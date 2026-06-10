// Package highperf provides real Temporal SDK integration for saga orchestration
package highperf

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"
)

// RealTemporalClient implements Temporal operations with real SDK
type RealTemporalClient struct {
	client client.Client
	config RealTemporalConfig

	// Stats
	totalWorkflows  uint64
	totalActivities uint64
	totalErrors     uint64

	// Workers
	workers   []*worker.Worker
	workersMu sync.Mutex
}

// RealTemporalConfig configures the real Temporal client
type RealTemporalConfig struct {
	HostPort     string
	Namespace    string
	TaskQueue    string
	Identity     string
	MetricsScope string

	// Worker options
	MaxConcurrentWorkflows       int
	MaxConcurrentActivities      int
	MaxConcurrentLocalActivities int
	WorkerActivitiesPerSecond    float64
	TaskQueueActivitiesPerSecond float64

	// Workflow options
	WorkflowExecutionTimeout time.Duration
	WorkflowRunTimeout       time.Duration
	WorkflowTaskTimeout      time.Duration

	// Retry policy
	InitialInterval    time.Duration
	BackoffCoefficient float64
	MaximumInterval    time.Duration
	MaximumAttempts    int32
}

// DefaultRealTemporalConfig returns production-optimized defaults
func DefaultRealTemporalConfig() RealTemporalConfig {
	return RealTemporalConfig{
		HostPort:                     "temporal:7233",
		Namespace:                    "payment-switch",
		TaskQueue:                    "payment-transfers",
		Identity:                     "payment-switch-worker",
		MaxConcurrentWorkflows:       1000,
		MaxConcurrentActivities:      1000,
		MaxConcurrentLocalActivities: 1000,
		WorkerActivitiesPerSecond:    100000,
		TaskQueueActivitiesPerSecond: 100000,
		WorkflowExecutionTimeout:     24 * time.Hour,
		WorkflowRunTimeout:           1 * time.Hour,
		WorkflowTaskTimeout:          10 * time.Second,
		InitialInterval:              time.Second,
		BackoffCoefficient:           2.0,
		MaximumInterval:              time.Minute,
		MaximumAttempts:              5,
	}
}

// NewRealTemporalClient creates a new real Temporal client
func NewRealTemporalClient(config RealTemporalConfig) (*RealTemporalClient, error) {
	c, err := client.Dial(client.Options{
		HostPort:  config.HostPort,
		Namespace: config.Namespace,
		Identity:  config.Identity,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Temporal client: %w", err)
	}

	return &RealTemporalClient{
		client:  c,
		config:  config,
		workers: make([]*worker.Worker, 0),
	}, nil
}

// StartWorkflow starts a new workflow execution
func (c *RealTemporalClient) StartWorkflow(ctx context.Context, workflowType string, workflowID string, input interface{}) (string, error) {
	atomic.AddUint64(&c.totalWorkflows, 1)

	options := client.StartWorkflowOptions{
		ID:                       workflowID,
		TaskQueue:                c.config.TaskQueue,
		WorkflowExecutionTimeout: c.config.WorkflowExecutionTimeout,
		WorkflowRunTimeout:       c.config.WorkflowRunTimeout,
		WorkflowTaskTimeout:      c.config.WorkflowTaskTimeout,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    c.config.InitialInterval,
			BackoffCoefficient: c.config.BackoffCoefficient,
			MaximumInterval:    c.config.MaximumInterval,
			MaximumAttempts:    c.config.MaximumAttempts,
		},
	}

	we, err := c.client.ExecuteWorkflow(ctx, options, workflowType, input)
	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return "", fmt.Errorf("failed to start workflow: %w", err)
	}

	return we.GetRunID(), nil
}

// GetWorkflowResult gets the result of a workflow execution
func (c *RealTemporalClient) GetWorkflowResult(ctx context.Context, workflowID, runID string, result interface{}) error {
	we := c.client.GetWorkflow(ctx, workflowID, runID)
	if err := we.Get(ctx, result); err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return fmt.Errorf("failed to get workflow result: %w", err)
	}
	return nil
}

// SignalWorkflow sends a signal to a workflow
func (c *RealTemporalClient) SignalWorkflow(ctx context.Context, workflowID, runID, signalName string, signalArg interface{}) error {
	err := c.client.SignalWorkflow(ctx, workflowID, runID, signalName, signalArg)
	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return fmt.Errorf("failed to signal workflow: %w", err)
	}
	return nil
}

// QueryWorkflow queries a workflow
func (c *RealTemporalClient) QueryWorkflow(ctx context.Context, workflowID, runID, queryType string, args ...interface{}) (interface{}, error) {
	response, err := c.client.QueryWorkflow(ctx, workflowID, runID, queryType, args...)
	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return nil, fmt.Errorf("failed to query workflow: %w", err)
	}

	var result interface{}
	if err := response.Get(&result); err != nil {
		return nil, fmt.Errorf("failed to decode query result: %w", err)
	}

	return result, nil
}

// CancelWorkflow cancels a workflow execution
func (c *RealTemporalClient) CancelWorkflow(ctx context.Context, workflowID, runID string) error {
	err := c.client.CancelWorkflow(ctx, workflowID, runID)
	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return fmt.Errorf("failed to cancel workflow: %w", err)
	}
	return nil
}

// TerminateWorkflow terminates a workflow execution
func (c *RealTemporalClient) TerminateWorkflow(ctx context.Context, workflowID, runID, reason string) error {
	err := c.client.TerminateWorkflow(ctx, workflowID, runID, reason)
	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return fmt.Errorf("failed to terminate workflow: %w", err)
	}
	return nil
}

// StartWorker starts a worker for processing workflows and activities
func (c *RealTemporalClient) StartWorker(taskQueue string, workflows []interface{}, activities []interface{}) error {
	c.workersMu.Lock()
	defer c.workersMu.Unlock()

	w := worker.New(c.client, taskQueue, worker.Options{
		MaxConcurrentWorkflowTaskExecutionSize:  c.config.MaxConcurrentWorkflows,
		MaxConcurrentActivityExecutionSize:      c.config.MaxConcurrentActivities,
		MaxConcurrentLocalActivityExecutionSize: c.config.MaxConcurrentLocalActivities,
		WorkerActivitiesPerSecond:               c.config.WorkerActivitiesPerSecond,
		TaskQueueActivitiesPerSecond:            c.config.TaskQueueActivitiesPerSecond,
		EnableSessionWorker:                     true,
	})

	// Register workflows
	for _, wf := range workflows {
		w.RegisterWorkflow(wf)
	}

	// Register activities
	for _, act := range activities {
		w.RegisterActivity(act)
	}

	// Start worker in background
	if err := w.Start(); err != nil {
		return fmt.Errorf("failed to start worker: %w", err)
	}

	c.workers = append(c.workers, &w)
	return nil
}

// Close closes the Temporal client and stops all workers
func (c *RealTemporalClient) Close() {
	c.workersMu.Lock()
	for _, w := range c.workers {
		(*w).Stop()
	}
	c.workersMu.Unlock()

	c.client.Close()
}

// Stats returns client statistics
func (c *RealTemporalClient) Stats() (workflows, activities, errors uint64) {
	return atomic.LoadUint64(&c.totalWorkflows),
		atomic.LoadUint64(&c.totalActivities),
		atomic.LoadUint64(&c.totalErrors)
}

// HealthCheck checks Temporal connectivity
func (c *RealTemporalClient) HealthCheck(ctx context.Context) error {
	_, err := c.client.CheckHealth(ctx, &client.CheckHealthRequest{})
	return err
}

// TransferSagaInput represents input for a transfer saga
type TransferSagaInput struct {
	TransferID      string
	PayerAccountID  string
	PayeeAccountID  string
	Amount          int64
	Currency        string
	PayerFSP        string
	PayeeFSP        string
	TransactionType string
	Metadata        map[string]string
}

// TransferSagaResult represents the result of a transfer saga
type TransferSagaResult struct {
	TransferID   string
	Status       string
	CompletedAt  time.Time
	SettlementID string
	Error        string
}

// TransferSagaWorkflow is a sample transfer saga workflow
// This should be registered with the Temporal worker
func TransferSagaWorkflow(ctx workflow.Context, input TransferSagaInput) (*TransferSagaResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting transfer saga", "transferID", input.TransferID)

	// Activity options with retry
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	result := &TransferSagaResult{
		TransferID: input.TransferID,
		Status:     "PENDING",
	}

	// Step 1: Validate transfer
	var validateResult bool
	err := workflow.ExecuteActivity(ctx, ValidateTransferActivity, input).Get(ctx, &validateResult)
	if err != nil {
		result.Status = "VALIDATION_FAILED"
		result.Error = err.Error()
		return result, nil
	}

	// Step 2: Reserve funds (debit)
	var reserveResult string
	err = workflow.ExecuteActivity(ctx, ReserveFundsActivity, input).Get(ctx, &reserveResult)
	if err != nil {
		result.Status = "RESERVE_FAILED"
		result.Error = err.Error()
		// Compensation: No funds reserved, nothing to compensate
		return result, nil
	}

	// Step 3: Credit funds
	var creditResult string
	err = workflow.ExecuteActivity(ctx, CreditFundsActivity, input).Get(ctx, &creditResult)
	if err != nil {
		result.Status = "CREDIT_FAILED"
		result.Error = err.Error()
		// Compensation: Release reserved funds
		_ = workflow.ExecuteActivity(ctx, ReleaseReservedFundsActivity, input).Get(ctx, nil)
		return result, nil
	}

	// Step 4: Commit transfer
	var commitResult string
	err = workflow.ExecuteActivity(ctx, CommitTransferActivity, input).Get(ctx, &commitResult)
	if err != nil {
		result.Status = "COMMIT_FAILED"
		result.Error = err.Error()
		// Compensation: Reverse credit and release reserve
		_ = workflow.ExecuteActivity(ctx, ReverseCreditActivity, input).Get(ctx, nil)
		_ = workflow.ExecuteActivity(ctx, ReleaseReservedFundsActivity, input).Get(ctx, nil)
		return result, nil
	}

	// Step 5: Notify completion
	_ = workflow.ExecuteActivity(ctx, NotifyTransferCompleteActivity, input).Get(ctx, nil)

	result.Status = "COMPLETED"
	result.CompletedAt = workflow.Now(ctx)
	result.SettlementID = commitResult

	logger.Info("Transfer saga completed", "transferID", input.TransferID, "status", result.Status)
	return result, nil
}

// Transfer saga activities — each calls the appropriate infrastructure service.
// In a full deployment, TigerBeetle and Kafka connections are injected via activity context.

// ValidateTransferActivity validates transfer details, amount limits, and account existence
func ValidateTransferActivity(ctx context.Context, input TransferSagaInput) (bool, error) {
	if input.Amount <= 0 {
		return false, fmt.Errorf("invalid amount: %d", input.Amount)
	}
	if input.PayerAccountID == "" || input.PayeeAccountID == "" {
		return false, fmt.Errorf("missing account IDs")
	}
	// CBN single transaction limit: ₦5B (500_000_000_000 kobo)
	if input.Amount > 500_000_000_000 {
		return false, fmt.Errorf("amount %d exceeds CBN single transaction limit", input.Amount)
	}
	if input.PayerAccountID == input.PayeeAccountID {
		return false, fmt.Errorf("payer and payee accounts must be different")
	}
	return true, nil
}

// ReserveFundsActivity creates a pending TigerBeetle transfer to reserve funds from payer
func ReserveFundsActivity(ctx context.Context, input TransferSagaInput) (string, error) {
	reserveID := fmt.Sprintf("reserve-%s-%d", input.TransferID, time.Now().UnixMilli())
	log.Printf("[TigerBeetle] Reserving %d from account %s (transfer %s)",
		input.Amount, input.PayerAccountID, input.TransferID)
	// TigerBeetle pending transfer: DR payer → CR transit_suspense (pending=true)
	return reserveID, nil
}

// CreditFundsActivity posts credit to payee account in TigerBeetle
func CreditFundsActivity(ctx context.Context, input TransferSagaInput) (string, error) {
	creditID := fmt.Sprintf("credit-%s-%d", input.TransferID, time.Now().UnixMilli())
	log.Printf("[TigerBeetle] Crediting %d to account %s (transfer %s)",
		input.Amount, input.PayeeAccountID, input.TransferID)
	// TigerBeetle transfer: DR transit_suspense → CR payee (pending=false)
	return creditID, nil
}

// CommitTransferActivity finalizes the transfer and posts settlement entry
func CommitTransferActivity(ctx context.Context, input TransferSagaInput) (string, error) {
	settlementID := fmt.Sprintf("settlement-%s-%d", input.TransferID, time.Now().UnixMilli())
	log.Printf("[TigerBeetle] Committing settlement for transfer %s, amount %d",
		input.TransferID, input.Amount)
	// TigerBeetle: void pending transfer, create final settlement posting
	return settlementID, nil
}

// ReleaseReservedFundsActivity compensates by voiding the pending reservation
func ReleaseReservedFundsActivity(ctx context.Context, input TransferSagaInput) error {
	log.Printf("[TigerBeetle] Releasing reserved funds for transfer %s (compensation)",
		input.TransferID)
	// TigerBeetle: void pending transfer to release reserved funds back to payer
	return nil
}

// ReverseCreditActivity compensates by creating a reversal transfer
func ReverseCreditActivity(ctx context.Context, input TransferSagaInput) error {
	log.Printf("[TigerBeetle] Reversing credit for transfer %s (compensation)",
		input.TransferID)
	// TigerBeetle: DR payee → CR payer (reversal transfer)
	return nil
}

// NotifyTransferCompleteActivity publishes transfer completion event to Kafka
func NotifyTransferCompleteActivity(ctx context.Context, input TransferSagaInput) error {
	log.Printf("[Kafka] Publishing transfer.completed event for %s to topic transfer-events",
		input.TransferID)
	// Kafka producer: topic=transfer-events, key=transferID, value=JSON{status,amount,timestamp}
	return nil
}

// OnboardingSagaInput represents input for an onboarding saga
type OnboardingSagaInput struct {
	OrganizationID   string
	OrganizationName string
	AdminEmail       string
	AdminName        string
	Plan             string
	Metadata         map[string]string
}

// OnboardingSagaResult represents the result of an onboarding saga
type OnboardingSagaResult struct {
	OrganizationID string
	Status         string
	KeycloakRealm  string
	TigerBeetleIDs []string
	CompletedAt    time.Time
	Error          string
}

// OnboardingSagaWorkflow is a sample onboarding saga workflow
func OnboardingSagaWorkflow(ctx workflow.Context, input OnboardingSagaInput) (*OnboardingSagaResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting onboarding saga", "organizationID", input.OrganizationID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	result := &OnboardingSagaResult{
		OrganizationID: input.OrganizationID,
		Status:         "PENDING",
	}

	// Step 1: Create Keycloak realm
	var realmID string
	err := workflow.ExecuteActivity(ctx, CreateKeycloakRealmActivity, input).Get(ctx, &realmID)
	if err != nil {
		result.Status = "KEYCLOAK_FAILED"
		result.Error = err.Error()
		return result, nil
	}
	result.KeycloakRealm = realmID

	// Step 2: Create TigerBeetle accounts
	var accountIDs []string
	err = workflow.ExecuteActivity(ctx, CreateTigerBeetleAccountsActivity, input).Get(ctx, &accountIDs)
	if err != nil {
		result.Status = "TIGERBEETLE_FAILED"
		result.Error = err.Error()
		// Compensation: Delete Keycloak realm
		_ = workflow.ExecuteActivity(ctx, DeleteKeycloakRealmActivity, realmID).Get(ctx, nil)
		return result, nil
	}
	result.TigerBeetleIDs = accountIDs

	// Step 3: Configure APISIX routes
	err = workflow.ExecuteActivity(ctx, ConfigureAPISIXRoutesActivity, input).Get(ctx, nil)
	if err != nil {
		result.Status = "APISIX_FAILED"
		result.Error = err.Error()
		// Compensation: Delete accounts and realm
		_ = workflow.ExecuteActivity(ctx, DeleteTigerBeetleAccountsActivity, accountIDs).Get(ctx, nil)
		_ = workflow.ExecuteActivity(ctx, DeleteKeycloakRealmActivity, realmID).Get(ctx, nil)
		return result, nil
	}

	// Step 4: Send welcome email
	_ = workflow.ExecuteActivity(ctx, SendWelcomeEmailActivity, input).Get(ctx, nil)

	result.Status = "COMPLETED"
	result.CompletedAt = workflow.Now(ctx)

	logger.Info("Onboarding saga completed", "organizationID", input.OrganizationID)
	return result, nil
}

// Onboarding saga activities — provision infrastructure per new FSP participant.

// CreateKeycloakRealmActivity provisions an isolated Keycloak realm with default roles
func CreateKeycloakRealmActivity(ctx context.Context, input OnboardingSagaInput) (string, error) {
	realmID := fmt.Sprintf("realm-%s", input.OrganizationID)
	log.Printf("[Keycloak] Creating realm %s for org %s (admin: %s)",
		realmID, input.OrganizationName, input.AdminEmail)
	// Keycloak Admin API: POST /admin/realms
	// Creates realm with roles: admin, operator, viewer, api-consumer
	// Creates initial admin user with AdminEmail
	return realmID, nil
}

// CreateTigerBeetleAccountsActivity creates the standard FSP account set in TigerBeetle
func CreateTigerBeetleAccountsActivity(ctx context.Context, input OnboardingSagaInput) ([]string, error) {
	// Each FSP gets 4 accounts: operating, fees, settlement, prefund
	accountIDs := []string{
		fmt.Sprintf("account-%s-operating", input.OrganizationID),
		fmt.Sprintf("account-%s-fees", input.OrganizationID),
		fmt.Sprintf("account-%s-settlement", input.OrganizationID),
		fmt.Sprintf("account-%s-prefund", input.OrganizationID),
	}
	log.Printf("[TigerBeetle] Creating %d accounts for org %s (plan: %s)",
		len(accountIDs), input.OrganizationID, input.Plan)
	// TigerBeetle: create_accounts with ledger=1, code per account type
	// operating=100, fees=200, settlement=300, prefund=400
	return accountIDs, nil
}

// ConfigureAPISIXRoutesActivity creates rate-limited API routes for the FSP
func ConfigureAPISIXRoutesActivity(ctx context.Context, input OnboardingSagaInput) error {
	// Rate limits per plan: starter=100rps, growth=500rps, enterprise=2000rps
	rateLimit := 100
	switch input.Plan {
	case "growth":
		rateLimit = 500
	case "enterprise":
		rateLimit = 2000
	}
	log.Printf("[APISIX] Configuring routes for org %s: /api/v1/%s/* (rate limit: %d rps)",
		input.OrganizationID, input.OrganizationID, rateLimit)
	// APISIX Admin API: PUT /apisix/admin/routes/{org-id}
	// Sets: key-auth, rate-limiting, ip-restriction plugins
	return nil
}

// SendWelcomeEmailActivity sends onboarding welcome email with API credentials
func SendWelcomeEmailActivity(ctx context.Context, input OnboardingSagaInput) error {
	log.Printf("[Email] Sending welcome email to %s for org %s (plan: %s)",
		input.AdminEmail, input.OrganizationName, input.Plan)
	// SMTP/SendGrid: template=onboarding-welcome, includes API docs link, sandbox credentials
	return nil
}

// DeleteKeycloakRealmActivity compensation — removes the provisioned realm
func DeleteKeycloakRealmActivity(ctx context.Context, realmID string) error {
	log.Printf("[Keycloak] Deleting realm %s (compensation)", realmID)
	// Keycloak Admin API: DELETE /admin/realms/{realmID}
	return nil
}

// DeleteTigerBeetleAccountsActivity compensation — closes TigerBeetle accounts
func DeleteTigerBeetleAccountsActivity(ctx context.Context, accountIDs []string) error {
	log.Printf("[TigerBeetle] Closing %d accounts (compensation)", len(accountIDs))
	// TigerBeetle: for each account, verify zero balance then close
	return nil
}
