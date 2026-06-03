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
	"github.com/munisp/NGApp/ussd-gateway/internal/handlers"
	"github.com/munisp/NGApp/ussd-gateway/internal/menu"
	"github.com/munisp/NGApp/ussd-gateway/internal/session"
	"github.com/munisp/NGApp/ussd-gateway/internal/store"
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

	sessionMgr := session.NewManager(redisAddr, logger)
	menuEngine := menu.NewEngine(pgStore, sessionMgr, kafkaBroker, logger)

	r := gin.New()
	r.Use(gin.Recovery())

	h := handlers.NewHandler(menuEngine, sessionMgr, logger)

	// USSD callback endpoint (telco webhook)
	r.POST("/ussd/callback", h.HandleUSSD)
	r.GET("/ussd/callback", h.HandleUSSD)

	// Session management
	r.GET("/ussd/sessions/active", h.GetActiveSessions)
	r.GET("/ussd/sessions/:id", h.GetSession)

	// Analytics
	r.GET("/ussd/analytics/daily", h.GetDailyAnalytics)
	r.GET("/ussd/analytics/states", h.GetStateAnalytics)

	// Health
	r.GET("/health", h.HealthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8093"
	}

	srv := &http.Server{Addr: fmt.Sprintf(":%s", port), Handler: r}

	go func() {
		logger.Info("USSD Gateway starting", zap.String("port", port), zap.String("shortcode", "*919#"))
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
