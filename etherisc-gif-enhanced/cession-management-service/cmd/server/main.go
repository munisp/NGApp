package main

import (
	"cession-management-service/api"
	"cession-management-service/config"
	"cession-management-service/internal/repository"
	"cession-management-service/internal/service"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	cfg := config.LoadConfig()

	// 1. Initialize Repository (Database)
	// NOTE: In a real system, this would connect to a real database.
	// For this implementation, we use the GormRepository which is structured for Postgres
	// but will not actually connect in the sandbox.
	repo, err := repository.NewGormRepository(cfg.DatabaseDSN)
	if err != nil {
		log.Fatalf("failed to initialize repository: %v", err)
	}

	// 2. Initialize Service Layer
	svc := service.NewCessionService(repo)

	// 3. Initialize Temporal Client (configured via environment)
	// Temporal client initialization is handled by the workflow worker service
	// which connects to Temporal server at cfg.TemporalHostPort

	// 4. Initialize API Handler
	handler := api.NewHandler(svc)

	// 5. Setup Router
	r := mux.NewRouter()

	// API routes
	r.PathPrefix("/v1").Handler(handler.Router)

	// Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")

	// 6. Start Server
	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("Starting Cession Management Service on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("could not start server: %v", err)
	}
}
