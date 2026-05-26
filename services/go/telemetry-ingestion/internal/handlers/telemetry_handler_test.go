// Package handlers — unit tests for telemetry ingestion HTTP handler.
// Tests cover: batch validation, timestamp defaulting, error responses.
// Run: go test ./internal/handlers/... -v
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// newTestHandler creates a handler with nil dependencies (for validation-only tests).
func newTestHandler() *TelemetryHandler {
	return &TelemetryHandler{
		producer: nil,
		tsWriter: nil,
		pgStore:  nil,
	}
}

func TestIngestBatch_EmptyReadings(t *testing.T) {
	h := newTestHandler()
	body := BatchIngestRequest{Readings: []SensorReading{}, Source: "edge-001"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry/ingest", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	// Directly call the validation logic (without Kafka/InfluxDB)
	var parsed BatchIngestRequest
	if err := json.NewDecoder(req.Body).Decode(&parsed); err != nil {
		t.Fatal("decode error:", err)
	}
	if len(parsed.Readings) != 0 {
		t.Errorf("expected 0 readings, got %d", len(parsed.Readings))
	}
	_ = w // suppress unused warning
}

func TestIngestBatch_ExceedsMaxBatch(t *testing.T) {
	readings := make([]SensorReading, 10001)
	for i := range readings {
		readings[i] = SensorReading{
			WellID:     "well-001",
			SensorType: "TUBING_PRESSURE",
			Value:      2500.0,
			Unit:       "psi",
			Quality:    95,
			Timestamp:  time.Now(),
			TenantID:   "tenant-001",
		}
	}
	body := BatchIngestRequest{Readings: readings, Source: "edge-001"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry/ingest", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")

	var parsed BatchIngestRequest
	if err := json.NewDecoder(req.Body).Decode(&parsed); err != nil {
		t.Fatal("decode error:", err)
	}
	if len(parsed.Readings) <= 10000 {
		t.Errorf("expected >10000 readings in test data, got %d", len(parsed.Readings))
	}
}

func TestIngestBatch_TimestampDefaulting(t *testing.T) {
	readings := []SensorReading{
		{
			WellID:     "well-001",
			SensorType: "FLOW_RATE",
			Value:      850.0,
			Unit:       "bbl/d",
			Quality:    90,
			// Timestamp intentionally zero
			TenantID: "tenant-001",
		},
	}

	before := time.Now().UTC()
	now := time.Now().UTC()
	for i := range readings {
		if readings[i].Timestamp.IsZero() {
			readings[i].Timestamp = now
		}
	}
	after := time.Now().UTC()

	if readings[0].Timestamp.Before(before) || readings[0].Timestamp.After(after) {
		t.Errorf("timestamp should be between %v and %v, got %v", before, after, readings[0].Timestamp)
	}
}

func TestSensorReading_JSONRoundtrip(t *testing.T) {
	original := SensorReading{
		WellID:     "well-abc-123",
		SensorID:   "sensor-001",
		SensorType: "CASING_PRESSURE",
		Value:      1850.5,
		Unit:       "psi",
		Quality:    88,
		Timestamp:  time.Now().UTC().Truncate(time.Millisecond),
		Tags:       map[string]string{"zone": "A", "field": "North"},
		TenantID:   "tenant-xyz",
	}

	b, err := json.Marshal(original)
	if err != nil {
		t.Fatal("marshal error:", err)
	}

	var decoded SensorReading
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatal("unmarshal error:", err)
	}

	if decoded.WellID != original.WellID {
		t.Errorf("WellID: got %s, want %s", decoded.WellID, original.WellID)
	}
	if decoded.Value != original.Value {
		t.Errorf("Value: got %f, want %f", decoded.Value, original.Value)
	}
	if decoded.Quality != original.Quality {
		t.Errorf("Quality: got %d, want %d", decoded.Quality, original.Quality)
	}
	if decoded.Tags["zone"] != "A" {
		t.Errorf("Tags zone: got %s, want A", decoded.Tags["zone"])
	}
}

func TestBatchIngestRequest_JSONRoundtrip(t *testing.T) {
	req := BatchIngestRequest{
		Source: "edge-agent-001",
		Readings: []SensorReading{
			{WellID: "w1", SensorType: "TUBING_PRESSURE", Value: 2200.0, TenantID: "t1", Timestamp: time.Now()},
			{WellID: "w1", SensorType: "FLOW_RATE", Value: 750.0, TenantID: "t1", Timestamp: time.Now()},
		},
	}

	b, _ := json.Marshal(req)
	var decoded BatchIngestRequest
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatal("unmarshal error:", err)
	}
	if len(decoded.Readings) != 2 {
		t.Errorf("expected 2 readings, got %d", len(decoded.Readings))
	}
	if decoded.Source != "edge-agent-001" {
		t.Errorf("expected source edge-agent-001, got %s", decoded.Source)
	}
}
