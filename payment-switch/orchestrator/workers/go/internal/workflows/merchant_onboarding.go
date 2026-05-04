package workflows

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/workflow"
)

// MerchantApplication represents a merchant onboarding application
type MerchantApplication struct {
	ID            int
	UserID        int
	BusinessName  string
	BusinessType  string
	Website       string
	Email         string
	Phone         string
	Documents     []string
	Country       string
	TaxID         string
}

// OnboardingResult represents the result of merchant onboarding
type OnboardingResult struct {
	MerchantID   int
	APIKey       string
	Status       string
	ErrorMessage string
}

// OCRResult represents document OCR processing result
type OCRResult struct {
	Documents map[string]interface{}
	Accuracy  float64
	Errors    []string
}

// ComplianceResult represents compliance check result
type ComplianceResult struct {
	Passed        bool
	Score         int
	Issues        []string
	Reason        string
	RequiresReview bool
}

// APICredentials represents generated API credentials
type APICredentials struct {
	APIKey    string
	APISecret string
	WebhookSecret string
}

// MerchantOnboardingWorkflow orchestrates the merchant onboarding process
func MerchantOnboardingWorkflow(ctx workflow.Context, application MerchantApplication) (*OnboardingResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting merchant onboarding workflow",
		"applicationID", application.ID,
		"businessName", application.BusinessName)

	result := &OnboardingResult{}

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

	// Step 1: Send email verification (microservice)
	logger.Info("Step 1: Sending email verification")
	var verificationResp map[string]interface{}
	err := workflow.ExecuteActivity(ctx, "SendVerificationEmail", map[string]interface{}{
		"email":       application.Email,
		"user_id":     application.UserID,
		"merchant_id": 0, // Will be set after merchant creation
	}).Get(ctx, &verificationResp)
	if err != nil {
		logger.Error("Failed to send verification email", "error", err)
		result.Status = "failed"
		result.ErrorMessage = "Failed to send verification email"
		return result, err
	}
	verificationToken := verificationResp["token"].(string)

	// Step 2: Wait for email verification (with 24 hour timeout)
	logger.Info("Step 2: Waiting for email verification")
	var emailVerified bool
	signalChan := workflow.GetSignalChannel(ctx, "email_verified")

	selector := workflow.NewSelector(ctx)
	selector.AddReceive(signalChan, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &emailVerified)
	})
	selector.AddFuture(workflow.NewTimer(ctx, 24*time.Hour), func(f workflow.Future) {
		emailVerified = false
	})

	selector.Select(ctx)

	if !emailVerified {
		logger.Warn("Email verification failed or timed out")
		workflow.ExecuteActivity(ctx, "RejectApplication", application.ID, "Email not verified")
		result.Status = "rejected"
		result.ErrorMessage = "Email verification failed"
		return result, nil
	}

	// Step 3: OCR document processing (Python worker)
	logger.Info("Step 3: Processing documents with OCR")
	ocrActivityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute, // OCR can take longer
		TaskQueue:           "python-workers",
	}
	ocrCtx := workflow.WithActivityOptions(ctx, ocrActivityOptions)

	var ocrResult OCRResult
	err = workflow.ExecuteActivity(ocrCtx, "ProcessDocuments", application.Documents).Get(ocrCtx, &ocrResult)
	if err != nil {
		logger.Error("OCR processing failed", "error", err)
		// Continue with manual review
		ocrResult = OCRResult{
			Documents: make(map[string]interface{}),
			Accuracy:  0,
			Errors:    []string{"OCR processing failed"},
		}
	}

	logger.Info("OCR processing complete", "accuracy", ocrResult.Accuracy)

	// Step 4: Validate extracted data
	logger.Info("Step 4: Validating extracted data")
	var dataValid bool
	err = workflow.ExecuteActivity(ctx, "ValidateBusinessData", map[string]interface{}{
		"application": application,
		"ocrData":     ocrResult.Documents,
	}).Get(ctx, &dataValid)

	if !dataValid {
		logger.Warn("Business data validation failed")
		workflow.ExecuteActivity(ctx, "RequestAdditionalInfo", application.ID, "Invalid or incomplete business data")
		
		// Wait for updated information
		var infoUpdated bool
		updateChan := workflow.GetSignalChannel(ctx, "info_updated")
		workflow.Await(ctx, func() bool {
			updateChan.Receive(ctx, &infoUpdated)
			return infoUpdated
		})
	}

	// Step 5: Compliance check
	logger.Info("Step 5: Running compliance check")
	var complianceResult ComplianceResult
	err = workflow.ExecuteActivity(ctx, "CheckCompliance", map[string]interface{}{
		"application": application,
		"ocrData":     ocrResult.Documents,
	}).Get(ctx, &complianceResult)

	if err != nil {
		logger.Error("Compliance check failed", "error", err)
		result.Status = "failed"
		result.ErrorMessage = "Compliance check failed"
		return result, err
	}

	logger.Info("Compliance check complete",
		"passed", complianceResult.Passed,
		"score", complianceResult.Score)

	if !complianceResult.Passed {
		logger.Warn("Compliance check failed", "reason", complianceResult.Reason)
		workflow.ExecuteActivity(ctx, "RejectApplication", application.ID, complianceResult.Reason)
		
		// Send rejection notification
		workflow.ExecuteActivity(ctx, "SendEmail", map[string]interface{}{
			"to":       application.Email,
			"subject":  "Application Rejected",
			"template": "application_rejected",
			"data": map[string]interface{}{
				"businessName": application.BusinessName,
				"reason":       complianceResult.Reason,
			},
		})

		result.Status = "rejected"
		result.ErrorMessage = complianceResult.Reason
		return result, nil
	}

	// Step 6: Risk assessment (if compliance requires review)
	if complianceResult.RequiresReview {
		logger.Info("Step 6: Manual review required")
		
		// Notify admin for review
		workflow.ExecuteActivity(ctx, "SendNotification", map[string]interface{}{
			"type":          "admin_review_required",
			"applicationID": application.ID,
			"businessName":  application.BusinessName,
			"complianceScore": complianceResult.Score,
		})

		// Wait for admin approval (with 7 day timeout)
		var approved bool
		approvalChan := workflow.GetSignalChannel(ctx, "admin_approval")

		selector := workflow.NewSelector(ctx)
		selector.AddReceive(approvalChan, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, &approved)
		})
		selector.AddFuture(workflow.NewTimer(ctx, 7*24*time.Hour), func(f workflow.Future) {
			approved = false
		})

		selector.Select(ctx)

		if !approved {
			logger.Warn("Admin approval denied or timed out")
			workflow.ExecuteActivity(ctx, "RejectApplication", application.ID, "Admin review failed")
			result.Status = "rejected"
			result.ErrorMessage = "Application not approved by admin"
			return result, nil
		}
	}

	// Step 7: Generate API credentials
	logger.Info("Step 7: Generating API credentials")
	var credentials APICredentials
	err = workflow.ExecuteActivity(ctx, "GenerateAPICredentials", application.ID).Get(ctx, &credentials)
	if err != nil {
		logger.Error("Failed to generate API credentials", "error", err)
		result.Status = "failed"
		result.ErrorMessage = "Failed to generate API credentials"
		return result, err
	}

	result.APIKey = credentials.APIKey

	// Step 8: Create merchant account
	logger.Info("Step 8: Creating merchant account")
	var merchantID int
	err = workflow.ExecuteActivity(ctx, "CreateMerchantAccount", map[string]interface{}{
		"application": application,
		"credentials": credentials,
		"status":      "active",
	}).Get(ctx, &merchantID)

	if err != nil {
		logger.Error("Failed to create merchant account", "error", err)
		
		// Compensate: Revoke API credentials
		workflow.ExecuteActivity(ctx, "RevokeAPICredentials", credentials.APIKey)
		
		result.Status = "failed"
		result.ErrorMessage = "Failed to create merchant account"
		return result, err
	}

	result.MerchantID = merchantID

	// Step 9: Set up default permissions (Permify)
	logger.Info("Step 9: Setting up permissions")
	err = workflow.ExecuteActivity(ctx, "SetupMerchantPermissions", merchantID).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to setup permissions", "error", err)
		// Continue - permissions can be set up later
	}

	// Step 10: Create TigerBeetle accounts
	logger.Info("Step 10: Creating ledger accounts")
	err = workflow.ExecuteActivity(ctx, "CreateLedgerAccounts", map[string]interface{}{
		"merchantID": merchantID,
		"currency":   "USD",
		"accounts": []string{
			"revenue",
			"fees",
			"reserve",
		},
	}).Get(ctx, nil)

	if err != nil {
		logger.Error("Failed to create ledger accounts", "error", err)
		// Continue - accounts can be created later
	}

	// Step 11: Send welcome email with credentials (using email service)
	logger.Info("Step 11: Sending welcome email")
	// In production, this would use a dedicated welcome email template
	workflow.ExecuteActivity(ctx, "SendEmail", map[string]interface{}{
		"to":       application.Email,
		"subject":  "Welcome to Payment Switch",
		"template": "merchant_welcome",
		"data": map[string]interface{}{
			"businessName": application.BusinessName,
			"merchantID":   merchantID,
			"apiKey":       credentials.APIKey,
			"apiSecret":    credentials.APISecret,
			"dashboardURL": fmt.Sprintf("https://dashboard.payment-switch.com/merchant/%d", merchantID),
		},
	})

	// Step 12: Create integration environment
	logger.Info("Step 12: Creating integration environment")
	workflow.ExecuteActivity(ctx, "CreateIntegrationEnvironment", map[string]interface{}{
		"merchantID":    merchantID,
		"environment":   "sandbox",
		"apiKey":        credentials.APIKey,
	})

	// Step 13: Schedule onboarding reminder emails
	logger.Info("Step 13: Scheduling reminder emails")
	workflow.ExecuteActivity(ctx, "ScheduleReminderEmails", map[string]interface{}{
		"merchantID": merchantID,
		"email":      application.Email,
		"reminders": []map[string]interface{}{
			{"days": 3, "template": "integration_reminder"},
			{"days": 7, "template": "testing_reminder"},
			{"days": 14, "template": "golive_reminder"},
		},
	})

	// Step 14: Publish onboarding event to Kafka
	logger.Info("Step 14: Publishing onboarding event")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "merchant.onboarded", map[string]interface{}{
		"merchantID":   merchantID,
		"businessName": application.BusinessName,
		"email":        application.Email,
		"timestamp":    workflow.Now(ctx),
	})

	// Step 15: Write to Lakehouse for analytics
	logger.Info("Step 15: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "dim_merchants", map[string]interface{}{
		"merchant_id":   merchantID,
		"business_name": application.BusinessName,
		"business_type": application.BusinessType,
		"country":       application.Country,
		"onboarded_at":  workflow.Now(ctx),
		"status":        "active",
	})

	result.Status = "completed"
	result.MerchantID = merchantID

	logger.Info("Merchant onboarding workflow completed successfully",
		"merchantID", merchantID)

	return result, nil
}
