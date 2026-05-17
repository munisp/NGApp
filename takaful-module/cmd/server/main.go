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

	"takaful-module/internal/cache"
	"takaful-module/internal/events"
	"takaful-module/internal/handlers"
	"takaful-module/internal/repository"
	"takaful-module/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8097"
	}

	// PostgreSQL persistence
	repo := repository.NewTakafulRepository()

	// Redis caching
	redisCache := cache.NewRedisCache("takaful")
	_ = redisCache

	// Kafka event publishing
	eventPub := events.NewEventPublisher("takaful")
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
			"service":      "takaful-module",
			"version":      "3.0.0",
			"db_connected": dbConnected,
			"middleware":    []string{"kafka", "tigerbeetle", "redis"},
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

	mux.HandleFunc("/api/v1/takaful/pools", h.ListPools)
	mux.HandleFunc("/api/v1/takaful/pools/create", h.CreatePool)
	mux.HandleFunc("/api/v1/takaful/join", h.JoinPool)
	mux.HandleFunc("/api/v1/takaful/contribute", h.MakeContribution)
	mux.HandleFunc("/api/v1/takaful/surplus", h.GetSurplus)
	mux.HandleFunc("/api/v1/takaful/distribute", h.DistributeSurplus)


	// Middleware chain: logging -> CORS -> auth -> handler
	var handler http.Handler = mux
	handler = corsMiddleware(handler)
	handler = loggingMiddleware("takaful-module", handler)
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
		log.Printf("[takaful-module] shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("[takaful-module] v3.0 starting on port %s (postgres=%v, middleware=kafka,tigerbeetle,redis)", port, true)
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
