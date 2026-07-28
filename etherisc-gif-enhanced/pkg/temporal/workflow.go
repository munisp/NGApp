package temporal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"policy-service-integration/pkg/gif"
	"policy-service-integration/pkg/models"
	"policy-service-integration/pkg/repo"

	"github.com/google/uuid"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// WorkflowName is the name of the workflow.
const WorkflowName = "CreateParametricPolicyWorkflow"

// Activities is a struct to hold dependencies for activities.
type Activities struct {
	Repo repo.Repository
	GIF  gif.GIFClient
}

// CreateParametricPolicyWorkflow is the main workflow that orchestrates the policy creation.
func CreateParametricPolicyWorkflow(ctx workflow.Context, req models.PolicyCreationRequest) (string, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("CreateParametricPolicyWorkflow started", "GIFProductID", req.GIFProductID)

	// 1. Setup Activity Options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    1 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Second,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var policyID uuid.UUID
	var txHash string
	var onChainAddress string
	var err error

	// 2. Validate and Persist Policy (Activity 1)
	err = workflow.ExecuteActivity(ctx, (*Activities).ValidateAndPersistActivity, req).Get(ctx, &policyID)
	if err != nil {
		logger.Error("ValidateAndPersistActivity failed", "error", err)
		return "", err
	}

	// 3. Execute On-Chain Creation (Activity 2)
	err = workflow.ExecuteActivity(ctx, (*Activities).ExecuteOnChainCreationActivity, policyID).Get(ctx, &txHash)
	if err != nil {
		logger.Error("ExecuteOnChainCreationActivity failed", "error", err)
		// Finalize policy as failed
		_ = workflow.ExecuteActivity(ctx, (*Activities).FinalizePolicyActivity, policyID, models.StatusFailed, "", "").Get(ctx, nil)
		return "", err
	}

	// 4. Wait for Confirmation (Activity 3)
	err = workflow.ExecuteActivity(ctx, (*Activities).WaitForConfirmationActivity, policyID, txHash).Get(ctx, &onChainAddress)
	if err != nil {
		logger.Error("WaitForConfirmationActivity failed", "error", err)
		// Finalize policy as failed
		_ = workflow.ExecuteActivity(ctx, (*Activities).FinalizePolicyActivity, policyID, models.StatusFailed, txHash, "").Get(ctx, nil)
		return "", err
	}

	// 5. Finalize Policy (Activity 4)
	err = workflow.ExecuteActivity(ctx, (*Activities).FinalizePolicyActivity, policyID, models.StatusActive, txHash, onChainAddress).Get(ctx, nil)
	if err != nil {
		logger.Error("FinalizePolicyActivity failed", "error", err)
		return "", err
	}

	logger.Info("CreateParametricPolicyWorkflow completed successfully", "PolicyID", policyID.String(), "OnChainAddress", onChainAddress)
	return policyID.String(), nil
}

// ValidateAndPersistActivity validates the request and saves the initial policy records.
func (a *Activities) ValidateAndPersistActivity(ctx context.Context, req models.PolicyCreationRequest) (uuid.UUID, error) {
	logger := activity.GetLogger(ctx)

	// 1. Basic Validation
	if req.GIFProductID == "" {
		return uuid.Nil, errors.New("GIFProductID cannot be empty")
	}

	// 2. Create ParametricPolicy record
	ppID := uuid.New()
	now := time.Now()
	parametricPolicy := &models.ParametricPolicy{
		ID: ppID,
		GIFProductID: req.GIFProductID,
		PremiumData: req.PremiumData,
		PayoutData: req.PayoutData,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := a.Repo.CreateParametricPolicy(ctx, parametricPolicy); err != nil {
		logger.Error("Failed to create parametric policy record", "error", err)
		return uuid.Nil, fmt.Errorf("failed to persist parametric policy: %w", err)
	}

	// 3. Create Policy record
	policyID := uuid.New()
	policy := &models.Policy{
		ID: policyID,
		PolicyType: models.Parametric,
		Status: models.StatusPendingOnChain,
		ParametricPolicyID: &ppID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := a.Repo.CreatePolicy(ctx, policy); err != nil {
		logger.Error("Failed to create policy record", "error", err)
		// Rollback: In a real scenario, we'd need to clean up the parametric policy record.
		return uuid.Nil, fmt.Errorf("failed to persist policy: %w", err)
	}

	logger.Info("Policy records created successfully", "PolicyID", policyID.String(), "ParametricPolicyID", ppID.String())
	return policyID, nil
}

// ExecuteOnChainCreationActivity calls the GIF client to start the on-chain process.
func (a *Activities) ExecuteOnChainCreationActivity(ctx context.Context, policyID uuid.UUID) (string, error) {
	logger := activity.GetLogger(ctx)

	policy, err := a.Repo.GetPolicyByID(ctx, policyID)
	if err != nil {
		return "", fmt.Errorf("policy not found: %w", err)
	}
	if policy.ParametricPolicyID == nil {
		return "", errors.New("policy is not parametric")
	}
	pp, err := a.Repo.GetParametricPolicyByID(ctx, *policy.ParametricPolicyID)
	if err != nil {
		return "", fmt.Errorf("parametric policy not found: %w", err)
	}

	txHash, err := a.GIF.CreatePolicyOnChain(ctx, pp)
	if err != nil {
		// Update status to failed immediately if the initial call fails
		_ = a.Repo.UpdatePolicyStatus(ctx, policyID, models.StatusFailed)
		return "", fmt.Errorf("gif client failed to create policy on chain: %w", err)
	}

	// Update the policy record with the initial transaction hash
	// Note: We use a mock repo method here. In a real scenario, this would be a dedicated update.
	// For simplicity in the mock, we'll rely on the final update in FinalizePolicyActivity.
	// A more robust implementation would update the ParametricPolicy.TxHash here.

	logger.Info("On-chain creation initiated", "PolicyID", policyID.String(), "TxHash", txHash)
	return txHash, nil
}

// WaitForConfirmationActivity polls the GIF client for transaction confirmation.
func (a *Activities) WaitForConfirmationActivity(ctx context.Context, policyID uuid.UUID, txHash string) (string, error) {
	logger := activity.GetLogger(ctx)

	// Activity Heartbeat setup for long-running polling
	activity.RecordHeartbeat(ctx, "Polling for confirmation")

	// Polling loop (simulated)
	for i := 0; i < 60; i++ { // Max 60 attempts (e.g., 1 minute)
		status, onChainAddress, err := a.GIF.GetTransactionStatus(ctx, txHash)
		if err != nil {
			logger.Warn("Error checking transaction status, retrying", "error", err)
			// Continue loop, relying on Activity Retry Policy to handle transient errors
		}

		switch status {
		case "Confirmed":
			logger.Info("Transaction confirmed", "PolicyID", policyID.String(), "OnChainAddress", onChainAddress)
			return onChainAddress, nil
		case "Failed":
			return "", errors.New("on-chain transaction failed")
		case "Pending":
			// Continue polling
			logger.Debug("Transaction still pending", "attempt", i+1)
		default:
			return "", fmt.Errorf("unexpected transaction status: %s", status)
		}

		// Heartbeat before sleeping
		activity.RecordHeartbeat(ctx, fmt.Sprintf("Attempt %d: Tx still pending", i+1))
		time.Sleep(1 * time.Second) // Simulate polling interval
	}

	// If loop finishes without confirmation
	return "", errors.New("transaction confirmation timed out")
}

// FinalizePolicyActivity updates the final status and details of the policy.
func (a *Activities) FinalizePolicyActivity(ctx context.Context, policyID uuid.UUID, finalStatus models.PolicyStatus, txHash, onChainAddress string) error {
	logger := activity.GetLogger(ctx)

	// 1. Update Policy Status
	if err := a.Repo.UpdatePolicyStatus(ctx, policyID, finalStatus); err != nil {
		logger.Error("Failed to update policy status", "error", err)
		return fmt.Errorf("failed to finalize policy status: %w", err)
	}

	// 2. Update Parametric Policy Details (TxHash and OnChainAddress)
	if finalStatus == models.StatusActive {
		if err := a.Repo.UpdatePolicyParametricDetails(ctx, policyID, txHash, onChainAddress); err != nil {
			logger.Error("Failed to update parametric policy details", "error", err)
			return fmt.Errorf("failed to finalize parametric details: %w", err)
		}
	}

	logger.Info("Policy finalized", "PolicyID", policyID.String(), "Status", finalStatus)
	return nil
}
