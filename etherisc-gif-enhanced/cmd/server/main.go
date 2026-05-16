package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/etherisc/treaty-reinsurance-service/internal/api"
	"github.com/etherisc/treaty-reinsurance-service/internal/repository"
	"github.com/etherisc/treaty-reinsurance-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
)

// Config holds the application configuration
type Config struct {
	Port     string
	DB_DSN   string
	LogLevel string
}

func loadConfig() *Config {
	return &Config{
		Port:     os.Getenv("PORT"),
		DB_DSN:   os.Getenv("DB_DSN"),
		LogLevel: os.Getenv("LOG_LEVEL"),
	}
}

func setupLogger(level string) *logrus.Logger {
	log := logrus.New()
	log.SetFormatter(&logrus.JSONFormatter{})
	log.SetOutput(os.Stdout)

	logLevel, err := logrus.ParseLevel(level)
	if err != nil {
		logLevel = logrus.InfoLevel
	}
	log.SetLevel(logLevel)
	return log
}

func main() {
	cfg := loadConfig()
	log := setupLogger(cfg.LogLevel)

	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.DB_DSN == "" {
		// Default DSN for local testing/development
		cfg.DB_DSN = "host=localhost user=postgres password=postgres dbname=treaty_reinsurance sslmode=disable"
	}

	// 1. Initialize Repository
	repo, err := repository.NewPostgresRepository(cfg.DB_DSN)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run migrations
	if err := repo.Migrate(context.Background()); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Info("Database migrations completed successfully")

	// 2. Initialize Service
	treatyService := service.NewTreatyService(repo, log)

	// 3. Initialize API Handler and Router
	handler := api.NewHandler(treatyService, log)
	router := gin.New()
	router.Use(gin.Recovery()) // Use gin's recovery middleware for structured logging of panics

	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))
	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "UP"})
	})

	handler.RegisterRoutes(router)

	// 4. Start Server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	// Initializing the server in a goroutine so that it won't block the graceful shutdown handling
	go func() {
		log.Infof("Server listening on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// 5. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Info("Server exiting")
}
