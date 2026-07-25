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
	"github.com/munisp/NGApp/naicom-compliance-module/internal/engine"
	"github.com/munisp/NGApp/naicom-compliance-module/internal/handlers"
	"github.com/munisp/NGApp/naicom-compliance-module/internal/store"
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

	kafkaBroker := os.Getenv("KAFKA_BROKER")
	if kafkaBroker == "" {
		kafkaBroker = "localhost:9092"
	}

	opensearchURL := os.Getenv("OPENSEARCH_URL")
	if opensearchURL == "" {
		opensearchURL = "http://localhost:9200"
	}

	reportingEngine := engine.NewReportingEngine(pgStore, kafkaBroker, opensearchURL, logger)
	go reportingEngine.StartScheduler(ctx)

	r := gin.New()
	r.Use(gin.Recovery())

	h := handlers.NewHandler(reportingEngine, logger)

	// Quarterly returns
	r.POST("/naicom/returns/quarterly", h.GenerateQuarterlyReturn)
	r.POST("/naicom/returns/annual", h.GenerateAnnualReturn)
	r.GET("/naicom/returns/history", h.GetReturnHistory)
	r.GET("/naicom/returns/:id", h.GetReturnDetail)

	// Solvency monitoring
	r.GET("/naicom/solvency/current", h.GetCurrentSolvency)
	r.GET("/naicom/solvency/history", h.GetSolvencyHistory)
	r.GET("/naicom/solvency/alerts", h.GetSolvencyAlerts)

	// Compliance scorecard
	r.GET("/naicom/scorecard", h.GetComplianceScorecard)
	r.GET("/naicom/directives", h.GetDirectives)
	r.GET("/naicom/calendar", h.GetRegulatoryCalendar)

	// Filing management
	r.POST("/naicom/filing/submit", h.SubmitFiling)
	r.GET("/naicom/filing/status", h.GetFilingStatus)
	r.GET("/naicom/filing/deadlines", h.GetFilingDeadlines)

	// NMID reporting
	r.GET("/naicom/nmid/compliance", h.GetNMIDCompliance)
	r.GET("/naicom/nmid/verification-stats", h.GetNMIDVerificationStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8091"
	}

	srv := &http.Server{Addr: fmt.Sprintf(":%s", port), Handler: r}

	go func() {
		logger.Info("NAICOM Compliance Engine starting", zap.String("port", port))
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
}
