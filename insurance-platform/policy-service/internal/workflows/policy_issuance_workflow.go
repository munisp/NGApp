package workflows

import (
	"fmt"
	"time"

	"insurance-platform/policy-service/internal/models"

	"go.temporal.io/sdk/workflow"
)

// PolicyIssuanceWorkflow orchestrates the policy issuance process
func PolicyIssuanceWorkflow(ctx workflow.Context, req *models.CreatePolicyRequest) (*models.Policy, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting policy issuance workflow", "customerID", req.CustomerID)

	// Set workflow options
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Step 1: Validate customer identity (NIN verification)
	var ninVerified bool
	err := workflow.ExecuteActivity(ctx, VerifyCustomerNINActivity, req.CustomerID).Get(ctx, &ninVerified)
	if err != nil {
		logger.Error("NIN verification failed", "error", err)
		return nil, fmt.Errorf("NIN verification failed: %w", err)
	}

	if !ninVerified {
		logger.Error("Customer NIN not verified")
		return nil, fmt.Errorf("customer NIN not verified")
	}

	// Step 2: Calculate risk score and premium
	var quoteResponse models.PolicyQuoteResponse
	quoteReq := &models.PolicyQuoteRequest{
		CustomerID:       req.CustomerID,
		PolicyType:       req.PolicyType,
		SumAssured:       req.SumAssured,
		DurationMonths:   req.DurationMonths,
		PremiumFrequency: req.PremiumFrequency,
	}
	err = workflow.ExecuteActivity(ctx, CalculateRiskAndPremiumActivity, quoteReq).Get(ctx, &quoteResponse)
	if err != nil {
		logger.Error("Risk calculation failed", "error", err)
		return nil, fmt.Errorf("risk calculation failed: %w", err)
	}

	// Update premium amount based on risk calculation
	req.PremiumAmount = quoteResponse.PremiumAmount

	// Step 3: Create policy record
	var policy models.Policy
	err = workflow.ExecuteActivity(ctx, CreatePolicyRecordActivity, req).Get(ctx, &policy)
	if err != nil {
		logger.Error("Policy creation failed", "error", err)
		return nil, fmt.Errorf("policy creation failed: %w", err)
	}

	// Step 4: Process initial premium payment
	var paymentSuccess bool
	paymentReq := map[string]interface{}{
		"policy_id":   policy.ID,
		"customer_id": req.CustomerID,
		"amount":      req.PremiumAmount,
		"currency":    req.Currency,
	}
	err = workflow.ExecuteActivity(ctx, ProcessPremiumPaymentActivity, paymentReq).Get(ctx, &paymentSuccess)
	if err != nil {
		logger.Error("Premium payment failed", "error", err)
		// Rollback: Cancel policy
		_ = workflow.ExecuteActivity(ctx, CancelPolicyActivity, policy.ID).Get(ctx, nil)
		return nil, fmt.Errorf("premium payment failed: %w", err)
	}

	// Step 5: Generate policy document
	var documentURL string
	err = workflow.ExecuteActivity(ctx, GeneratePolicyDocumentActivity, policy.ID).Get(ctx, &documentURL)
	if err != nil {
		logger.Error("Document generation failed", "error", err)
		// Continue anyway - document can be regenerated later
	}

	// Step 6: Issue policy (mark as active)
	err = workflow.ExecuteActivity(ctx, IssuePolicyActivity, policy.ID).Get(ctx, nil)
	if err != nil {
		logger.Error("Policy issuance failed", "error", err)
		return nil, fmt.Errorf("policy issuance failed: %w", err)
	}

	// Step 7: Send notifications
	notificationReq := map[string]interface{}{
		"policy_id":      policy.ID,
		"customer_id":    req.CustomerID,
		"policy_number":  policy.PolicyNumber,
		"document_url":   documentURL,
	}
	err = workflow.ExecuteActivity(ctx, SendPolicyNotificationsActivity, notificationReq).Get(ctx, nil)
	if err != nil {
		logger.Error("Notification sending failed", "error", err)
		// Continue anyway - notifications can be resent
	}

	// Step 8: Schedule premium reminders
	err = workflow.ExecuteActivity(ctx, SchedulePremiumRemindersActivity, policy.ID).Get(ctx, nil)
	if err != nil {
		logger.Error("Premium reminder scheduling failed", "error", err)
		// Continue anyway
	}

	logger.Info("Policy issuance workflow completed successfully", "policyID", policy.ID)
	return &policy, nil
}

// PolicyRenewalWorkflow orchestrates the policy renewal process
func PolicyRenewalWorkflow(ctx workflow.Context, policyID string) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting policy renewal workflow", "policyID", policyID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Step 1: Get policy details
	var policy models.Policy
	err := workflow.ExecuteActivity(ctx, GetPolicyActivity, policyID).Get(ctx, &policy)
	if err != nil {
		return fmt.Errorf("failed to get policy: %w", err)
	}

	// Step 2: Recalculate premium based on updated risk
	var newPremium int64
	err = workflow.ExecuteActivity(ctx, RecalculatePremiumActivity, policyID).Get(ctx, &newPremium)
	if err != nil {
		return fmt.Errorf("failed to recalculate premium: %w", err)
	}

	// Step 3: Send renewal notice to customer
	renewalNotice := map[string]interface{}{
		"policy_id":     policyID,
		"customer_id":   policy.CustomerID,
		"old_premium":   policy.PremiumAmount,
		"new_premium":   newPremium,
		"expiry_date":   policy.EndDate,
	}
	err = workflow.ExecuteActivity(ctx, SendRenewalNoticeActivity, renewalNotice).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to send renewal notice", "error", err)
	}

	// Step 4: Wait for customer acceptance (with timeout)
	var accepted bool
	selector := workflow.NewSelector(ctx)
	
	// Wait for acceptance signal or timeout
	acceptanceChannel := workflow.GetSignalChannel(ctx, "renewal-acceptance")
	selector.AddReceive(acceptanceChannel, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &accepted)
	})

	// Timeout after 30 days
	timer := workflow.NewTimer(ctx, 30*24*time.Hour)
	selector.AddFuture(timer, func(f workflow.Future) {
		accepted = false
	})

	selector.Select(ctx)

	if !accepted {
		logger.Info("Policy renewal not accepted by customer", "policyID", policyID)
		return nil
	}

	// Step 5: Process renewal payment
	var paymentSuccess bool
	paymentReq := map[string]interface{}{
		"policy_id":   policyID,
		"customer_id": policy.CustomerID,
		"amount":      newPremium,
		"currency":    policy.Currency,
	}
	err = workflow.ExecuteActivity(ctx, ProcessPremiumPaymentActivity, paymentReq).Get(ctx, &paymentSuccess)
	if err != nil {
		return fmt.Errorf("renewal payment failed: %w", err)
	}

	// Step 6: Update policy with new end date and premium
	renewalReq := map[string]interface{}{
		"policy_id":     policyID,
		"new_premium":   newPremium,
		"new_end_date":  policy.EndDate.AddDate(1, 0, 0), // Add 1 year
	}
	err = workflow.ExecuteActivity(ctx, UpdatePolicyRenewalActivity, renewalReq).Get(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to update policy: %w", err)
	}

	// Step 7: Send confirmation
	err = workflow.ExecuteActivity(ctx, SendRenewalConfirmationActivity, policyID).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to send renewal confirmation", "error", err)
	}

	logger.Info("Policy renewal workflow completed successfully", "policyID", policyID)
	return nil
}

// PolicyCancellationWorkflow orchestrates the policy cancellation process
func PolicyCancellationWorkflow(ctx workflow.Context, policyID string, reason string) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting policy cancellation workflow", "policyID", policyID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Step 1: Get policy details
	var policy models.Policy
	err := workflow.ExecuteActivity(ctx, GetPolicyActivity, policyID).Get(ctx, &policy)
	if err != nil {
		return fmt.Errorf("failed to get policy: %w", err)
	}

	// Step 2: Calculate refund amount
	var refundAmount int64
	err = workflow.ExecuteActivity(ctx, CalculateRefundActivity, policyID).Get(ctx, &refundAmount)
	if err != nil {
		return fmt.Errorf("failed to calculate refund: %w", err)
	}

	// Step 3: Process refund if applicable
	if refundAmount > 0 {
		refundReq := map[string]interface{}{
			"policy_id":   policyID,
			"customer_id": policy.CustomerID,
			"amount":      refundAmount,
			"reason":      reason,
		}
		err = workflow.ExecuteActivity(ctx, ProcessRefundActivity, refundReq).Get(ctx, nil)
		if err != nil {
			logger.Error("Refund processing failed", "error", err)
			// Continue with cancellation even if refund fails
		}
	}

	// Step 4: Cancel policy
	err = workflow.ExecuteActivity(ctx, CancelPolicyActivity, policyID).Get(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to cancel policy: %w", err)
	}

	// Step 5: Send cancellation confirmation
	cancellationReq := map[string]interface{}{
		"policy_id":     policyID,
		"customer_id":   policy.CustomerID,
		"refund_amount": refundAmount,
		"reason":        reason,
	}
	err = workflow.ExecuteActivity(ctx, SendCancellationNotificationActivity, cancellationReq).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to send cancellation notification", "error", err)
	}

	logger.Info("Policy cancellation workflow completed successfully", "policyID", policyID)
	return nil
}
