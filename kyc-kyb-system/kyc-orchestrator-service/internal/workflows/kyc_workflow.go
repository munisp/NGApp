package workflows

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

type KYCWorkflowInput struct {
	CustomerID    string                 `json:"customer_id"`
	CustomerType  string                 `json:"customer_type"` // individual, business
	FirstName     string                 `json:"first_name"`
	LastName      string                 `json:"last_name"`
	DateOfBirth   string                 `json:"date_of_birth"`
	NIN           string                 `json:"nin"`
	BVN           string                 `json:"bvn"`
	Phone         string                 `json:"phone"`
	Email         string                 `json:"email"`
	Address       string                 `json:"address"`
	DocumentPaths []string               `json:"document_paths"`
	SelfiePath    string                 `json:"selfie_path"`
	WebhookURL    string                 `json:"webhook_url"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type KYCWorkflowOutput struct {
	WorkflowID          string                 `json:"workflow_id"`
	CustomerID          string                 `json:"customer_id"`
	Status              string                 `json:"status"` // verified, rejected, pending_review
	RiskLevel           string                 `json:"risk_level"`
	RiskScore           float64                `json:"risk_score"`
	DDLevel             string                 `json:"dd_level"`
	VerificationDetails map[string]interface{} `json:"verification_details"`
	FailedChecks        []string               `json:"failed_checks"`
	CompletedAt         time.Time              `json:"completed_at"`
}

type DocumentVerificationResult struct {
	DocumentID      string                 `json:"document_id"`
	DocumentType    string                 `json:"document_type"`
	Status          string                 `json:"status"`
	ConfidenceScore float64                `json:"confidence_score"`
	ExtractedData   map[string]interface{} `json:"extracted_data"`
	FraudIndicators []string               `json:"fraud_indicators"`
}

type LivenessCheckResult struct {
	CheckID        string  `json:"check_id"`
	IsLive         bool    `json:"is_live"`
	LivenessScore  float64 `json:"liveness_score"`
	FaceMatchScore float64 `json:"face_match_score"`
	SpoofingType   string  `json:"spoofing_type"`
}

type NINVerificationResult struct {
	Status          string                 `json:"status"`
	ConfidenceScore float64                `json:"confidence_score"`
	MatchDetails    map[string]interface{} `json:"match_details"`
	VerifiedData    map[string]interface{} `json:"verified_data"`
}

type BVNVerificationResult struct {
	Status          string                 `json:"status"`
	ConfidenceScore float64                `json:"confidence_score"`
	MatchDetails    map[string]interface{} `json:"match_details"`
	VerifiedData    map[string]interface{} `json:"verified_data"`
}

type AMLScreeningResult struct {
	ScreeningID string  `json:"screening_id"`
	Status      string  `json:"status"` // clear, hit
	RiskLevel   string  `json:"risk_level"`
	HitCount    int     `json:"hit_count"`
	MatchScore  float64 `json:"match_score"`
}

type RiskScoringResult struct {
	RiskScoreID     string                 `json:"risk_score_id"`
	OverallScore    float64                `json:"overall_score"`
	RiskLevel       string                 `json:"risk_level"`
	DDLevel         string                 `json:"dd_level"`
	Recommendations map[string]interface{} `json:"recommendations"`
}

func IndividualKYCWorkflow(ctx workflow.Context, input KYCWorkflowInput) (*KYCWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Individual KYC Workflow", "customer_id", input.CustomerID)

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

	output := &KYCWorkflowOutput{
		WorkflowID:          workflow.GetInfo(ctx).WorkflowExecution.ID,
		CustomerID:          input.CustomerID,
		Status:              "in_progress",
		VerificationDetails: make(map[string]interface{}),
		FailedChecks:        []string{},
	}

	var notifyErr error
	notifyErr = workflow.ExecuteActivity(ctx, "NotifyKYCStarted", input.CustomerID, output.WorkflowID).Get(ctx, nil)
	if notifyErr != nil {
		logger.Warn("Failed to send KYC started notification", "error", notifyErr)
	}

	documentResults := make([]DocumentVerificationResult, 0)
	for _, docPath := range input.DocumentPaths {
		var docResult DocumentVerificationResult
		err := workflow.ExecuteActivity(ctx, "VerifyDocument", input.CustomerID, docPath).Get(ctx, &docResult)
		if err != nil {
			logger.Error("Document verification failed", "error", err)
			output.FailedChecks = append(output.FailedChecks, "document_verification")
			continue
		}
		documentResults = append(documentResults, docResult)

		if docResult.Status == "rejected" {
			output.FailedChecks = append(output.FailedChecks, fmt.Sprintf("document_%s", docResult.DocumentType))
		}
	}
	output.VerificationDetails["documents"] = documentResults

	var livenessResult LivenessCheckResult
	if input.SelfiePath != "" {
		var documentPhotoPath string
		for _, doc := range documentResults {
			if doc.DocumentType == "national_id" || doc.DocumentType == "passport" {
				if photoPath, ok := doc.ExtractedData["photo_path"].(string); ok {
					documentPhotoPath = photoPath
					break
				}
			}
		}

		err := workflow.ExecuteActivity(ctx, "CheckLiveness", input.CustomerID, input.SelfiePath, documentPhotoPath).Get(ctx, &livenessResult)
		if err != nil {
			logger.Error("Liveness check failed", "error", err)
			output.FailedChecks = append(output.FailedChecks, "liveness_check")
		} else if !livenessResult.IsLive {
			output.FailedChecks = append(output.FailedChecks, "liveness_check")
		}
		output.VerificationDetails["liveness"] = livenessResult
	}

	var ninResult NINVerificationResult
	var bvnResult BVNVerificationResult

	ninFuture := workflow.ExecuteActivity(ctx, "VerifyNIN", input.CustomerID, input.NIN, input.FirstName, input.LastName, input.DateOfBirth)
	bvnFuture := workflow.ExecuteActivity(ctx, "VerifyBVN", input.CustomerID, input.BVN, input.FirstName, input.LastName, input.DateOfBirth)

	if err := ninFuture.Get(ctx, &ninResult); err != nil {
		logger.Error("NIN verification failed", "error", err)
		output.FailedChecks = append(output.FailedChecks, "nin_verification")
	} else if ninResult.Status != "verified" {
		output.FailedChecks = append(output.FailedChecks, "nin_verification")
	}
	output.VerificationDetails["nin"] = ninResult

	if err := bvnFuture.Get(ctx, &bvnResult); err != nil {
		logger.Error("BVN verification failed", "error", err)
		output.FailedChecks = append(output.FailedChecks, "bvn_verification")
	} else if bvnResult.Status != "verified" {
		output.FailedChecks = append(output.FailedChecks, "bvn_verification")
	}
	output.VerificationDetails["bvn"] = bvnResult

	var amlResult AMLScreeningResult
	err := workflow.ExecuteActivity(ctx, "ScreenAML", input.CustomerID, input.FirstName+" "+input.LastName, input.DateOfBirth, "Nigerian").Get(ctx, &amlResult)
	if err != nil {
		logger.Error("AML screening failed", "error", err)
		output.FailedChecks = append(output.FailedChecks, "aml_screening")
	} else if amlResult.Status == "hit" {
		output.FailedChecks = append(output.FailedChecks, "aml_screening")
	}
	output.VerificationDetails["aml"] = amlResult

	var riskResult RiskScoringResult
	riskInput := map[string]interface{}{
		"customer_id":       input.CustomerID,
		"document_verified": len(output.FailedChecks) == 0 || !contains(output.FailedChecks, "document_verification"),
		"liveness_verified": livenessResult.IsLive,
		"aml_clear":         amlResult.Status == "clear",
		"aml_hit_count":     amlResult.HitCount,
		"country":           "Nigeria",
	}

	err = workflow.ExecuteActivity(ctx, "CalculateRiskScore", riskInput).Get(ctx, &riskResult)
	if err != nil {
		logger.Error("Risk scoring failed", "error", err)
		output.RiskLevel = "unknown"
		output.RiskScore = 0
	} else {
		output.RiskLevel = riskResult.RiskLevel
		output.RiskScore = riskResult.OverallScore
		output.DDLevel = riskResult.DDLevel
		output.VerificationDetails["risk"] = riskResult
	}

	if len(output.FailedChecks) == 0 {
		output.Status = "verified"
	} else if riskResult.RiskLevel == "critical" || len(output.FailedChecks) > 2 {
		output.Status = "rejected"
	} else {
		output.Status = "pending_review"
	}

	output.CompletedAt = workflow.Now(ctx)

	if output.Status == "verified" {
		_ = workflow.ExecuteActivity(ctx, "NotifyKYCCompleted", input.CustomerID, output.WorkflowID, output.RiskLevel, output.RiskScore, output.VerificationDetails).Get(ctx, nil)
	} else {
		_ = workflow.ExecuteActivity(ctx, "NotifyKYCFailed", input.CustomerID, output.WorkflowID, output.Status, output.FailedChecks).Get(ctx, nil)
	}

	_ = workflow.ExecuteActivity(ctx, "PublishKYCEvent", output).Get(ctx, nil)

	logger.Info("Individual KYC Workflow completed", "customer_id", input.CustomerID, "status", output.Status)
	return output, nil
}

type KYBWorkflowInput struct {
	CompanyID       string                 `json:"company_id"`
	CACNumber       string                 `json:"cac_number"`
	CompanyName     string                 `json:"company_name"`
	CompanyType     string                 `json:"company_type"`
	Directors       []DirectorInfo         `json:"directors"`
	UBOs            []UBOInfo              `json:"ubos"`
	DocumentPaths   []string               `json:"document_paths"`
	WebhookURL      string                 `json:"webhook_url"`
	Metadata        map[string]interface{} `json:"metadata"`
}

type DirectorInfo struct {
	CustomerID  string `json:"customer_id"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DateOfBirth string `json:"date_of_birth"`
	NIN         string `json:"nin"`
	BVN         string `json:"bvn"`
	Role        string `json:"role"`
}

type UBOInfo struct {
	CustomerID          string  `json:"customer_id"`
	FirstName           string  `json:"first_name"`
	LastName            string  `json:"last_name"`
	DateOfBirth         string  `json:"date_of_birth"`
	NIN                 string  `json:"nin"`
	OwnershipPercentage float64 `json:"ownership_percentage"`
}

type KYBWorkflowOutput struct {
	WorkflowID          string                 `json:"workflow_id"`
	CompanyID           string                 `json:"company_id"`
	Status              string                 `json:"status"`
	RiskLevel           string                 `json:"risk_level"`
	RiskScore           float64                `json:"risk_score"`
	DDLevel             string                 `json:"dd_level"`
	CACVerification     map[string]interface{} `json:"cac_verification"`
	DirectorResults     []map[string]interface{} `json:"director_results"`
	UBOResults          []map[string]interface{} `json:"ubo_results"`
	VerificationDetails map[string]interface{} `json:"verification_details"`
	FailedChecks        []string               `json:"failed_checks"`
	CompletedAt         time.Time              `json:"completed_at"`
}

func BusinessKYBWorkflow(ctx workflow.Context, input KYBWorkflowInput) (*KYBWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Business KYB Workflow", "company_id", input.CompanyID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	output := &KYBWorkflowOutput{
		WorkflowID:          workflow.GetInfo(ctx).WorkflowExecution.ID,
		CompanyID:           input.CompanyID,
		Status:              "in_progress",
		VerificationDetails: make(map[string]interface{}),
		FailedChecks:        []string{},
		DirectorResults:     []map[string]interface{}{},
		UBOResults:          []map[string]interface{}{},
	}

	var cacResult map[string]interface{}
	err := workflow.ExecuteActivity(ctx, "VerifyCAC", input.CACNumber, input.CompanyName).Get(ctx, &cacResult)
	if err != nil {
		logger.Error("CAC verification failed", "error", err)
		output.FailedChecks = append(output.FailedChecks, "cac_verification")
	} else if cacResult["status"] != "active" {
		output.FailedChecks = append(output.FailedChecks, "cac_verification")
	}
	output.CACVerification = cacResult
	output.VerificationDetails["cac"] = cacResult

	for _, director := range input.Directors {
		directorKYCInput := KYCWorkflowInput{
			CustomerID:  director.CustomerID,
			FirstName:   director.FirstName,
			LastName:    director.LastName,
			DateOfBirth: director.DateOfBirth,
			NIN:         director.NIN,
			BVN:         director.BVN,
		}

		var directorResult *KYCWorkflowOutput
		childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
			WorkflowID: fmt.Sprintf("director-kyc-%s-%s", input.CompanyID, director.CustomerID),
		})

		err := workflow.ExecuteChildWorkflow(childCtx, IndividualKYCWorkflow, directorKYCInput).Get(ctx, &directorResult)
		if err != nil {
			logger.Error("Director KYC failed", "director_id", director.CustomerID, "error", err)
			output.FailedChecks = append(output.FailedChecks, fmt.Sprintf("director_%s", director.CustomerID))
		} else if directorResult.Status != "verified" {
			output.FailedChecks = append(output.FailedChecks, fmt.Sprintf("director_%s", director.CustomerID))
		}

		output.DirectorResults = append(output.DirectorResults, map[string]interface{}{
			"customer_id": director.CustomerID,
			"name":        director.FirstName + " " + director.LastName,
			"role":        director.Role,
			"status":      directorResult.Status,
			"risk_level":  directorResult.RiskLevel,
		})
	}

	for _, ubo := range input.UBOs {
		if ubo.OwnershipPercentage < 25 {
			continue
		}

		uboKYCInput := KYCWorkflowInput{
			CustomerID:  ubo.CustomerID,
			FirstName:   ubo.FirstName,
			LastName:    ubo.LastName,
			DateOfBirth: ubo.DateOfBirth,
			NIN:         ubo.NIN,
		}

		var uboResult *KYCWorkflowOutput
		childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
			WorkflowID: fmt.Sprintf("ubo-kyc-%s-%s", input.CompanyID, ubo.CustomerID),
		})

		err := workflow.ExecuteChildWorkflow(childCtx, IndividualKYCWorkflow, uboKYCInput).Get(ctx, &uboResult)
		if err != nil {
			logger.Error("UBO KYC failed", "ubo_id", ubo.CustomerID, "error", err)
			output.FailedChecks = append(output.FailedChecks, fmt.Sprintf("ubo_%s", ubo.CustomerID))
		} else if uboResult.Status != "verified" {
			output.FailedChecks = append(output.FailedChecks, fmt.Sprintf("ubo_%s", ubo.CustomerID))
		}

		output.UBOResults = append(output.UBOResults, map[string]interface{}{
			"customer_id":          ubo.CustomerID,
			"name":                 ubo.FirstName + " " + ubo.LastName,
			"ownership_percentage": ubo.OwnershipPercentage,
			"status":               uboResult.Status,
			"risk_level":           uboResult.RiskLevel,
		})
	}

	var companyAMLResult AMLScreeningResult
	err = workflow.ExecuteActivity(ctx, "ScreenAML", input.CompanyID, input.CompanyName, "", "Nigerian").Get(ctx, &companyAMLResult)
	if err != nil {
		logger.Error("Company AML screening failed", "error", err)
		output.FailedChecks = append(output.FailedChecks, "company_aml_screening")
	} else if companyAMLResult.Status == "hit" {
		output.FailedChecks = append(output.FailedChecks, "company_aml_screening")
	}
	output.VerificationDetails["company_aml"] = companyAMLResult

	var riskResult RiskScoringResult
	riskInput := map[string]interface{}{
		"customer_id":       input.CompanyID,
		"customer_type":     "business",
		"document_verified": cacResult["status"] == "active",
		"aml_clear":         companyAMLResult.Status == "clear",
		"aml_hit_count":     companyAMLResult.HitCount,
		"country":           "Nigeria",
	}

	err = workflow.ExecuteActivity(ctx, "CalculateRiskScore", riskInput).Get(ctx, &riskResult)
	if err != nil {
		logger.Error("Risk scoring failed", "error", err)
		output.RiskLevel = "unknown"
	} else {
		output.RiskLevel = riskResult.RiskLevel
		output.RiskScore = riskResult.OverallScore
		output.DDLevel = riskResult.DDLevel
		output.VerificationDetails["risk"] = riskResult
	}

	if len(output.FailedChecks) == 0 {
		output.Status = "verified"
	} else if riskResult.RiskLevel == "critical" || len(output.FailedChecks) > 3 {
		output.Status = "rejected"
	} else {
		output.Status = "pending_review"
	}

	output.CompletedAt = workflow.Now(ctx)

	_ = workflow.ExecuteActivity(ctx, "PublishKYBEvent", output).Get(ctx, nil)

	logger.Info("Business KYB Workflow completed", "company_id", input.CompanyID, "status", output.Status)
	return output, nil
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
