package middleware

import (
	"context"
	"fmt"
	"time"
)

// TemporalConfig holds configuration for Temporal workflow engine
type TemporalConfig struct {
	HostPort  string
	Namespace string
	TaskQueue string
}

// PaymentWorkflowInput defines the input for payment processing workflows
type PaymentWorkflowInput struct {
	TransactionID   string                 `json:"transaction_id"`
	SenderID        string                 `json:"sender_id"`
	RecipientID     string                 `json:"recipient_id"`
	Amount          float64                `json:"amount"`
	Currency        string                 `json:"currency"`
	PaymentMethod   string                 `json:"payment_method"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// PaymentWorkflowResult defines the result of a completed payment workflow
type PaymentWorkflowResult struct {
	TransactionID   string    `json:"transaction_id"`
	Status          string    `json:"status"`
	ProcessedAt     time.Time `json:"processed_at"`
	SettlementRef   string    `json:"settlement_ref"`
	FeeAmount       float64   `json:"fee_amount"`
	ExchangeRate    float64   `json:"exchange_rate"`
	FinalAmount     float64   `json:"final_amount"`
}

// DisputeWorkflowInput defines the input for dispute resolution workflows
type DisputeWorkflowInput struct {
	DisputeID       string    `json:"dispute_id"`
	TransactionID   string    `json:"transaction_id"`
	Reason          string    `json:"reason"`
	Amount          float64   `json:"amount"`
	FiledBy         string    `json:"filed_by"`
	EvidenceURLs    []string  `json:"evidence_urls"`
}

// ComplianceWorkflowInput defines the input for compliance check workflows
type ComplianceWorkflowInput struct {
	TransactionID   string  `json:"transaction_id"`
	SenderID        string  `json:"sender_id"`
	RecipientID     string  `json:"recipient_id"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	Country         string  `json:"country"`
}

// WorkflowOrchestrator manages Temporal workflow executions
type WorkflowOrchestrator struct {
	config TemporalConfig
}

func NewWorkflowOrchestrator(config TemporalConfig) *WorkflowOrchestrator {
	if config.HostPort == "" {
		config.HostPort = getEnvOrDefault("TEMPORAL_HOST", "localhost:7233")
	}
	if config.Namespace == "" {
		config.Namespace = "payment-switch"
	}
	if config.TaskQueue == "" {
		config.TaskQueue = "payment-processing"
	}
	return &WorkflowOrchestrator{config: config}
}

// PaymentProcessingWorkflow orchestrates the full payment lifecycle
func (o *WorkflowOrchestrator) PaymentProcessingWorkflow(ctx context.Context, input PaymentWorkflowInput) (*PaymentWorkflowResult, error) {
	// Step 1: Validate transaction
	if err := o.validateTransaction(ctx, input); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Step 2: AML/Compliance check
	complianceResult, err := o.complianceCheck(ctx, ComplianceWorkflowInput{
		TransactionID: input.TransactionID,
		SenderID:      input.SenderID,
		RecipientID:   input.RecipientID,
		Amount:        input.Amount,
		Currency:      input.Currency,
	})
	if err != nil || !complianceResult {
		return nil, fmt.Errorf("compliance check failed: %w", err)
	}

	// Step 3: Calculate fees
	feeAmount := o.calculateFee(input.Amount, input.PaymentMethod)

	// Step 4: Reserve funds (debit sender)
	if err := o.reserveFunds(ctx, input.SenderID, input.Amount+feeAmount, input.Currency); err != nil {
		return nil, fmt.Errorf("fund reservation failed: %w", err)
	}

	// Step 5: Execute transfer via payment rails
	settlementRef, err := o.executeTransfer(ctx, input)
	if err != nil {
		_ = o.releaseFunds(ctx, input.SenderID, input.Amount+feeAmount, input.Currency)
		return nil, fmt.Errorf("transfer execution failed: %w", err)
	}

	// Step 6: Confirm settlement
	return &PaymentWorkflowResult{
		TransactionID: input.TransactionID,
		Status:        "completed",
		ProcessedAt:   time.Now(),
		SettlementRef: settlementRef,
		FeeAmount:     feeAmount,
		FinalAmount:   input.Amount - feeAmount,
	}, nil
}

func (o *WorkflowOrchestrator) validateTransaction(ctx context.Context, input PaymentWorkflowInput) error {
	if input.Amount <= 0 {
		return fmt.Errorf("invalid amount: %f", input.Amount)
	}
	if input.SenderID == "" || input.RecipientID == "" {
		return fmt.Errorf("sender and recipient required")
	}
	return nil
}

func (o *WorkflowOrchestrator) complianceCheck(ctx context.Context, input ComplianceWorkflowInput) (bool, error) {
	// Transaction amount thresholds for CTR reporting
	if input.Amount > 10000 && input.Currency == "USD" {
		// Flag for Currency Transaction Report
		fmt.Printf("CTR flagged: transaction %s amount %.2f %s\n", input.TransactionID, input.Amount, input.Currency)
	}
	return true, nil
}

func (o *WorkflowOrchestrator) calculateFee(amount float64, method string) float64 {
	switch method {
	case "card":
		fee := amount * 0.025
		if fee < 100 {
			return 100
		}
		if fee > 5000 {
			return 5000
		}
		return fee
	case "bank_transfer":
		fee := amount * 0.015
		if fee < 50 {
			return 50
		}
		return fee
	default:
		return amount * 0.02
	}
}

func (o *WorkflowOrchestrator) reserveFunds(ctx context.Context, userID string, amount float64, currency string) error {
	return nil // TigerBeetle integration point
}

func (o *WorkflowOrchestrator) releaseFunds(ctx context.Context, userID string, amount float64, currency string) error {
	return nil // Compensating transaction
}

func (o *WorkflowOrchestrator) executeTransfer(ctx context.Context, input PaymentWorkflowInput) (string, error) {
	ref := fmt.Sprintf("STL-%d-%s", time.Now().UnixMilli(), input.TransactionID[:8])
	return ref, nil
}

// DisputeResolutionWorkflow orchestrates dispute handling
func (o *WorkflowOrchestrator) DisputeResolutionWorkflow(ctx context.Context, input DisputeWorkflowInput) error {
	fmt.Printf("Processing dispute %s for transaction %s\n", input.DisputeID, input.TransactionID)
	return nil
}

// RecurringPaymentWorkflow handles scheduled recurring payments
func (o *WorkflowOrchestrator) RecurringPaymentWorkflow(ctx context.Context, scheduleID string, payments []PaymentWorkflowInput) error {
	for _, payment := range payments {
		if _, err := o.PaymentProcessingWorkflow(ctx, payment); err != nil {
			fmt.Printf("Recurring payment failed for schedule %s: %v\n", scheduleID, err)
		}
	}
	return nil
}
