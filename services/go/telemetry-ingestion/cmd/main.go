// Oil & Gas RMM Platform — Telemetry Ingestion Service
// Receives high-frequency sensor data from edge agents via HTTP/MQTT bridge,
// writes hot data to InfluxDB (time-series) and metadata to PostgreSQL.
// Publishes to Kafka topic: og.field.telemetry.raw
// Consumes from Kafka topic: og.field.telemetry.raw → writes to PostgreSQL telemetry_readings
// Spec: FRQ-009 — write throughput > 250K points/sec
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/og-rmm/telemetry-ingestion/internal/handlers"
	"github.com/og-rmm/telemetry-ingestion/internal/kafka"
	"github.com/og-rmm/telemetry-ingestion/internal/store"
)

// postgresReadingWriter adapts PostgresStore to the kafka.ReadingWriter interface.
type postgresReadingWriter struct {
	store *store.PostgresStore
}

func (w *postgresReadingWriter) WriteTelemetryReading(ctx context.Context, r kafka.TelemetryReading) error {
	return w.store.WriteTelemetryReadingDirect(ctx, r.WellID, r.SensorTag, r.Value, r.Unit, r.Quality)
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	port := getEnv("PORT", "8082")
	kafkaBrokers := getEnv("KAFKA_BROKERS", "kafka:9092")
	kafkaTopic := getEnv("KAFKA_TOPIC", "og.field.telemetry.raw")
	kafkaGroup := getEnv("KAFKA_CONSUMER_GROUP", "og-rmm-telemetry-consumer")
	influxURL := getEnv("INFLUXDB_URL", "http://influxdb:8086")
	influxToken := getEnv("INFLUXDB_TOKEN", "og-rmm-token")
	influxOrg := getEnv("INFLUXDB_ORG", "og-rmm")
	influxBucket := getEnv("INFLUXDB_BUCKET", "field_data")
	pgDSN := getEnv("DATABASE_URL", "postgres://og_rmm:og_rmm_pass@postgres:5432/og_rmm?sslmode=disable")

	// Initialize Kafka producer
	producer, err := kafka.NewProducer(kafkaBrokers)
	if err != nil {
		slog.Error("failed to create Kafka producer", "err", err)
		os.Exit(1)
	}
	defer producer.Close()

	// Initialize InfluxDB writer
	tsWriter := store.NewInfluxWriter(influxURL, influxToken, influxOrg, influxBucket)
	defer tsWriter.Close()

	// Initialize PostgreSQL for telemetry metadata
	pgStore, err := store.NewPostgresStore(context.Background(), pgDSN)
	if err != nil {
		slog.Error("failed to connect to PostgreSQL", "err", err)
		os.Exit(1)
	}
	defer pgStore.Close()

	// Initialize Kafka consumer — writes telemetry readings to PostgreSQL
	pgWriter := &postgresReadingWriter{store: pgStore}
	consumer := kafka.NewConsumer(kafkaBrokers, kafkaTopic, kafkaGroup, pgWriter)

	// Start consumer in background
	consumerCtx, cancelConsumer := context.WithCancel(context.Background())
	defer cancelConsumer()
	go consumer.Start(consumerCtx)

	h := handlers.NewTelemetryHandler(producer, tsWriter, pgStore)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		status := consumer.Status()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":       "ok",
			"service":      "telemetry-ingestion",
			"kafka_status": status.Source,
			"connected":    status.Connected,
		})
	})

	// Prometheus-compatible metrics endpoint
	mux.HandleFunc("GET /metrics", func(w http.ResponseWriter, r *http.Request) {
		status := consumer.Status()
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		fmt.Fprintf(w, "# HELP og_rmm_telemetry_total Total telemetry readings consumed\n")
		fmt.Fprintf(w, "# TYPE og_rmm_telemetry_total counter\n")
		fmt.Fprintf(w, "og_rmm_telemetry_total %d\n", status.TotalConsumed)
		fmt.Fprintf(w, "# HELP og_rmm_kafka_consumer_lag Kafka consumer lag\n")
		fmt.Fprintf(w, "# TYPE og_rmm_kafka_consumer_lag gauge\n")
		fmt.Fprintf(w, "og_rmm_kafka_consumer_lag %d\n", status.ConsumerLag)
		fmt.Fprintf(w, "# HELP og_rmm_telemetry_msg_per_sec Messages per second\n")
		fmt.Fprintf(w, "# TYPE og_rmm_telemetry_msg_per_sec gauge\n")
		fmt.Fprintf(w, "og_rmm_telemetry_msg_per_sec %.2f\n", status.MessagesPerSec)
	})

	// Live stream status — called by the Node.js tRPC layer to show the live indicator
	mux.HandleFunc("GET /api/v1/live-stream-status", func(w http.ResponseWriter, r *http.Request) {
		status := consumer.Status()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	})

	// Batch ingest endpoint — accepts arrays of readings
	mux.HandleFunc("POST /api/v1/telemetry/ingest", h.IngestBatch)

	// Single reading (for testing/low-frequency sensors)
	mux.HandleFunc("POST /api/v1/telemetry/reading", h.IngestSingle)

	// Query latest readings for a well
	mux.HandleFunc("GET /api/v1/wells/{id}/telemetry", h.GetLatestTelemetry)

	// Query historical range
	mux.HandleFunc("GET /api/v1/wells/{id}/telemetry/history", h.GetTelemetryHistory)

	// Aggregated stats (rolling averages)
	mux.HandleFunc("GET /api/v1/wells/{id}/telemetry/stats", h.GetTelemetryStats)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		slog.Info("Telemetry Ingestion Service starting", "port", port,
			"kafka_topic", kafkaTopic, "consumer_group", kafkaGroup)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	cancelConsumer()
	consumer.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	slog.Info("Telemetry Ingestion Service stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
