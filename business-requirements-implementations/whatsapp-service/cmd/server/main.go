package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"whatsapp-service/internal/api"
	"whatsapp-service/internal/repository"
	"whatsapp-service/internal/service"
	"whatsapp-service/internal/whatsapp"
	"whatsapp-service/pkg/config"
	"whatsapp-service/pkg/logger"
	"whatsapp-service/pkg/metrics"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.temporal.io/sdk/client"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize logger
	log := logger.New(cfg.LogLevel)

	// Initialize metrics
	metrics.Init()

	// Connect to PostgreSQL
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database", "error", err)
	}

	// Auto-migrate database schema
	if err := repository.AutoMigrate(db); err != nil {
		log.Fatal("Failed to migrate database", "error", err)
	}

	// Initialize Temporal client
	temporalClient, err := client.Dial(client.Options{
		HostPort: cfg.TemporalHostPort,
	})
	if err != nil {
		log.Fatal("Failed to create Temporal client", "error", err)
	}
	defer temporalClient.Close()

	// Initialize WhatsApp client
	whatsappClient := whatsapp.NewClient(cfg.WhatsAppAPIKey, cfg.WhatsAppPhoneNumberID, cfg.WhatsAppBusinessAccountID)

	// Initialize repository
	repo := repository.New(db)

	// Initialize service
	svc := service.New(repo, whatsappClient, temporalClient, log)

	// Start Temporal worker
	go func() {
		if err := service.StartWorker(temporalClient, svc, log); err != nil {
			log.Fatal("Failed to start Temporal worker", "error", err)
		}
	}()

	// Initialize Gin router
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API routes
	api.RegisterRoutes(router, svc, log)

	// Start HTTP server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Failed to start server", "error", err)
		}
	}()

	log.Info("WhatsApp service started", "port", cfg.Port)

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown", "error", err)
	}

	log.Info("Server exited")
}
