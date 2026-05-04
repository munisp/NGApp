package workflows

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/workflow"
)

// PaymentRequest represents a payment initiation request
type PaymentRequest struct {
	SessionID      string
	MerchantID     int
	Amount         int
	Currency       string
	PaymentMethod  string
	CustomerEmail  string
	CustomerName   string
	SuccessURL     string
	CancelURL      string
	Metadata       map[string]interface{}
}

// PaymentResult represents the result of payment processing
type PaymentResult struct {
	TransactionID string
	Status        string
	FraudScore    int
	ErrorCode     string
	ErrorMessage  string
	ProcessedAt   time.Time
}

// AuthResult represents payment authorization result
type AuthResult struct {
	AuthID            string
	Status            string
	GatewayTxnID      string
	ThreeDSecureURL   string
	RequiresChallenge bool
}

// CaptureResult represents payment capture result
type CaptureResult struct {
	TransactionID    string
	Status           string
	GatewayTxnID     string
	Amount           int
	Currency         string
	CardLast4        string
	CardBrand        string
	ProcessedAt      time.Time
}

// PaymentProcessingWorkflow orchestrates the complete payment processing flow
func PaymentProcessingWorkflow(ctx workflow.Context, req PaymentRequest) (*PaymentResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting payment processing workflow",
		"sessionID", req.SessionID,
		"merchantID", req.MerchantID,
		"amount", req.Amount,
		"currency", req.Currency)

	result := &PaymentResult{
		ProcessedAt: workflow.Now(ctx),
	}

	// Configure activity options
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

	// Step 1: Validate payment session
	logger.Info("Step 1: Validating payment session")
	var sessionValid bool
	err := workflow.ExecuteActivity(ctx, "ValidatePaymentSession", req.SessionID).Get(ctx, &sessionValid)
	if err != nil {
		logger.Error("Failed to validate payment session", "error", err)
		result.Status = "failed"
		result.ErrorCode = "SESSION_VALIDATION_FAILED"
		result.ErrorMessage = err.Error()
		return result, err
	}
	if !sessionValid {
		logger.Warn("Invalid payment session")
		result.Status = "failed"
		result.ErrorCode = "INVALID_SESSION"
		result.ErrorMessage = "Payment session is invalid or expired"
		return result, fmt.Errorf("invalid payment session")
	}

	// Step 2: Check permissions (Permify)
	logger.Info("Step 2: Checking merchant permissions")
	var hasPermission bool
	err = workflow.ExecuteActivity(ctx, "CheckPermission",
		fmt.Sprintf("merchant:%d", req.MerchantID),
		"payment",
		"process").Get(ctx, &hasPermission)
	if err != nil || !hasPermission {
		logger.Error("Permission check failed", "error", err)
		result.Status = "failed"
		result.ErrorCode = "PERMISSION_DENIED"
		result.ErrorMessage = "Merchant does not have permission to process payments"
		return result, fmt.Errorf("permission denied")
	}

	// Step 3: Fraud detection (Python worker via signal)
	logger.Info("Step 3: Running fraud detection")
	fraudActivityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		TaskQueue:           "python-workers", // Route to Python worker
	}
	fraudCtx := workflow.WithActivityOptions(ctx, fraudActivityOptions)

	var fraudScore int
	err = workflow.ExecuteActivity(fraudCtx, "DetectFraud", req).Get(fraudCtx, &fraudScore)
	if err != nil {
		logger.Error("Fraud detection failed", "error", err)
		// Continue with default score
		fraudScore = 50
	}
	result.FraudScore = fraudScore

	logger.Info("Fraud detection complete", "score", fraudScore)

	// Step 4: Evaluate fraud score
	if fraudScore > 80 {
		logger.Warn("High fraud risk detected", "score", fraudScore)
		// Decline payment
		err = workflow.ExecuteActivity(ctx, "DeclinePayment", req.SessionID, "High fraud risk")
		if err != nil {
			logger.Error("Failed to decline payment", "error", err)
		}

		// Send notification
		workflow.ExecuteActivity(ctx, "SendNotification", map[string]interface{}{
			"type":       "fraud_alert",
			"merchantID": req.MerchantID,
			"sessionID":  req.SessionID,
			"score":      fraudScore,
		})

		result.Status = "declined"
		result.ErrorCode = "FRAUD_DETECTED"
		result.ErrorMessage = "Payment declined due to high fraud risk"
		return result, nil
	}

	// Step 5: Authorize payment
	logger.Info("Step 5: Authorizing payment")
	var authResult AuthResult
	err = workflow.ExecuteActivity(ctx, "AuthorizePayment", req).Get(ctx, &authResult)
	if err != nil {
		logger.Error("Payment authorization failed", "error", err)
		result.Status = "failed"
		result.ErrorCode = "AUTHORIZATION_FAILED"
		result.ErrorMessage = err.Error()

		// Publish failure event to Kafka
		workflow.ExecuteActivity(ctx, "PublishToKafka", "payment.failed", result)

		return result, err
	}

	// Step 6: Handle 3D Secure if required
	if authResult.RequiresChallenge {
		logger.Info("Step 6: 3D Secure challenge required")

		// Wait for 3D Secure completion (max 5 minutes)
		var threeDSecureResult string
		signalChan := workflow.GetSignalChannel(ctx, "3ds_complete")

		selector := workflow.NewSelector(ctx)
		selector.AddReceive(signalChan, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, &threeDSecureResult)
		})
		selector.AddFuture(workflow.NewTimer(ctx, 5*time.Minute), func(f workflow.Future) {
			threeDSecureResult = "timeout"
		})

		selector.Select(ctx)

		if threeDSecureResult != "authenticated" {
			logger.Warn("3D Secure authentication failed or timed out")

			// Void authorization
			workflow.ExecuteActivity(ctx, "VoidAuthorization", authResult.AuthID)

			result.Status = "failed"
			result.ErrorCode = "3DS_FAILED"
			result.ErrorMessage = "3D Secure authentication failed"
			return result, nil
		}
	}

	// Step 7: Capture payment
	logger.Info("Step 7: Capturing payment")
	var captureResult CaptureResult
	err = workflow.ExecuteActivity(ctx, "CapturePayment", authResult.AuthID).Get(ctx, &captureResult)
	if err != nil {
		logger.Error("Payment capture failed", "error", err)

		// Compensate: Void authorization
		workflow.ExecuteActivity(ctx, "VoidAuthorization", authResult.AuthID)

		result.Status = "failed"
		result.ErrorCode = "CAPTURE_FAILED"
		result.ErrorMessage = err.Error()
		return result, err
	}

	result.TransactionID = captureResult.TransactionID

	// Step 8: Record in ledger (TigerBeetle)
	logger.Info("Step 8: Recording in ledger")
	err = workflow.ExecuteActivity(ctx, "RecordLedgerEntry", map[string]interface{}{
		"transactionID":     captureResult.TransactionID,
		"merchantID":        req.MerchantID,
		"amount":            captureResult.Amount,
		"currency":          captureResult.Currency,
		"debitAccount":      "customer_funds",
		"creditAccount":     fmt.Sprintf("merchant_%d", req.MerchantID),
		"platformFeeAmount": captureResult.Amount * 2 / 100, // 2% platform fee
	}).Get(ctx, nil)

	if err != nil {
		logger.Error("Ledger entry failed", "error", err)

		// Compensate: Refund payment
		workflow.ExecuteActivity(ctx, "RefundPayment", captureResult.TransactionID, captureResult.Amount, "Ledger entry failed")

		result.Status = "failed"
		result.ErrorCode = "LEDGER_FAILED"
		result.ErrorMessage = err.Error()
		return result, err
	}

	// Step 9: Cache transaction data (Redis)
	logger.Info("Step 9: Caching transaction data")
	workflow.ExecuteActivity(ctx, "CacheSet",
		fmt.Sprintf("transaction:%s", captureResult.TransactionID),
		captureResult,
		24*time.Hour)

	// Step 10: Publish success event to Kafka
	logger.Info("Step 10: Publishing success event")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "payment.completed", map[string]interface{}{
		"transactionID": captureResult.TransactionID,
		"merchantID":    req.MerchantID,
		"amount":        captureResult.Amount,
		"currency":      captureResult.Currency,
		"timestamp":     captureResult.ProcessedAt,
	})

	// Step 11: Stream to Fluvio for real-time analytics
	logger.Info("Step 11: Streaming to Fluvio")
	workflow.ExecuteActivity(ctx, "StreamToFluvio", "payment-stream", captureResult)

	// Step 12: Send webhook notification
	logger.Info("Step 12: Sending webhook notification")
	workflow.ExecuteActivity(ctx, "SendWebhook", map[string]interface{}{
		"merchantID": req.MerchantID,
		"event":      "payment.completed",
		"data":       captureResult,
	})

	// Step 13: Generate and send email receipt (microservice)
	logger.Info("Step 13: Sending email receipt")
	if req.CustomerEmail != "" {
		err = workflow.ExecuteActivity(ctx, "SendEmailReceipt", map[string]interface{}{
			"transaction_id": captureResult.TransactionID,
			"email":          req.CustomerEmail,
		}).Get(ctx, nil)
		if err != nil {
			logger.Error("Failed to send email receipt", "error", err)
			// Continue - email failure shouldn't fail the payment
		}
	}

	// Step 13a: Generate QR code if payment method is QR
	if req.PaymentMethod == "qr" {
		logger.Info("Generating QR code for payment")
		var qrResult map[string]interface{}
		err = workflow.ExecuteActivity(ctx, "GenerateQRCode", map[string]interface{}{
			"session_id":     req.SessionID,
			"amount":         req.Amount,
			"currency":       req.Currency,
			"merchant_id":    req.MerchantID,
			"payment_method": "qr",
		}).Get(ctx, &qrResult)
		if err != nil {
			logger.Error("Failed to generate QR code", "error", err)
		}
	}

	// Step 14: Write to Lakehouse for analytics
	logger.Info("Step 14: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_transactions", map[string]interface{}{
		"transaction_id":  captureResult.TransactionID,
		"merchant_id":     req.MerchantID,
		"amount":          captureResult.Amount,
		"currency":        captureResult.Currency,
		"payment_method":  req.PaymentMethod,
		"fraud_score":     fraudScore,
		"card_brand":      captureResult.CardBrand,
		"processed_at":    captureResult.ProcessedAt,
		"success":         true,
	})

	result.Status = "completed"
	result.TransactionID = captureResult.TransactionID

	// Step 15: Update real-time analytics metrics
	logger.Info("Step 15: Updating real-time analytics")
	workflow.ExecuteActivity(ctx, "UpdateRealtimeMetrics", map[string]interface{}{
		"transaction_id": captureResult.TransactionID,
		"merchant_id":    req.MerchantID,
		"amount":         captureResult.Amount,
		"status":         "completed",
	})

	logger.Info("Payment processing workflow completed successfully",
		"transactionID", result.TransactionID)

	return result, nil
}
