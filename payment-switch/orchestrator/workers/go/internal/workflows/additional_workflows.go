package workflows

import (
	"time"

	"go.temporal.io/sdk/workflow"
)

// ============================================================================
// Refund Processing Workflow
// ============================================================================

type RefundRequest struct {
	TransactionID string
	MerchantID    int
	Amount        int
	Currency      string
	Reason        string
	RequestedBy   string
}

type RefundResult struct {
	RefundID     string
	Status       string
	ProcessedAt  time.Time
	ErrorMessage string
}

func RefundProcessingWorkflow(ctx workflow.Context, req RefundRequest) (*RefundResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting refund processing workflow", "transactionID", req.TransactionID)

	result := &RefundResult{ProcessedAt: workflow.Now(ctx)}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Validate transaction
	var txnValid bool
	workflow.ExecuteActivity(ctx, "ValidateTransaction", req.TransactionID).Get(ctx, &txnValid)
	if !txnValid {
		result.Status = "failed"
		result.ErrorMessage = "Invalid transaction"
		return result, nil
	}

	// Check refund eligibility
	var eligible bool
	workflow.ExecuteActivity(ctx, "CheckRefundEligibility", req).Get(ctx, &eligible)
	if !eligible {
		result.Status = "rejected"
		result.ErrorMessage = "Transaction not eligible for refund"
		return result, nil
	}

	// Process refund with payment gateway
	var refundID string
	err := workflow.ExecuteActivity(ctx, "ProcessRefund", req).Get(ctx, &refundID)
	if err != nil {
		result.Status = "failed"
		result.ErrorMessage = err.Error()
		return result, err
	}
	result.RefundID = refundID

	// Reverse ledger entry
	workflow.ExecuteActivity(ctx, "ReverseLedgerEntry", req.TransactionID, req.Amount)

	// Publish event
	workflow.ExecuteActivity(ctx, "PublishToKafka", "refund.processed", result)

	// Send webhook
	workflow.ExecuteActivity(ctx, "SendWebhook", map[string]interface{}{
		"merchantID": req.MerchantID,
		"event":      "refund.completed",
		"data":       result,
	})

	// Write to Lakehouse
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_refunds", result)

	result.Status = "completed"
	return result, nil
}

// ============================================================================
// Webhook Delivery Workflow
// ============================================================================

type WebhookPayload struct {
	MerchantID int
	Event      string
	Data       interface{}
	Signature  string
}

type WebhookDeliveryResult struct {
	DeliveryID   string
	Status       string
	ResponseCode int
	Attempts     int
}

func WebhookDeliveryWorkflow(ctx workflow.Context, payload WebhookPayload) (*WebhookDeliveryResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting webhook delivery workflow", "merchantID", payload.MerchantID, "event", payload.Event)

	result := &WebhookDeliveryResult{}

	// Get merchant webhook URL
	var webhookURL string
	workflow.ExecuteActivity(ctx, "GetMerchantWebhookURL", payload.MerchantID).Get(ctx, &webhookURL)
	if webhookURL == "" {
		result.Status = "skipped"
		return result, nil
	}

	// Retry with exponential backoff
	maxAttempts := 5
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		result.Attempts = attempt

		activityOptions := workflow.ActivityOptions{
			StartToCloseTimeout: 5 * time.Second,
			RetryPolicy: &workflow.RetryPolicy{
				MaximumAttempts: 1, // Handle retries manually
			},
		}
		ctx := workflow.WithActivityOptions(ctx, activityOptions)

		var responseCode int
		err := workflow.ExecuteActivity(ctx, "DeliverWebhook", webhookURL, payload).Get(ctx, &responseCode)
		result.ResponseCode = responseCode

		if err == nil && responseCode >= 200 && responseCode < 300 {
			result.Status = "delivered"
			workflow.ExecuteActivity(ctx, "LogWebhookDelivery", payload.MerchantID, result)
			return result, nil
		}

		// Wait before retry with exponential backoff
		if attempt < maxAttempts {
			backoff := time.Duration(attempt*attempt) * time.Second
			workflow.Sleep(ctx, backoff)
		}
	}

	result.Status = "failed"
	workflow.ExecuteActivity(ctx, "LogWebhookDelivery", payload.MerchantID, result)
	workflow.ExecuteActivity(ctx, "PublishToKafka", "webhook.failed", result)

	return result, nil
}

// ============================================================================
// Notification Delivery Workflow
// ============================================================================

type NotificationRequest struct {
	UserID   int
	Type     string
	Channel  string // email, sms, slack, push
	Template string
	Data     map[string]interface{}
}

type NotificationResult struct {
	NotificationID string
	Status         string
	DeliveredAt    time.Time
}

func NotificationDeliveryWorkflow(ctx workflow.Context, req NotificationRequest) (*NotificationResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting notification delivery workflow", "userID", req.UserID, "channel", req.Channel)

	result := &NotificationResult{DeliveredAt: workflow.Now(ctx)}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Second,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Get user notification preferences
	var preferences map[string]bool
	workflow.ExecuteActivity(ctx, "GetNotificationPreferences", req.UserID).Get(ctx, &preferences)

	// Check if user wants this notification
	if !preferences[req.Type] {
		result.Status = "skipped"
		return result, nil
	}

	// Send notification based on channel
	var notificationID string
	err := workflow.ExecuteActivity(ctx, "SendNotification", req).Get(ctx, &notificationID)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	result.NotificationID = notificationID
	result.Status = "delivered"

	// Log delivery
	workflow.ExecuteActivity(ctx, "LogNotificationDelivery", result)

	return result, nil
}

// ============================================================================
// Compliance Check Workflow
// ============================================================================

type ComplianceCheckRequest struct {
	MerchantID int
	CheckType  string // kyc, aml, sanctions
	Documents  []string
}

type ComplianceCheckResult struct {
	CheckID      string
	Status       string
	Score        int
	Issues       []string
	RequiresReview bool
}

func ComplianceCheckWorkflow(ctx workflow.Context, req ComplianceCheckRequest) (*ComplianceCheckResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting compliance check workflow", "merchantID", req.MerchantID, "checkType", req.CheckType)

	result := &ComplianceCheckResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 1 * time.Minute,
		TaskQueue:           "python-workers", // Python for ML-based checks
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Run compliance check
	err := workflow.ExecuteActivity(ctx, "RunComplianceCheck", req).Get(ctx, result)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	// If requires review, wait for manual approval
	if result.RequiresReview {
		var approved bool
		signalChan := workflow.GetSignalChannel(ctx, "compliance_approved")
		workflow.Await(ctx, func() bool {
			signalChan.Receive(ctx, &approved)
			return true
		})

		if approved {
			result.Status = "approved"
		} else {
			result.Status = "rejected"
		}
	}

	// Log result
	workflow.ExecuteActivity(ctx, "LogComplianceCheck", result)

	// Publish event
	workflow.ExecuteActivity(ctx, "PublishToKafka", "compliance.checked", result)

	return result, nil
}

// ============================================================================
// Settlement Processing Workflow
// ============================================================================

type SettlementRequest struct {
	MerchantID  int
	StartDate   time.Time
	EndDate     time.Time
	Currency    string
}

type SettlementResult struct {
	SettlementID   string
	TotalAmount    int
	TransactionCount int
	Fees           int
	NetAmount      int
	Status         string
}

func SettlementProcessingWorkflow(ctx workflow.Context, req SettlementRequest) (*SettlementResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting settlement processing workflow", "merchantID", req.MerchantID)

	result := &SettlementResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Calculate settlement amount
	err := workflow.ExecuteActivity(ctx, "CalculateSettlement", req).Get(ctx, result)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	// Create payout
	var payoutID string
	err = workflow.ExecuteActivity(ctx, "CreatePayout", result).Get(ctx, &payoutID)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	// Record in ledger
	workflow.ExecuteActivity(ctx, "RecordSettlementLedger", result)

	// Send notification
	workflow.ExecuteActivity(ctx, "SendNotification", map[string]interface{}{
		"type":       "settlement_processed",
		"merchantID": req.MerchantID,
		"amount":     result.NetAmount,
	})

	// Write to Lakehouse
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_settlements", result)

	result.Status = "completed"
	return result, nil
}
