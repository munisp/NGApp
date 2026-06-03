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
	"github.com/munisp/NGApp/disaster-recovery-module/internal/handlers"
	"github.com/munisp/NGApp/disaster-recovery-module/internal/health"
	"github.com/munisp/NGApp/disaster-recovery-module/internal/service"
	"github.com/munisp/NGApp/disaster-recovery-module/internal/store"
	"github.com/munisp/NGApp/disaster-recovery-module/internal/workflows"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pgStore, err := store.NewPostgresStore(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pgStore.Close()

	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	kafkaBroker := os.Getenv("KAFKA_BROKER")
	if kafkaBroker == "" {
		kafkaBroker = "localhost:9092"
	}

	drService := service.NewDRService(pgStore, redisAddr, kafkaBroker, logger)
	healthChecker := health.NewChecker(pgStore, redisAddr, kafkaBroker, logger)
	workflowEngine := workflows.NewFailoverWorkflow(drService, logger)

	go drService.StartHealthMonitor(ctx)
	go workflowEngine.RegisterWithTemporal(ctx)

	r := gin.New()
	r.Use(gin.Recovery())

	h := handlers.NewHandler(drService, healthChecker, workflowEngine, logger)

	// Health endpoints (deep checks for NAICOM compliance)
	r.GET("/health", h.HealthCheck)
	r.GET("/health/deep", h.DeepHealthCheck)
	r.GET("/health/dependencies", h.DependencyCheck)

	// DR operations
	r.POST("/dr/failover/initiate", h.InitiateFailover)
	r.POST("/dr/failover/rollback", h.RollbackFailover)
	r.GET("/dr/status", h.GetDRStatus)
	r.GET("/dr/rto-rpo", h.GetRTORPO)
	r.POST("/dr/test", h.TriggerDRTest)
	r.GET("/dr/test/history", h.GetTestHistory)

	// BCP endpoints
	r.GET("/bcp/plan", h.GetBCPPlan)
	r.POST("/bcp/activate", h.ActivateBCP)
	r.GET("/bcp/runbook", h.GetRunbook)

	// NAICOM reporting
	r.GET("/naicom/bcp-report", h.GenerateNAICOMBCPReport)
	r.GET("/naicom/incident-log", h.GetIncidentLog)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: r,
	}

	go func() {
		logger.Info("DR/BCP service starting", zap.String("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
	logger.Info("DR/BCP service stopped")
}
