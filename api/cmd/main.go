// api/cmd/main.go
package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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
	mlClient := mlclient.NewClient(cfg.MLServiceURL)

	// ── Repositories ─────────────────────────────────────
	userRepo := db.NewUserRepo(pool)
	txRepo := db.NewTransactionRepo(pool)

	// ── Handlers ─────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(userRepo, jwtSvc, cfg.AppEnv)
	uploadHandler := handlers.NewUploadHandler(txRepo, userRepo, mlClient, rdb)
	txHandler := handlers.NewTransactionHandler(txRepo)
	forecastHandler := handlers.NewForecastHandler(txRepo, mlClient, rdb)
	billingHandler := handlers.NewBillingHandler(userRepo, cfg.LemonSqueezyAPIKey, cfg.LemonSqueezyStoreID, cfg.LemonSqueezyVariantID, cfg.LemonSqueezyWebhookSecret, cfg.FrontendURL)

	// ── Router ───────────────────────────────────────────
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Request logging middleware
	r.Use(gin.Recovery())
	r.Use(requestLogger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	r.Use(ratelimit.RateLimit())

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

	// ── Protected routes ─────────────────────────────────
	protected := r.Group("/api/v1")
	protected.Use(middleware.Auth(jwtSvc, userRepo))
	{
		// User
		protected.GET("/auth/me", authHandler.Me)

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
	}
}
