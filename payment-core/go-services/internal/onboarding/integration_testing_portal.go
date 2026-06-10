// Package onboarding provides integration testing portal for self-service sandbox testing
package onboarding

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// TestScenario represents a test scenario for integration testing
type TestScenario struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Description     string     `json:"description"`
	Category        string     `json:"category"`   // TRANSFER, QUOTE, PARTY_LOOKUP, BULK, FX
	Difficulty      string     `json:"difficulty"` // BASIC, INTERMEDIATE, ADVANCED
	Steps           []TestStep `json:"steps"`
	ExpectedOutcome string     `json:"expected_outcome"`
	Timeout         int        `json:"timeout_seconds"`
	IsRequired      bool       `json:"is_required"` // Required for certification
	Tags            []string   `json:"tags"`
}

// TestStep represents a step in a test scenario
type TestStep struct {
	Order       int                    `json:"order"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Method      string                 `json:"method"` // GET, POST, PUT, DELETE
	Endpoint    string                 `json:"endpoint"`
	Headers     map[string]string      `json:"headers,omitempty"`
	Body        map[string]interface{} `json:"body,omitempty"`
	Assertions  []TestAssertion        `json:"assertions"`
	WaitBefore  int                    `json:"wait_before_ms,omitempty"`
	WaitAfter   int                    `json:"wait_after_ms,omitempty"`
}

// TestAssertion represents an assertion for a test step
type TestAssertion struct {
	Type     string `json:"type"` // STATUS_CODE, HEADER, BODY_FIELD, BODY_CONTAINS
	Field    string `json:"field,omitempty"`
	Operator string `json:"operator"` // EQUALS, NOT_EQUALS, CONTAINS, GREATER_THAN, LESS_THAN
	Expected string `json:"expected"`
}

// TestRun represents a test run execution
type TestRun struct {
	ID            string           `json:"id"`
	ParticipantID string           `json:"participant_id"`
	ScenarioID    string           `json:"scenario_id"`
	ScenarioName  string           `json:"scenario_name"`
	Environment   string           `json:"environment"` // SANDBOX, PRODUCTION
	Status        string           `json:"status"`      // PENDING, RUNNING, PASSED, FAILED, TIMEOUT
	StartedAt     time.Time        `json:"started_at"`
	CompletedAt   *time.Time       `json:"completed_at,omitempty"`
	Duration      int              `json:"duration_ms"`
	StepResults   []TestStepResult `json:"step_results"`
	ErrorMessage  string           `json:"error_message,omitempty"`
	Logs          []TestLog        `json:"logs"`
}

// TestStepResult represents the result of a test step
type TestStepResult struct {
	StepOrder        int               `json:"step_order"`
	StepName         string            `json:"step_name"`
	Status           string            `json:"status"` // PASSED, FAILED, SKIPPED
	Duration         int               `json:"duration_ms"`
	Request          *TestRequest      `json:"request,omitempty"`
	Response         *TestResponse     `json:"response,omitempty"`
	AssertionResults []AssertionResult `json:"assertion_results"`
	ErrorMessage     string            `json:"error_message,omitempty"`
}

// TestRequest represents the request made during a test step
type TestRequest struct {
	Method  string                 `json:"method"`
	URL     string                 `json:"url"`
	Headers map[string]string      `json:"headers"`
	Body    map[string]interface{} `json:"body,omitempty"`
}

// TestResponse represents the response received during a test step
type TestResponse struct {
	StatusCode int                    `json:"status_code"`
	Headers    map[string]string      `json:"headers"`
	Body       map[string]interface{} `json:"body,omitempty"`
	RawBody    string                 `json:"raw_body,omitempty"`
}

// AssertionResult represents the result of an assertion
type AssertionResult struct {
	Assertion TestAssertion `json:"assertion"`
	Passed    bool          `json:"passed"`
	Actual    string        `json:"actual"`
	Message   string        `json:"message,omitempty"`
}

// TestLog represents a log entry during test execution
type TestLog struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"` // DEBUG, INFO, WARN, ERROR
	Message   string    `json:"message"`
	StepOrder int       `json:"step_order,omitempty"`
}

// CertificationProgress represents certification progress for a participant
type CertificationProgress struct {
	ParticipantID     string            `json:"participant_id"`
	Environment       string            `json:"environment"`
	TotalScenarios    int               `json:"total_scenarios"`
	PassedScenarios   int               `json:"passed_scenarios"`
	FailedScenarios   int               `json:"failed_scenarios"`
	PendingScenarios  int               `json:"pending_scenarios"`
	ProgressPercent   float64           `json:"progress_percent"`
	IsCertified       bool              `json:"is_certified"`
	CertifiedAt       *time.Time        `json:"certified_at,omitempty"`
	CertificateID     string            `json:"certificate_id,omitempty"`
	ScenarioStatuses  map[string]string `json:"scenario_statuses"` // scenario_id -> status
	LastRunAt         *time.Time        `json:"last_run_at,omitempty"`
	RequiredRemaining int               `json:"required_remaining"`
}

// SandboxCredentials represents sandbox API credentials
type SandboxCredentials struct {
	ParticipantID    string     `json:"participant_id"`
	ClientID         string     `json:"client_id"`
	ClientSecret     string     `json:"client_secret,omitempty"` // Only shown once
	APIKey           string     `json:"api_key"`
	APISecret        string     `json:"api_secret,omitempty"` // Only shown once
	Environment      string     `json:"environment"`
	BaseURL          string     `json:"base_url"`
	WebhookSecret    string     `json:"webhook_secret,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	IsActive         bool       `json:"is_active"`
	RateLimitTPS     int        `json:"rate_limit_tps"`
	AllowedEndpoints []string   `json:"allowed_endpoints"`
}

// MockParticipant represents a mock participant for testing
type MockParticipant struct {
	ID       string        `json:"id"`
	Name     string        `json:"name"`
	FSPID    string        `json:"fsp_id"`
	Type     string        `json:"type"` // BANK, MMO, FINTECH
	Currency string        `json:"currency"`
	Balance  float64       `json:"balance"`
	IsActive bool          `json:"is_active"`
	Accounts []MockAccount `json:"accounts"`
	Parties  []MockParty   `json:"parties"`
}

// MockAccount represents a mock account for testing
type MockAccount struct {
	ID        string  `json:"id"`
	AccountNo string  `json:"account_no"`
	Currency  string  `json:"currency"`
	Balance   float64 `json:"balance"`
	Status    string  `json:"status"`
	PartyID   string  `json:"party_id"`
}

// MockParty represents a mock party (customer) for testing
type MockParty struct {
	ID           string `json:"id"`
	Type         string `json:"type"` // CONSUMER, BUSINESS
	FirstName    string `json:"first_name,omitempty"`
	LastName     string `json:"last_name,omitempty"`
	BusinessName string `json:"business_name,omitempty"`
	MSISDN       string `json:"msisdn,omitempty"`
	Email        string `json:"email,omitempty"`
	IDType       string `json:"id_type,omitempty"`
	IDValue      string `json:"id_value,omitempty"`
}

// IntegrationTestingPortal provides self-service integration testing
type IntegrationTestingPortal struct {
	scenarios          map[string]*TestScenario
	scenariosMu        sync.RWMutex
	testRuns           map[string]*TestRun
	testRunsMu         sync.RWMutex
	certProgress       map[string]*CertificationProgress
	certProgressMu     sync.RWMutex
	credentials        map[string]*SandboxCredentials
	credentialsMu      sync.RWMutex
	mockParticipants   map[string]*MockParticipant
	mockParticipantsMu sync.RWMutex
}

// NewIntegrationTestingPortal creates a new integration testing portal
func NewIntegrationTestingPortal() *IntegrationTestingPortal {
	portal := &IntegrationTestingPortal{
		scenarios:        make(map[string]*TestScenario),
		testRuns:         make(map[string]*TestRun),
		certProgress:     make(map[string]*CertificationProgress),
		credentials:      make(map[string]*SandboxCredentials),
		mockParticipants: make(map[string]*MockParticipant),
	}
	portal.registerDefaultScenarios()
	portal.registerMockParticipants()
	return portal
}

// registerDefaultScenarios registers default test scenarios
func (p *IntegrationTestingPortal) registerDefaultScenarios() {
	scenarios := []TestScenario{
		{
			ID:          "party-lookup-msisdn",
			Name:        "Party Lookup by MSISDN",
			Description: "Look up a party by mobile phone number",
			Category:    "PARTY_LOOKUP",
			Difficulty:  "BASIC",
			IsRequired:  true,
			Timeout:     30,
			Tags:        []string{"party", "lookup", "msisdn"},
			Steps: []TestStep{
				{
					Order:       1,
					Name:        "Lookup Party",
					Description: "Send GET request to lookup party by MSISDN",
					Method:      "GET",
					Endpoint:    "/parties/MSISDN/{{test_msisdn}}",
					Headers:     map[string]string{"Accept": "application/vnd.interoperability.parties+json;version=1.0"},
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "200"},
						{Type: "BODY_FIELD", Field: "party.partyIdInfo.partyIdType", Operator: "EQUALS", Expected: "MSISDN"},
					},
				},
			},
			ExpectedOutcome: "Party information returned with correct MSISDN",
		},
		{
			ID:          "p2p-transfer-happy-path",
			Name:        "P2P Transfer - Happy Path",
			Description: "Complete a person-to-person transfer successfully",
			Category:    "TRANSFER",
			Difficulty:  "BASIC",
			IsRequired:  true,
			Timeout:     60,
			Tags:        []string{"transfer", "p2p", "happy-path"},
			Steps: []TestStep{
				{
					Order:       1,
					Name:        "Lookup Payee",
					Description: "Look up the payee party",
					Method:      "GET",
					Endpoint:    "/parties/MSISDN/{{payee_msisdn}}",
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "200"},
					},
				},
				{
					Order:       2,
					Name:        "Request Quote",
					Description: "Request a quote for the transfer",
					Method:      "POST",
					Endpoint:    "/quotes",
					Body: map[string]interface{}{
						"quoteId":       "{{quote_id}}",
						"transactionId": "{{transaction_id}}",
						"payer": map[string]interface{}{
							"partyIdInfo": map[string]interface{}{
								"partyIdType":     "MSISDN",
								"partyIdentifier": "{{payer_msisdn}}",
							},
						},
						"payee": map[string]interface{}{
							"partyIdInfo": map[string]interface{}{
								"partyIdType":     "MSISDN",
								"partyIdentifier": "{{payee_msisdn}}",
							},
						},
						"amountType": "SEND",
						"amount": map[string]interface{}{
							"amount":   "100",
							"currency": "NGN",
						},
						"transactionType": map[string]interface{}{
							"scenario":      "TRANSFER",
							"initiator":     "PAYER",
							"initiatorType": "CONSUMER",
						},
					},
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "202"},
					},
					WaitAfter: 2000,
				},
				{
					Order:       3,
					Name:        "Execute Transfer",
					Description: "Execute the transfer",
					Method:      "POST",
					Endpoint:    "/transfers",
					Body: map[string]interface{}{
						"transferId": "{{transfer_id}}",
						"payerFsp":   "{{payer_fsp}}",
						"payeeFsp":   "{{payee_fsp}}",
						"amount": map[string]interface{}{
							"amount":   "100",
							"currency": "NGN",
						},
						"ilpPacket":  "{{ilp_packet}}",
						"condition":  "{{condition}}",
						"expiration": "{{expiration}}",
					},
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "202"},
					},
					WaitAfter: 3000,
				},
				{
					Order:       4,
					Name:        "Verify Transfer Status",
					Description: "Verify the transfer completed successfully",
					Method:      "GET",
					Endpoint:    "/transfers/{{transfer_id}}",
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "200"},
						{Type: "BODY_FIELD", Field: "transferState", Operator: "EQUALS", Expected: "COMMITTED"},
					},
				},
			},
			ExpectedOutcome: "Transfer completed with COMMITTED state",
		},
		{
			ID:          "transfer-timeout",
			Name:        "Transfer Timeout Handling",
			Description: "Verify proper handling of transfer timeout",
			Category:    "TRANSFER",
			Difficulty:  "INTERMEDIATE",
			IsRequired:  true,
			Timeout:     120,
			Tags:        []string{"transfer", "timeout", "error-handling"},
			Steps: []TestStep{
				{
					Order:       1,
					Name:        "Initiate Transfer with Short Expiry",
					Description: "Start a transfer that will timeout",
					Method:      "POST",
					Endpoint:    "/transfers",
					Body: map[string]interface{}{
						"transferId": "{{transfer_id}}",
						"expiration": "{{short_expiration}}", // 1 second expiry
					},
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "202"},
					},
					WaitAfter: 5000,
				},
				{
					Order:       2,
					Name:        "Verify Transfer Aborted",
					Description: "Verify the transfer was aborted due to timeout",
					Method:      "GET",
					Endpoint:    "/transfers/{{transfer_id}}",
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "200"},
						{Type: "BODY_FIELD", Field: "transferState", Operator: "EQUALS", Expected: "ABORTED"},
					},
				},
			},
			ExpectedOutcome: "Transfer aborted with proper timeout handling",
		},
		{
			ID:          "bulk-transfer",
			Name:        "Bulk Transfer Processing",
			Description: "Process a bulk transfer with multiple transactions",
			Category:    "BULK",
			Difficulty:  "ADVANCED",
			IsRequired:  false,
			Timeout:     180,
			Tags:        []string{"bulk", "transfer", "batch"},
			Steps: []TestStep{
				{
					Order:       1,
					Name:        "Submit Bulk Transfer",
					Description: "Submit a bulk transfer request",
					Method:      "POST",
					Endpoint:    "/bulkTransfers",
					Body: map[string]interface{}{
						"bulkTransferId": "{{bulk_transfer_id}}",
						"bulkQuoteId":    "{{bulk_quote_id}}",
						"payerFsp":       "{{payer_fsp}}",
						"payeeFsp":       "{{payee_fsp}}",
						"individualTransfers": []map[string]interface{}{
							{"transferId": "{{transfer_id_1}}", "transferAmount": map[string]interface{}{"amount": "100", "currency": "NGN"}},
							{"transferId": "{{transfer_id_2}}", "transferAmount": map[string]interface{}{"amount": "200", "currency": "NGN"}},
							{"transferId": "{{transfer_id_3}}", "transferAmount": map[string]interface{}{"amount": "300", "currency": "NGN"}},
						},
					},
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "202"},
					},
					WaitAfter: 10000,
				},
				{
					Order:       2,
					Name:        "Verify Bulk Transfer Status",
					Description: "Verify all individual transfers completed",
					Method:      "GET",
					Endpoint:    "/bulkTransfers/{{bulk_transfer_id}}",
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "200"},
						{Type: "BODY_FIELD", Field: "bulkTransferState", Operator: "EQUALS", Expected: "COMPLETED"},
					},
				},
			},
			ExpectedOutcome: "All individual transfers in bulk completed successfully",
		},
		{
			ID:          "fx-quote",
			Name:        "FX Quote Request",
			Description: "Request a foreign exchange quote",
			Category:    "FX",
			Difficulty:  "INTERMEDIATE",
			IsRequired:  false,
			Timeout:     60,
			Tags:        []string{"fx", "quote", "currency"},
			Steps: []TestStep{
				{
					Order:       1,
					Name:        "Request FX Quote",
					Description: "Request a quote for currency conversion",
					Method:      "POST",
					Endpoint:    "/fxQuotes",
					Body: map[string]interface{}{
						"conversionRequestId": "{{conversion_request_id}}",
						"conversionTerms": map[string]interface{}{
							"conversionId": "{{conversion_id}}",
							"sourceAmount": map[string]interface{}{"amount": "1000", "currency": "NGN"},
							"targetAmount": map[string]interface{}{"currency": "USD"},
						},
					},
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "202"},
					},
					WaitAfter: 2000,
				},
				{
					Order:       2,
					Name:        "Verify FX Quote",
					Description: "Verify the FX quote was received",
					Method:      "GET",
					Endpoint:    "/fxQuotes/{{conversion_request_id}}",
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "200"},
						{Type: "BODY_FIELD", Field: "conversionTerms.targetAmount.currency", Operator: "EQUALS", Expected: "USD"},
					},
				},
			},
			ExpectedOutcome: "FX quote received with conversion rate",
		},
		{
			ID:          "error-handling-invalid-party",
			Name:        "Error Handling - Invalid Party",
			Description: "Verify proper error handling for invalid party lookup",
			Category:    "PARTY_LOOKUP",
			Difficulty:  "BASIC",
			IsRequired:  true,
			Timeout:     30,
			Tags:        []string{"error", "party", "validation"},
			Steps: []TestStep{
				{
					Order:       1,
					Name:        "Lookup Invalid Party",
					Description: "Attempt to lookup a non-existent party",
					Method:      "GET",
					Endpoint:    "/parties/MSISDN/0000000000",
					Assertions: []TestAssertion{
						{Type: "STATUS_CODE", Operator: "EQUALS", Expected: "404"},
						{Type: "BODY_FIELD", Field: "errorInformation.errorCode", Operator: "EQUALS", Expected: "3204"},
					},
				},
			},
			ExpectedOutcome: "Proper error response with error code 3204 (Party not found)",
		},
	}

	for _, scenario := range scenarios {
		p.scenarios[scenario.ID] = &scenario
	}
}

// registerMockParticipants registers mock participants for testing
func (p *IntegrationTestingPortal) registerMockParticipants() {
	mockParticipants := []MockParticipant{
		{
			ID:       "mock-bank-001",
			Name:     "Mock Bank Nigeria",
			FSPID:    "mockbankng",
			Type:     "BANK",
			Currency: "NGN",
			Balance:  10000000,
			IsActive: true,
			Parties: []MockParty{
				{ID: "party-001", Type: "CONSUMER", FirstName: "John", LastName: "Doe", MSISDN: "2348012345678"},
				{ID: "party-002", Type: "CONSUMER", FirstName: "Jane", LastName: "Smith", MSISDN: "2348087654321"},
				{ID: "party-003", Type: "BUSINESS", BusinessName: "Acme Corp", MSISDN: "2348011111111"},
			},
			Accounts: []MockAccount{
				{ID: "acc-001", AccountNo: "1234567890", Currency: "NGN", Balance: 50000, Status: "ACTIVE", PartyID: "party-001"},
				{ID: "acc-002", AccountNo: "0987654321", Currency: "NGN", Balance: 75000, Status: "ACTIVE", PartyID: "party-002"},
			},
		},
		{
			ID:       "mock-mmo-001",
			Name:     "Mock Mobile Money",
			FSPID:    "mockmmo",
			Type:     "MMO",
			Currency: "NGN",
			Balance:  5000000,
			IsActive: true,
			Parties: []MockParty{
				{ID: "party-101", Type: "CONSUMER", FirstName: "Alice", LastName: "Johnson", MSISDN: "2349012345678"},
				{ID: "party-102", Type: "CONSUMER", FirstName: "Bob", LastName: "Williams", MSISDN: "2349087654321"},
			},
			Accounts: []MockAccount{
				{ID: "acc-101", AccountNo: "MM1234567890", Currency: "NGN", Balance: 25000, Status: "ACTIVE", PartyID: "party-101"},
				{ID: "acc-102", AccountNo: "MM0987654321", Currency: "NGN", Balance: 30000, Status: "ACTIVE", PartyID: "party-102"},
			},
		},
	}

	for _, participant := range mockParticipants {
		p.mockParticipants[participant.ID] = &participant
	}
}

// GetScenarios returns all available test scenarios
func (p *IntegrationTestingPortal) GetScenarios(ctx context.Context, category string, difficulty string) ([]*TestScenario, error) {
	p.scenariosMu.RLock()
	defer p.scenariosMu.RUnlock()

	var scenarios []*TestScenario
	for _, scenario := range p.scenarios {
		if category != "" && scenario.Category != category {
			continue
		}
		if difficulty != "" && scenario.Difficulty != difficulty {
			continue
		}
		scenarios = append(scenarios, scenario)
	}
	return scenarios, nil
}

// RunScenario executes a test scenario
func (p *IntegrationTestingPortal) RunScenario(ctx context.Context, participantID, scenarioID, environment string) (*TestRun, error) {
	p.scenariosMu.RLock()
	scenario, ok := p.scenarios[scenarioID]
	p.scenariosMu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("scenario %s not found", scenarioID)
	}

	testRun := &TestRun{
		ID:            uuid.New().String(),
		ParticipantID: participantID,
		ScenarioID:    scenarioID,
		ScenarioName:  scenario.Name,
		Environment:   environment,
		Status:        "RUNNING",
		StartedAt:     time.Now(),
		StepResults:   []TestStepResult{},
		Logs:          []TestLog{},
	}

	p.testRunsMu.Lock()
	p.testRuns[testRun.ID] = testRun
	p.testRunsMu.Unlock()

	// Execute test steps
	allPassed := true
	for _, step := range scenario.Steps {
		stepResult := p.executeStep(ctx, testRun, &step)
		testRun.StepResults = append(testRun.StepResults, stepResult)

		if stepResult.Status == "FAILED" {
			allPassed = false
			break
		}
	}

	// Update test run status
	completedAt := time.Now()
	testRun.CompletedAt = &completedAt
	testRun.Duration = int(completedAt.Sub(testRun.StartedAt).Milliseconds())

	if allPassed {
		testRun.Status = "PASSED"
	} else {
		testRun.Status = "FAILED"
	}

	// Update certification progress
	p.updateCertificationProgress(ctx, participantID, scenarioID, testRun.Status, environment)

	return testRun, nil
}

// executeStep executes a single test step
func (p *IntegrationTestingPortal) executeStep(ctx context.Context, testRun *TestRun, step *TestStep) TestStepResult {
	startTime := time.Now()

	result := TestStepResult{
		StepOrder:        step.Order,
		StepName:         step.Name,
		Status:           "PASSED",
		AssertionResults: []AssertionResult{},
	}

	// Log step start
	testRun.Logs = append(testRun.Logs, TestLog{
		Timestamp: time.Now(),
		Level:     "INFO",
		Message:   fmt.Sprintf("Starting step %d: %s", step.Order, step.Name),
		StepOrder: step.Order,
	})

	// Wait before if specified
	if step.WaitBefore > 0 {
		time.Sleep(time.Duration(step.WaitBefore) * time.Millisecond)
	}

	// Simulate API call (in production, this would make actual HTTP requests)
	result.Request = &TestRequest{
		Method:  step.Method,
		URL:     step.Endpoint,
		Headers: step.Headers,
		Body:    step.Body,
	}

	// Simulate response
	result.Response = &TestResponse{
		StatusCode: 200,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       map[string]interface{}{"status": "success"},
	}

	// Run assertions
	for _, assertion := range step.Assertions {
		assertionResult := p.runAssertion(&assertion, result.Response)
		result.AssertionResults = append(result.AssertionResults, assertionResult)

		if !assertionResult.Passed {
			result.Status = "FAILED"
			result.ErrorMessage = assertionResult.Message
		}
	}

	// Wait after if specified
	if step.WaitAfter > 0 {
		time.Sleep(time.Duration(step.WaitAfter) * time.Millisecond)
	}

	result.Duration = int(time.Since(startTime).Milliseconds())

	// Log step completion
	testRun.Logs = append(testRun.Logs, TestLog{
		Timestamp: time.Now(),
		Level:     "INFO",
		Message:   fmt.Sprintf("Completed step %d: %s - %s", step.Order, step.Name, result.Status),
		StepOrder: step.Order,
	})

	return result
}

// runAssertion runs a single assertion
func (p *IntegrationTestingPortal) runAssertion(assertion *TestAssertion, response *TestResponse) AssertionResult {
	result := AssertionResult{
		Assertion: *assertion,
		Passed:    true,
	}

	switch assertion.Type {
	case "STATUS_CODE":
		actual := fmt.Sprintf("%d", response.StatusCode)
		result.Actual = actual
		result.Passed = actual == assertion.Expected
		if !result.Passed {
			result.Message = fmt.Sprintf("Expected status code %s but got %s", assertion.Expected, actual)
		}
	case "BODY_FIELD":
		// In production, this would extract the field from the response body
		result.Actual = "value"
		result.Passed = true
	case "BODY_CONTAINS":
		result.Actual = response.RawBody
		result.Passed = true
	}

	return result
}

// updateCertificationProgress updates certification progress for a participant
func (p *IntegrationTestingPortal) updateCertificationProgress(ctx context.Context, participantID, scenarioID, status, environment string) {
	p.certProgressMu.Lock()
	defer p.certProgressMu.Unlock()

	key := fmt.Sprintf("%s-%s", participantID, environment)
	progress, ok := p.certProgress[key]
	if !ok {
		progress = &CertificationProgress{
			ParticipantID:    participantID,
			Environment:      environment,
			ScenarioStatuses: make(map[string]string),
		}
		p.certProgress[key] = progress
	}

	progress.ScenarioStatuses[scenarioID] = status
	now := time.Now()
	progress.LastRunAt = &now

	// Recalculate progress
	p.scenariosMu.RLock()
	totalRequired := 0
	passedRequired := 0
	for id, scenario := range p.scenarios {
		if scenario.IsRequired {
			totalRequired++
			if progress.ScenarioStatuses[id] == "PASSED" {
				passedRequired++
			}
		}
	}
	progress.TotalScenarios = len(p.scenarios)
	p.scenariosMu.RUnlock()

	progress.PassedScenarios = 0
	progress.FailedScenarios = 0
	for _, s := range progress.ScenarioStatuses {
		if s == "PASSED" {
			progress.PassedScenarios++
		} else if s == "FAILED" {
			progress.FailedScenarios++
		}
	}
	progress.PendingScenarios = progress.TotalScenarios - progress.PassedScenarios - progress.FailedScenarios
	progress.ProgressPercent = float64(progress.PassedScenarios) / float64(progress.TotalScenarios) * 100
	progress.RequiredRemaining = totalRequired - passedRequired

	// Check if certified
	if passedRequired == totalRequired && totalRequired > 0 {
		progress.IsCertified = true
		progress.CertifiedAt = &now
		progress.CertificateID = fmt.Sprintf("CERT-%s-%d", participantID, now.Unix())
	}
}

// GetCertificationProgress returns certification progress for a participant
func (p *IntegrationTestingPortal) GetCertificationProgress(ctx context.Context, participantID, environment string) (*CertificationProgress, error) {
	p.certProgressMu.RLock()
	defer p.certProgressMu.RUnlock()

	key := fmt.Sprintf("%s-%s", participantID, environment)
	if progress, ok := p.certProgress[key]; ok {
		return progress, nil
	}

	// Return empty progress
	return &CertificationProgress{
		ParticipantID:    participantID,
		Environment:      environment,
		TotalScenarios:   len(p.scenarios),
		ScenarioStatuses: make(map[string]string),
	}, nil
}

// GenerateSandboxCredentials generates sandbox credentials for a participant
func (p *IntegrationTestingPortal) GenerateSandboxCredentials(ctx context.Context, participantID string) (*SandboxCredentials, error) {
	p.credentialsMu.Lock()
	defer p.credentialsMu.Unlock()

	creds := &SandboxCredentials{
		ParticipantID:    participantID,
		ClientID:         fmt.Sprintf("sandbox-%s", participantID),
		ClientSecret:     uuid.New().String(),
		APIKey:           fmt.Sprintf("sk_sandbox_%s", uuid.New().String()[:16]),
		APISecret:        uuid.New().String(),
		Environment:      "SANDBOX",
		BaseURL:          "https://sandbox.paymentswitch.com/api/v1",
		WebhookSecret:    uuid.New().String(),
		CreatedAt:        time.Now(),
		IsActive:         true,
		RateLimitTPS:     100,
		AllowedEndpoints: []string{"/parties", "/quotes", "/transfers", "/bulkTransfers", "/fxQuotes"},
	}

	p.credentials[participantID] = creds
	return creds, nil
}

// GetTestRuns returns test runs for a participant
func (p *IntegrationTestingPortal) GetTestRuns(ctx context.Context, participantID string, limit int) ([]*TestRun, error) {
	p.testRunsMu.RLock()
	defer p.testRunsMu.RUnlock()

	var runs []*TestRun
	for _, run := range p.testRuns {
		if run.ParticipantID == participantID {
			runs = append(runs, run)
		}
	}

	// Sort by started_at descending and limit
	if len(runs) > limit {
		runs = runs[:limit]
	}

	return runs, nil
}

// HTTP Handlers

// HandleGetScenarios handles getting test scenarios
func (p *IntegrationTestingPortal) HandleGetScenarios(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	difficulty := r.URL.Query().Get("difficulty")

	scenarios, err := p.GetScenarios(r.Context(), category, difficulty)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scenarios)
}

// HandleRunScenario handles running a test scenario
func (p *IntegrationTestingPortal) HandleRunScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ParticipantID string `json:"participant_id"`
		ScenarioID    string `json:"scenario_id"`
		Environment   string `json:"environment"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	testRun, err := p.RunScenario(r.Context(), req.ParticipantID, req.ScenarioID, req.Environment)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(testRun)
}

// HandleGetProgress handles getting certification progress
func (p *IntegrationTestingPortal) HandleGetProgress(w http.ResponseWriter, r *http.Request) {
	participantID := r.URL.Query().Get("participant_id")
	environment := r.URL.Query().Get("environment")

	if participantID == "" {
		http.Error(w, "participant_id is required", http.StatusBadRequest)
		return
	}
	if environment == "" {
		environment = "SANDBOX"
	}

	progress, err := p.GetCertificationProgress(r.Context(), participantID, environment)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(progress)
}

// HandleGenerateCredentials handles generating sandbox credentials
func (p *IntegrationTestingPortal) HandleGenerateCredentials(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ParticipantID string `json:"participant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	creds, err := p.GenerateSandboxCredentials(r.Context(), req.ParticipantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(creds)
}
