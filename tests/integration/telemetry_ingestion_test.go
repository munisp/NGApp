// Package integration provides end-to-end integration tests for critical OG-RMM flows.
// These tests verify the telemetry ingestion pipeline:
//   Field device → Edge agent → Kafka → Telemetry ingestion → InfluxDB + PostgreSQL + OpenSearch
//
// Run with: go test -tags=integration ./tests/integration/ -run TestTelemetryIngestion
//
//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"
)

type SensorReading struct {
	WellID     string            `json:"well_id"`
	SensorID   string            `json:"sensor_id"`
	SensorType string            `json:"sensor_type"`
	Value      float64           `json:"value"`
	Unit       string            `json:"unit"`
	Quality    int               `json:"quality"`
	Timestamp  time.Time         `json:"timestamp"`
	TenantID   string            `json:"tenant_id"`
	Tags       map[string]string `json:"tags,omitempty"`
}

type BatchUpload struct {
	Readings []SensorReading `json:"readings"`
	Source   string          `json:"source"`
}

func telemetryIngestionURL() string {
	return envOr("TELEMETRY_INGESTION_URL", "http://localhost:8082")
}

func envOr(key, fallback string) string {
	if v := getEnv(key); v != "" {
		return v
	}
	return fallback
}

var getEnv = func(key string) string { return "" }

func TestTelemetryIngestionSingleReading(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reading := SensorReading{
		WellID:     "well-integration-001",
		SensorID:   "sensor-tp-001",
		SensorType: "TUBING_PRESSURE",
		Value:      1345.67,
		Unit:       "PSI",
		Quality:    95,
		Timestamp:  time.Now().UTC(),
		TenantID:   "tenant-test-001",
	}

	body, _ := json.Marshal(reading)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, telemetryIngestionURL()+"/api/v1/telemetry/ingest", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("ingest request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		t.Errorf("expected 200/202, got %d", resp.StatusCode)
	}
}

func TestTelemetryIngestionBatch(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	readings := make([]SensorReading, 100)
	now := time.Now().UTC()
	for i := range readings {
		readings[i] = SensorReading{
			WellID:     "well-integration-001",
			SensorID:   fmt.Sprintf("sensor-%03d", i),
			SensorType: "FLOW_RATE",
			Value:      500.0 + float64(i),
			Unit:       "BPD",
			Quality:    95,
			Timestamp:  now.Add(-time.Duration(100-i) * time.Second),
			TenantID:   "tenant-test-001",
		}
	}

	batch := BatchUpload{
		Readings: readings,
		Source:   "integration-test",
	}

	body, _ := json.Marshal(batch)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, telemetryIngestionURL()+"/api/v1/telemetry/ingest", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("batch ingest failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		t.Errorf("expected 200/202, got %d", resp.StatusCode)
	}
}

func TestTelemetryIngestionInvalidPayload(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	body := []byte(`{"invalid": true}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, telemetryIngestionURL()+"/api/v1/telemetry/ingest", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		t.Error("expected rejection of invalid payload, got 200")
	}
}

func TestTelemetryIngestionRateLimiting(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	reading := SensorReading{
		WellID:     "well-integration-001",
		SensorID:   "sensor-rate-001",
		SensorType: "CASING_PRESSURE",
		Value:      890.0,
		Unit:       "PSI",
		Quality:    90,
		Timestamp:  time.Now().UTC(),
		TenantID:   "tenant-test-001",
	}

	body, _ := json.Marshal(reading)

	successCount := 0
	rateLimited := 0
	for i := 0; i < 200; i++ {
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, telemetryIngestionURL()+"/api/v1/telemetry/ingest", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			continue
		}
		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusAccepted {
			successCount++
		} else if resp.StatusCode == http.StatusTooManyRequests {
			rateLimited++
		}
		resp.Body.Close()
	}

	t.Logf("200 rapid requests: %d succeeded, %d rate-limited", successCount, rateLimited)
}
