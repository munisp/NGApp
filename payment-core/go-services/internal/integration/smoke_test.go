package integration

import (
	"context"
	"testing"
	"time"
)

// TestMiddlewareHealthCheck validates the health checker initializes correctly
func TestMiddlewareHealthCheck(t *testing.T) {
	cfg := DefaultMiddlewareHealthConfig()
	mh := NewMiddlewareHealth(cfg)

	if len(mh.checks) != 16 {
		t.Errorf("Expected 16 middleware checks, got %d", len(mh.checks))
	}

	// Verify all expected services are present
	expected := map[string]bool{
		"kafka": true, "redis": true, "postgres": true, "temporal": true,
		"keycloak": true, "permify": true, "opensearch": true, "apisix": true,
		"tigerbeetle": true, "mojaloop": true, "fluvio": true, "dapr": true,
		"openappsec": true, "jaeger": true, "prometheus": true, "grafana": true,
	}

	for _, check := range mh.checks {
		if !expected[check.Name] {
			t.Errorf("Unexpected check: %s", check.Name)
		}
		delete(expected, check.Name)
	}

	if len(expected) > 0 {
		for name := range expected {
			t.Errorf("Missing check: %s", name)
		}
	}
}

// TestSeedDataServiceInit validates the seeder initializes with correct defaults
func TestSeedDataServiceInit(t *testing.T) {
	cfg := DefaultSeedConfig()
	if cfg.NumParticipants != 25 {
		t.Errorf("Expected 25 participants, got %d", cfg.NumParticipants)
	}
	if cfg.NumTransactions != 10000 {
		t.Errorf("Expected 10000 transactions, got %d", cfg.NumTransactions)
	}
	if cfg.NumKafkaTopics != 15 {
		t.Errorf("Expected 15 kafka topics, got %d", cfg.NumKafkaTopics)
	}

	svc := NewSeedDataService(cfg)
	if svc == nil {
		t.Fatal("SeedDataService should not be nil")
	}
}

// TestSeedDataExecution validates seeding runs without panics
func TestSeedDataExecution(t *testing.T) {
	cfg := DefaultSeedConfig()
	cfg.SeedTigerBeetle = false
	cfg.SeedPostgres = false
	cfg.SeedRedis = false
	cfg.NumTransactions = 10
	cfg.NumParticipants = 5

	svc := NewSeedDataService(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	results, err := svc.SeedAll(ctx)
	if err != nil {
		t.Fatalf("SeedAll failed: %v", err)
	}

	if len(results) != 9 {
		t.Errorf("Expected 9 seed results, got %d", len(results))
	}

	// All should succeed (they're stub implementations without real connections)
	for _, r := range results {
		if !r.Success {
			t.Errorf("Seeder %s failed: %s", r.Service, r.Error)
		}
	}

	// Verify JSON serialization
	data, err := svc.ToJSON(results)
	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}
	if len(data) == 0 {
		t.Error("JSON output should not be empty")
	}
}

// TestNigerianParticipants validates seed data generation
func TestNigerianParticipants(t *testing.T) {
	participants := generateNigerianParticipants(25)
	if len(participants) != 25 {
		t.Errorf("Expected 25 participants, got %d", len(participants))
	}

	// Verify real Nigerian banks are included
	found := map[string]bool{}
	for _, p := range participants {
		found[p.Code] = true
		if p.Currency != "NGN" {
			t.Errorf("Expected NGN currency for %s, got %s", p.Code, p.Currency)
		}
		if p.SettlementCap <= 0 {
			t.Errorf("Settlement cap should be positive for %s", p.Code)
		}
	}

	required := []string{"ACCESS", "GTB", "ZENITH", "UBA", "FIRSTBANK", "KUDA", "OPAY"}
	for _, code := range required {
		if !found[code] {
			t.Errorf("Missing required participant: %s", code)
		}
	}

	// Test generating more than base set
	participants50 := generateNigerianParticipants(50)
	if len(participants50) != 50 {
		t.Errorf("Expected 50 participants, got %d", len(participants50))
	}
}

// TestHealthCheckJSON validates JSON output format
func TestHealthCheckJSON(t *testing.T) {
	cfg := DefaultMiddlewareHealthConfig()
	mh := NewMiddlewareHealth(cfg)

	// Initialize with empty results
	data, err := mh.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}
	if len(data) == 0 {
		t.Error("JSON output should not be empty")
	}

	// Overall status should be healthy when no checks have run
	status := mh.GetOverallStatus()
	if status != "healthy" {
		t.Errorf("Expected healthy status with no results, got %s", status)
	}
}
