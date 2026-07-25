package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/api-marketplace/internal/handlers"
	"github.com/munisp/NGApp/api-marketplace/internal/service"
	"github.com/munisp/NGApp/api-marketplace/internal/store"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pgStore, err := store.NewStore(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pgStore.Close()

	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	apisixAdmin := os.Getenv("APISIX_ADMIN_URL")
	if apisixAdmin == "" {
		apisixAdmin = "http://localhost:9180"
	}
	tigerbeetleAddr := os.Getenv("TIGERBEETLE_ADDR")
	if tigerbeetleAddr == "" {
		tigerbeetleAddr = "localhost:3000"
	}

	mktService := service.NewMarketplaceService(pgStore, redisAddr, apisixAdmin, tigerbeetleAddr, logger)
	h := handlers.NewHandler(mktService, logger)

	r := gin.New()
	r.Use(gin.Recovery())

	// API Products
	r.GET("/marketplace/products", h.ListProducts)
	r.GET("/marketplace/products/:id", h.GetProduct)
	r.POST("/marketplace/products", h.CreateProduct)

	// Developer management
	r.POST("/marketplace/developers/register", h.RegisterDeveloper)
	r.GET("/marketplace/developers/:id", h.GetDeveloper)
	r.GET("/marketplace/developers/:id/usage", h.GetDeveloperUsage)

	// API keys
	r.POST("/marketplace/keys", h.CreateAPIKey)
	r.GET("/marketplace/keys", h.ListAPIKeys)
	r.DELETE("/marketplace/keys/:id", h.RevokeAPIKey)

	// Subscriptions
	r.POST("/marketplace/subscriptions", h.Subscribe)
	r.GET("/marketplace/subscriptions", h.ListSubscriptions)

	// Usage & billing (TigerBeetle)
	r.GET("/marketplace/billing/usage", h.GetUsageReport)
	r.GET("/marketplace/billing/invoices", h.ListInvoices)

	// Documentation
	r.GET("/marketplace/docs/:product_id", h.GetAPIDocumentation)

	// Analytics
	r.GET("/marketplace/analytics/popular", h.GetPopularAPIs)
	r.GET("/marketplace/analytics/latency", h.GetLatencyMetrics)

	r.GET("/health", h.HealthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8097"
	}

	srv := &http.Server{Addr: fmt.Sprintf(":%s", port), Handler: r}
	go func() {
		logger.Info("API Marketplace starting", zap.String("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	shutdownCtx, _ := context.WithTimeout(context.Background(), 30*time.Second)
	srv.Shutdown(shutdownCtx)
}
