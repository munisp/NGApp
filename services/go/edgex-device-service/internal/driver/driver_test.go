// Package driver — unit tests for EdgeX OG field sensor driver.
// Tests cover: ParseModbusAddress, DeviceProfile, ProfileJSON.
// Run: go test ./internal/driver/... -v
package driver

import (
	"encoding/json"
	"testing"

	"github.com/edgexfoundry/go-mod-core-contracts/v3/models"
)

// ── ParseModbusAddress tests ──────────────────────────────────────────────────

func TestParseModbusAddress_ValidProps(t *testing.T) {
	props := models.ProtocolProperties{
		"host":   "192.168.1.100",
		"port":   "502",
		"unitID": "1",
	}
	host, port, unitID, err := ParseModbusAddress(props)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if host != "192.168.1.100" {
		t.Errorf("host = %s, want 192.168.1.100", host)
	}
	if port != 502 {
		t.Errorf("port = %d, want 502", port)
	}
	if unitID != 1 {
		t.Errorf("unitID = %d, want 1", unitID)
	}
}

func TestParseModbusAddress_DefaultPort(t *testing.T) {
	props := models.ProtocolProperties{
		"host":   "10.0.0.50",
		"port":   "invalid",
		"unitID": "5",
	}
	_, port, _, err := ParseModbusAddress(props)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should default to 502 when port is invalid
	if port != 502 {
		t.Errorf("default port = %d, want 502", port)
	}
}

func TestParseModbusAddress_DefaultUnitID(t *testing.T) {
	props := models.ProtocolProperties{
		"host":   "10.0.0.50",
		"port":   "502",
		"unitID": "invalid",
	}
	_, _, unitID, err := ParseModbusAddress(props)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should default to 1 when unitID is invalid
	if unitID != 1 {
		t.Errorf("default unitID = %d, want 1", unitID)
	}
}

func TestParseModbusAddress_MissingHost(t *testing.T) {
	props := models.ProtocolProperties{
		"port":   "502",
		"unitID": "1",
	}
	_, _, _, err := ParseModbusAddress(props)
	if err == nil {
		t.Error("expected error for missing host, got nil")
	}
}

func TestParseModbusAddress_NonStandardPort(t *testing.T) {
	props := models.ProtocolProperties{
		"host":   "rtu.field.local",
		"port":   "5020",
		"unitID": "3",
	}
	host, port, unitID, err := ParseModbusAddress(props)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if host != "rtu.field.local" {
		t.Errorf("host = %s, want rtu.field.local", host)
	}
	if port != 5020 {
		t.Errorf("port = %d, want 5020", port)
	}
	if unitID != 3 {
		t.Errorf("unitID = %d, want 3", unitID)
	}
}

// ── DeviceProfile tests ───────────────────────────────────────────────────────

func TestDeviceProfile_HasRequiredFields(t *testing.T) {
	profile := DeviceProfile()

	if profile["name"] == "" {
		t.Error("profile name should not be empty")
	}
	if profile["name"] != "og-field-sensor-profile" {
		t.Errorf("profile name = %v, want og-field-sensor-profile", profile["name"])
	}

	resources, ok := profile["deviceResources"].([]map[string]interface{})
	if !ok {
		t.Fatal("deviceResources should be a slice of maps")
	}
	if len(resources) == 0 {
		t.Error("deviceResources should not be empty")
	}
}

func TestDeviceProfile_HasPressureResource(t *testing.T) {
	profile := DeviceProfile()
	resources := profile["deviceResources"].([]map[string]interface{})

	found := false
	for _, r := range resources {
		if r["name"] == "Pressure" {
			found = true
			props := r["properties"].(map[string]interface{})
			if props["units"] != "psi" {
				t.Errorf("Pressure units = %v, want psi", props["units"])
			}
		}
	}
	if !found {
		t.Error("deviceResources should contain Pressure resource")
	}
}

func TestDeviceProfile_HasFlowRateResource(t *testing.T) {
	profile := DeviceProfile()
	resources := profile["deviceResources"].([]map[string]interface{})

	found := false
	for _, r := range resources {
		if r["name"] == "FlowRate" {
			found = true
			props := r["properties"].(map[string]interface{})
			if props["units"] != "bbl/d" {
				t.Errorf("FlowRate units = %v, want bbl/d", props["units"])
			}
		}
	}
	if !found {
		t.Error("deviceResources should contain FlowRate resource")
	}
}

func TestDeviceProfile_ValvePositionIsReadWrite(t *testing.T) {
	profile := DeviceProfile()
	resources := profile["deviceResources"].([]map[string]interface{})

	for _, r := range resources {
		if r["name"] == "ValvePosition" {
			props := r["properties"].(map[string]interface{})
			if props["readWrite"] != "RW" {
				t.Errorf("ValvePosition readWrite = %v, want RW", props["readWrite"])
			}
			return
		}
	}
	t.Error("ValvePosition resource not found")
}

// ── ProfileJSON tests ─────────────────────────────────────────────────────────

func TestProfileJSON_ValidJSON(t *testing.T) {
	b, err := ProfileJSON()
	if err != nil {
		t.Fatalf("ProfileJSON() error: %v", err)
	}
	if len(b) == 0 {
		t.Error("ProfileJSON() returned empty bytes")
	}

	// Verify it's valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Errorf("ProfileJSON() produced invalid JSON: %v", err)
	}
	if parsed["name"] != "og-field-sensor-profile" {
		t.Errorf("parsed name = %v, want og-field-sensor-profile", parsed["name"])
	}
}
