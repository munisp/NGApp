package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"claims-reserve-service/config"
	"claims-reserve-service/pkg/log"
	"claims-reserve-service/pkg/metrics"

	"github.com/gin-gonic/gin"
	"go.temporal.io/sdk/client"
	"go.uber.org/zap"
)

func main() {
	// 1. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize Logger
	log.InitLogger(cfg.Log.Level)
	defer log.Sync()
	log.L().Info("Starting Claims Reserve API Service")

	// 3. Initialize Metrics
	m := metrics.NewMetrics()
	metrics.StartMetricsServer(cfg.Metrics.Port)
	log.L().Info("Metrics server started", zap.Int("port", cfg.Metrics.Port))

	// 4. Initialize Temporal Client
	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.Temporal.HostPort,
		Namespace: cfg.Temporal.Namespace,
	})
	if err != nil {
		log.L().Fatal("Unable to create Temporal client", zap.Error(err))
	}
	defer temporalClient.Close()
	log.L().Info("Temporal client connected", zap.String("hostPort", cfg.Temporal.HostPort))

	// 5. Initialize HTTP Server (Gin)
	router := gin.Default()
	handler := NewHandler(temporalClient)

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API routes
	api := router.Group("/api/v1")
	{
		api.POST("/claims/reserve/trigger", handler.TriggerReserveCalculation)
		api.POST("/ibnr/trigger", handler.TriggerIBNRCalculation)
	}

	// 6. Start Server
	serverAddr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{
		Addr:    serverAddr,
		Handler: router,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.L().Info("Starting HTTP server", zap.String("address", serverAddr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.L().Fatal("HTTP server failed", zap.Error(err))
		}
	}()

	<-quit
	log.L().Info("Shutting down server...")
}
