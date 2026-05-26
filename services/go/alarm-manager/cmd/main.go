// Oil & Gas RMM Platform — Alarm Manager Service
// Implements ISA-18.2 alarm management with Temporal workflow orchestration.
// Stores alarm state in PostgreSQL; publishes to Kafka og.field.alarms topic.
// Spec: BRQ-006 — < 1 min notification time for Critical alarms.
//       FRQ-005 — Temporal workflow completion < 1s for standard alarm path.
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

	"github.com/og-rmm/alarm-manager/internal/db"
	"github.com/og-rmm/alarm-manager/internal/handlers"
	"github.com/og-rmm/alarm-manager/internal/processor"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	port := getEnv("PORT", "8084")
	pgDSN := getEnv("DATABASE_URL", "postgres://og_rmm:og_rmm_pass@postgres:5432/og_rmm?sslmode=disable")
	kafkaBrokers := getEnv("KAFKA_BROKERS", "kafka:9092")
	temporalHost := getEnv("TEMPORAL_HOST", "temporal:7233")

	// PostgreSQL connection
	pool, err := db.NewPool(context.Background(), pgDSN)
	if err != nil {
		slog.Error("PostgreSQL connection failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := db.RunMigrations(context.Background(), pool); err != nil {
		slog.Error("alarm migrations failed", "err", err)
		os.Exit(1)
	}

	// Alarm processor (Kafka consumer + Temporal workflow starter)
	proc := processor.NewAlarmProcessor(pool, kafkaBrokers, temporalHost)
	go proc.Start(context.Background())

	h := handlers.NewAlarmHandler(pool, proc)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "alarm-manager",
		})
	})

	// Alarm CRUD
	mux.HandleFunc("GET /api/v1/alarms", h.ListAlarms)
	mux.HandleFunc("GET /api/v1/alarms/{id}", h.GetAlarm)
	mux.HandleFunc("POST /api/v1/alarms", h.CreateAlarm)
	mux.HandleFunc("PATCH /api/v1/alarms/{id}/acknowledge", h.AcknowledgeAlarm)
	mux.HandleFunc("PATCH /api/v1/alarms/{id}/resolve", h.ResolveAlarm)

	// Alarm rules
	mux.HandleFunc("GET /api/v1/alarm-rules", h.ListRules)
	mux.HandleFunc("POST /api/v1/alarm-rules", h.CreateRule)

	// Statistics
	mux.HandleFunc("GET /api/v1/alarms/stats", h.GetAlarmStats)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		slog.Info("Alarm Manager Service starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	slog.Info("Alarm Manager stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
