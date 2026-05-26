package workflows

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/workflow"
)

// ============================================================================
// TOP 20 USER JOURNEY WORKFLOWS
// These workflows orchestrate end-to-end user journeys using existing platform
// components: TigerBeetle, Mojaloop, KYC/KYB, Kafka, Dapr, Fluvio, Keycloak,
// Permify, Redis, APISIX, and Lakehouse.
// ============================================================================

// ============================================================================
// Journey 1: Admin Login and Participant Organization Provisioning
// Components: Keycloak, Permify, APISIX, Onboarding, Kafka, Lakehouse
// ============================================================================

type AdminProvisionOrgRequest struct {
	AdminUserID      string
	OrganizationName string
	OrganizationType string // bank, fintech, merchant, government
	Country          string
	ContactEmail     string
	ContactPhone     string
}

type AdminProvisionOrgResult struct {
	OrganizationID string
	Status         string
	APIKey         string
	ErrorMessage   string
}

func Journey1_AdminProvisionOrganizationWorkflow(ctx workflow.Context, req AdminProvisionOrgRequest) (*AdminProvisionOrgResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 1: Admin provisioning new organization", "orgName", req.OrganizationName)

	result := &AdminProvisionOrgResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Validate admin session via Keycloak
	logger.Info("Step 1: Validating admin session via Keycloak")
	var sessionValid bool
	err := workflow.ExecuteActivity(ctx, "ValidateKeycloakSession", req.AdminUserID).Get(ctx, &sessionValid)
	if err != nil || !sessionValid {
		result.Status = "failed"
		result.ErrorMessage = "Invalid admin session"
		return result, fmt.Errorf("invalid admin session")
	}

	// Step 2: Check admin permissions via Permify
	logger.Info("Step 2: Checking admin permissions via Permify")
	var hasPermission bool
	err = workflow.ExecuteActivity(ctx, "CheckPermifyPermission",
		req.AdminUserID, "organization", "create").Get(ctx, &hasPermission)
	if err != nil || !hasPermission {
		result.Status = "failed"
		result.ErrorMessage = "Admin does not have permission to create organizations"
		return result, fmt.Errorf("permission denied")
	}

	// Step 3: Create organization record
	logger.Info("Step 3: Creating organization record")
	var orgID string
	err = workflow.ExecuteActivity(ctx, "CreateOrganization", req).Get(ctx, &orgID)
	if err != nil {
		result.Status = "failed"
		result.ErrorMessage = err.Error()
		return result, err
	}
	result.OrganizationID = orgID

	// Step 4: Create Keycloak realm/client for organization
	logger.Info("Step 4: Creating Keycloak realm for organization")
	err = workflow.ExecuteActivity(ctx, "CreateKeycloakRealm", orgID, req.OrganizationName).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to create Keycloak realm", "error", err)
	}

	// Step 5: Setup Permify relationships
	logger.Info("Step 5: Setting up Permify relationships")
	err = workflow.ExecuteActivity(ctx, "SetupPermifyRelationships", orgID, req.OrganizationType).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to setup Permify relationships", "error", err)
	}

	// Step 6: Generate API credentials
	logger.Info("Step 6: Generating API credentials")
	var apiKey string
	err = workflow.ExecuteActivity(ctx, "GenerateOrgAPICredentials", orgID).Get(ctx, &apiKey)
	if err != nil {
		logger.Error("Failed to generate API credentials", "error", err)
	}
	result.APIKey = apiKey

	// Step 7: Create APISIX routes for organization
	logger.Info("Step 7: Creating APISIX routes")
	err = workflow.ExecuteActivity(ctx, "CreateAPISIXRoutes", orgID, apiKey).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to create APISIX routes", "error", err)
	}

	// Step 8: Cache organization data in Redis
	logger.Info("Step 8: Caching organization data in Redis")
	workflow.ExecuteActivity(ctx, "CacheSet",
		fmt.Sprintf("org:%s", orgID),
		req,
		24*time.Hour)

	// Step 9: Publish event to Kafka
	logger.Info("Step 9: Publishing event to Kafka")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "organization.created", map[string]interface{}{
		"organizationID": orgID,
		"name":           req.OrganizationName,
		"type":           req.OrganizationType,
		"country":        req.Country,
		"createdBy":      req.AdminUserID,
		"timestamp":      workflow.Now(ctx),
	})

	// Step 10: Write to Lakehouse
	logger.Info("Step 10: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "dim_organizations", map[string]interface{}{
		"organization_id": orgID,
		"name":            req.OrganizationName,
		"type":            req.OrganizationType,
		"country":         req.Country,
		"created_at":      workflow.Now(ctx),
		"status":          "active",
	})

	// Step 11: Send notification
	logger.Info("Step 11: Sending notification")
	workflow.ExecuteActivity(ctx, "SendNotification", map[string]interface{}{
		"type":    "organization_created",
		"email":   req.ContactEmail,
		"orgName": req.OrganizationName,
		"orgID":   orgID,
	})

	result.Status = "completed"
	logger.Info("Journey 1 completed successfully", "organizationID", orgID)
	return result, nil
}

// ============================================================================
// Journey 2: Participant KYB Completion and Network Activation
// Components: KYB (Ballerine), Docling, PaddleOCR, LLaVA, Compliance, Kafka, Lakehouse
// ============================================================================

type ParticipantKYBRequest struct {
	OrganizationID string
	BusinessName   string
	RegistrationNo string
	TaxID          string
	Documents      []string // Document URLs
	Directors      []string
	Country        string
}

type ParticipantKYBResult struct {
	KYBCheckID     string
	Status         string
	ComplianceScore int
	Issues         []string
	ActivatedAt    time.Time
}

func Journey2_ParticipantKYBActivationWorkflow(ctx workflow.Context, req ParticipantKYBRequest) (*ParticipantKYBResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 2: Participant KYB and activation", "orgID", req.OrganizationID)

	result := &ParticipantKYBResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Process documents with Docling + PaddleOCR
	logger.Info("Step 1: Processing documents with OCR pipeline")
	ocrCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 3 * time.Minute,
		TaskQueue:           "python-workers",
	})
	var ocrResults map[string]interface{}
	err := workflow.ExecuteActivity(ocrCtx, "ProcessDocumentsWithDocling", req.Documents).Get(ocrCtx, &ocrResults)
	if err != nil {
		logger.Error("OCR processing failed", "error", err)
		ocrResults = make(map[string]interface{})
	}

	// Step 2: Extract fields with LLaVA VLM
	logger.Info("Step 2: Extracting fields with LLaVA")
	var extractedFields map[string]interface{}
	err = workflow.ExecuteActivity(ocrCtx, "ExtractFieldsWithLLaVA", ocrResults).Get(ocrCtx, &extractedFields)
	if err != nil {
		logger.Error("Field extraction failed", "error", err)
	}

	// Step 3: Run Ballerine KYB workflow
	logger.Info("Step 3: Running Ballerine KYB workflow")
	var kybResult map[string]interface{}
	err = workflow.ExecuteActivity(ctx, "RunBallerineKYB", map[string]interface{}{
		"organizationID": req.OrganizationID,
		"businessName":   req.BusinessName,
		"registrationNo": req.RegistrationNo,
		"taxID":          req.TaxID,
		"extractedData":  extractedFields,
		"country":        req.Country,
	}).Get(ctx, &kybResult)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	result.KYBCheckID = kybResult["checkID"].(string)
	result.ComplianceScore = int(kybResult["score"].(float64))

	// Step 4: AML/Sanctions screening
	logger.Info("Step 4: Running AML/Sanctions screening")
	var amlResult map[string]interface{}
	err = workflow.ExecuteActivity(ctx, "RunAMLScreening", req.BusinessName, req.Directors).Get(ctx, &amlResult)
	if err != nil {
		logger.Error("AML screening failed", "error", err)
	}

	// Step 5: Compliance decision
	logger.Info("Step 5: Making compliance decision")
	if result.ComplianceScore < 70 {
		result.Status = "requires_review"
		result.Issues = append(result.Issues, "Low compliance score")

		// Wait for manual review
		var approved bool
		signalChan := workflow.GetSignalChannel(ctx, "kyb_review_complete")
		selector := workflow.NewSelector(ctx)
		selector.AddReceive(signalChan, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, &approved)
		})
		selector.AddFuture(workflow.NewTimer(ctx, 7*24*time.Hour), func(f workflow.Future) {
			approved = false
		})
		selector.Select(ctx)

		if !approved {
			result.Status = "rejected"
			workflow.ExecuteActivity(ctx, "PublishToKafka", "kyb.rejected", result)
			return result, nil
		}
	}

	// Step 6: Activate participant on network
	logger.Info("Step 6: Activating participant on network")
	err = workflow.ExecuteActivity(ctx, "ActivateParticipant", req.OrganizationID).Get(ctx, nil)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	// Step 7: Create TigerBeetle accounts
	logger.Info("Step 7: Creating TigerBeetle accounts")
	workflow.ExecuteActivity(ctx, "CreateLedgerAccounts", map[string]interface{}{
		"organizationID": req.OrganizationID,
		"currency":       "USD",
		"accounts":       []string{"operating", "settlement", "reserve"},
	})

	// Step 8: Publish activation event
	logger.Info("Step 8: Publishing activation event")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "participant.activated", map[string]interface{}{
		"organizationID":  req.OrganizationID,
		"businessName":    req.BusinessName,
		"complianceScore": result.ComplianceScore,
		"activatedAt":     workflow.Now(ctx),
	})

	// Step 9: Write to Lakehouse
	logger.Info("Step 9: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_kyb_checks", map[string]interface{}{
		"check_id":         result.KYBCheckID,
		"organization_id":  req.OrganizationID,
		"compliance_score": result.ComplianceScore,
		"status":           "approved",
		"completed_at":     workflow.Now(ctx),
	})

	result.Status = "activated"
	result.ActivatedAt = workflow.Now(ctx)
	logger.Info("Journey 2 completed successfully", "orgID", req.OrganizationID)
	return result, nil
}

// ============================================================================
// Journey 3: Individual User KYC and Product Access
// Components: KYC, Identity Verification, AML, Permify, Kafka, Lakehouse
// ============================================================================

type UserKYCRequest struct {
	UserID        string
	OrganizationID string
	FullName      string
	DateOfBirth   string
	IDType        string // passport, national_id, drivers_license
	IDNumber      string
	IDDocument    string // Document URL
	SelfieImage   string
	Address       string
	Country       string
}

type UserKYCResult struct {
	KYCCheckID    string
	Status        string
	VerificationScore int
	ProductsGranted []string
}

func Journey3_UserKYCProductAccessWorkflow(ctx workflow.Context, req UserKYCRequest) (*UserKYCResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 3: User KYC and product access", "userID", req.UserID)

	result := &UserKYCResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Document verification with OCR
	logger.Info("Step 1: Verifying ID document")
	ocrCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
		TaskQueue:           "python-workers",
	})
	var docVerification map[string]interface{}
	workflow.ExecuteActivity(ocrCtx, "VerifyIDDocument", req.IDDocument, req.IDType).Get(ocrCtx, &docVerification)

	// Step 2: Liveness check with selfie
	logger.Info("Step 2: Running liveness check")
	var livenessResult map[string]interface{}
	workflow.ExecuteActivity(ocrCtx, "RunLivenessCheck", req.SelfieImage, req.IDDocument).Get(ocrCtx, &livenessResult)

	// Step 3: Identity verification
	logger.Info("Step 3: Running identity verification")
	var identityResult map[string]interface{}
	err := workflow.ExecuteActivity(ctx, "VerifyIdentity", map[string]interface{}{
		"userID":      req.UserID,
		"fullName":    req.FullName,
		"dateOfBirth": req.DateOfBirth,
		"idType":      req.IDType,
		"idNumber":    req.IDNumber,
		"country":     req.Country,
	}).Get(ctx, &identityResult)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	result.KYCCheckID = identityResult["checkID"].(string)
	result.VerificationScore = int(identityResult["score"].(float64))

	// Step 4: AML screening
	logger.Info("Step 4: Running AML screening")
	var amlClear bool
	workflow.ExecuteActivity(ctx, "RunUserAMLScreening", req.FullName, req.DateOfBirth, req.Country).Get(ctx, &amlClear)

	if !amlClear {
		result.Status = "blocked"
		workflow.ExecuteActivity(ctx, "PublishToKafka", "kyc.blocked", result)
		return result, nil
	}

	// Step 5: Determine product access based on verification level
	logger.Info("Step 5: Determining product access")
	var products []string
	if result.VerificationScore >= 90 {
		products = []string{"p2p_transfer", "bill_payment", "remittance", "card_payment", "loan_application"}
	} else if result.VerificationScore >= 70 {
		products = []string{"p2p_transfer", "bill_payment"}
	} else {
		products = []string{"p2p_transfer"}
	}
	result.ProductsGranted = products

	// Step 6: Grant permissions via Permify
	logger.Info("Step 6: Granting permissions via Permify")
	for _, product := range products {
		workflow.ExecuteActivity(ctx, "GrantPermifyPermission", req.UserID, product, "access")
	}

	// Step 7: Cache user verification status in Redis
	logger.Info("Step 7: Caching verification status")
	workflow.ExecuteActivity(ctx, "CacheSet",
		fmt.Sprintf("user:kyc:%s", req.UserID),
		result,
		30*24*time.Hour)

	// Step 8: Publish event to Kafka
	logger.Info("Step 8: Publishing KYC event")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "kyc.completed", map[string]interface{}{
		"userID":            req.UserID,
		"organizationID":    req.OrganizationID,
		"verificationScore": result.VerificationScore,
		"productsGranted":   products,
		"timestamp":         workflow.Now(ctx),
	})

	// Step 9: Write to Lakehouse
	logger.Info("Step 9: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_kyc_checks", map[string]interface{}{
		"check_id":           result.KYCCheckID,
		"user_id":            req.UserID,
		"organization_id":    req.OrganizationID,
		"verification_score": result.VerificationScore,
		"products_granted":   len(products),
		"completed_at":       workflow.Now(ctx),
	})

	result.Status = "verified"
	logger.Info("Journey 3 completed successfully", "userID", req.UserID)
	return result, nil
}

// ============================================================================
// Journey 4: Merchant Onboarding with POS Enablement
// Components: Onboarding, KYB, Document Storage, POS Service, Sandbox, Kafka, Lakehouse
// ============================================================================

type MerchantPOSOnboardingRequest struct {
	OrganizationID string
	MerchantName   string
	MerchantType   string // retail, restaurant, ecommerce
	Documents      []string
	POSType        string // physical, virtual, mobile
	Locations      []map[string]interface{}
}

type MerchantPOSOnboardingResult struct {
	MerchantID    string
	POSTerminals  []string
	SandboxAPIKey string
	Status        string
}

func Journey4_MerchantPOSOnboardingWorkflow(ctx workflow.Context, req MerchantPOSOnboardingRequest) (*MerchantPOSOnboardingResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 4: Merchant onboarding with POS", "merchantName", req.MerchantName)

	result := &MerchantPOSOnboardingResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Store documents in RustFS
	logger.Info("Step 1: Storing documents")
	var docRefs []string
	for _, doc := range req.Documents {
		var docRef string
		workflow.ExecuteActivity(ctx, "StoreDocument", doc, req.OrganizationID).Get(ctx, &docRef)
		docRefs = append(docRefs, docRef)
	}

	// Step 2: Run merchant KYB
	logger.Info("Step 2: Running merchant KYB")
	kybResult, err := Journey2_ParticipantKYBActivationWorkflow(ctx, ParticipantKYBRequest{
		OrganizationID: req.OrganizationID,
		BusinessName:   req.MerchantName,
		Documents:      docRefs,
	})
	if err != nil || kybResult.Status != "activated" {
		result.Status = "kyb_failed"
		return result, err
	}

	// Step 3: Create merchant account
	logger.Info("Step 3: Creating merchant account")
	var merchantID string
	err = workflow.ExecuteActivity(ctx, "CreateMerchantAccount", map[string]interface{}{
		"organizationID": req.OrganizationID,
		"merchantName":   req.MerchantName,
		"merchantType":   req.MerchantType,
	}).Get(ctx, &merchantID)
	if err != nil {
		result.Status = "failed"
		return result, err
	}
	result.MerchantID = merchantID

	// Step 4: Provision POS terminals
	logger.Info("Step 4: Provisioning POS terminals")
	var terminals []string
	for _, location := range req.Locations {
		var terminalID string
		workflow.ExecuteActivity(ctx, "ProvisionPOSTerminal", map[string]interface{}{
			"merchantID": merchantID,
			"posType":    req.POSType,
			"location":   location,
		}).Get(ctx, &terminalID)
		terminals = append(terminals, terminalID)
	}
	result.POSTerminals = terminals

	// Step 5: Create sandbox environment
	logger.Info("Step 5: Creating sandbox environment")
	var sandboxKey string
	workflow.ExecuteActivity(ctx, "CreateSandboxEnvironment", merchantID).Get(ctx, &sandboxKey)
	result.SandboxAPIKey = sandboxKey

	// Step 6: Configure POS via Dapr
	logger.Info("Step 6: Configuring POS via Dapr")
	workflow.ExecuteActivity(ctx, "ConfigurePOSViaDapr", map[string]interface{}{
		"merchantID": merchantID,
		"terminals":  terminals,
		"config": map[string]interface{}{
			"currency":       "USD",
			"taxRate":        0.1,
			"receiptEnabled": true,
		},
	})

	// Step 7: Stream config to Fluvio
	logger.Info("Step 7: Streaming config to Fluvio")
	workflow.ExecuteActivity(ctx, "StreamToFluvio", "pos-config-stream", map[string]interface{}{
		"merchantID": merchantID,
		"terminals":  terminals,
		"timestamp":  workflow.Now(ctx),
	})

	// Step 8: Publish event to Kafka
	logger.Info("Step 8: Publishing event to Kafka")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "merchant.pos_enabled", map[string]interface{}{
		"merchantID":   merchantID,
		"merchantName": req.MerchantName,
		"posType":      req.POSType,
		"terminals":    len(terminals),
		"timestamp":    workflow.Now(ctx),
	})

	// Step 9: Write to Lakehouse
	logger.Info("Step 9: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "dim_merchants", map[string]interface{}{
		"merchant_id":    merchantID,
		"merchant_name":  req.MerchantName,
		"merchant_type":  req.MerchantType,
		"pos_type":       req.POSType,
		"terminal_count": len(terminals),
		"onboarded_at":   workflow.Now(ctx),
	})

	result.Status = "completed"
	logger.Info("Journey 4 completed successfully", "merchantID", merchantID)
	return result, nil
}

// ============================================================================
// Journey 5: Developer API Token and Sandbox Testing
// Components: Monetization, Token, Metering, Sandbox, APISIX, Redis, Kafka, Lakehouse
// ============================================================================

type DeveloperSandboxRequest struct {
	DeveloperID    string
	OrganizationID string
	AppName        string
	PlanType       string // free, starter, growth, enterprise
	Scopes         []string
}

type DeveloperSandboxResult struct {
	APIKey        string
	SecretKey     string
	SandboxURL    string
	RateLimits    map[string]int
	Status        string
}

func Journey5_DeveloperSandboxAccessWorkflow(ctx workflow.Context, req DeveloperSandboxRequest) (*DeveloperSandboxResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 5: Developer sandbox access", "developerID", req.DeveloperID)

	result := &DeveloperSandboxResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Generate API token
	logger.Info("Step 1: Generating API token")
	var tokenResult map[string]string
	err := workflow.ExecuteActivity(ctx, "GenerateAPIToken", map[string]interface{}{
		"developerID":    req.DeveloperID,
		"organizationID": req.OrganizationID,
		"appName":        req.AppName,
		"scopes":         req.Scopes,
	}).Get(ctx, &tokenResult)
	if err != nil {
		result.Status = "failed"
		return result, err
	}
	result.APIKey = tokenResult["apiKey"]
	result.SecretKey = tokenResult["secretKey"]

	// Step 2: Setup metering based on plan
	logger.Info("Step 2: Setting up metering")
	var rateLimits map[string]int
	switch req.PlanType {
	case "free":
		rateLimits = map[string]int{"requests_per_minute": 60, "requests_per_day": 1000}
	case "starter":
		rateLimits = map[string]int{"requests_per_minute": 300, "requests_per_day": 10000}
	case "growth":
		rateLimits = map[string]int{"requests_per_minute": 1000, "requests_per_day": 100000}
	case "enterprise":
		rateLimits = map[string]int{"requests_per_minute": 10000, "requests_per_day": 1000000}
	}
	result.RateLimits = rateLimits

	workflow.ExecuteActivity(ctx, "SetupMetering", map[string]interface{}{
		"apiKey":     result.APIKey,
		"planType":   req.PlanType,
		"rateLimits": rateLimits,
	})

	// Step 3: Create sandbox environment
	logger.Info("Step 3: Creating sandbox environment")
	var sandboxURL string
	workflow.ExecuteActivity(ctx, "CreateDeveloperSandbox", req.DeveloperID).Get(ctx, &sandboxURL)
	result.SandboxURL = sandboxURL

	// Step 4: Configure APISIX routes with rate limiting
	logger.Info("Step 4: Configuring APISIX routes")
	workflow.ExecuteActivity(ctx, "ConfigureAPISIXRateLimiting", map[string]interface{}{
		"apiKey":     result.APIKey,
		"rateLimits": rateLimits,
		"scopes":     req.Scopes,
	})

	// Step 5: Cache token in Redis
	logger.Info("Step 5: Caching token in Redis")
	workflow.ExecuteActivity(ctx, "CacheSet",
		fmt.Sprintf("api:token:%s", result.APIKey),
		map[string]interface{}{
			"developerID":    req.DeveloperID,
			"organizationID": req.OrganizationID,
			"scopes":         req.Scopes,
			"rateLimits":     rateLimits,
		},
		365*24*time.Hour)

	// Step 6: Publish event to Kafka
	logger.Info("Step 6: Publishing event to Kafka")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "developer.sandbox_created", map[string]interface{}{
		"developerID":    req.DeveloperID,
		"organizationID": req.OrganizationID,
		"appName":        req.AppName,
		"planType":       req.PlanType,
		"timestamp":      workflow.Now(ctx),
	})

	// Step 7: Write to Lakehouse
	logger.Info("Step 7: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "dim_developers", map[string]interface{}{
		"developer_id":    req.DeveloperID,
		"organization_id": req.OrganizationID,
		"app_name":        req.AppName,
		"plan_type":       req.PlanType,
		"created_at":      workflow.Now(ctx),
	})

	result.Status = "completed"
	logger.Info("Journey 5 completed successfully", "developerID", req.DeveloperID)
	return result, nil
}

// ============================================================================
// Journey 6: P2P Transfer via Mojaloop with TigerBeetle Ledger
// Components: Mojaloop, TigerBeetle, Fraud Detection, Kafka, Fluvio, Lakehouse
// ============================================================================

type P2PTransferRequest struct {
	PayerID       string
	PayeeID       string
	Amount        int64
	Currency      string
	PayerFSPID    string
	PayeeFSPID    string
	TransactionType string // p2p, merchant, bill
}

type P2PTransferResult struct {
	TransferID    string
	Status        string
	FraudScore    int
	LedgerEntryID string
	CompletedAt   time.Time
}

func Journey6_P2PTransferMojaloopWorkflow(ctx workflow.Context, req P2PTransferRequest) (*P2PTransferResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 6: P2P transfer via Mojaloop", "payerID", req.PayerID, "payeeID", req.PayeeID)

	result := &P2PTransferResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Fraud detection
	logger.Info("Step 1: Running fraud detection")
	fraudCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		TaskQueue:           "python-workers",
	})
	var fraudScore int
	workflow.ExecuteActivity(fraudCtx, "DetectFraud", map[string]interface{}{
		"payerID":   req.PayerID,
		"payeeID":   req.PayeeID,
		"amount":    req.Amount,
		"currency":  req.Currency,
	}).Get(fraudCtx, &fraudScore)
	result.FraudScore = fraudScore

	if fraudScore > 80 {
		result.Status = "blocked"
		workflow.ExecuteActivity(ctx, "PublishToKafka", "transfer.blocked", result)
		return result, nil
	}

	// Step 2: Mojaloop party lookup
	logger.Info("Step 2: Mojaloop party lookup")
	var payeeInfo map[string]interface{}
	err := workflow.ExecuteActivity(ctx, "MojaloopPartyLookup", req.PayeeID, req.PayeeFSPID).Get(ctx, &payeeInfo)
	if err != nil {
		result.Status = "payee_not_found"
		return result, err
	}

	// Step 3: Mojaloop quote request
	logger.Info("Step 3: Mojaloop quote request")
	var quoteResult map[string]interface{}
	err = workflow.ExecuteActivity(ctx, "MojaloopQuoteRequest", map[string]interface{}{
		"payerFSP":  req.PayerFSPID,
		"payeeFSP":  req.PayeeFSPID,
		"amount":    req.Amount,
		"currency":  req.Currency,
	}).Get(ctx, &quoteResult)
	if err != nil {
		result.Status = "quote_failed"
		return result, err
	}

	// Step 4: Create pending TigerBeetle transfer
	logger.Info("Step 4: Creating pending TigerBeetle transfer")
	var pendingTransferID string
	err = workflow.ExecuteActivity(ctx, "CreatePendingTigerBeetleTransfer", map[string]interface{}{
		"payerAccount": req.PayerID,
		"payeeAccount": req.PayeeID,
		"amount":       req.Amount,
		"currency":     req.Currency,
	}).Get(ctx, &pendingTransferID)
	if err != nil {
		result.Status = "ledger_failed"
		return result, err
	}

	// Step 5: Mojaloop transfer execution
	logger.Info("Step 5: Executing Mojaloop transfer")
	var transferID string
	err = workflow.ExecuteActivity(ctx, "MojaloopTransferExecute", map[string]interface{}{
		"quoteID":   quoteResult["quoteID"],
		"payerFSP":  req.PayerFSPID,
		"payeeFSP":  req.PayeeFSPID,
		"amount":    req.Amount,
		"currency":  req.Currency,
	}).Get(ctx, &transferID)
	if err != nil {
		// Compensate: Void pending transfer
		workflow.ExecuteActivity(ctx, "VoidTigerBeetleTransfer", pendingTransferID)
		result.Status = "transfer_failed"
		return result, err
	}
	result.TransferID = transferID

	// Step 6: Post TigerBeetle transfer (commit)
	logger.Info("Step 6: Posting TigerBeetle transfer")
	var ledgerEntryID string
	workflow.ExecuteActivity(ctx, "PostTigerBeetleTransfer", pendingTransferID).Get(ctx, &ledgerEntryID)
	result.LedgerEntryID = ledgerEntryID

	// Step 7: Stream to Fluvio for real-time analytics
	logger.Info("Step 7: Streaming to Fluvio")
	workflow.ExecuteActivity(ctx, "StreamToFluvio", "transfer-stream", map[string]interface{}{
		"transferID": transferID,
		"payerID":    req.PayerID,
		"payeeID":    req.PayeeID,
		"amount":     req.Amount,
		"currency":   req.Currency,
		"timestamp":  workflow.Now(ctx),
	})

	// Step 8: Publish event to Kafka
	logger.Info("Step 8: Publishing event to Kafka")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "transfer.completed", map[string]interface{}{
		"transferID":    transferID,
		"payerID":       req.PayerID,
		"payeeID":       req.PayeeID,
		"amount":        req.Amount,
		"currency":      req.Currency,
		"fraudScore":    fraudScore,
		"ledgerEntryID": ledgerEntryID,
		"timestamp":     workflow.Now(ctx),
	})

	// Step 9: Write to Lakehouse
	logger.Info("Step 9: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_transfers", map[string]interface{}{
		"transfer_id":     transferID,
		"payer_id":        req.PayerID,
		"payee_id":        req.PayeeID,
		"amount":          req.Amount,
		"currency":        req.Currency,
		"fraud_score":     fraudScore,
		"ledger_entry_id": ledgerEntryID,
		"completed_at":    workflow.Now(ctx),
	})

	// Step 10: Send notifications
	logger.Info("Step 10: Sending notifications")
	workflow.ExecuteActivity(ctx, "SendNotification", map[string]interface{}{
		"type":   "transfer_sent",
		"userID": req.PayerID,
		"amount": req.Amount,
	})
	workflow.ExecuteActivity(ctx, "SendNotification", map[string]interface{}{
		"type":   "transfer_received",
		"userID": req.PayeeID,
		"amount": req.Amount,
	})

	result.Status = "completed"
	result.CompletedAt = workflow.Now(ctx)
	logger.Info("Journey 6 completed successfully", "transferID", transferID)
	return result, nil
}

// ============================================================================
// Journey 7: QR Code Payment End-to-End
// Components: QR Service, Payment Processing, TigerBeetle, Notifications, Kafka, Lakehouse
// ============================================================================

type QRPaymentRequest struct {
	MerchantID    string
	Amount        int64
	Currency      string
	CustomerID    string
	QRType        string // static, dynamic
	ExpiresIn     int    // seconds
}

type QRPaymentResult struct {
	PaymentID     string
	QRCode        string
	Status        string
	LedgerEntryID string
}

func Journey7_QRCodePaymentWorkflow(ctx workflow.Context, req QRPaymentRequest) (*QRPaymentResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 7: QR code payment", "merchantID", req.MerchantID)

	result := &QRPaymentResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Generate QR code
	logger.Info("Step 1: Generating QR code")
	var qrCode string
	err := workflow.ExecuteActivity(ctx, "GenerateQRCode", map[string]interface{}{
		"merchantID": req.MerchantID,
		"amount":     req.Amount,
		"currency":   req.Currency,
		"qrType":     req.QRType,
		"expiresIn":  req.ExpiresIn,
	}).Get(ctx, &qrCode)
	if err != nil {
		result.Status = "failed"
		return result, err
	}
	result.QRCode = qrCode

	// Step 2: Wait for customer scan (with timeout)
	logger.Info("Step 2: Waiting for customer scan")
	var scanResult map[string]interface{}
	signalChan := workflow.GetSignalChannel(ctx, "qr_scanned")
	selector := workflow.NewSelector(ctx)
	selector.AddReceive(signalChan, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &scanResult)
	})
	selector.AddFuture(workflow.NewTimer(ctx, time.Duration(req.ExpiresIn)*time.Second), func(f workflow.Future) {
		scanResult = nil
	})
	selector.Select(ctx)

	if scanResult == nil {
		result.Status = "expired"
		return result, nil
	}

	// Step 3: Process payment using existing workflow
	logger.Info("Step 3: Processing payment")
	paymentResult, err := PaymentProcessingWorkflow(ctx, PaymentRequest{
		SessionID:     scanResult["sessionID"].(string),
		MerchantID:    1, // Convert from string
		Amount:        int(req.Amount),
		Currency:      req.Currency,
		PaymentMethod: "qr",
		CustomerEmail: scanResult["customerEmail"].(string),
	})
	if err != nil {
		result.Status = "payment_failed"
		return result, err
	}

	result.PaymentID = paymentResult.TransactionID
	result.Status = paymentResult.Status

	logger.Info("Journey 7 completed successfully", "paymentID", result.PaymentID)
	return result, nil
}

// ============================================================================
// Journey 8: Remittance/FX Transfer with Risk Checks
// Components: Remittance, FX Risk, Routing, TigerBeetle, Kafka, Lakehouse
// ============================================================================

type RemittanceRequest struct {
	SenderID        string
	RecipientID     string
	SendAmount      int64
	SendCurrency    string
	ReceiveCurrency string
	Corridor        string // e.g., "US-NG", "UK-KE"
	Purpose         string
}

type RemittanceResult struct {
	RemittanceID    string
	ExchangeRate    float64
	ReceiveAmount   int64
	Fees            int64
	Status          string
	RiskScore       int
}

func Journey8_RemittanceFXTransferWorkflow(ctx workflow.Context, req RemittanceRequest) (*RemittanceResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 8: Remittance/FX transfer", "corridor", req.Corridor)

	result := &RemittanceResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: FX risk assessment
	logger.Info("Step 1: FX risk assessment")
	var riskResult map[string]interface{}
	err := workflow.ExecuteActivity(ctx, "AssessFXRisk", map[string]interface{}{
		"corridor":        req.Corridor,
		"amount":          req.SendAmount,
		"sendCurrency":    req.SendCurrency,
		"receiveCurrency": req.ReceiveCurrency,
	}).Get(ctx, &riskResult)
	if err != nil {
		result.Status = "risk_check_failed"
		return result, err
	}
	result.RiskScore = int(riskResult["riskScore"].(float64))

	if result.RiskScore > 80 {
		result.Status = "high_risk_blocked"
		return result, nil
	}

	// Step 2: Get FX quote
	logger.Info("Step 2: Getting FX quote")
	var fxQuote map[string]interface{}
	err = workflow.ExecuteActivity(ctx, "GetFXQuote", map[string]interface{}{
		"sendAmount":      req.SendAmount,
		"sendCurrency":    req.SendCurrency,
		"receiveCurrency": req.ReceiveCurrency,
		"corridor":        req.Corridor,
	}).Get(ctx, &fxQuote)
	if err != nil {
		result.Status = "quote_failed"
		return result, err
	}
	result.ExchangeRate = fxQuote["rate"].(float64)
	result.ReceiveAmount = int64(fxQuote["receiveAmount"].(float64))
	result.Fees = int64(fxQuote["fees"].(float64))

	// Step 3: Lock FX rate
	logger.Info("Step 3: Locking FX rate")
	var lockID string
	workflow.ExecuteActivity(ctx, "LockFXRate", fxQuote["quoteID"]).Get(ctx, &lockID)

	// Step 4: Compliance check
	logger.Info("Step 4: Running compliance check")
	var compliancePassed bool
	workflow.ExecuteActivity(ctx, "CheckRemittanceCompliance", map[string]interface{}{
		"senderID":    req.SenderID,
		"recipientID": req.RecipientID,
		"amount":      req.SendAmount,
		"corridor":    req.Corridor,
		"purpose":     req.Purpose,
	}).Get(ctx, &compliancePassed)

	if !compliancePassed {
		result.Status = "compliance_blocked"
		return result, nil
	}

	// Step 5: Create TigerBeetle entries
	logger.Info("Step 5: Creating ledger entries")
	var remittanceID string
	err = workflow.ExecuteActivity(ctx, "CreateRemittanceLedgerEntries", map[string]interface{}{
		"senderID":        req.SenderID,
		"recipientID":     req.RecipientID,
		"sendAmount":      req.SendAmount,
		"sendCurrency":    req.SendCurrency,
		"receiveAmount":   result.ReceiveAmount,
		"receiveCurrency": req.ReceiveCurrency,
		"fees":            result.Fees,
	}).Get(ctx, &remittanceID)
	if err != nil {
		result.Status = "ledger_failed"
		return result, err
	}
	result.RemittanceID = remittanceID

	// Step 6: Route to payout partner
	logger.Info("Step 6: Routing to payout partner")
	workflow.ExecuteActivity(ctx, "RouteRemittancePayout", map[string]interface{}{
		"remittanceID":    remittanceID,
		"corridor":        req.Corridor,
		"recipientID":     req.RecipientID,
		"receiveAmount":   result.ReceiveAmount,
		"receiveCurrency": req.ReceiveCurrency,
	})

	// Step 7: Publish event to Kafka
	logger.Info("Step 7: Publishing event to Kafka")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "remittance.completed", map[string]interface{}{
		"remittanceID":    remittanceID,
		"senderID":        req.SenderID,
		"recipientID":     req.RecipientID,
		"sendAmount":      req.SendAmount,
		"receiveAmount":   result.ReceiveAmount,
		"exchangeRate":    result.ExchangeRate,
		"corridor":        req.Corridor,
		"timestamp":       workflow.Now(ctx),
	})

	// Step 8: Write to Lakehouse
	logger.Info("Step 8: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_remittances", map[string]interface{}{
		"remittance_id":    remittanceID,
		"sender_id":        req.SenderID,
		"recipient_id":     req.RecipientID,
		"send_amount":      req.SendAmount,
		"send_currency":    req.SendCurrency,
		"receive_amount":   result.ReceiveAmount,
		"receive_currency": req.ReceiveCurrency,
		"exchange_rate":    result.ExchangeRate,
		"fees":             result.Fees,
		"corridor":         req.Corridor,
		"risk_score":       result.RiskScore,
		"completed_at":     workflow.Now(ctx),
	})

	result.Status = "completed"
	logger.Info("Journey 8 completed successfully", "remittanceID", remittanceID)
	return result, nil
}

// ============================================================================
// Journey 9: Dispute/Chargeback Lifecycle
// Components: Disputes, Document Storage, Compliance, TigerBeetle, Notifications, Kafka, Lakehouse
// ============================================================================

type DisputeRequest struct {
	TransactionID string
	CustomerID    string
	MerchantID    string
	Reason        string
	Amount        int64
	Evidence      []string
}

type DisputeResult struct {
	DisputeID     string
	Status        string
	Resolution    string
	RefundAmount  int64
}

func Journey9_DisputeChargebackWorkflow(ctx workflow.Context, req DisputeRequest) (*DisputeResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 9: Dispute/chargeback", "transactionID", req.TransactionID)

	result := &DisputeResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Create dispute case
	logger.Info("Step 1: Creating dispute case")
	var disputeID string
	err := workflow.ExecuteActivity(ctx, "CreateDisputeCase", req).Get(ctx, &disputeID)
	if err != nil {
		result.Status = "failed"
		return result, err
	}
	result.DisputeID = disputeID

	// Step 2: Store evidence documents
	logger.Info("Step 2: Storing evidence documents")
	for _, doc := range req.Evidence {
		workflow.ExecuteActivity(ctx, "StoreDisputeEvidence", disputeID, doc)
	}

	// Step 3: Place hold on merchant funds
	logger.Info("Step 3: Placing hold on merchant funds")
	workflow.ExecuteActivity(ctx, "PlaceTigerBeetleHold", map[string]interface{}{
		"merchantID": req.MerchantID,
		"amount":     req.Amount,
		"reason":     "dispute_hold",
		"disputeID":  disputeID,
	})

	// Step 4: Notify merchant
	logger.Info("Step 4: Notifying merchant")
	workflow.ExecuteActivity(ctx, "SendNotification", map[string]interface{}{
		"type":          "dispute_opened",
		"merchantID":    req.MerchantID,
		"transactionID": req.TransactionID,
		"amount":        req.Amount,
		"reason":        req.Reason,
	})

	// Step 5: Wait for merchant response (14 days)
	logger.Info("Step 5: Waiting for merchant response")
	var merchantResponse map[string]interface{}
	signalChan := workflow.GetSignalChannel(ctx, "merchant_dispute_response")
	selector := workflow.NewSelector(ctx)
	selector.AddReceive(signalChan, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &merchantResponse)
	})
	selector.AddFuture(workflow.NewTimer(ctx, 14*24*time.Hour), func(f workflow.Future) {
		merchantResponse = nil
	})
	selector.Select(ctx)

	// Step 6: Compliance review
	logger.Info("Step 6: Running compliance review")
	var reviewResult map[string]interface{}
	workflow.ExecuteActivity(ctx, "ReviewDispute", map[string]interface{}{
		"disputeID":        disputeID,
		"customerEvidence": req.Evidence,
		"merchantResponse": merchantResponse,
	}).Get(ctx, &reviewResult)

	// Step 7: Make decision
	logger.Info("Step 7: Making decision")
	resolution := reviewResult["resolution"].(string)
	result.Resolution = resolution

	if resolution == "customer_favor" {
		// Refund customer
		result.RefundAmount = req.Amount
		workflow.ExecuteActivity(ctx, "ProcessDisputeRefund", map[string]interface{}{
			"disputeID":     disputeID,
			"customerID":    req.CustomerID,
			"merchantID":    req.MerchantID,
			"amount":        req.Amount,
		})
	} else {
		// Release hold
		workflow.ExecuteActivity(ctx, "ReleaseTigerBeetleHold", disputeID)
	}

	// Step 8: Publish event to Kafka
	logger.Info("Step 8: Publishing event to Kafka")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "dispute.resolved", map[string]interface{}{
		"disputeID":     disputeID,
		"transactionID": req.TransactionID,
		"resolution":    resolution,
		"refundAmount":  result.RefundAmount,
		"timestamp":     workflow.Now(ctx),
	})

	// Step 9: Write to Lakehouse
	logger.Info("Step 9: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_disputes", map[string]interface{}{
		"dispute_id":     disputeID,
		"transaction_id": req.TransactionID,
		"customer_id":    req.CustomerID,
		"merchant_id":    req.MerchantID,
		"amount":         req.Amount,
		"reason":         req.Reason,
		"resolution":     resolution,
		"refund_amount":  result.RefundAmount,
		"resolved_at":    workflow.Now(ctx),
	})

	result.Status = "resolved"
	logger.Info("Journey 9 completed successfully", "disputeID", disputeID)
	return result, nil
}

// ============================================================================
// Journey 10: Reconciliation Workflow
// Components: Reconciliation, Lakehouse, TigerBeetle, Alerts, Kafka
// ============================================================================

type ReconciliationRequest struct {
	ReconciliationType string // daily, weekly, monthly
	StartDate          time.Time
	EndDate            time.Time
	Sources            []string // ledger, processor, bank
}

type ReconciliationResult struct {
	ReconciliationID string
	Status           string
	MatchedCount     int
	UnmatchedCount   int
	Discrepancies    []map[string]interface{}
}

func Journey10_ReconciliationWorkflow(ctx workflow.Context, req ReconciliationRequest) (*ReconciliationResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Journey 10: Reconciliation", "type", req.ReconciliationType)

	result := &ReconciliationResult{}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Fetch ledger data from TigerBeetle
	logger.Info("Step 1: Fetching ledger data")
	var ledgerData []map[string]interface{}
	workflow.ExecuteActivity(ctx, "FetchTigerBeetleLedgerData", req.StartDate, req.EndDate).Get(ctx, &ledgerData)

	// Step 2: Fetch processor data
	logger.Info("Step 2: Fetching processor data")
	var processorData []map[string]interface{}
	workflow.ExecuteActivity(ctx, "FetchProcessorData", req.StartDate, req.EndDate).Get(ctx, &processorData)

	// Step 3: Fetch bank settlement data
	logger.Info("Step 3: Fetching bank settlement data")
	var bankData []map[string]interface{}
	workflow.ExecuteActivity(ctx, "FetchBankSettlementData", req.StartDate, req.EndDate).Get(ctx, &bankData)

	// Step 4: Run reconciliation (Python worker)
	logger.Info("Step 4: Running reconciliation")
	reconCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		TaskQueue:           "python-workers",
	})
	var reconResult map[string]interface{}
	err := workflow.ExecuteActivity(reconCtx, "RunReconciliation", map[string]interface{}{
		"ledgerData":    ledgerData,
		"processorData": processorData,
		"bankData":      bankData,
	}).Get(reconCtx, &reconResult)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	result.ReconciliationID = reconResult["reconciliationID"].(string)
	result.MatchedCount = int(reconResult["matchedCount"].(float64))
	result.UnmatchedCount = int(reconResult["unmatchedCount"].(float64))

	// Step 5: Handle discrepancies
	if result.UnmatchedCount > 0 {
		logger.Info("Step 5: Handling discrepancies")
		workflow.ExecuteActivity(ctx, "CreateReconciliationAlerts", reconResult["discrepancies"])
	}

	// Step 6: Write results to Lakehouse
	logger.Info("Step 6: Writing to Lakehouse")
	workflow.ExecuteActivity(ctx, "WriteLakehouse", "fact_reconciliations", map[string]interface{}{
		"reconciliation_id": result.ReconciliationID,
		"type":              req.ReconciliationType,
		"start_date":        req.StartDate,
		"end_date":          req.EndDate,
		"matched_count":     result.MatchedCount,
		"unmatched_count":   result.UnmatchedCount,
		"completed_at":      workflow.Now(ctx),
	})

	// Step 7: Publish event to Kafka
	logger.Info("Step 7: Publishing event to Kafka")
	workflow.ExecuteActivity(ctx, "PublishToKafka", "reconciliation.completed", result)

	result.Status = "completed"
	logger.Info("Journey 10 completed successfully", "reconciliationID", result.ReconciliationID)
	return result, nil
}
