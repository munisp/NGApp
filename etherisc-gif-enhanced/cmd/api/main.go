package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"policy-service-integration/internal/config"
	"policy-service-integration/pkg/api"
	"policy-service-integration/pkg/repo"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.temporal.io/sdk/client"
)

func main() {
	// 1. Load Configuration and Logger
	cfg := config.LoadConfig()
	logger := config.NewLogger()
	defer logger.Sync()

	// 2. Setup Dependencies (Mocked for this implementation)
	mockRepo := repo.NewMockRepository()

	// 3. Setup Temporal Client
	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalHostPort,
		Namespace: cfg.TemporalNamespace,
	})
	if err != nil {
		logger.Fatal("Unable to create Temporal client", zap.Error(err))
	}
	defer temporalClient.Close()

	// 4. Setup Handlers
	handler := api.NewHandler(logger, temporalClient, mockRepo)

	// 5. Setup Router
	r := mux.NewRouter()

	// API Endpoints
	r.HandleFunc("/v1/policies/parametric", handler.CreateParametricPolicyHandler).Methods("POST")
	r.HandleFunc("/v1/policies/{id}", handler.GetPolicyHandler).Methods("GET")
	r.HandleFunc("/v1/policies/parametric/{id}", handler.GetParametricPolicyDetailsHandler).Methods("GET")

	// Prometheus Metrics Endpoint
	r.Handle("/metrics", promhttp.Handler())

	// 6. Start Server
	addr := fmt.Sprintf(":%d", cfg.HTTPPort)
	srv := &http.Server{
		Handler:      r,
		Addr:         addr,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	logger.Info("Starting API server", zap.String("address", addr))
	log.Fatal(srv.ListenAndServe())
}
