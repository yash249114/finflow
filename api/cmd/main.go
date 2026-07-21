// api/cmd/main.go
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/finflow/api/internal/aiops"
	"github.com/finflow/api/internal/config"
	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/handlers"
	"github.com/finflow/api/internal/middleware"
	ratelimit "github.com/finflow/api/internal/middleware"
	jwtService "github.com/finflow/api/internal/services/jwt"
	"github.com/finflow/api/internal/services/mlclient"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// ── Logging ──────────────────────────────────────────
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("APP_ENV") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	// ── Config ───────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("loading config")
	}

	// ── Database ─────────────────────────────────────────
	ctx := context.Background()
	pool, err := db.NewPostgresPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("connecting to PostgreSQL")
	}
	defer pool.Close()

	// ── Redis ────────────────────────────────────────────
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("parsing Redis URL")
	}
	rdb := redis.NewClient(redisOpts)
	defer rdb.Close()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatal().Err(err).Msg("connecting to Redis")
	}
	log.Info().Msg("Redis connection established")

	// ── Services ─────────────────────────────────────────
	jwtSvc := jwtService.NewService(cfg.JWTSecret, cfg.JWTAccessTTLMin, cfg.JWTRefreshTTLDays)
	mlClient := mlclient.NewClient(cfg.MLServiceURL, cfg.MLAPIKey)

	// ── AIOps (self-monitoring, self-healing) ───────────
	telemetry := aiops.NewPublisher(rdb, cfg.TelemetryStream, "api")
	telemetryPub = telemetry
	alerter := aiops.NewAlerter(aiops.AlertConfig{
		EmailFrom:   cfg.AlertEmailFrom,
		SMTPHost:    cfg.SMTPHost,
		SMTPPort:    cfg.SMTPPort,
		SMTPUser:    cfg.SMTPUser,
		SMTPPass:    cfg.SMTPPassword,
		EmailTo:     cfg.AlertEmailTo,
		GitHubToken: cfg.GitHubToken,
		GitHubOwner: cfg.GitHubOwner,
		GitHubRepo:  cfg.GitHubRepo,
		OwnerEmail:  cfg.AIOpsOwnerEmail,
	}, rdb, cfg.TelemetryStream+":reports")
	copilot := aiops.NewCopilot(cfg.OpenAIAPIKey, cfg.AnthropicAPIKey, cfg.GeminiAPIKey)
	aiopsWorker := aiops.NewWorker(rdb, cfg.TelemetryStream, cfg.TelemetryStream+":reports", telemetry, alerter)
	aiopsWorker.Start(ctx)

	// Dependency monitoring: periodically probe Redis, Postgres, and ML service.
	go monitorDependencies(ctx, rdb, pool, cfg.MLServiceURL, telemetry)

	// ── Repositories ─────────────────────────────────────
	userRepo := db.NewUserRepo(pool)
	txRepo := db.NewTransactionRepo(pool)

	// ── Handlers ─────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(userRepo, jwtSvc, cfg.AppEnv)
	uploadHandler := handlers.NewUploadHandler(txRepo, userRepo, mlClient, rdb)
	txHandler := handlers.NewTransactionHandler(txRepo)
	forecastHandler := handlers.NewForecastHandler(txRepo, mlClient, rdb)
	billingHandler := handlers.NewBillingHandler(userRepo, cfg.LemonSqueezyAPIKey, cfg.LemonSqueezyStoreID, cfg.LemonSqueezyVariantID, cfg.LemonSqueezyWebhookSecret, cfg.FrontendURL)
	aiChatHandler := handlers.NewAIChatHandler(copilot, alerter)

	// ── Router ───────────────────────────────────────────
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Global middleware stack (order matters)
	r.Use(gin.Recovery())
	r.Use(requestLogger())
	r.Use(middleware.SecurityHeaders())
	r.Use(func(c *gin.Context) { c.Set("redis", rdb); c.Next() })
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	r.Use(ratelimit.RateLimit(cfg.RedisURL))

	// ── Health ───────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"service":  "finflow-api",
			"time":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	// ── Auth routes (no middleware) ──────────────────────
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.Refresh)
		auth.POST("/logout", authHandler.Logout)
	}

	// ── Billing webhook (Stripe signature, no JWT) ──────
	r.POST("/api/v1/billing/webhook", billingHandler.Webhook)

	// ── AIOps self-monitoring (rate-limited, no auth required) ─
	r.GET("/api/aiops/health", func(c *gin.Context) {
		h := aiopsWorker.Health()
		c.JSON(http.StatusOK, gin.H{
			"score":      h.Score,
			"status":     h.Status,
			"components": h.Components,
			"computed_at": h.ComputedAt,
		})
	})

	// ── Authenticated routes ──────────────────────────────
	protected := r.Group("/api/v1")
	protected.Use(middleware.Auth(jwtSvc, userRepo))
	protected.Use(middleware.CSRF(cfg.FrontendURL))
	{
		// User
		protected.GET("/auth/me", authHandler.Me)

		// AI Copilot (tiered auth, all plans supported)
		protected.POST("/ai/chat", aiChatHandler.Chat)

		// Transactions
		protected.POST("/transactions/upload", uploadHandler.Upload)
		protected.POST("/transactions/upload/start", uploadHandler.StartUpload)
		protected.POST("/transactions/upload/chunk", uploadHandler.UploadChunk)
		protected.GET("/transactions/upload/status", uploadHandler.UploadStatus)
		protected.GET("/transactions", txHandler.List)
		protected.GET("/transactions/summary", txHandler.Summary)

		// Forecast (pro plan required)
		forecast := protected.Group("/forecast")
		forecast.Use(middleware.RequirePro())
		{
			forecast.GET("", forecastHandler.GetForecast)
		}

		// Billing
		protected.POST("/billing/create-checkout", billingHandler.CreateCheckout)
		protected.POST("/billing/portal", billingHandler.CreatePortal)
	}

	// ── Start server ─────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("port", cfg.Port).Msg("FinFlow API starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	// ── Graceful shutdown ────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down server...")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutCtx); err != nil {
		log.Fatal().Err(err).Msg("server forced shutdown")
	}

	log.Info().Msg("server exited cleanly")
}

// telemetryPub is the package-level telemetry publisher used by middleware.
var telemetryPub *aiops.Publisher

// requestLogger is a structured JSON request logging middleware.
func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)

		event := log.Info()
		if c.Writer.Status() >= 500 {
			event = log.Error()
		}

		userID, _ := c.Get("user_id")
		event.
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("latency", latency).
			Interface("user_id", userID).
			Msg("request")

		// Best-effort AIOps telemetry (dependency-tagged for RCA).
		status := "ok"
		if c.Writer.Status() >= 500 {
			status = "error"
		} else if c.Writer.Status() >= 400 {
			status = "degraded"
		}
		meta := map[string]string{"type": "internal"}
		if c.Writer.Status() == 502 || c.Writer.Status() == 503 {
			meta["type"] = "dependency"
		}
		telemetryPub.EmitRequest(c.Request.Context(), c.Request.URL.Path, status, float64(latency.Milliseconds()), nil, meta)
	}
}

// monitorDependencies probes Redis, Postgres, and the ML service on an interval,
// emitting dependency-tagged telemetry so the AIOps worker can detect outages
// and auto-retry (self-healing) downstream calls.
func monitorDependencies(ctx context.Context, rdb *redis.Client, pool interface {
	Ping(context.Context) error
}, mlURL string, telemetry *aiops.Publisher) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	probe := func() {
		// Redis
		start := time.Now()
		if err := rdb.Ping(ctx).Err(); err != nil {
			telemetry.EmitRequest(ctx, "redis", "error", float64(time.Since(start).Milliseconds()), err, map[string]string{"type": "dependency"})
		} else {
			telemetry.EmitRequest(ctx, "redis", "ok", float64(time.Since(start).Milliseconds()), nil, map[string]string{"type": "dependency"})
		}
		// Postgres
		start = time.Now()
		if err := pool.Ping(ctx); err != nil {
			telemetry.EmitRequest(ctx, "postgres", "error", float64(time.Since(start).Milliseconds()), err, map[string]string{"type": "dependency"})
		} else {
			telemetry.EmitRequest(ctx, "postgres", "ok", float64(time.Since(start).Milliseconds()), nil, map[string]string{"type": "dependency"})
		}
		// ML service
		start = time.Now()
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, mlURL+"/health", nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			telemetry.EmitRequest(ctx, "ml-service", "error", float64(time.Since(start).Milliseconds()), err, map[string]string{"type": "dependency"})
		} else {
			resp.Body.Close()
			st := "ok"
			if resp.StatusCode >= 500 {
				st = "error"
			}
			telemetry.EmitRequest(ctx, "ml-service", st, float64(time.Since(start).Milliseconds()), nil, map[string]string{"type": "dependency"})
		}

		// ML model signals (drift + confidence) for AIOps self-monitoring.
		start = time.Now()
		mreq, _ := http.NewRequestWithContext(ctx, http.MethodGet, mlURL+"/metrics", nil)
		mresp, merr := http.DefaultClient.Do(mreq)
		if merr == nil {
			defer mresp.Body.Close()
			var md struct {
				DriftScore      float64 `json:"drift_score"`
				ConfidenceScore float64 `json:"confidence_score"`
			}
			if json.NewDecoder(mresp.Body).Decode(&md) == nil {
				telemetry.Emit(ctx, aiops.TelemetryEvent{
					Kind:       "model",
					Operation:  "drift",
					Status:     "ok",
					LatencyMs:  float64(time.Since(start).Milliseconds()),
					DriftScore: md.DriftScore,
					Confidence: md.ConfidenceScore,
					Meta:       map[string]string{"type": "model"},
				})
			}
		}
	}
	probe()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			probe()
		}
	}
}
