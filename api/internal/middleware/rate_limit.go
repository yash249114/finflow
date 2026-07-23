package middleware

import (
	"context"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

type visitor struct {
	limiter  *rateLimiter
	lastSeen time.Time
}

type rateLimiter struct {
	mu       sync.Mutex
	slots    []time.Time
	interval time.Duration
	max      int
}

func newRateLimiter(max int, interval time.Duration) *rateLimiter {
	return &rateLimiter{
		slots:    make([]time.Time, 0, max),
		interval: interval,
		max:      max,
	}
}

func (rl *rateLimiter) allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.interval)

	firstValid := 0
	for i, t := range rl.slots {
		if t.After(cutoff) {
			firstValid = i
			break
		}
		firstValid = i + 1
	}
	rl.slots = rl.slots[firstValid:]

	if len(rl.slots) >= rl.max {
		return false
	}

	rl.slots = append(rl.slots, now)
	return true
}

type IPRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	max      int
	interval time.Duration
	ttl      time.Duration
	stopCh   chan struct{}
}

func NewIPRateLimiter(max int, interval, ttl time.Duration) *IPRateLimiter {
	rl := &IPRateLimiter{
		visitors: make(map[string]*visitor),
		max:      max,
		interval: interval,
		ttl:      ttl,
		stopCh:   make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *IPRateLimiter) Stop() {
	close(rl.stopCh)
}

func (rl *IPRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			now := time.Now()
			for ip, v := range rl.visitors {
				if now.Sub(v.lastSeen) > rl.ttl {
					delete(rl.visitors, ip)
				}
			}
			rl.mu.Unlock()
		case <-rl.stopCh:
			return
		}
	}
}

func (rl *IPRateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	v, exists := rl.visitors[ip]
	if !exists {
		v = &visitor{
			limiter: newRateLimiter(rl.max, rl.interval),
		}
		rl.visitors[ip] = v
	}
	v.lastSeen = time.Now()
	rl.mu.Unlock()

	return v.limiter.allow()
}

var globalRateLimiter = NewIPRateLimiter(100, 1*time.Minute, 30*time.Minute)

// redis-backed rate limiting for distributed deployments.
type RedisRateLimiter struct {
	client   *redis.Client
	max      int
	interval time.Duration
}

func NewRedisRateLimiter(redisURL string, max int, interval time.Duration) (*RedisRateLimiter, error) {
	if redisURL == "" {
		return nil, nil
	}
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opts)
	return &RedisRateLimiter{client: client, max: max, interval: interval}, nil
}

func (r *RedisRateLimiter) Allow(key string) bool {
	if r == nil || r.client == nil {
		return true
	}
	ctx := context.Background()
	window := int64(r.interval.Seconds())
	now := time.Now().Unix()
	// Sliding window using sorted set — purge old entries, count current.
	r.client.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(now-window, 10))
	count, err := r.client.ZCard(ctx, key).Result()
	if err != nil {
		return true
	}
	if int(count) >= r.max {
		return false
	}
	r.client.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: now})
	r.client.Expire(ctx, key, r.interval)
	return true
}

func RateLimit(redisURL string) gin.HandlerFunc {
	redisRL, err := NewRedisRateLimiter(redisURL, 100, 1*time.Minute)
	if err != nil {
		log.Warn().Err(err).Msg("Redis rate limiter disabled, falling back to in-memory")
	}

	return func(c *gin.Context) {
		ip := parseIP(c.Request.RemoteAddr)
		key := "ratelimit:" + ip

		if redisRL != nil {
			if !redisRL.Allow(key) {
				log.Warn().Str("ip", ip).Str("path", c.Request.URL.Path).Msg("rate limit exceeded (redis)")
				c.Header("Retry-After", "60")
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error": "rate limit exceeded. Try again later.",
				})
				return
			}
		} else if !globalRateLimiter.Allow(ip) {
			log.Warn().Str("ip", ip).Str("path", c.Request.URL.Path).Msg("rate limit exceeded (memory)")
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded. Try again later.",
			})
			return
		}

		// Endpoint-specific stricter limits
		path := c.Request.URL.Path
		method := c.Request.Method
		if method == "POST" && (path == "/api/v1/auth/login" || strings.HasPrefix(path, "/api/v1/auth/register")) {
			if !globalRateLimiter.Allow(ip + ":auth") {
				c.Header("Retry-After", "60")
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error": "too many authentication attempts. Try again later.",
				})
				return
			}
		}
		// Stricter limit for AI chat (cost exposure prevention)
		if method == "POST" && path == "/api/ai/chat" {
			chatKey := key + ":chat"
			if redisRL != nil {
				if !redisRL.Allow(chatKey) {
					c.Header("Retry-After", "60")
					c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
						"error": "AI chat rate limit exceeded. Try again later.",
					})
					return
				}
			} else if !globalRateLimiter.Allow(ip + ":chat") {
				c.Header("Retry-After", "60")
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error": "AI chat rate limit exceeded. Try again later.",
				})
				return
			}
		}

		c.Next()
	}
}

func parseIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}

func CSRF(allowedOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = c.GetHeader("Referer")
		}
		if origin == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "origin or referer header required for state-changing requests"})
			return
		}
		allowedOrigins := strings.Split(allowedOrigin, ",")
		for _, o := range allowedOrigins {
			if strings.TrimSpace(o) == origin {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "cross-site request forbidden"})
	}
}
