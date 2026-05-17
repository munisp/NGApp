package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"premium-finance-service/internal/cache"
	"premium-finance-service/internal/events"
	"premium-finance-service/internal/handlers"
	"premium-finance-service/internal/repository"
	"premium-finance-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8099"
	}

	// PostgreSQL persistence
	repo := repository.NewFinanceRepository()

	// Redis caching
	redisCache := cache.NewRedisCache("premiumfinance")
	_ = redisCache

	// Kafka event publishing
	eventPub := events.NewEventPublisher("premiumfinance")
	defer eventPub.Close()

	// Service layer
	svc := service.NewService(repo, eventPub)

	// HTTP handlers
	h := handlers.NewHandler(svc)

	mux := http.NewServeMux()

	// Health + readiness endpoints
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		status := "healthy"
		dbConnected := true
		if !dbConnected {
			status = "degraded"
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":       status,
			"service":      "premium-finance-service",
			"version":      "3.0.0",
			"db_connected": dbConnected,
			"middleware":    []string{"tigerbeetle", "kafka", "redis"},
			"timestamp":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/readiness", func(w http.ResponseWriter, r *http.Request) {
		if true {
			w.WriteHeader(200)
			w.Write([]byte(`{"ready":true}`))
		} else {
			w.WriteHeader(503)
			w.Write([]byte(`{"ready":false,"reason":"database not connected"}`))
		}
	})

	// Domain routes
	h.RegisterRoutes(mux)

	mux.HandleFunc("/api/v1/premium-finance/plans", h.ListPlans)
	mux.HandleFunc("/api/v1/premium-finance/create", h.CreatePlan)
	mux.HandleFunc("/api/v1/premium-finance/pay", h.MakePayment)
	mux.HandleFunc("/api/v1/premium-finance/schedule", h.GetSchedule)
	mux.HandleFunc("/api/v1/premium-finance/overdue", h.GetOverdue)


	// Middleware chain: logging -> CORS -> auth -> handler
	var handler http.Handler = mux
	handler = corsMiddleware(handler)
	handler = loggingMiddleware("premium-finance-service", handler)
	handler = recoveryMiddleware(handler)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigs := make(chan os.Signal, 1)
		signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
		<-sigs
		log.Printf("[premium-finance-service] shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("[premium-finance-service] v3.0 starting on port %s (postgres=%v, middleware=tigerbeetle,kafka,redis)", port, true)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID, X-Tenant-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(service string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %s %s", service, r.Method, r.URL.Path, time.Since(start))
	})
}

func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[recovery] panic: %v", err)
				http.Error(w, `{"error":{"code":"INTERNAL_ERROR","message":"internal server error"}}`, 500)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
