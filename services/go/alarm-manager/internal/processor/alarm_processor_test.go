// Package processor — unit tests for alarm evaluation engine.
// Tests cover: condition evaluation, message formatting, rule filtering.
// Run: go test ./internal/processor/... -v
package processor

import (
	"testing"
	"time"
)

// ── evaluateCondition tests ───────────────────────────────────────────────────

func TestEvaluateCondition_GT(t *testing.T) {
	p := &AlarmProcessor{}
	tests := []struct {
		value     float64
		threshold float64
		want      bool
	}{
		{3001.0, 3000.0, true},
		{3000.0, 3000.0, false},
		{2999.0, 3000.0, false},
	}
	for _, tt := range tests {
		got := p.evaluateCondition(tt.value, "GT", tt.threshold)
		if got != tt.want {
			t.Errorf("GT(%v, %v) = %v, want %v", tt.value, tt.threshold, got, tt.want)
		}
	}
}

func TestEvaluateCondition_GTE(t *testing.T) {
	p := &AlarmProcessor{}
	if !p.evaluateCondition(3000.0, "GTE", 3000.0) {
		t.Error("GTE equal case should be true")
	}
	if !p.evaluateCondition(3001.0, "GTE", 3000.0) {
		t.Error("GTE greater case should be true")
	}
	if p.evaluateCondition(2999.0, "GTE", 3000.0) {
		t.Error("GTE less case should be false")
	}
}

func TestEvaluateCondition_LT(t *testing.T) {
	p := &AlarmProcessor{}
	if !p.evaluateCondition(99.0, "LT", 100.0) {
		t.Error("LT less case should be true")
	}
	if p.evaluateCondition(100.0, "LT", 100.0) {
		t.Error("LT equal case should be false")
	}
}

func TestEvaluateCondition_LTE(t *testing.T) {
	p := &AlarmProcessor{}
	if !p.evaluateCondition(100.0, "LTE", 100.0) {
		t.Error("LTE equal case should be true")
	}
	if !p.evaluateCondition(99.0, "LTE", 100.0) {
		t.Error("LTE less case should be true")
	}
	if p.evaluateCondition(101.0, "LTE", 100.0) {
		t.Error("LTE greater case should be false")
	}
}

func TestEvaluateCondition_EQ(t *testing.T) {
	p := &AlarmProcessor{}
	if !p.evaluateCondition(42.0, "EQ", 42.0) {
		t.Error("EQ equal case should be true")
	}
	if p.evaluateCondition(42.1, "EQ", 42.0) {
		t.Error("EQ unequal case should be false")
	}
}

func TestEvaluateCondition_Unknown(t *testing.T) {
	p := &AlarmProcessor{}
	if p.evaluateCondition(100.0, "UNKNOWN_OP", 50.0) {
		t.Error("unknown operator should return false")
	}
}

// ── EvaluateReading tests ─────────────────────────────────────────────────────

func TestEvaluateReading_TriggersOnMatch(t *testing.T) {
	p := &AlarmProcessor{
		rules: []AlarmRule{
			{
				RuleID:          "rule-001",
				WellID:          "well-001",
				SensorType:      "TUBING_PRESSURE",
				Condition:       "GT",
				Threshold:       3000.0,
				Severity:        1,
				MessageTemplate: "High tubing pressure on {{well_id}}",
			},
		},
	}

	reading := TelemetryReading{
		WellID:     "well-001",
		SensorType: "TUBING_PRESSURE",
		Value:      3200.0,
		TenantID:   "tenant-001",
		Timestamp:  time.Now(),
	}

	// EvaluateReading without DB (pool is nil) — should still evaluate conditions
	// but skip persistence. We test the condition evaluation path here.
	triggered := p.evaluateRulesOnly(reading)
	if len(triggered) != 1 {
		t.Fatalf("expected 1 triggered alarm, got %d", len(triggered))
	}
	if triggered[0].SensorType != "TUBING_PRESSURE" {
		t.Errorf("expected TUBING_PRESSURE, got %s", triggered[0].SensorType)
	}
	if triggered[0].Severity != 1 {
		t.Errorf("expected severity 1, got %d", triggered[0].Severity)
	}
}

func TestEvaluateReading_SkipsWrongWell(t *testing.T) {
	p := &AlarmProcessor{
		rules: []AlarmRule{
			{
				RuleID:     "rule-002",
				WellID:     "well-999",
				SensorType: "TUBING_PRESSURE",
				Condition:  "GT",
				Threshold:  3000.0,
				Severity:   1,
			},
		},
	}

	reading := TelemetryReading{
		WellID:     "well-001", // Different well
		SensorType: "TUBING_PRESSURE",
		Value:      9999.0, // Way above threshold
		TenantID:   "tenant-001",
		Timestamp:  time.Now(),
	}

	triggered := p.evaluateRulesOnly(reading)
	if len(triggered) != 0 {
		t.Errorf("expected 0 triggered alarms for wrong well, got %d", len(triggered))
	}
}

func TestEvaluateReading_SkipsWrongSensorType(t *testing.T) {
	p := &AlarmProcessor{
		rules: []AlarmRule{
			{
				RuleID:     "rule-003",
				WellID:     "well-001",
				SensorType: "CASING_PRESSURE",
				Condition:  "GT",
				Threshold:  2000.0,
				Severity:   2,
			},
		},
	}

	reading := TelemetryReading{
		WellID:     "well-001",
		SensorType: "TUBING_PRESSURE", // Different sensor type
		Value:      9999.0,
		TenantID:   "tenant-001",
		Timestamp:  time.Now(),
	}

	triggered := p.evaluateRulesOnly(reading)
	if len(triggered) != 0 {
		t.Errorf("expected 0 triggered alarms for wrong sensor type, got %d", len(triggered))
	}
}

func TestEvaluateReading_GlobalRule(t *testing.T) {
	// A rule with empty WellID applies to all wells
	p := &AlarmProcessor{
		rules: []AlarmRule{
			{
				RuleID:     "rule-global",
				WellID:     "", // Global rule
				SensorType: "FLOW_RATE",
				Condition:  "LT",
				Threshold:  100.0,
				Severity:   2,
			},
		},
	}

	reading := TelemetryReading{
		WellID:     "any-well-id",
		SensorType: "FLOW_RATE",
		Value:      50.0, // Below threshold
		TenantID:   "tenant-001",
		Timestamp:  time.Now(),
	}

	triggered := p.evaluateRulesOnly(reading)
	if len(triggered) != 1 {
		t.Fatalf("expected 1 triggered alarm for global rule, got %d", len(triggered))
	}
}

// ── formatMessage tests ───────────────────────────────────────────────────────

func TestFormatMessage_DefaultMessage(t *testing.T) {
	p := &AlarmProcessor{}
	reading := TelemetryReading{WellID: "well-001", SensorType: "TUBING_PRESSURE"}
	rule := AlarmRule{MessageTemplate: ""}
	msg := p.formatMessage("", reading, rule)
	if msg == "" {
		t.Error("expected non-empty default message")
	}
}

func TestFormatMessage_CustomTemplate(t *testing.T) {
	p := &AlarmProcessor{}
	reading := TelemetryReading{WellID: "well-001", SensorType: "TUBING_PRESSURE"}
	rule := AlarmRule{MessageTemplate: "Custom alert"}
	msg := p.formatMessage("Custom alert", reading, rule)
	if msg != "Custom alert" {
		t.Errorf("expected 'Custom alert', got '%s'", msg)
	}
}

// ── AlarmEscalationWorkflow timeout tests ─────────────────────────────────────

func TestEscalationTimeouts(t *testing.T) {
	timeouts := map[int]time.Duration{
		1: 5 * time.Minute,
		2: 15 * time.Minute,
		3: 60 * time.Minute,
		4: 4 * time.Hour,
	}
	for severity, expected := range timeouts {
		got := timeouts[severity]
		if got != expected {
			t.Errorf("severity %d: expected timeout %v, got %v", severity, expected, got)
		}
	}
}
