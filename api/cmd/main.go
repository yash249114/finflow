// api/cmd/main.go
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/finflow/api/internal/aiops"
	"github.com/finflow/api/internal/analytics"
	"github.com/finflow/api/internal/business"
	"github.com/finflow/api/internal/config"
	"github.com/finflow/api/internal/costing"
	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/entitlements"
	"github.com/finflow/api/internal/experiment"
	"github.com/finflow/api/internal/handlers"
	limSvc "github.com/finflow/api/internal/limits"
	"github.com/finflow/api/internal/middleware"
	"github.com/finflow/api/internal/recommendations"
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
	rdb, err := db.ConnectRedis(ctx, cfg.RedisURL)
	if err != nil {
		log.Warn().Err(err).Msg("Redis unavailable — continuing without cache")
	} else {
		log.Info().Msg("Redis connection established")
		defer rdb.Close()
	}

	// ── Background context (cancelled on shutdown) ───────
	bgCtx, bgCancel := context.WithCancel(ctx)
	defer bgCancel()

	// ── Services ─────────────────────────────────────────
	jwtSvc := jwtService.NewService(cfg.JWTSecret, cfg.JWTAccessTTLMin, cfg.JWTRefreshTTLDays)
	mlClient := mlclient.NewClient(cfg.MLServiceURL, cfg.MLAPIKey)

	// ── AIOps (self-monitoring, self-healing) ───────────
	telemetry := aiops.NewPublisher(rdb, cfg.TelemetryStream, "api")
	telemetryPub = telemetry
	alerter := aiops.NewAlerter(aiops.AlertConfig{
		EmailFrom:    cfg.AlertEmailFrom,
		SMTPHost:     cfg.SMTPHost,
		SMTPPort:     cfg.SMTPPort,
		SMTPUser:     cfg.SMTPUser,
		SMTPPass:     cfg.SMTPPassword,
		EmailTo:      cfg.AlertEmailTo,
		GitHubToken:  cfg.GitHubToken,
		GitHubOwner:  cfg.GitHubOwner,
		GitHubRepo:   cfg.GitHubRepo,
		OwnerEmail:   cfg.AIOpsOwnerEmail,
		Web3FormsKey: cfg.Web3FormsKey,
	}, rdb, cfg.TelemetryStream+":reports")
	copilot := aiops.NewCopilot(cfg.OpenAIAPIKey, cfg.AnthropicAPIKey, cfg.GeminiAPIKey)
	aiopsWorker := aiops.NewWorker(rdb, cfg.TelemetryStream, cfg.TelemetryStream+":reports", telemetry, alerter)
	if rdb != nil {
		aiopsWorker.Start(bgCtx)
	} else {
		log.Warn().Msg("AIOps worker disabled — Redis unavailable")
	}

	// Dependency monitoring: periodically probe Postgres and ML service.
	go monitorDependencies(bgCtx, rdb, pool, cfg.MLServiceURL, telemetry)

	// ── Repositories ─────────────────────────────────────
	userRepo := db.NewUserRepo(pool)
	txRepo := db.NewTransactionRepo(pool)

	// ── AI Product Layer: Entitlements Engine ────────────
	entEngine := entitlements.NewEngine(pool, rdb)
	if err := entEngine.Start(ctx); err != nil {
		log.Warn().Err(err).Msg("Entitlement engine started in degraded mode — feature catalog will load when migrations complete")
	} else {
		log.Info().Msg("Entitlement engine fully initialized")
	}
	defer entEngine.Stop()

	// Quota refresh background worker
	quotaRefresher := entitlements.NewQuotaRefresher(entEngine, time.Duration(cfg.QuotaRefreshMinutes)*time.Minute)
	go quotaRefresher.Start(bgCtx)
	defer quotaRefresher.Stop()

	// ── Business Intelligence & Analytics Layer ──────────
	eventStore := analytics.NewEventStore(pool, rdb)
	configStore := analytics.NewConfigStore(pool)
	growthService := business.NewGrowthService(pool)
	revenueService := business.NewRevenueService(pool)
	retentionService := business.NewRetentionService(pool)
	forecastAccService := business.NewForecastAccuracyService(pool)
	costTracker := costing.NewCostTracker(pool, rdb)
	costOptimizer := costing.NewOptimizer(configStore)
	experimentService := experiment.NewService(pool)
	limitService := limSvc.NewService(pool, rdb, configStore, eventStore)
	recEngine := recommendations.NewEngine(pool, configStore)

	// ── Handlers ─────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(userRepo, jwtSvc, cfg.AppEnv)
	uploadHandler := handlers.NewUploadHandler(txRepo, userRepo, mlClient, rdb)
	txHandler := handlers.NewTransactionHandler(txRepo)
	forecastHandler := handlers.NewForecastHandler(txRepo, mlClient, rdb)
	billingHandler := handlers.NewBillingHandler(userRepo, cfg.LemonSqueezyAPIKey, cfg.LemonSqueezyStoreID, cfg.LemonSqueezyVariantID, cfg.LemonSqueezyWebhookSecret, cfg.FrontendURL)
	aiChatHandler := handlers.NewAIChatHandler(copilot, alerter)
	recommendationsHandler := handlers.NewRecommendationsHandler(txRepo)
	entitlementHandler := handlers.NewEntitlementHandler(entEngine)
	analyticsHandler := handlers.NewAnalyticsHandler(
		eventStore, configStore, growthService, revenueService,
		retentionService, forecastAccService, costTracker, costOptimizer,
		experimentService, limitService, recEngine,
	)

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
	r.Use(func(c *gin.Context) { c.Set("entitlement_engine", entEngine); c.Next() })
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	r.Use(middleware.RateLimit(cfg.RedisURL))

	// ── Health ───────────────────────────────────────────
	r.GET("/health", healthHandler(pool, rdb, cfg.MLServiceURL, entEngine, cfg))
	r.GET("/api/v1/health", healthHandler(pool, rdb, cfg.MLServiceURL, entEngine, cfg))

	// ── Auth routes (no middleware) ──────────────────────
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.Refresh)
		auth.POST("/logout", authHandler.Logout)
	}

	// ── Billing webhook (no JWT) ───────────────────────
	if cfg.BillingEnabled() {
		r.POST("/api/v1/billing/webhook", billingHandler.Webhook)
	}

	// ── AIOps self-monitoring (rate-limited, no auth required) ─
	r.GET("/api/aiops/health", func(c *gin.Context) {
		h := aiopsWorker.Health()
		c.JSON(http.StatusOK, gin.H{
			"score":       h.Score,
			"status":      h.Status,
			"components":  h.Components,
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

		// AI Recommendations (proactive financial suggestions)
		protected.GET("/ai/recommendations", recommendationsHandler.GetRecommendations)

		// Transactions
		protected.POST("/transactions/upload", uploadHandler.Upload)
		protected.POST("/transactions/upload/start", uploadHandler.StartUpload)
		protected.POST("/transactions/upload/chunk", uploadHandler.UploadChunk)
		protected.GET("/transactions/upload/status", uploadHandler.UploadStatus)
		protected.GET("/transactions", txHandler.List)
		protected.GET("/transactions/summary", txHandler.Summary)

		// Billing (only registered when LemonSqueezy keys are present)
		if cfg.BillingEnabled() {
			protected.POST("/billing/create-checkout", billingHandler.CreateCheckout)
			protected.POST("/billing/portal", billingHandler.CreatePortal)
		}

		// AI Product Layer: Entitlements & Usage
		protected.GET("/entitlements", entitlementHandler.GetMyEntitlements)
		protected.GET("/entitlements/features", entitlementHandler.ListFeatures)
		protected.GET("/entitlements/tiers", entitlementHandler.ListTiers)
		protected.GET("/entitlements/usage/:feature", entitlementHandler.GetMyUsage)
		protected.GET("/entitlements/upgrade", entitlementHandler.GetUpgradeRecommendation)

		// Forecast (feature-gated via entitlement engine)
		forecast := protected.Group("/forecast")
		forecast.Use(middleware.FeatureGate("cash_flow_forecast"))
		{
			forecast.GET("", forecastHandler.GetForecast)
			forecast.GET("/quality", forecastHandler.GetForecastQuality)
		}

		// ── Business Intelligence & Analytics ──────────────
		analytics := protected.Group("/analytics")
		{
			// Feature tracking
			analytics.POST("/events", analyticsHandler.TrackEvent)
			analytics.GET("/features/usage", analyticsHandler.GetFeatureUsage)
			analytics.GET("/features/usage/daily", analyticsHandler.GetFeatureUsageDaily)

			// Growth
			analytics.GET("/growth", analyticsHandler.GetGrowthMetrics)
			analytics.GET("/growth/dau", analyticsHandler.GetDAU)

			// Revenue
			analytics.GET("/revenue", analyticsHandler.GetRevenueMetrics)
			analytics.GET("/revenue/funnel", analyticsHandler.GetConversionFunnel)
			analytics.GET("/revenue/triggers", analyticsHandler.GetUpgradeTriggers)

			// Retention
			analytics.GET("/retention/cohorts", analyticsHandler.GetRetentionCohorts)
			analytics.GET("/retention/churn", analyticsHandler.GetChurnMetrics)
			analytics.GET("/retention/adoption", analyticsHandler.GetFeatureAdoption)

			// Forecast accuracy
			analytics.GET("/forecast/accuracy", analyticsHandler.GetForecastAccuracy)

			// Cost monitoring
			analytics.GET("/costs", analyticsHandler.GetCostSummary)
			analytics.GET("/costs/daily", analyticsHandler.GetCostByDay)
			analytics.GET("/costs/optimizations", analyticsHandler.GetCostOptimizations)
			analytics.GET("/costs/top-users", analyticsHandler.GetTopCostUsers)

			// Experiments
			analytics.GET("/experiments", analyticsHandler.ListExperiments)
			analytics.POST("/experiments", analyticsHandler.CreateExperiment)
			analytics.GET("/experiments/:id/results", analyticsHandler.GetExperimentResults)

			// Usage summary
			analytics.GET("/usage", analyticsHandler.GetUserUsageSummary)

			// Automated recommendations
			analytics.GET("/recommendations", analyticsHandler.GetRecommendations)
			analytics.POST("/recommendations/apply", analyticsHandler.ApplyRecommendation)

			// Business config
			analytics.GET("/config", analyticsHandler.GetConfig)
			analytics.PUT("/config", analyticsHandler.UpdateConfig)
		}
	}

	// Public entitlement endpoints (no auth)
	r.GET("/api/v1/features", entitlementHandler.ListFeatures)
	r.GET("/api/v1/tiers", entitlementHandler.ListTiers)

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
	bgCancel() // stop background workers
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
		if telemetryPub != nil {
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
}

// monitorDependencies probes Redis, Postgres, and the ML service on an interval,
// emitting dependency-tagged telemetry so the AIOps worker can detect outages
// and auto-retry (self-healing) downstream calls.
func monitorDependencies(ctx context.Context, rdb *redis.Client, pool interface {
	Ping(context.Context) error
}, mlURL string, telemetry *aiops.Publisher) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	client := &http.Client{Timeout: 10 * time.Second}
	probe := func() {
		// Redis (nil-safe)
		start := time.Now()
		if rdb != nil {
			if err := rdb.Ping(ctx).Err(); err != nil {
				telemetry.EmitRequest(ctx, "redis", "error", float64(time.Since(start).Milliseconds()), err, map[string]string{"type": "dependency"})
			} else {
				telemetry.EmitRequest(ctx, "redis", "ok", float64(time.Since(start).Milliseconds()), nil, map[string]string{"type": "dependency"})
			}
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
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, mlURL+"/health", nil)
		if err != nil {
			telemetry.EmitRequest(ctx, "ml-service", "error", float64(time.Since(start).Milliseconds()), err, map[string]string{"type": "dependency"})
		} else if resp, err := client.Do(req); err != nil {
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
		mreq, err := http.NewRequestWithContext(ctx, http.MethodGet, mlURL+"/metrics", nil)
		if err == nil {
			if mresp, merr := client.Do(mreq); merr == nil {
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

// healthHandler returns a gin handler that reports the status of each dependency.
// Covers all 7 external integrations: postgres, redis, ml, billing, email, llm, captcha.
func healthHandler(pool interface{ Ping(context.Context) error }, rdb *redis.Client, mlURL string, entEngine *entitlements.Engine, cfg *config.Config) gin.HandlerFunc {
	mlClient := &http.Client{Timeout: 5 * time.Second}
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()

		status := "ok"
		components := map[string]string{}

		// PostgreSQL
		if err := pool.Ping(ctx); err != nil {
			components["postgres"] = "unavailable"
			status = "degraded"
		} else {
			components["postgres"] = "ok"
		}

		// Redis (nil-safe)
		if rdb == nil {
			components["redis"] = "not_configured"
		} else if err := rdb.Ping(ctx).Err(); err != nil {
			components["redis"] = "unavailable"
			if status == "ok" {
				status = "degraded"
			}
		} else {
			components["redis"] = "ok"
		}

		// Entitlement engine
		if entEngine != nil {
			if entEngine.Healthy() {
				components["entitlements"] = "ok"
			} else {
				components["entitlements"] = "degraded"
				if status == "ok" {
					status = "degraded"
				}
			}
		}

		// ML service
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, mlURL+"/health", nil)
		if err != nil {
			components["ml"] = "unknown"
		} else if resp, err := mlClient.Do(req); err != nil {
			components["ml"] = "unavailable"
			if status == "ok" {
				status = "degraded"
			}
		} else {
			resp.Body.Close()
			if resp.StatusCode >= 500 {
				components["ml"] = "unavailable"
				if status == "ok" {
					status = "degraded"
				}
			} else {
				components["ml"] = "ok"
			}
		}

		// Billing (LemonSqueezy)
		if cfg.LemonSqueezyAPIKey != "" {
			components["billing"] = "configured"
		} else {
			components["billing"] = "not_configured"
		}

		// Email (SMTP / Resend)
		if cfg.SMTPHost != "" {
			components["email"] = "configured"
		} else {
			components["email"] = "not_configured"
		}

		// LLM providers
		llmProviders := []string{}
		if cfg.OpenAIAPIKey != "" {
			llmProviders = append(llmProviders, "openai")
		}
		if cfg.AnthropicAPIKey != "" {
			llmProviders = append(llmProviders, "anthropic")
		}
		if cfg.GeminiAPIKey != "" {
			llmProviders = append(llmProviders, "gemini")
		}
		if len(llmProviders) > 0 {
			components["llm"] = strings.Join(llmProviders, ",")
		} else {
			components["llm"] = "not_configured"
		}

		// reCAPTCHA
		if cfg.RecaptchaSecretKey != "" {
			components["captcha"] = "configured"
		} else {
			components["captcha"] = "not_configured"
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     status,
			"service":    "finflow-api",
			"time":       time.Now().UTC().Format(time.RFC3339),
			"components": components,
		})
	}
}
