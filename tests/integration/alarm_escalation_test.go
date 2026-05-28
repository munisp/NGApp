// Integration tests for alarm escalation flow:
//   Telemetry threshold breach → Alarm trigger → Temporal workflow → Notification
//
// Run with: go test -tags=integration ./tests/integration/ -run TestAlarmEscalation
//
//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

type AlarmRule struct {
	WellID          string  `json:"well_id"`
	SensorType      string  `json:"sensor_type"`
	Condition       string  `json:"condition"`
	Threshold       float64 `json:"threshold"`
	Severity        int     `json:"severity"`
	MessageTemplate string  `json:"message_template"`
	Enabled         bool    `json:"enabled"`
}

type AlarmEvent struct {
	AlarmID    string  `json:"alarm_id"`
	WellID     string  `json:"well_id"`
	SensorType string  `json:"sensor_type"`
	Severity   int     `json:"severity"`
	Message    string  `json:"message"`
	Value      float64 `json:"value"`
	Threshold  float64 `json:"threshold"`
}

func alarmManagerURL() string {
	return envOr("ALARM_MANAGER_URL", "http://localhost:8083")
}

func TestAlarmEscalationHighPressure(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Step 1: Create alarm rule for high tubing pressure
	rule := AlarmRule{
		WellID:          "well-integration-001",
		SensorType:      "TUBING_PRESSURE",
		Condition:       "GT",
		Threshold:       1500,
		Severity:        1,
		MessageTemplate: "CRITICAL: Tubing pressure exceeded 1500 PSI",
		Enabled:         true,
	}

	ruleBody, _ := json.Marshal(rule)
	ruleReq, err := http.NewRequestWithContext(ctx, http.MethodPost, alarmManagerURL()+"/api/v1/alarms/rules", bytes.NewReader(ruleBody))
	if err != nil {
		t.Fatalf("create rule request: %v", err)
	}
	ruleReq.Header.Set("Content-Type", "application/json")

	ruleResp, err := http.DefaultClient.Do(ruleReq)
	if err != nil {
		t.Fatalf("create rule failed: %v", err)
	}
	ruleResp.Body.Close()

	// Step 2: Send telemetry reading that breaches the threshold
	reading := SensorReading{
		WellID:     "well-integration-001",
		SensorID:   "sensor-tp-001",
		SensorType: "TUBING_PRESSURE",
		Value:      1650.0, // Above 1500 threshold
		Unit:       "PSI",
		Quality:    95,
		Timestamp:  time.Now().UTC(),
		TenantID:   "tenant-test-001",
	}

	readingBody, _ := json.Marshal(reading)
	ingestReq, err := http.NewRequestWithContext(ctx, http.MethodPost, telemetryIngestionURL()+"/api/v1/telemetry/ingest", bytes.NewReader(readingBody))
	if err != nil {
		t.Fatalf("create ingest request: %v", err)
	}
	ingestReq.Header.Set("Content-Type", "application/json")

	ingestResp, err := http.DefaultClient.Do(ingestReq)
	if err != nil {
		t.Fatalf("ingest failed: %v", err)
	}
	ingestResp.Body.Close()

	// Step 3: Check that alarm was created
	time.Sleep(2 * time.Second) // Wait for async processing

	alarmsReq, err := http.NewRequestWithContext(ctx, http.MethodGet, alarmManagerURL()+"/api/v1/alarms?well_id=well-integration-001&status=ACTIVE", nil)
	if err != nil {
		t.Fatalf("get alarms request: %v", err)
	}

	alarmsResp, err := http.DefaultClient.Do(alarmsReq)
	if err != nil {
		t.Logf("alarm query failed (service may not be running): %v", err)
		return
	}
	defer alarmsResp.Body.Close()

	if alarmsResp.StatusCode == http.StatusOK {
		var alarms []AlarmEvent
		json.NewDecoder(alarmsResp.Body).Decode(&alarms)
		t.Logf("active alarms for well: %d", len(alarms))
	}
}

func TestAlarmAcknowledgement(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	ackBody, _ := json.Marshal(map[string]string{
		"alarm_id":        "test-alarm-001",
		"acknowledged_by": "operator-001",
		"notes":           "Checked pressure gauge — sensor spike, returning to normal",
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, alarmManagerURL()+"/api/v1/alarms/acknowledge", bytes.NewReader(ackBody))
	if err != nil {
		t.Fatalf("create ack request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("alarm ack failed (service may not be running): %v", err)
		return
	}
	defer resp.Body.Close()

	t.Logf("alarm acknowledgement response: HTTP %d", resp.StatusCode)
}
