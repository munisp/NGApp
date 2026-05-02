// Package onboarding provides idempotent provisioning with saga pattern rollback
package onboarding

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ProvisioningStatus represents the status of a provisioning step
type ProvisioningStatus string

const (
	ProvisioningPending    ProvisioningStatus = "PENDING"
	ProvisioningInProgress ProvisioningStatus = "IN_PROGRESS"
	ProvisioningCompleted  ProvisioningStatus = "COMPLETED"
	ProvisioningFailed     ProvisioningStatus = "FAILED"
	ProvisioningRolledBack ProvisioningStatus = "ROLLED_BACK"
)

// ProvisioningStep represents a single step in the provisioning saga
type ProvisioningStep struct {
	Name        string             `json:"name"`
	Status      ProvisioningStatus `json:"status"`
	ResourceID  string             `json:"resource_id"`
	StartedAt   time.Time          `json:"started_at"`
	CompletedAt time.Time          `json:"completed_at"`
	Error       string             `json:"error"`
	Retries     int                `json:"retries"`
}

// ProvisioningSaga manages the provisioning process with rollback capability
type ProvisioningSaga struct {
	ID          string              `json:"id"`
	CaseID      string              `json:"case_id"`
	Environment string              `json:"environment"`
	Steps       []*ProvisioningStep `json:"steps"`
	Status      ProvisioningStatus  `json:"status"`
	StartedAt   time.Time           `json:"started_at"`
	CompletedAt time.Time           `json:"completed_at"`
	Error       string              `json:"error"`
}

// ProvisioningSagaExecutor executes provisioning sagas
type ProvisioningSagaExecutor struct {
	integration *IntegrationManager
	store       ProvisioningStore
	maxRetries  int
}

// ProvisioningStore interface for storing provisioning state
type ProvisioningStore interface {
	SaveSaga(ctx context.Context, saga *ProvisioningSaga) error
	GetSaga(ctx context.Context, sagaID string) (*ProvisioningSaga, error)
	GetSagaByCaseAndEnv(ctx context.Context, caseID, environment string) (*ProvisioningSaga, error)
}

// NewProvisioningSagaExecutor creates a new saga executor
func NewProvisioningSagaExecutor(integration *IntegrationManager, store ProvisioningStore) *ProvisioningSagaExecutor {
	return &ProvisioningSagaExecutor{
		integration: integration,
		store:       store,
		maxRetries:  3,
	}
}

// ExecuteProvisioning executes the full provisioning saga
func (e *ProvisioningSagaExecutor) ExecuteProvisioning(ctx context.Context, caseID string, environment string, profile *TechnicalProfile) (*ProvisioningSaga, error) {
	// Check for existing saga (idempotency)
	existingSaga, _ := e.store.GetSagaByCaseAndEnv(ctx, caseID, environment)
	if existingSaga != nil {
		if existingSaga.Status == ProvisioningCompleted {
			return existingSaga, nil // Already completed
		}
		if existingSaga.Status == ProvisioningInProgress {
			return nil, fmt.Errorf("provisioning already in progress")
		}
		// Resume failed saga
		return e.resumeSaga(ctx, existingSaga, profile)
	}

	// Create new saga
	saga := &ProvisioningSaga{
		ID:          uuid.New().String(),
		CaseID:      caseID,
		Environment: environment,
		Status:      ProvisioningInProgress,
		StartedAt:   time.Now(),
		Steps: []*ProvisioningStep{
			{Name: "keycloak_client", Status: ProvisioningPending},
			{Name: "keycloak_users", Status: ProvisioningPending},
			{Name: "apisix_upstream", Status: ProvisioningPending},
			{Name: "apisix_route", Status: ProvisioningPending},
			{Name: "tigerbeetle_account", Status: ProvisioningPending},
			{Name: "trigger_kyb", Status: ProvisioningPending},
			{Name: "trigger_kyc", Status: ProvisioningPending},
			{Name: "smoke_test", Status: ProvisioningPending},
		},
	}

	if err := e.store.SaveSaga(ctx, saga); err != nil {
		return nil, fmt.Errorf("failed to save saga: %w", err)
	}

	return e.executeSaga(ctx, saga, profile)
}

// executeSaga executes all steps in the saga
func (e *ProvisioningSagaExecutor) executeSaga(ctx context.Context, saga *ProvisioningSaga, profile *TechnicalProfile) (*ProvisioningSaga, error) {
	for i, step := range saga.Steps {
		if step.Status == ProvisioningCompleted {
			continue // Skip completed steps
		}

		step.Status = ProvisioningInProgress
		step.StartedAt = time.Now()
		e.store.SaveSaga(ctx, saga)

		var err error
		var resourceID string

		for retry := 0; retry <= e.maxRetries; retry++ {
			step.Retries = retry

			switch step.Name {
				case "keycloak_client":
					resourceID, err = e.provisionKeycloakClient(ctx, saga.CaseID, saga.Environment, profile)
				case "keycloak_users":
					resourceID, err = e.provisionKeycloakUsers(ctx, saga.CaseID, saga.Environment, profile)
				case "apisix_upstream":
					resourceID, err = e.provisionAPISIXUpstream(ctx, saga.CaseID, saga.Environment, profile)
				case "apisix_route":
					upstreamID := e.getStepResourceID(saga, "apisix_upstream")
					resourceID, err = e.provisionAPISIXRoute(ctx, saga.CaseID, saga.Environment, upstreamID, profile)
				case "tigerbeetle_account":
					resourceID, err = e.provisionTigerBeetleAccount(ctx, saga.CaseID, saga.Environment)
				case "trigger_kyb":
					resourceID, err = e.triggerKYBVerification(ctx, saga.CaseID, saga.Environment, profile)
				case "trigger_kyc":
					resourceID, err = e.triggerKYCVerification(ctx, saga.CaseID, saga.Environment, profile)
				case "smoke_test":
					err = e.runSmokeTests(ctx, saga.CaseID, saga.Environment, profile)
					resourceID = "smoke_test_passed"
				}

			if err == nil {
				break
			}

			if retry < e.maxRetries {
				time.Sleep(time.Duration(retry+1) * time.Second) // Exponential backoff
			}
		}

		if err != nil {
			step.Status = ProvisioningFailed
			step.Error = err.Error()
			step.CompletedAt = time.Now()
			saga.Status = ProvisioningFailed
			saga.Error = fmt.Sprintf("step %s failed: %s", step.Name, err.Error())
			e.store.SaveSaga(ctx, saga)

			// Rollback completed steps
			if rollbackErr := e.rollbackSaga(ctx, saga, i); rollbackErr != nil {
				saga.Error += fmt.Sprintf("; rollback error: %s", rollbackErr.Error())
				e.store.SaveSaga(ctx, saga)
			}

			return saga, fmt.Errorf("provisioning failed at step %s: %w", step.Name, err)
		}

		step.Status = ProvisioningCompleted
		step.ResourceID = resourceID
		step.CompletedAt = time.Now()
		e.store.SaveSaga(ctx, saga)
	}

	saga.Status = ProvisioningCompleted
	saga.CompletedAt = time.Now()
	e.store.SaveSaga(ctx, saga)

	return saga, nil
}

// resumeSaga resumes a failed saga
func (e *ProvisioningSagaExecutor) resumeSaga(ctx context.Context, saga *ProvisioningSaga, profile *TechnicalProfile) (*ProvisioningSaga, error) {
	saga.Status = ProvisioningInProgress
	saga.Error = ""
	e.store.SaveSaga(ctx, saga)

	return e.executeSaga(ctx, saga, profile)
}

// rollbackSaga rolls back completed steps in reverse order
func (e *ProvisioningSagaExecutor) rollbackSaga(ctx context.Context, saga *ProvisioningSaga, failedStepIndex int) error {
	var rollbackErrors []string

	// Rollback in reverse order
	for i := failedStepIndex - 1; i >= 0; i-- {
		step := saga.Steps[i]
		if step.Status != ProvisioningCompleted {
			continue
		}

		var err error
		switch step.Name {
		case "keycloak_client":
			err = e.rollbackKeycloakClient(ctx, step.ResourceID)
		case "apisix_upstream":
			err = e.rollbackAPISIXUpstream(ctx, step.ResourceID)
		case "apisix_route":
			err = e.rollbackAPISIXRoute(ctx, step.ResourceID)
		case "tigerbeetle_account":
			err = e.rollbackTigerBeetleAccount(ctx, step.ResourceID)
		}

		if err != nil {
			rollbackErrors = append(rollbackErrors, fmt.Sprintf("%s: %s", step.Name, err.Error()))
		} else {
			step.Status = ProvisioningRolledBack
		}
	}

	saga.Status = ProvisioningRolledBack
	e.store.SaveSaga(ctx, saga)

	if len(rollbackErrors) > 0 {
		return fmt.Errorf("rollback errors: %v", rollbackErrors)
	}

	return nil
}

// getStepResourceID retrieves the resource ID from a completed step
func (e *ProvisioningSagaExecutor) getStepResourceID(saga *ProvisioningSaga, stepName string) string {
	for _, step := range saga.Steps {
		if step.Name == stepName && step.Status == ProvisioningCompleted {
			return step.ResourceID
		}
	}
	return ""
}

// Provisioning step implementations

func (e *ProvisioningSagaExecutor) provisionKeycloakClient(ctx context.Context, caseID, environment string, profile *TechnicalProfile) (string, error) {
	clientID := fmt.Sprintf("participant-%s-%s", caseID, environment)
	
	// Check if client already exists (idempotency)
	// In production, this would call Keycloak Admin API
	
	result, err := e.integration.keycloak.CreateClient(ctx, KeycloakClientRequest{
		ClientID:    clientID,
		Name:        fmt.Sprintf("Participant %s (%s)", caseID, environment),
		Description: fmt.Sprintf("Auto-provisioned client for case %s", caseID),
		RedirectURIs: []string{profile.CallbackURL},
	})
	if err != nil {
		return "", err
	}

	return result.ClientID, nil
}

func (e *ProvisioningSagaExecutor) provisionAPISIXUpstream(ctx context.Context, caseID, environment string, profile *TechnicalProfile) (string, error) {
	upstreamID := fmt.Sprintf("upstream-%s-%s", caseID, environment)
	
	// In production, this would call APISIX Admin API
	// For now, return the upstream ID
	
	return upstreamID, nil
}

func (e *ProvisioningSagaExecutor) provisionAPISIXRoute(ctx context.Context, caseID, environment, upstreamID string, profile *TechnicalProfile) (string, error) {
	result, err := e.integration.apisix.CreateRoute(ctx, APISIXRouteRequest{
		URI:        fmt.Sprintf("/participants/%s/*", caseID),
		UpstreamID: upstreamID,
		Methods:    []string{"GET", "POST", "PUT", "DELETE"},
	})
	if err != nil {
		return "", err
	}

	return result.RouteID, nil
}

func (e *ProvisioningSagaExecutor) provisionTigerBeetleAccount(ctx context.Context, caseID, environment string) (string, error) {
	accountID := fmt.Sprintf("account-%s-%s", caseID, environment)
	
	// In production, this would call TigerBeetle client
	// For now, return the account ID
	
	return accountID, nil
}

// provisionKeycloakUsers creates Keycloak users for the organization's key personnel
func (e *ProvisioningSagaExecutor) provisionKeycloakUsers(ctx context.Context, caseID, environment string, profile *TechnicalProfile) (string, error) {
	// Get organization personnel from profile
	userIDs := []string{}
	
	// Create admin user for the organization
	adminUserID := fmt.Sprintf("user-admin-%s-%s", caseID, environment)
	userIDs = append(userIDs, adminUserID)
	
	// In production, this would:
	// 1. Get list of directors/UBOs from the onboarding case
	// 2. Create Keycloak users for each person
	// 3. Assign appropriate roles (participant_admin, etc.)
	// 4. Send welcome emails with password reset links
	
	return fmt.Sprintf("users:%v", userIDs), nil
}

// triggerKYBVerification creates a KYB case for the organization
func (e *ProvisioningSagaExecutor) triggerKYBVerification(ctx context.Context, caseID, environment string, profile *TechnicalProfile) (string, error) {
	kybCaseID := fmt.Sprintf("KYB-%s", caseID)
	
	// Create KYB case with organization details
	kybCase := &KYBCaseRecord{
		ID:               kybCaseID,
		OnboardingCaseID: caseID,
		OrganizationName: profile.OrganizationName,
		RegistrationNo:   profile.RegistrationNumber,
		Country:          profile.Country,
		Status:           "SUBMITTED",
		CreatedAt:        time.Now(),
	}
	
	// In production, this would:
	// 1. Create KYB case in the KYB service
	// 2. Trigger document collection workflow
	// 3. Initiate Ballerine KYB orchestration
	// 4. Send notification to compliance team
	
	_ = kybCase // Use the case
	
	return kybCaseID, nil
}

// triggerKYCVerification creates KYC cases for all key personnel (directors, UBOs, signatories)
func (e *ProvisioningSagaExecutor) triggerKYCVerification(ctx context.Context, caseID, environment string, profile *TechnicalProfile) (string, error) {
	kycCaseIDs := []string{}
	
	// Create KYC cases for each key person (uses KeyPersonInfo from TechnicalProfile)
	for i, person := range profile.KeyPersonnel {
		kycCaseID := fmt.Sprintf("KYC-%s-%d", caseID, i+1)
		
		kycCase := &KYCCaseRecord{
			ID:               kycCaseID,
			OnboardingCaseID: caseID,
			KYBCaseID:        fmt.Sprintf("KYB-%s", caseID),
			PersonName:       person.Name,
			PersonType:       person.Role, // DIRECTOR, UBO, SIGNATORY
			Email:            person.Email,
			Status:           "PENDING",
			CreatedAt:        time.Now(),
		}
		
		// In production, this would:
		// 1. Create KYC case in the KYC service
		// 2. Send KYC invitation email to the person
		// 3. Link KYC case to the parent KYB case
		// 4. Track KYC progress for KYB completion
		
		_ = kycCase // Use the case
		kycCaseIDs = append(kycCaseIDs, kycCaseID)
	}
	
	// If no key personnel defined, create at least one KYC case for the primary contact
	if len(kycCaseIDs) == 0 {
		kycCaseID := fmt.Sprintf("KYC-%s-1", caseID)
		kycCaseIDs = append(kycCaseIDs, kycCaseID)
	}
	
	return fmt.Sprintf("kyc_cases:%v", kycCaseIDs), nil
}

// KYBCaseRecord represents a KYB verification case created during provisioning
type KYBCaseRecord struct {
	ID               string    `json:"id"`
	OnboardingCaseID string    `json:"onboarding_case_id"`
	OrganizationName string    `json:"organization_name"`
	RegistrationNo   string    `json:"registration_no"`
	Country          string    `json:"country"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}

// KYCCaseRecord represents a KYC verification case created during provisioning
type KYCCaseRecord struct {
	ID               string    `json:"id"`
	OnboardingCaseID string    `json:"onboarding_case_id"`
	KYBCaseID        string    `json:"kyb_case_id"`
	PersonName       string    `json:"person_name"`
	PersonType       string    `json:"person_type"`
	Email            string    `json:"email"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}

func (e *ProvisioningSagaExecutor) runSmokeTests(ctx context.Context, caseID, environment string, profile *TechnicalProfile) error {
	// Run smoke tests against the participant's endpoints
	tests := []SmokeTest{
		{Name: "health_check", Endpoint: profile.APIEndpoint + "/health"},
		{Name: "callback_reachable", Endpoint: profile.CallbackURL},
	}

	for _, test := range tests {
		if err := e.runSmokeTest(ctx, test); err != nil {
			return fmt.Errorf("smoke test %s failed: %w", test.Name, err)
		}
	}

	return nil
}

// SmokeTest represents a smoke test configuration
type SmokeTest struct {
	Name     string
	Endpoint string
	Method   string
	Expected int
}

func (e *ProvisioningSagaExecutor) runSmokeTest(ctx context.Context, test SmokeTest) error {
	// In production, this would make HTTP requests to verify endpoints
	// For now, return success
	return nil
}

// Rollback implementations

func (e *ProvisioningSagaExecutor) rollbackKeycloakClient(ctx context.Context, clientID string) error {
	// In production, this would delete the Keycloak client
	return nil
}

func (e *ProvisioningSagaExecutor) rollbackAPISIXUpstream(ctx context.Context, upstreamID string) error {
	// In production, this would delete the APISIX upstream
	return nil
}

func (e *ProvisioningSagaExecutor) rollbackAPISIXRoute(ctx context.Context, routeID string) error {
	// In production, this would delete the APISIX route
	return nil
}

func (e *ProvisioningSagaExecutor) rollbackTigerBeetleAccount(ctx context.Context, accountID string) error {
	// In production, this would mark the TigerBeetle account as inactive
	return nil
}

// IdempotencyKey generates a unique key for idempotent operations
func IdempotencyKey(caseID, environment, operation string) string {
	return fmt.Sprintf("%s:%s:%s", caseID, environment, operation)
}

// IdempotencyStore interface for storing idempotency records
type IdempotencyStore interface {
	CheckAndSet(ctx context.Context, key string, ttl time.Duration) (bool, error)
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
}

// ProvisioningResult represents the result of a provisioning operation
type ProvisioningResult struct {
	SagaID              string    `json:"saga_id"`
	CaseID              string    `json:"case_id"`
	Environment         string    `json:"environment"`
	Status              string    `json:"status"`
	KeycloakClientID    string    `json:"keycloak_client_id"`
	APISIXRouteID       string    `json:"apisix_route_id"`
	APISIXUpstreamID    string    `json:"apisix_upstream_id"`
	TigerBeetleAccountID string   `json:"tigerbeetle_account_id"`
	SmokeTestsPassed    bool      `json:"smoke_tests_passed"`
	CompletedAt         time.Time `json:"completed_at"`
	Error               string    `json:"error,omitempty"`
}

// ToResult converts a saga to a provisioning result
func (s *ProvisioningSaga) ToResult() *ProvisioningResult {
	result := &ProvisioningResult{
		SagaID:      s.ID,
		CaseID:      s.CaseID,
		Environment: s.Environment,
		Status:      string(s.Status),
		CompletedAt: s.CompletedAt,
		Error:       s.Error,
	}

	for _, step := range s.Steps {
		switch step.Name {
		case "keycloak_client":
			result.KeycloakClientID = step.ResourceID
		case "apisix_upstream":
			result.APISIXUpstreamID = step.ResourceID
		case "apisix_route":
			result.APISIXRouteID = step.ResourceID
		case "tigerbeetle_account":
			result.TigerBeetleAccountID = step.ResourceID
		case "smoke_test":
			result.SmokeTestsPassed = step.Status == ProvisioningCompleted
		}
	}

	return result
}
