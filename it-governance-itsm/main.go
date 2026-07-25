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
	"github.com/munisp/NGApp/it-governance-itsm/internal/handlers"
	"github.com/munisp/NGApp/it-governance-itsm/internal/service"
	"github.com/munisp/NGApp/it-governance-itsm/internal/store"
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
	kafkaBroker := os.Getenv("KAFKA_BROKER")
	if kafkaBroker == "" {
		kafkaBroker = "localhost:9092"
	}
	temporalAddr := os.Getenv("TEMPORAL_ADDR")
	if temporalAddr == "" {
		temporalAddr = "localhost:7233"
	}

	itsmService := service.NewITSMService(pgStore, redisAddr, kafkaBroker, temporalAddr, logger)
	go itsmService.StartSLAMonitor(ctx)

	r := gin.New()
	r.Use(gin.Recovery())

	h := handlers.NewHandler(itsmService, logger)

	// Change management (ITIL)
	r.GET("/itsm/changes", h.ListChanges)
	r.POST("/itsm/changes", h.CreateChange)
	r.GET("/itsm/changes/:id", h.GetChange)
	r.POST("/itsm/changes/:id/approve", h.ApproveChange)
	r.POST("/itsm/changes/:id/reject", h.RejectChange)
	r.POST("/itsm/changes/:id/implement", h.ImplementChange)

	// Incident management
	r.GET("/itsm/incidents", h.ListIncidents)
	r.POST("/itsm/incidents", h.CreateIncident)
	r.GET("/itsm/incidents/:id", h.GetIncident)
	r.POST("/itsm/incidents/:id/assign", h.AssignIncident)
	r.POST("/itsm/incidents/:id/resolve", h.ResolveIncident)
	r.POST("/itsm/incidents/:id/escalate", h.EscalateIncident)

	// Problem management
	r.GET("/itsm/problems", h.ListProblems)
	r.POST("/itsm/problems", h.CreateProblem)
	r.POST("/itsm/problems/:id/root-cause", h.AddRootCause)

	// SLA management
	r.GET("/itsm/sla/dashboard", h.GetSLADashboard)
	r.GET("/itsm/sla/breaches", h.GetSLABreaches)

	// IT Asset management (CMDB)
	r.GET("/itsm/assets", h.ListAssets)
	r.GET("/itsm/assets/:id", h.GetAsset)
	r.GET("/itsm/assets/:id/relationships", h.GetAssetRelationships)

	// Governance metrics
	r.GET("/itsm/governance/kpis", h.GetGovernanceKPIs)
	r.GET("/itsm/governance/maturity", h.GetMaturityAssessment)

	// CAB (Change Advisory Board)
	r.GET("/itsm/cab/schedule", h.GetCABSchedule)
	r.GET("/itsm/cab/pending", h.GetPendingChanges)

	r.GET("/health", h.HealthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8099"
	}

	srv := &http.Server{Addr: fmt.Sprintf(":%s", port), Handler: r}
	go func() {
		logger.Info("IT Governance/ITSM starting", zap.String("port", port))
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
