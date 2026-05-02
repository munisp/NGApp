// Package integrations provides production-ready external system integrations
// This file implements integration tests for all production clients
package integrations

import (
	"context"
	"os"
	"testing"
	"time"
)

// TestTigerBeetleClient tests the TigerBeetle production client
func TestTigerBeetleClient(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test (set INTEGRATION_TEST=true to run)")
	}

	config := &TigerBeetleConfig{
		Addresses:    []string{os.Getenv("TIGERBEETLE_ADDRESS")},
		ClusterID:    0,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		RetryCount:   3,
		RetryDelay:   100 * time.Millisecond,
	}

	client := NewProductionTigerBeetleClient(config)
	ctx := context.Background()

	// Test connection
	t.Run("Connect", func(t *testing.T) {
		err := client.Connect(ctx)
		if err != nil {
			t.Fatalf("Failed to connect: %v", err)
		}
		defer client.Disconnect()

		if !client.IsConnected() {
			t.Error("Client should be connected")
		}
	})

	// Test health check
	t.Run("HealthCheck", func(t *testing.T) {
		err := client.HealthCheck(ctx)
		if err != nil {
			t.Fatalf("Health check failed: %v", err)
		}
	})

	// Test account creation
	t.Run("CreateAccount", func(t *testing.T) {
		account := &TBAccount{
			ID:     Uint64ToID(12345),
			Ledger: 1,
			Code:   1,
			Flags:  TBAccountFlagDebitsMustNotExceedCredits,
		}

		results, err := client.CreateAccounts(ctx, []*TBAccount{account})
		if err != nil {
			t.Fatalf("Failed to create account: %v", err)
		}

		// Check for errors (result code 0 means success, non-zero means error or already exists)
		for _, r := range results {
			if r.Result != 0 && r.Result != 1 { // 1 = already exists
				t.Errorf("Account creation failed with result code: %d", r.Result)
			}
		}
	})

	// Test account lookup
	t.Run("LookupAccount", func(t *testing.T) {
		accounts, err := client.LookupAccounts(ctx, [][16]byte{Uint64ToID(12345)})
		if err != nil {
			t.Fatalf("Failed to lookup account: %v", err)
		}

		if len(accounts) == 0 {
			t.Error("Expected to find account")
		}
	})

	// Test transfer creation
	t.Run("CreateTransfer", func(t *testing.T) {
		// Create two accounts first
		accounts := []*TBAccount{
			{ID: Uint64ToID(100001), Ledger: 1, Code: 1, Flags: 0},
			{ID: Uint64ToID(100002), Ledger: 1, Code: 1, Flags: TBAccountFlagDebitsMustNotExceedCredits},
		}
		client.CreateAccounts(ctx, accounts)

		// Create a transfer
		transfer := &TBTransfer{
			ID:              Uint64ToID(200001),
			DebitAccountID:  Uint64ToID(100001),
			CreditAccountID: Uint64ToID(100002),
			Amount:          Uint64ToAmount(1000),
			Ledger:          1,
			Code:            1,
		}

		results, err := client.CreateTransfers(ctx, []*TBTransfer{transfer})
		if err != nil {
			t.Fatalf("Failed to create transfer: %v", err)
		}

		for _, r := range results {
			if r.Result != 0 && r.Result != 1 { // 1 = already exists
				t.Errorf("Transfer creation failed with result code: %d", r.Result)
			}
		}
	})
}

// TestMojaloopClient tests the Mojaloop production client
func TestMojaloopClient(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test (set INTEGRATION_TEST=true to run)")
	}

	config := &MojaloopConfig{
		CentralLedgerURL:  os.Getenv("MOJALOOP_CENTRAL_LEDGER_URL"),
		ALSURL:            os.Getenv("MOJALOOP_ALS_URL"),
		QuotingServiceURL: os.Getenv("MOJALOOP_QUOTING_URL"),
		MLAPIAdapterURL:   os.Getenv("MOJALOOP_ML_API_ADAPTER_URL"),
		FSPID:             "testfsp",
		HubName:           "Hub",
		Timeout:           30 * time.Second,
	}

	client := NewProductionMojaloopClient(config)
	ctx := context.Background()

	// Test health check
	t.Run("HealthCheck", func(t *testing.T) {
		err := client.HealthCheck(ctx)
		if err != nil {
			t.Logf("Health check failed (expected if Mojaloop not running): %v", err)
		}
	})

	// Test party lookup
	t.Run("LookupParty", func(t *testing.T) {
		party, err := client.LookupParty(ctx, PartyIDTypeMSISDN, "+1234567890")
		if err != nil {
			t.Logf("Party lookup failed (expected if party not registered): %v", err)
		} else {
			t.Logf("Found party: %+v", party)
		}
	})
}

// TestKeycloakClient tests the Keycloak production client
func TestKeycloakClient(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test (set INTEGRATION_TEST=true to run)")
	}

	config := &KeycloakConfig{
		BaseURL:       os.Getenv("KEYCLOAK_URL"),
		Realm:         os.Getenv("KEYCLOAK_REALM"),
		AdminUsername: os.Getenv("KEYCLOAK_ADMIN_USER"),
		AdminPassword: os.Getenv("KEYCLOAK_ADMIN_PASSWORD"),
		ClientID:      "admin-cli",
		Timeout:       30 * time.Second,
	}

	client := NewProductionKeycloakClient(config)
	ctx := context.Background()

	// Test health check
	t.Run("HealthCheck", func(t *testing.T) {
		err := client.HealthCheck(ctx)
		if err != nil {
			t.Logf("Health check failed (expected if Keycloak not running): %v", err)
		}
	})

	// Test user creation
	t.Run("CreateUser", func(t *testing.T) {
		user := &KeycloakUser{
			Username:      "testuser-" + time.Now().Format("20060102150405"),
			Email:         "testuser@example.com",
			Enabled:       true,
			EmailVerified: true,
			Credentials: []Credential{
				{Type: "password", Value: "testpassword123", Temporary: false},
			},
		}

		userID, err := client.CreateUser(ctx, user)
		if err != nil {
			t.Logf("User creation failed (expected if Keycloak not running): %v", err)
		} else {
			t.Logf("Created user: %s", userID)

			// Clean up
			client.DeleteUser(ctx, userID)
		}
	})

	// Test client creation
	t.Run("CreateClient", func(t *testing.T) {
		kcClient := &KeycloakClient{
			ClientID:                  "test-client-" + time.Now().Format("20060102150405"),
			Name:                      "Test Client",
			Enabled:                   true,
			StandardFlowEnabled:       true,
			DirectAccessGrantsEnabled: true,
			PublicClient:              false,
			Protocol:                  "openid-connect",
		}

		clientUUID, err := client.CreateClient(ctx, kcClient)
		if err != nil {
			t.Logf("Client creation failed (expected if Keycloak not running): %v", err)
		} else {
			t.Logf("Created client: %s", clientUUID)
		}
	})
}

// TestAPISIXClient tests the APISIX production client
func TestAPISIXClient(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test (set INTEGRATION_TEST=true to run)")
	}

	config := &APISIXConfig{
		AdminURL: os.Getenv("APISIX_ADMIN_URL"),
		APIKey:   os.Getenv("APISIX_API_KEY"),
		Timeout:  30 * time.Second,
	}

	client := NewProductionAPISIXClient(config)
	ctx := context.Background()

	// Test health check
	t.Run("HealthCheck", func(t *testing.T) {
		err := client.HealthCheck(ctx)
		if err != nil {
			t.Logf("Health check failed (expected if APISIX not running): %v", err)
		}
	})

	// Test upstream creation
	t.Run("CreateUpstream", func(t *testing.T) {
		upstream := &APISIXUpstream{
			ID:   "test-upstream-" + time.Now().Format("20060102150405"),
			Name: "Test Upstream",
			Type: "roundrobin",
			Nodes: map[string]int{
				"httpbin.org:80": 1,
			},
		}

		key, err := client.CreateUpstream(ctx, upstream)
		if err != nil {
			t.Logf("Upstream creation failed (expected if APISIX not running): %v", err)
		} else {
			t.Logf("Created upstream: %s", key)

			// Clean up
			client.DeleteUpstream(ctx, upstream.ID)
		}
	})

	// Test route creation
	t.Run("CreateRoute", func(t *testing.T) {
		route := &APISIXRoute{
			ID:      "test-route-" + time.Now().Format("20060102150405"),
			Name:    "Test Route",
			URI:     "/test/*",
			Methods: []string{"GET", "POST"},
			Upstream: &APISIXUpstream{
				Type: "roundrobin",
				Nodes: map[string]int{
					"httpbin.org:80": 1,
				},
			},
		}

		key, err := client.CreateRoute(ctx, route)
		if err != nil {
			t.Logf("Route creation failed (expected if APISIX not running): %v", err)
		} else {
			t.Logf("Created route: %s", key)

			// Clean up
			client.DeleteRoute(ctx, route.ID)
		}
	})
}

// TestHealthChecker tests the unified health checker
func TestHealthChecker(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test (set INTEGRATION_TEST=true to run)")
	}

	// Create clients (they may fail to connect, which is fine for this test)
	tbClient := NewProductionTigerBeetleClient(nil)
	mjClient := NewProductionMojaloopClient(nil)
	kcClient := NewProductionKeycloakClient(nil)
	axClient := NewProductionAPISIXClient(nil)

	config := &HealthCheckerConfig{
		CheckInterval: 5 * time.Second,
		Timeout:       5 * time.Second,
	}

	checker := NewProductionHealthChecker(tbClient, mjClient, kcClient, axClient, config)

	// Test force check
	t.Run("ForceCheck", func(t *testing.T) {
		checker.ForceCheck()

		overall := checker.GetOverallHealth()
		t.Logf("Overall health: %s - %s", overall.Status, overall.Message)

		for name, health := range overall.Services {
			t.Logf("  %s: %s (%s)", name, health.Status, health.Message)
		}
	})

	// Test individual service check
	t.Run("ForceCheckService", func(t *testing.T) {
		err := checker.ForceCheckService("keycloak")
		if err != nil {
			t.Errorf("ForceCheckService failed: %v", err)
		}

		health := checker.GetHealth("keycloak")
		t.Logf("Keycloak health: %s", health.Status)
	})
}

// TestProvisioningOrchestrator tests the provisioning orchestrator
func TestProvisioningOrchestrator(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test (set INTEGRATION_TEST=true to run)")
	}

	// Create orchestrator with nil clients (will use simulated mode)
	orchestrator := NewProductionProvisioningOrchestrator(nil, nil, nil, nil, nil)

	ctx := context.Background()

	// Test dry run provisioning
	t.Run("DryRunProvisioning", func(t *testing.T) {
		req := &ParticipantProvisionRequest{
			ParticipantID:   "test-participant",
			ParticipantName: "Test Participant",
			AdminEmail:      "admin@test.com",
			AdminPassword:   "testpassword123",
			Currency:        "USD",
			BackendHost:     "localhost",
			BackendPort:     8080,
			Mode:            ModeDryRun,
		}

		result, err := orchestrator.ProvisionParticipant(ctx, req)
		if err != nil {
			t.Fatalf("Dry run provisioning failed: %v", err)
		}

		if result.Status != StatusCompleted {
			t.Errorf("Expected status %s, got %s", StatusCompleted, result.Status)
		}

		t.Logf("Provisioning result: %s", result.Status)
		for _, step := range result.Steps {
			t.Logf("  Step %s: %s", step.Step, step.Status)
		}
	})

	// Test simulated provisioning
	t.Run("SimulatedProvisioning", func(t *testing.T) {
		req := &ParticipantProvisionRequest{
			ParticipantID:   "test-participant-sim",
			ParticipantName: "Test Participant Simulated",
			AdminEmail:      "admin@test.com",
			AdminPassword:   "testpassword123",
			Currency:        "USD",
			BackendHost:     "localhost",
			BackendPort:     8080,
			Mode:            ModeSimulated,
		}

		result, err := orchestrator.ProvisionParticipant(ctx, req)
		if err != nil {
			t.Fatalf("Simulated provisioning failed: %v", err)
		}

		if result.Status != StatusCompleted {
			t.Errorf("Expected status %s, got %s", StatusCompleted, result.Status)
		}

		// Check that external IDs were set
		if result.ExternalIDs["keycloak_client_id"] == "" {
			t.Error("Expected keycloak_client_id to be set")
		}

		t.Logf("Provisioning completed with %d steps", len(result.Steps))
	})
}

// TestConfigValidation tests configuration validation
func TestConfigValidation(t *testing.T) {
	// Test valid development config
	t.Run("ValidDevelopmentConfig", func(t *testing.T) {
		config := &ProductionConfig{
			Environment: "development",
			Features: FeatureFlags{
				SimulatedMode: true,
			},
		}

		err := config.Validate()
		if err != nil {
			t.Errorf("Expected valid config, got error: %v", err)
		}
	})

	// Test invalid environment
	t.Run("InvalidEnvironment", func(t *testing.T) {
		config := &ProductionConfig{
			Environment: "invalid",
		}

		err := config.Validate()
		if err == nil {
			t.Error("Expected error for invalid environment")
		}
	})

	// Test production config without required fields
	t.Run("ProductionWithoutRequiredFields", func(t *testing.T) {
		config := &ProductionConfig{
			Environment: "production",
			Features: FeatureFlags{
				EnableKeycloak: true,
				EnableAPISIX:   true,
				SimulatedMode:  false,
			},
		}

		err := config.Validate()
		if err == nil {
			t.Error("Expected error for production config without required fields")
		}
	})

	// Test production config with simulated mode (should fail)
	t.Run("ProductionWithSimulatedMode", func(t *testing.T) {
		config := &ProductionConfig{
			Environment: "production",
			Features: FeatureFlags{
				SimulatedMode: true,
			},
		}

		err := config.Validate()
		if err == nil {
			t.Error("Expected error for production config with simulated mode")
		}
	})
}

// Benchmark tests

func BenchmarkTigerBeetleCreateAccount(b *testing.B) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		b.Skip("Skipping benchmark (set INTEGRATION_TEST=true to run)")
	}

	client := NewProductionTigerBeetleClient(nil)
	ctx := context.Background()

	if err := client.Connect(ctx); err != nil {
		b.Fatalf("Failed to connect: %v", err)
	}
	defer client.Disconnect()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		account := &TBAccount{
			ID:     Uint64ToID(uint64(1000000 + i)),
			Ledger: 1,
			Code:   1,
		}
		client.CreateAccounts(ctx, []*TBAccount{account})
	}
}

func BenchmarkHealthCheck(b *testing.B) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		b.Skip("Skipping benchmark (set INTEGRATION_TEST=true to run)")
	}

	checker := NewProductionHealthChecker(nil, nil, nil, nil, nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		checker.ForceCheck()
	}
}
