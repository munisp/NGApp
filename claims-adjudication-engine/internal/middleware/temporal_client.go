package middleware

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/workflow"
)

// TemporalConfig holds Temporal configuration
type TemporalConfig struct {
	HostPort  string
	Namespace string
	TaskQueue string
}

// TemporalClient handles Temporal workflow orchestration
type TemporalClient struct {
	config TemporalConfig
	client client.Client
}

// NewTemporalClient creates a new Temporal client
func NewTemporalClient(config TemporalConfig) (*TemporalClient, error) {
	if config.HostPort == "" {
		config.HostPort = os.Getenv("TEMPORAL_HOST")
		if config.HostPort == "" {
			config.HostPort = "localhost:7233"
		}
	}
	if config.Namespace == "" {
		config.Namespace = "claims-adjudication"
	}
	if config.TaskQueue == "" {
		config.TaskQueue = "claims-adjudication-queue"
	}

	c, err := client.Dial(client.Options{
		HostPort:  config.HostPort,
		Namespace: config.Namespace,
	})
	if err != nil {
		// Return mock client for development
		return &TemporalClient{config: config}, nil
	}

	return &TemporalClient{
		config: config,
		client: c,
	}, nil
}

// ClaimAdjudicationWorkflowInput represents input for the claim adjudication workflow
type ClaimAdjudicationWorkflowInput struct {
	ClaimID       uuid.UUID              `json:"claim_id"`
	PolicyID      uuid.UUID              `json:"policy_id"`
	ClaimAmount   float64                `json:"claim_amount"`
	ClaimType     string                 `json:"claim_type"`
	Documents     []uuid.UUID            `json:"documents"`
	CustomerID    uuid.UUID              `json:"customer_id"`
	IncidentDate  time.Time              `json:"incident_date"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// ClaimAdjudicationWorkflowOutput represents output from the claim adjudication workflow
type ClaimAdjudicationWorkflowOutput struct {
	ClaimID        uuid.UUID `json:"claim_id"`
	Decision       string    `json:"decision"`
	ApprovedAmount float64   `json:"approved_amount,omitempty"`
	Reasoning      string    `json:"reasoning"`
	ProcessingTime string    `json:"processing_time"`
	RulesApplied   []string  `json:"rules_applied"`
	FraudScore     float64   `json:"fraud_score"`
	Confidence     float64   `json:"confidence"`
}

// StartClaimAdjudicationWorkflow starts a new claim adjudication workflow
func (t *TemporalClient) StartClaimAdjudicationWorkflow(ctx context.Context, input ClaimAdjudicationWorkflowInput) (string, error) {
	if t.client == nil {
		// Return mock workflow ID for development
		return fmt.Sprintf("mock-workflow-%s", input.ClaimID.String()), nil
	}

	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("claim-adjudication-%s", input.ClaimID.String()),
		TaskQueue: t.config.TaskQueue,
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "ClaimAdjudicationWorkflow", input)
	if err != nil {
		return "", fmt.Errorf("failed to start workflow: %w", err)
	}

	return we.GetID(), nil
}

// GetWorkflowResult gets the result of a workflow
func (t *TemporalClient) GetWorkflowResult(ctx context.Context, workflowID string) (*ClaimAdjudicationWorkflowOutput, error) {
	if t.client == nil {
		// Return mock result for development
		return &ClaimAdjudicationWorkflowOutput{
			Decision:       "MANUAL_REVIEW",
			Reasoning:      "Mock workflow result",
			ProcessingTime: "5s",
			FraudScore:     0.15,
			Confidence:     0.85,
		}, nil
	}

	run := t.client.GetWorkflow(ctx, workflowID, "")
	var result ClaimAdjudicationWorkflowOutput
	if err := run.Get(ctx, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// SignalWorkflow sends a signal to a running workflow
func (t *TemporalClient) SignalWorkflow(ctx context.Context, workflowID string, signalName string, signalArg interface{}) error {
	if t.client == nil {
		return nil
	}
	return t.client.SignalWorkflow(ctx, workflowID, "", signalName, signalArg)
}

// CancelWorkflow cancels a running workflow
func (t *TemporalClient) CancelWorkflow(ctx context.Context, workflowID string) error {
	if t.client == nil {
		return nil
	}
	return t.client.CancelWorkflow(ctx, workflowID, "")
}

// Close closes the Temporal client
func (t *TemporalClient) Close() {
	if t.client != nil {
		t.client.Close()
	}
}

// ClaimAdjudicationWorkflow is the main workflow for claim adjudication
// This would be registered with the Temporal worker
func ClaimAdjudicationWorkflow(ctx workflow.Context, input ClaimAdjudicationWorkflowInput) (*ClaimAdjudicationWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting claim adjudication workflow", "claimID", input.ClaimID)

	// Activity options
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Step 1: Validate claim
	var validationResult ValidationResult
	err := workflow.ExecuteActivity(ctx, ValidateClaimActivity, input.ClaimID).Get(ctx, &validationResult)
	if err != nil {
		return nil, fmt.Errorf("claim validation failed: %w", err)
	}
	if !validationResult.IsValid {
		return &ClaimAdjudicationWorkflowOutput{
			ClaimID:   input.ClaimID,
			Decision:  "AUTO_REJECT",
			Reasoning: validationResult.Reason,
		}, nil
	}

	// Step 2: Process documents with OCR
	var documentResults []DocumentProcessingResult
	for _, docID := range input.Documents {
		var docResult DocumentProcessingResult
		err := workflow.ExecuteActivity(ctx, ProcessDocumentActivity, docID).Get(ctx, &docResult)
		if err != nil {
			logger.Warn("Document processing failed", "documentID", docID, "error", err)
			continue
		}
		documentResults = append(documentResults, docResult)
	}

	// Step 3: Run fraud detection
	var fraudResult FraudDetectionResult
	err = workflow.ExecuteActivity(ctx, DetectFraudActivity, input.ClaimID, input.CustomerID).Get(ctx, &fraudResult)
	if err != nil {
		logger.Warn("Fraud detection failed", "error", err)
		fraudResult.Score = 0.5 // Default to medium risk
	}

	// Step 4: Evaluate rules
	var ruleResult RuleEvaluationResult
	err = workflow.ExecuteActivity(ctx, EvaluateRulesActivity, input, fraudResult.Score, documentResults).Get(ctx, &ruleResult)
	if err != nil {
		return nil, fmt.Errorf("rule evaluation failed: %w", err)
	}

	// Step 5: If escalation needed, wait for human decision
	if ruleResult.Decision == "ESCALATE" || ruleResult.Decision == "MANUAL_REVIEW" {
		// Set up signal channel for human decision
		signalChan := workflow.GetSignalChannel(ctx, "human-decision")

		// Wait for human decision with timeout
		selector := workflow.NewSelector(ctx)
		var humanDecision HumanDecisionSignal

		selector.AddReceive(signalChan, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, &humanDecision)
		})

		// Add timeout
		timerFuture := workflow.NewTimer(ctx, 24*time.Hour)
		selector.AddFuture(timerFuture, func(f workflow.Future) {
			// Timeout - escalate to supervisor
			humanDecision = HumanDecisionSignal{
				Decision: "ESCALATE",
				Reason:   "SLA timeout - no human decision within 24 hours",
			}
		})

		selector.Select(ctx)

		ruleResult.Decision = humanDecision.Decision
		ruleResult.Reasoning = humanDecision.Reason
	}

	// Step 6: Calculate approved amount if approved
	var approvedAmount float64
	if ruleResult.Decision == "AUTO_APPROVE" || ruleResult.Decision == "APPROVE" {
		var amountResult AmountCalculationResult
		err = workflow.ExecuteActivity(ctx, CalculateApprovedAmountActivity, input.ClaimID, input.ClaimAmount).Get(ctx, &amountResult)
		if err != nil {
			logger.Warn("Amount calculation failed", "error", err)
			approvedAmount = input.ClaimAmount
		} else {
			approvedAmount = amountResult.ApprovedAmount
		}
	}

	// Step 7: Record decision
	err = workflow.ExecuteActivity(ctx, RecordDecisionActivity, input.ClaimID, ruleResult.Decision, ruleResult.Reasoning).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to record decision", "error", err)
	}

	// Step 8: Send notifications
	err = workflow.ExecuteActivity(ctx, SendNotificationActivity, input.ClaimID, input.CustomerID, ruleResult.Decision).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to send notification", "error", err)
	}

	return &ClaimAdjudicationWorkflowOutput{
		ClaimID:        input.ClaimID,
		Decision:       ruleResult.Decision,
		ApprovedAmount: approvedAmount,
		Reasoning:      ruleResult.Reasoning,
		RulesApplied:   ruleResult.RulesApplied,
		FraudScore:     fraudResult.Score,
		Confidence:     ruleResult.Confidence,
	}, nil
}

// Activity result types
type ValidationResult struct {
	IsValid bool
	Reason  string
}

type DocumentProcessingResult struct {
	DocumentID uuid.UUID
	IsVerified bool
	Confidence float64
	Fields     map[string]interface{}
}

type FraudDetectionResult struct {
	Score      float64
	Indicators []string
	RiskLevel  string
}

type RuleEvaluationResult struct {
	Decision     string
	Reasoning    string
	RulesApplied []string
	Confidence   float64
}

type AmountCalculationResult struct {
	ApprovedAmount float64
	Deductible     float64
	CoverageLimit  float64
}

type HumanDecisionSignal struct {
	Decision string
	Reason   string
	UserID   string
}

// Activity stubs - these would be implemented in a separate file
func ValidateClaimActivity(ctx context.Context, claimID uuid.UUID) (*ValidationResult, error) {
	return &ValidationResult{IsValid: true}, nil
}

func ProcessDocumentActivity(ctx context.Context, documentID uuid.UUID) (*DocumentProcessingResult, error) {
	return &DocumentProcessingResult{DocumentID: documentID, IsVerified: true, Confidence: 0.9}, nil
}

func DetectFraudActivity(ctx context.Context, claimID, customerID uuid.UUID) (*FraudDetectionResult, error) {
	return &FraudDetectionResult{Score: 0.15, RiskLevel: "LOW"}, nil
}

func EvaluateRulesActivity(ctx context.Context, input ClaimAdjudicationWorkflowInput, fraudScore float64, docs []DocumentProcessingResult) (*RuleEvaluationResult, error) {
	return &RuleEvaluationResult{Decision: "MANUAL_REVIEW", Reasoning: "Requires review", Confidence: 0.8}, nil
}

func CalculateApprovedAmountActivity(ctx context.Context, claimID uuid.UUID, claimAmount float64) (*AmountCalculationResult, error) {
	return &AmountCalculationResult{ApprovedAmount: claimAmount * 0.9}, nil
}

func RecordDecisionActivity(ctx context.Context, claimID uuid.UUID, decision, reasoning string) error {
	return nil
}

func SendNotificationActivity(ctx context.Context, claimID, customerID uuid.UUID, decision string) error {
	return nil
}
