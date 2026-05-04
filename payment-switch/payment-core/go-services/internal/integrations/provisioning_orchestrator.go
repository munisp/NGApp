// Package integrations provides production-ready external system integrations
// This file implements the production provisioning orchestrator
package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

// ProvisioningStep represents a step in the provisioning process
type ProvisioningStep string

const (
	StepValidateConfig   ProvisioningStep = "validate_config"
	StepHealthCheck      ProvisioningStep = "health_check"
	StepKeycloakSetup    ProvisioningStep = "keycloak_setup"
	StepAPISIXSetup      ProvisioningStep = "apisix_setup"
	StepTigerBeetleSetup ProvisioningStep = "tigerbeetle_setup"
	StepMojaloopSetup    ProvisioningStep = "mojaloop_setup"
	StepVerification     ProvisioningStep = "verification"
)

// ProvisioningStatus represents the status of a provisioning step
type ProvisioningStatus string

const (
	StatusPending    ProvisioningStatus = "pending"
	StatusInProgress ProvisioningStatus = "in_progress"
	StatusCompleted  ProvisioningStatus = "completed"
	StatusFailed     ProvisioningStatus = "failed"
	StatusSkipped    ProvisioningStatus = "skipped"
)

// ProvisioningMode represents the provisioning mode
type ProvisioningMode string

const (
	ModeProduction ProvisioningMode = "production"
	ModeSimulated  ProvisioningMode = "simulated"
	ModeDryRun     ProvisioningMode = "dry_run"
)

// ParticipantProvisionRequest represents a request to provision a participant
type ParticipantProvisionRequest struct {
	ParticipantID   string            `json:"participant_id"`
	ParticipantName string            `json:"participant_name"`
	AdminEmail      string            `json:"admin_email"`
	AdminPassword   string            `json:"admin_password"`
	Currency        string            `json:"currency"`
	BackendHost     string            `json:"backend_host"`
	BackendPort     int               `json:"backend_port"`
	InitialBalance  uint64            `json:"initial_balance"`
	Mode            ProvisioningMode  `json:"mode"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

// ProvisioningStepResult represents the result of a provisioning step
type ProvisioningStepResult struct {
	Step        ProvisioningStep   `json:"step"`
	Status      ProvisioningStatus `json:"status"`
	StartedAt   time.Time          `json:"started_at"`
	CompletedAt time.Time          `json:"completed_at,omitempty"`
	Duration    time.Duration      `json:"duration_ms,omitempty"`
	Message     string             `json:"message,omitempty"`
	Error       string             `json:"error,omitempty"`
	Details     map[string]string  `json:"details,omitempty"`
	ExternalIDs map[string]string  `json:"external_ids,omitempty"`
}

// ParticipantProvisionResult represents the complete result of provisioning
type ParticipantProvisionResult struct {
	ParticipantID string                   `json:"participant_id"`
	Mode          ProvisioningMode         `json:"mode"`
	Status        ProvisioningStatus       `json:"status"`
	StartedAt     time.Time                `json:"started_at"`
	CompletedAt   time.Time                `json:"completed_at,omitempty"`
	TotalDuration time.Duration            `json:"total_duration_ms,omitempty"`
	Steps         []ProvisioningStepResult `json:"steps"`
	ExternalIDs   map[string]string        `json:"external_ids"`
	Credentials   *ProvisionedCredentials  `json:"credentials,omitempty"`
	Error         string                   `json:"error,omitempty"`
}

// ProvisionedCredentials contains the credentials created during provisioning
type ProvisionedCredentials struct {
	KeycloakClientID     string `json:"keycloak_client_id,omitempty"`
	KeycloakClientSecret string `json:"keycloak_client_secret,omitempty"`
	KeycloakAdminUserID  string `json:"keycloak_admin_user_id,omitempty"`
	APISIXConsumerKey    string `json:"apisix_consumer_key,omitempty"`
	TigerBeetleAccountID string `json:"tigerbeetle_account_id,omitempty"`
	MojaloopFSPID        string `json:"mojaloop_fsp_id,omitempty"`
}

// ProductionProvisioningOrchestrator orchestrates production provisioning
type ProductionProvisioningOrchestrator struct {
	tigerbeetle   *ProductionTigerBeetleClient
	mojaloop      *ProductionMojaloopClient
	keycloak      *ProductionKeycloakClient
	apisix        *ProductionAPISIXClient
	healthChecker *ProductionHealthChecker

	mu         sync.Mutex
	activeJobs map[string]*ParticipantProvisionResult
}

// NewProductionProvisioningOrchestrator creates a new orchestrator
func NewProductionProvisioningOrchestrator(
	tigerbeetle *ProductionTigerBeetleClient,
	mojaloop *ProductionMojaloopClient,
	keycloak *ProductionKeycloakClient,
	apisix *ProductionAPISIXClient,
	healthChecker *ProductionHealthChecker,
) *ProductionProvisioningOrchestrator {
	return &ProductionProvisioningOrchestrator{
		tigerbeetle:   tigerbeetle,
		mojaloop:      mojaloop,
		keycloak:      keycloak,
		apisix:        apisix,
		healthChecker: healthChecker,
		activeJobs:    make(map[string]*ParticipantProvisionResult),
	}
}

// ProvisionParticipant provisions a new participant across all systems
func (o *ProductionProvisioningOrchestrator) ProvisionParticipant(ctx context.Context, req *ParticipantProvisionRequest) (*ParticipantProvisionResult, error) {
	o.mu.Lock()
	if _, exists := o.activeJobs[req.ParticipantID]; exists {
		o.mu.Unlock()
		return nil, fmt.Errorf("provisioning already in progress for participant: %s", req.ParticipantID)
	}

	result := &ParticipantProvisionResult{
		ParticipantID: req.ParticipantID,
		Mode:          req.Mode,
		Status:        StatusInProgress,
		StartedAt:     time.Now(),
		Steps:         make([]ProvisioningStepResult, 0),
		ExternalIDs:   make(map[string]string),
		Credentials:   &ProvisionedCredentials{},
	}
	o.activeJobs[req.ParticipantID] = result
	o.mu.Unlock()

	defer func() {
		o.mu.Lock()
		delete(o.activeJobs, req.ParticipantID)
		o.mu.Unlock()
	}()

	// Execute provisioning steps
	steps := []struct {
		step    ProvisioningStep
		execute func(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error
	}{
		{StepValidateConfig, o.stepValidateConfig},
		{StepHealthCheck, o.stepHealthCheck},
		{StepKeycloakSetup, o.stepKeycloakSetup},
		{StepAPISIXSetup, o.stepAPISIXSetup},
		{StepTigerBeetleSetup, o.stepTigerBeetleSetup},
		{StepMojaloopSetup, o.stepMojaloopSetup},
		{StepVerification, o.stepVerification},
	}

	for _, s := range steps {
		stepResult := ProvisioningStepResult{
			Step:        s.step,
			Status:      StatusInProgress,
			StartedAt:   time.Now(),
			Details:     make(map[string]string),
			ExternalIDs: make(map[string]string),
		}

		log.Printf("Provisioning %s: Starting step %s", req.ParticipantID, s.step)

		err := s.execute(ctx, req, result)

		stepResult.CompletedAt = time.Now()
		stepResult.Duration = stepResult.CompletedAt.Sub(stepResult.StartedAt)

		if err != nil {
			stepResult.Status = StatusFailed
			stepResult.Error = err.Error()
			result.Steps = append(result.Steps, stepResult)
			result.Status = StatusFailed
			result.Error = fmt.Sprintf("Step %s failed: %s", s.step, err.Error())
			result.CompletedAt = time.Now()
			result.TotalDuration = result.CompletedAt.Sub(result.StartedAt)

			log.Printf("Provisioning %s: Step %s failed: %v", req.ParticipantID, s.step, err)

			// Attempt rollback for production mode
			if req.Mode == ModeProduction {
				o.rollback(ctx, req, result)
			}

			return result, err
		}

		stepResult.Status = StatusCompleted
		stepResult.Message = fmt.Sprintf("Step %s completed successfully", s.step)
		result.Steps = append(result.Steps, stepResult)

		log.Printf("Provisioning %s: Step %s completed", req.ParticipantID, s.step)
	}

	result.Status = StatusCompleted
	result.CompletedAt = time.Now()
	result.TotalDuration = result.CompletedAt.Sub(result.StartedAt)

	log.Printf("Provisioning %s: Completed successfully in %v", req.ParticipantID, result.TotalDuration)

	return result, nil
}

// stepValidateConfig validates the provisioning configuration
func (o *ProductionProvisioningOrchestrator) stepValidateConfig(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error {
	if req.ParticipantID == "" {
		return fmt.Errorf("participant_id is required")
	}
	if req.ParticipantName == "" {
		return fmt.Errorf("participant_name is required")
	}
	if req.AdminEmail == "" {
		return fmt.Errorf("admin_email is required")
	}
	if req.AdminPassword == "" {
		return fmt.Errorf("admin_password is required")
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}
	if req.BackendHost == "" {
		return fmt.Errorf("backend_host is required")
	}
	if req.BackendPort == 0 {
		req.BackendPort = 8080
	}
	if req.Mode == "" {
		req.Mode = ModeProduction
	}

	return nil
}

// stepHealthCheck verifies all external services are healthy
func (o *ProductionProvisioningOrchestrator) stepHealthCheck(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error {
	if req.Mode == ModeDryRun {
		return nil // Skip health check in dry run mode
	}

	if o.healthChecker == nil {
		return fmt.Errorf("health checker not configured")
	}

	// Force a health check
	o.healthChecker.ForceCheck()

	// Get overall health
	overall := o.healthChecker.GetOverallHealth()

	if overall.Status == HealthStatusUnhealthy {
		return fmt.Errorf("external services unhealthy: %s", overall.Message)
	}

	// For production mode, require all services to be healthy
	if req.Mode == ModeProduction && overall.Status != HealthStatusHealthy {
		return fmt.Errorf("not all services healthy for production provisioning: %s", overall.Message)
	}

	return nil
}

// stepKeycloakSetup provisions Keycloak resources
func (o *ProductionProvisioningOrchestrator) stepKeycloakSetup(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error {
	if req.Mode == ModeDryRun {
		result.ExternalIDs["keycloak_client_id"] = req.ParticipantID + "-client (dry-run)"
		result.ExternalIDs["keycloak_user_id"] = req.ParticipantID + "-admin (dry-run)"
		return nil
	}

	if req.Mode == ModeSimulated {
		result.ExternalIDs["keycloak_client_id"] = req.ParticipantID + "-client (simulated)"
		result.ExternalIDs["keycloak_user_id"] = req.ParticipantID + "-admin (simulated)"
		result.Credentials.KeycloakClientID = req.ParticipantID + "-client"
		result.Credentials.KeycloakClientSecret = "simulated-secret"
		result.Credentials.KeycloakAdminUserID = "simulated-user-id"
		return nil
	}

	if o.keycloak == nil {
		return fmt.Errorf("Keycloak client not configured")
	}

	// Provision Keycloak resources
	kcResult, err := o.keycloak.ProvisionParticipant(
		ctx,
		req.ParticipantID,
		req.ParticipantName,
		req.AdminEmail,
		req.AdminPassword,
	)
	if err != nil {
		return fmt.Errorf("Keycloak provisioning failed: %w", err)
	}

	result.ExternalIDs["keycloak_client_uuid"] = kcResult.ClientUUID
	result.ExternalIDs["keycloak_user_id"] = kcResult.AdminUserID
	result.Credentials.KeycloakClientID = req.ParticipantID + "-client"
	result.Credentials.KeycloakClientSecret = kcResult.ClientSecret
	result.Credentials.KeycloakAdminUserID = kcResult.AdminUserID

	return nil
}

// stepAPISIXSetup provisions APISIX resources
func (o *ProductionProvisioningOrchestrator) stepAPISIXSetup(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error {
	if req.Mode == ModeDryRun {
		result.ExternalIDs["apisix_upstream_id"] = req.ParticipantID + "-upstream (dry-run)"
		result.ExternalIDs["apisix_route_id"] = req.ParticipantID + "-api (dry-run)"
		return nil
	}

	if req.Mode == ModeSimulated {
		result.ExternalIDs["apisix_upstream_id"] = req.ParticipantID + "-upstream (simulated)"
		result.ExternalIDs["apisix_route_id"] = req.ParticipantID + "-api (simulated)"
		result.Credentials.APISIXConsumerKey = req.ParticipantID + "-api-key"
		return nil
	}

	if o.apisix == nil {
		return fmt.Errorf("APISIX client not configured")
	}

	// Provision APISIX resources
	apisixResult, err := o.apisix.ProvisionParticipantRoutes(
		ctx,
		req.ParticipantID,
		req.BackendHost,
		req.BackendPort,
	)
	if err != nil {
		return fmt.Errorf("APISIX provisioning failed: %w", err)
	}

	result.ExternalIDs["apisix_upstream_id"] = apisixResult.UpstreamID
	result.ExternalIDs["apisix_route_id"] = apisixResult.APIRouteID
	result.ExternalIDs["apisix_consumer"] = apisixResult.ConsumerUsername
	result.Credentials.APISIXConsumerKey = req.ParticipantID + "-api-key"

	return nil
}

// stepTigerBeetleSetup provisions TigerBeetle accounts
func (o *ProductionProvisioningOrchestrator) stepTigerBeetleSetup(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error {
	if req.Mode == ModeDryRun {
		result.ExternalIDs["tigerbeetle_account_id"] = "dry-run-account-id"
		return nil
	}

	if req.Mode == ModeSimulated {
		result.ExternalIDs["tigerbeetle_account_id"] = "simulated-account-id"
		result.Credentials.TigerBeetleAccountID = "simulated-account-id"
		return nil
	}

	if o.tigerbeetle == nil {
		return fmt.Errorf("TigerBeetle client not configured")
	}

	// Generate account ID from participant ID
	accountID := generateAccountID(req.ParticipantID)

	// Get ledger for currency
	ledger := getCurrencyLedger(req.Currency)

	// Create account in TigerBeetle
	account := &TBAccount{
		ID:     Uint64ToID(accountID),
		Ledger: ledger,
		Code:   1, // Participant account
		Flags:  TBAccountFlagDebitsMustNotExceedCredits,
	}

	results, err := o.tigerbeetle.CreateAccounts(ctx, []*TBAccount{account})
	if err != nil {
		return fmt.Errorf("TigerBeetle account creation failed: %w", err)
	}

	// Check for errors in results
	for _, r := range results {
		if r.Result != 0 {
			return fmt.Errorf("TigerBeetle account creation error: result code %d", r.Result)
		}
	}

	result.ExternalIDs["tigerbeetle_account_id"] = fmt.Sprintf("%d", accountID)
	result.Credentials.TigerBeetleAccountID = fmt.Sprintf("%d", accountID)

	// If initial balance is specified, create a funding transfer
	if req.InitialBalance > 0 {
		// This would require a hub/treasury account to fund from
		// For now, just log the intent
		log.Printf("Initial balance of %d requested for %s (requires treasury account)", req.InitialBalance, req.ParticipantID)
	}

	return nil
}

// stepMojaloopSetup registers the participant with Mojaloop
func (o *ProductionProvisioningOrchestrator) stepMojaloopSetup(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error {
	if req.Mode == ModeDryRun {
		result.ExternalIDs["mojaloop_fsp_id"] = req.ParticipantID + " (dry-run)"
		return nil
	}

	if req.Mode == ModeSimulated {
		result.ExternalIDs["mojaloop_fsp_id"] = req.ParticipantID + " (simulated)"
		result.Credentials.MojaloopFSPID = req.ParticipantID
		return nil
	}

	if o.mojaloop == nil {
		return fmt.Errorf("Mojaloop client not configured")
	}

	// Register participant with Mojaloop Central Ledger
	err := o.mojaloop.RegisterParticipant(ctx, req.ParticipantID, req.Currency)
	if err != nil {
		return fmt.Errorf("Mojaloop registration failed: %w", err)
	}

	result.ExternalIDs["mojaloop_fsp_id"] = req.ParticipantID
	result.Credentials.MojaloopFSPID = req.ParticipantID

	return nil
}

// stepVerification verifies all provisioned resources
func (o *ProductionProvisioningOrchestrator) stepVerification(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) error {
	if req.Mode == ModeDryRun || req.Mode == ModeSimulated {
		return nil // Skip verification for non-production modes
	}

	// Verify Keycloak client exists
	if o.keycloak != nil {
		_, err := o.keycloak.GetClientByClientID(ctx, req.ParticipantID+"-client")
		if err != nil {
			return fmt.Errorf("Keycloak verification failed: %w", err)
		}
	}

	// Verify APISIX route exists
	if o.apisix != nil {
		_, err := o.apisix.GetRoute(ctx, req.ParticipantID+"-api")
		if err != nil {
			return fmt.Errorf("APISIX verification failed: %w", err)
		}
	}

	// Verify TigerBeetle account exists
	if o.tigerbeetle != nil {
		accountID := generateAccountID(req.ParticipantID)
		accounts, err := o.tigerbeetle.LookupAccounts(ctx, [][16]byte{Uint64ToID(accountID)})
		if err != nil {
			return fmt.Errorf("TigerBeetle verification failed: %w", err)
		}
		if len(accounts) == 0 {
			return fmt.Errorf("TigerBeetle account not found")
		}
	}

	return nil
}

// rollback attempts to rollback provisioned resources on failure
func (o *ProductionProvisioningOrchestrator) rollback(ctx context.Context, req *ParticipantProvisionRequest, result *ParticipantProvisionResult) {
	log.Printf("Provisioning %s: Starting rollback", req.ParticipantID)

	// Rollback in reverse order
	// Note: Some resources may not support deletion (e.g., TigerBeetle accounts)

	// Rollback APISIX
	if o.apisix != nil {
		if routeID, ok := result.ExternalIDs["apisix_route_id"]; ok && routeID != "" {
			if err := o.apisix.DeleteRoute(ctx, req.ParticipantID+"-api"); err != nil {
				log.Printf("Rollback: Failed to delete APISIX route: %v", err)
			}
		}
		if upstreamID, ok := result.ExternalIDs["apisix_upstream_id"]; ok && upstreamID != "" {
			if err := o.apisix.DeleteUpstream(ctx, req.ParticipantID+"-upstream"); err != nil {
				log.Printf("Rollback: Failed to delete APISIX upstream: %v", err)
			}
		}
		if err := o.apisix.DeleteConsumer(ctx, req.ParticipantID); err != nil {
			log.Printf("Rollback: Failed to delete APISIX consumer: %v", err)
		}
	}

	// Rollback Keycloak
	if o.keycloak != nil {
		if userID, ok := result.ExternalIDs["keycloak_user_id"]; ok && userID != "" {
			if err := o.keycloak.DeleteUser(ctx, userID); err != nil {
				log.Printf("Rollback: Failed to delete Keycloak user: %v", err)
			}
		}
		// Note: Client deletion would require the client UUID
	}

	// TigerBeetle accounts cannot be deleted, only disabled
	// Mojaloop participants cannot be easily removed

	log.Printf("Provisioning %s: Rollback completed", req.ParticipantID)
}

// GetProvisioningStatus returns the status of an active provisioning job
func (o *ProductionProvisioningOrchestrator) GetProvisioningStatus(participantID string) (*ParticipantProvisionResult, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()

	result, exists := o.activeJobs[participantID]
	return result, exists
}

// ToJSON returns the provisioning result as JSON
func (r *ParticipantProvisionResult) ToJSON() ([]byte, error) {
	return json.Marshal(r)
}

// Helper functions

// generateAccountID generates a TigerBeetle account ID from participant ID
func generateAccountID(participantID string) uint64 {
	// Simple hash-based ID generation
	// In production, use a more robust method
	var id uint64
	for i, c := range participantID {
		id += uint64(c) * uint64(i+1)
	}
	return id
}

// getCurrencyLedger returns the TigerBeetle ledger ID for a currency
func getCurrencyLedger(currency string) uint32 {
	ledgers := map[string]uint32{
		"USD": 1,
		"EUR": 2,
		"GBP": 3,
		"KES": 4,
		"NGN": 5,
		"ZAR": 6,
		"GHS": 7,
		"TZS": 8,
		"UGX": 9,
		"RWF": 10,
	}

	if ledger, ok := ledgers[currency]; ok {
		return ledger
	}
	return 1 // Default to USD ledger
}
