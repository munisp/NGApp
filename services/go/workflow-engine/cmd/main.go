// Package main is the entry point for the OG-RMM Workflow Engine service.
// This service runs the Temporal security incident triage worker.
// Spec: IEC 62443 §21.2 — IncidentTriageWorkflow + ReAdmitNodeWorkflow
package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/og-rmm/workflow-engine/internal/security"
)

var startTime = time.Now()

func main() {
	// Load .env for local development
	_ = godotenv.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Required environment variables
	temporalHostPort := getEnv("TEMPORAL_ADDRESS", "temporal:7233")
	openCTIURL := getEnv("OPENCTI_URL", "http://opencti:8080")
	openCTIKey := getEnv("OPENCTI_API_KEY", "")
	onCallURL := getEnv("GRAFANA_ONCALL_URL", "http://grafana-oncall:8080")
	onCallIntegrationID := getEnv("GRAFANA_ONCALL_INTEGRATION_ID", "")
	onCallToken := getEnv("GRAFANA_ONCALL_TOKEN", "")
	k8sAPIURL := getEnv("K8S_API_URL", "https://kubernetes.default.svc")
	k8sToken := getEnv("K8S_SERVICE_ACCOUNT_TOKEN", "")
	platformAPIURL := getEnv("PLATFORM_API_URL", "http://og-rmm-platform:3000")
	platformAPIKey := getEnv("PLATFORM_API_KEY", "")
	healthPort := getEnv("HEALTH_PORT", "8109")

	slog.Info("Starting OG-RMM Workflow Engine",
		"temporal", temporalHostPort,
		"opencti", openCTIURL,
		"oncall", onCallURL,
	)

	w, _, err := security.NewSecurityWorker(
		temporalHostPort,
		openCTIURL, openCTIKey,
		onCallURL, onCallIntegrationID, onCallToken,
		k8sAPIURL, k8sToken,
		platformAPIURL, platformAPIKey,
	)
	if err != nil {
		slog.Error("Failed to create security worker", "err", err)
		os.Exit(1)
	}

	if err := w.Start(); err != nil {
		slog.Error("Failed to start security worker", "err", err)
		os.Exit(1)
	}
	slog.Info("Security workflow worker started", "taskQueue", security.TaskQueue)

	// Health endpoint for k8s probes
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(wr http.ResponseWriter, r *http.Request) {
		wr.Header().Set("Content-Type", "application/json")
		json.NewEncoder(wr).Encode(map[string]interface{}{
			"status":    "ok",
			"service":   "workflow-engine",
			"uptime_s":  int(time.Since(startTime).Seconds()),
			"temporal":  temporalHostPort,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	srv := &http.Server{Addr: ":" + healthPort, Handler: mux}
	go func() {
		slog.Info("Health endpoint listening", "port", healthPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Health server error", "err", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down workflow engine...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	w.Stop()
	slog.Info("Workflow engine stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
