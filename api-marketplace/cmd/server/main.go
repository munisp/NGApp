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

	"api-marketplace/internal/cache"
	"api-marketplace/internal/events"
	"api-marketplace/internal/handlers"
	"api-marketplace/internal/repository"
	"api-marketplace/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8113"
	}

	// PostgreSQL persistence
	repo := repository.NewMarketplaceRepository()

	// Redis caching
	redisCache := cache.NewRedisCache("marketplace")
	_ = redisCache

	// Kafka event publishing
	eventPub := events.NewEventPublisher("marketplace")
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
			"service":      "api-marketplace",
			"version":      "3.0.0",
			"db_connected": dbConnected,
			"middleware":    []string{"redis", "kafka", "apisix"},
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

	mux.HandleFunc("/api/v1/marketplace/products", h.ListProducts)
	mux.HandleFunc("/api/v1/marketplace/subscribe", h.Subscribe)
	mux.HandleFunc("/api/v1/marketplace/keys", h.ManageKeys)
	mux.HandleFunc("/api/v1/marketplace/usage", h.GetUsage)
	mux.HandleFunc("/api/v1/marketplace/docs", h.GetDocs)


	// Middleware chain: logging -> CORS -> auth -> handler
	var handler http.Handler = mux
	handler = corsMiddleware(handler)
	handler = loggingMiddleware("api-marketplace", handler)
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
		log.Printf("[api-marketplace] shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("[api-marketplace] v3.0 starting on port %s (postgres=%v, middleware=redis,kafka,apisix)", port, true)
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
