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
	"github.com/munisp/NGApp/enterprise-mdm/internal/handlers"
	"github.com/munisp/NGApp/enterprise-mdm/internal/service"
	"github.com/munisp/NGApp/enterprise-mdm/internal/store"
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

	mdmService := service.NewMDMService(pgStore, redisAddr, kafkaBroker, logger)
	go mdmService.StartDataQualityMonitor(ctx)

	r := gin.New()
	r.Use(gin.Recovery())

	h := handlers.NewHandler(mdmService, logger)

	// Golden record management
	r.GET("/mdm/customers/:id", h.GetGoldenRecord)
	r.GET("/mdm/customers/search", h.SearchCustomers)
	r.POST("/mdm/customers/merge", h.MergeRecords)
	r.GET("/mdm/customers/:id/duplicates", h.FindDuplicates)

	// Data quality
	r.GET("/mdm/quality/dashboard", h.GetQualityDashboard)
	r.GET("/mdm/quality/rules", h.GetQualityRules)
	r.POST("/mdm/quality/validate", h.ValidateRecord)
	r.GET("/mdm/quality/completeness", h.GetCompletenessReport)

	// Master data domains
	r.GET("/mdm/domains", h.ListDomains)
	r.GET("/mdm/domains/:domain/stats", h.GetDomainStats)

	// Deduplication
	r.POST("/mdm/dedup/run", h.RunDeduplication)
	r.GET("/mdm/dedup/candidates", h.GetDedupCandidates)

	// Data lineage
	r.GET("/mdm/lineage/:entity_id", h.GetDataLineage)

	r.GET("/health", h.HealthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8095"
	}

	srv := &http.Server{Addr: fmt.Sprintf(":%s", port), Handler: r}
	go func() {
		logger.Info("Enterprise MDM starting", zap.String("port", port))
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
