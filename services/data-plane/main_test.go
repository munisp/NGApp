package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testService() *Service {
	cfg := Config{
		KafkaBrokers:       []string{"localhost:9092"},
		KafkaTopic:         "og.telemetry.v1",
		FluvioEndpoint:     "localhost:9003",
		FluvioTopic:        "og.telemetry.realtime",
		Port:               4002,
		SimulationInterval: 100 * time.Millisecond,
	}
	return NewService(cfg)
}

func TestHealthEndpoint(t *testing.T) {
	svc := testService()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w   := httptest.NewRecorder()
	svc.handleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]any
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", resp["status"])
	}
}

func TestHeartbeatEndpoint(t *testing.T) {
	svc := testService()

	body := HeartbeatRequest{
		DeviceID:  "RTU-W-001",
		WellID:    "W-001",
		FirmwareV: "v2.3.1",
		Uptime:    86400,
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/devices/RTU-W-001/heartbeat",
		bytes.NewReader(bodyBytes))
	req.SetPathValue("id", "RTU-W-001")
	w := httptest.NewRecorder()
	svc.handleHeartbeat(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp HeartbeatResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode heartbeat response: %v", err)
	}
	if !resp.Accepted {
		t.Error("expected accepted=true")
	}
	if resp.NextIntervalMs <= 0 {
		t.Error("expected positive next_interval_ms")
	}
}

func TestHeartbeatIncrementsStat(t *testing.T) {
	svc := testService()
	body := HeartbeatRequest{DeviceID: "RTU-W-002", FirmwareV: "v1.0.0"}
	bodyBytes, _ := json.Marshal(body)

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/devices/RTU-W-002/heartbeat",
			bytes.NewReader(bodyBytes))
		req.SetPathValue("id", "RTU-W-002")
		w := httptest.NewRecorder()
		svc.handleHeartbeat(w, req)
	}

	svc.mu.RLock()
	count := svc.stats.HeartbeatsReceived
	svc.mu.RUnlock()

	if count != 3 {
		t.Errorf("expected 3 heartbeats, got %d", count)
	}
}

func TestSimulationGeneratesReadings(t *testing.T) {
	svc := testService()
	svc.simulation = true

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	out := make(chan TelemetryReading, 256)
	go svc.runSimulation(ctx, out)

	// Wait for at least one batch
	time.Sleep(200 * time.Millisecond)
	cancel()

	if len(out) == 0 {
		t.Error("simulation produced no readings")
	}

	reading := <-out
	if reading.Source != "simulation" {
		t.Errorf("expected source=simulation, got %s", reading.Source)
	}
	if reading.Quality != "GOOD" {
		t.Errorf("expected quality=GOOD, got %s", reading.Quality)
	}
	if reading.WellID == "" {
		t.Error("expected non-empty well_id")
	}
}

func TestMetricsEndpoint(t *testing.T) {
	svc := testService()
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w   := httptest.NewRecorder()
	svc.handleMetrics(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := w.Body.String()
	if !contains(body, "og_data_plane_messages_consumed_total") {
		t.Error("metrics missing og_data_plane_messages_consumed_total")
	}
	if !contains(body, "og_data_plane_heartbeats_total") {
		t.Error("metrics missing og_data_plane_heartbeats_total")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStr(s, substr))
}

func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
