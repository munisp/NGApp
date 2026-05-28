// Package handlers provides HTTP handlers for telemetry ingestion.
// Supports batch ingestion of sensor readings with Kafka publishing
// and InfluxDB time-series storage.
package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/og-rmm/telemetry-ingestion/internal/kafka"
	"github.com/og-rmm/telemetry-ingestion/internal/store"
)

// SensorReading represents a single sensor data point from a well.
type SensorReading struct {
	WellID      string            `json:"well_id"`
	SensorID    string            `json:"sensor_id"`
	SensorType  string            `json:"sensor_type"` // PRESSURE, TEMPERATURE, FLOW_RATE, CHOKE, GAS_LIFT
	Value       float64           `json:"value"`
	Unit        string            `json:"unit"`
	Quality     int               `json:"quality"`    // 0-100 data quality score
	Timestamp   time.Time         `json:"timestamp"`
	Tags        map[string]string `json:"tags,omitempty"`
	TenantID    string            `json:"tenant_id"`
}

// BatchIngestRequest holds multiple sensor readings.
type BatchIngestRequest struct {
	Readings []SensorReading `json:"readings"`
	Source   string          `json:"source"` // edge-agent ID
}

// TelemetryHandler handles telemetry HTTP endpoints.
type TelemetryHandler struct {
	producer *kafka.Producer
	tsWriter *store.InfluxWriter
	pgStore  *store.PostgresStore
}

// NewTelemetryHandler creates a new handler.
func NewTelemetryHandler(
	producer *kafka.Producer,
	tsWriter *store.InfluxWriter,
	pgStore *store.PostgresStore,
) *TelemetryHandler {
	return &TelemetryHandler{
		producer: producer,
		tsWriter: tsWriter,
		pgStore:  pgStore,
	}
}

// IngestBatch handles POST /api/v1/telemetry/ingest
// Accepts up to 10,000 readings per request.
func (h *TelemetryHandler) IngestBatch(w http.ResponseWriter, r *http.Request) {
	var req BatchIngestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if len(req.Readings) == 0 {
		writeError(w, http.StatusBadRequest, "readings array is empty")
		return
	}
	if len(req.Readings) > 10000 {
		writeError(w, http.StatusBadRequest, "batch size exceeds maximum of 10,000")
		return
	}

	// Set timestamps for readings without one
	now := time.Now().UTC()
	for i := range req.Readings {
		if req.Readings[i].Timestamp.IsZero() {
			req.Readings[i].Timestamp = now
		}
	}

	// Write to InfluxDB (time-series hot storage)
	if err := h.tsWriter.WriteBatch(r.Context(), req.Readings); err != nil {
		slog.Error("InfluxDB write failed", "err", err, "count", len(req.Readings))
		// Don't fail — continue to Kafka
	}

	// Publish to Kafka for downstream processing
	published := 0
	for _, reading := range req.Readings {
		data, _ := json.Marshal(reading)
		if err := h.producer.Publish(r.Context(), "og.field.telemetry.raw", reading.WellID, data); err != nil {
			slog.Warn("Kafka publish failed", "well_id", reading.WellID, "err", err)
		} else {
			published++
		}
	}

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"accepted":  len(req.Readings),
		"published": published,
		"timestamp": now,
	})
}

// IngestSingle handles POST /api/v1/telemetry/reading
func (h *TelemetryHandler) IngestSingle(w http.ResponseWriter, r *http.Request) {
	var reading SensorReading
	if err := json.NewDecoder(r.Body).Decode(&reading); err != nil {
		writeError(w, http.StatusBadRequest, "invalid reading: "+err.Error())
		return
	}
	if reading.Timestamp.IsZero() {
		reading.Timestamp = time.Now().UTC()
	}

	if err := h.tsWriter.WritePoint(r.Context(), reading); err != nil {
		slog.Error("InfluxDB single write failed", "err", err)
	}

	data, _ := json.Marshal(reading)
	if err := h.producer.Publish(r.Context(), "og.field.telemetry.raw", reading.WellID, data); err != nil {
		slog.Warn("Kafka publish failed", "err", err)
	}

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

// GetLatestTelemetry handles GET /api/v1/wells/{id}/telemetry
// Returns the most recent reading for each sensor type on the well.
func (h *TelemetryHandler) GetLatestTelemetry(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	if wellID == "" {
		writeError(w, http.StatusBadRequest, "well_id is required")
		return
	}

	readings, err := h.tsWriter.QueryLatest(r.Context(), wellID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"well_id":  wellID,
		"readings": readings,
		"time":     time.Now().UTC(),
	})
}

// GetTelemetryHistory handles GET /api/v1/wells/{id}/telemetry/history
// Query params: sensor_type, start, end, limit
func (h *TelemetryHandler) GetTelemetryHistory(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	q := r.URL.Query()
	sensorType := q.Get("sensor_type")
	start := q.Get("start")
	end := q.Get("end")

	readings, err := h.tsWriter.QueryHistory(r.Context(), wellID, sensorType, start, end)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "history query failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"well_id":     wellID,
		"sensor_type": sensorType,
		"readings":    readings,
	})
}

// GetTelemetryStats handles GET /api/v1/wells/{id}/telemetry/stats
// Returns rolling averages, min, max over configurable windows.
func (h *TelemetryHandler) GetTelemetryStats(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	window := r.URL.Query().Get("window") // e.g., "1h", "24h", "7d"
	if window == "" {
		window = "1h"
	}

	stats, err := h.tsWriter.QueryStats(r.Context(), wellID, window)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "stats query failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"well_id": wellID,
		"window":  window,
		"stats":   stats,
	})
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]interface{}{"error": msg, "code": code})
}
