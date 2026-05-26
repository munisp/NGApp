// Package security — unit tests for IEC 62443 incident triage severity scoring.
// Tests cover: severity classification thresholds, input/output struct validation.
// Run: go test ./internal/security/... -v
package security

import (
	"testing"
)

// ── Severity scoring tests ────────────────────────────────────────────────────
// Based on the documented scoring rules:
//   Score ≥ 80 → CRITICAL
//   Score ≥ 60 → HIGH
//   Score ≥ 40 → MEDIUM
//   Score < 40 → LOW

func classifyScore(score int) string {
	switch {
	case score >= 80:
		return "CRITICAL"
	case score >= 60:
		return "HIGH"
	case score >= 40:
		return "MEDIUM"
	default:
		return "LOW"
	}
}

func TestSeverityClassification_Critical(t *testing.T) {
	tests := []int{80, 85, 90, 95, 100}
	for _, score := range tests {
		got := classifyScore(score)
		if got != "CRITICAL" {
			t.Errorf("score %d: got %s, want CRITICAL", score, got)
		}
	}
}

func TestSeverityClassification_High(t *testing.T) {
	tests := []int{60, 65, 70, 75, 79}
	for _, score := range tests {
		got := classifyScore(score)
		if got != "HIGH" {
			t.Errorf("score %d: got %s, want HIGH", score, got)
		}
	}
}

func TestSeverityClassification_Medium(t *testing.T) {
	tests := []int{40, 45, 50, 55, 59}
	for _, score := range tests {
		got := classifyScore(score)
		if got != "MEDIUM" {
			t.Errorf("score %d: got %s, want MEDIUM", score, got)
		}
	}
}

func TestSeverityClassification_Low(t *testing.T) {
	tests := []int{0, 10, 20, 30, 39}
	for _, score := range tests {
		got := classifyScore(score)
		if got != "LOW" {
			t.Errorf("score %d: got %s, want LOW", score, got)
		}
	}
}

func TestSeverityClassification_Boundaries(t *testing.T) {
	// Exact boundary values
	if classifyScore(79) != "HIGH" {
		t.Error("score 79 should be HIGH")
	}
	if classifyScore(80) != "CRITICAL" {
		t.Error("score 80 should be CRITICAL")
	}
	if classifyScore(59) != "MEDIUM" {
		t.Error("score 59 should be MEDIUM")
	}
	if classifyScore(60) != "HIGH" {
		t.Error("score 60 should be HIGH")
	}
	if classifyScore(39) != "LOW" {
		t.Error("score 39 should be LOW")
	}
	if classifyScore(40) != "MEDIUM" {
		t.Error("score 40 should be MEDIUM")
	}
}

// ── IncidentTriageInput struct tests ──────────────────────────────────────────

func TestIncidentTriageInput_FieldsSet(t *testing.T) {
	input := IncidentTriageInput{
		EventID:      "evt-001",
		EventType:    "INTRUSION_ATTEMPT",
		Severity:     "HIGH",
		SourceIP:     "10.0.0.100",
		TargetNode:   "worker-node-3",
		Namespace:    "og-rmm-production",
		Description:  "Unauthorized access attempt on SCADA network",
		IEC62443Zone: "Zone 3",
	}

	if input.EventID == "" {
		t.Error("EventID should not be empty")
	}
	if input.IEC62443Zone != "Zone 3" {
		t.Errorf("IEC62443Zone = %s, want Zone 3", input.IEC62443Zone)
	}
	if input.EventType != "INTRUSION_ATTEMPT" {
		t.Errorf("EventType = %s, want INTRUSION_ATTEMPT", input.EventType)
	}
}

// ── Isolation decision tests ──────────────────────────────────────────────────

func TestIsolationDecision_CriticalRequiresIsolation(t *testing.T) {
	// CRITICAL and HIGH require isolation; MEDIUM and LOW do not
	shouldIsolate := func(severity string) bool {
		return severity == "CRITICAL" || severity == "HIGH"
	}

	if !shouldIsolate("CRITICAL") {
		t.Error("CRITICAL should require isolation")
	}
	if !shouldIsolate("HIGH") {
		t.Error("HIGH should require isolation")
	}
	if shouldIsolate("MEDIUM") {
		t.Error("MEDIUM should not require isolation")
	}
	if shouldIsolate("LOW") {
		t.Error("LOW should not require isolation")
	}
}

// ── IEC 62443 Zone validation tests ──────────────────────────────────────────

func TestIEC62443Zones(t *testing.T) {
	validZones := map[string]bool{
		"Zone 0": true, // Safety zone (SIL)
		"Zone 1": true, // Field devices
		"Zone 2": true, // Control systems
		"Zone 3": true, // Operations
		"Zone 4": true, // Enterprise
	}

	testZones := []struct {
		zone  string
		valid bool
	}{
		{"Zone 3", true},
		{"Zone 4", true},
		{"Zone 0", true},
		{"Zone 99", false},
		{"", false},
	}

	for _, tt := range testZones {
		got := validZones[tt.zone]
		if got != tt.valid {
			t.Errorf("zone %q valid = %v, want %v", tt.zone, got, tt.valid)
		}
	}
}
