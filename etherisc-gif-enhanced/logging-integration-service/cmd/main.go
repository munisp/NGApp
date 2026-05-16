package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/etherisc/logging-integration-service/pkg/config"
	"github.com/etherisc/logging-integration-service/pkg/handler"
	"github.com/etherisc/logging-integration-service/pkg/gifclient"
	"github.com/etherisc/logging-integration-service/pkg/logger"
	"github.com/etherisc/logging-integration-service/pkg/middleware"
	"github.com/etherisc/logging-integration-service/pkg/metrics"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// 1. Load Configuration
	cfg := config.LoadConfig()

	// 2. Initialize Logger
	logger.InitLogger(cfg)
	logger.Log.Info().Msg("Starting GIF Logging Integration Service...")

	// 3. Initialize Metrics
	m := metrics.NewMetrics(cfg.ServiceName)

	// 4. Initialize GIF Client
	gifClient := gifclient.NewClient(logger.Log)

	// 5. Initialize Handlers
	policyHandler := handler.NewPolicyHandler(gifClient, m)

	// 6. Initialize Router
	r := mux.NewRouter()

	// 7. Apply Middlewares
	r.Use(middleware.TraceIDMiddleware)
	r.Use(middleware.LoggerMiddleware(logger.Log))

	// 8. Setup Routes
	r.HandleFunc("/health", healthHandler).Methods("GET")
	r.Handle("/metrics", promhttp.Handler()).Methods("GET")
	r.HandleFunc("/log-test", logTestHandler).Methods("GET")
	r.HandleFunc("/policy/{policyID}", policyHandler.GetPolicyByID).Methods("GET")

	// 9. Start Server
	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	logger.Log.Info().Str("address", addr).Msg("Server starting")
	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Log.Fatal().Err(err).Msg("Server failed to start")
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	// Use the request-scoped logger
	log := logger.GetLoggerFromContext(r.Context())
	log.Info().Msg("Health check successful")

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "OK")
}

func logTestHandler(w http.ResponseWriter, r *http.Request) {
	// Use the request-scoped logger, which now includes the trace_id
	log := logger.GetLoggerFromContext(r.Context())

	// Simulate a critical error log
	log.Error().
		Str("component", "business_logic").
		Str("error_code", "E_GIF_1001").
		Msg("Critical error: Failed to connect to GIF service")

	// Simulate a successful operation log
	log.Info().
		Str("component", "api").
		Str("endpoint", "/log-test").
		Msg("Log test complete, check logs for trace ID and error example")

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Log test initiated. Check logs for trace ID and critical error example.")
}
