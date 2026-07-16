// api/internal/middleware/rate_limit.go
package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
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

	// Prune expired slots
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

func RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := parseIP(c.Request.RemoteAddr)
		if !globalRateLimiter.Allow(ip) {
			log.Warn().Str("ip", ip).Str("path", c.Request.URL.Path).Msg("rate limit exceeded")
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded. Try again later.",
			})
			return
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
