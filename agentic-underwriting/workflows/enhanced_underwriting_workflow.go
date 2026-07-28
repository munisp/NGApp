package workflows

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/workflow"
)

// EnhancedUnderwritingInput includes document processing
type EnhancedUnderwritingInput struct {
	ApplicationID    string          `json:"application_id"`
	CustomerID       string          `json:"customer_id"`
	PolicyType       string          `json:"policy_type"`
	SumAssured       float64         `json:"sum_assured"`
	Documents        []DocumentInput `json:"documents"`
	RequiresManualReview bool        `json:"requires_manual_review"`
}

// EnhancedUnderwritingResult includes document analysis results
type EnhancedUnderwritingResult struct {
	ApplicationID       string                 `json:"application_id"`
	Decision            string                 `json:"decision"` // APPROVED, REJECTED, MANUAL_REVIEW
	RiskScore           float64                `json:"risk_score"`
	PremiumAmount       float64                `json:"premium_amount"`
	DocumentAnalysis    *DocumentAnalysisResult `json:"document_analysis"`
	DataCollection      map[string]interface{} `json:"data_collection"`
	RiskAnalysis        map[string]interface{} `json:"risk_analysis"`
	PricingTerms        map[string]interface{} `json:"pricing_terms"`
	Reasoning           string                 `json:"reasoning"`
	CompletedAt         time.Time              `json:"completed_at"`
}

// EnhancedUnderwritingSaga orchestrates the complete underwriting process with document analysis
func EnhancedUnderwritingSaga(ctx workflow.Context, input EnhancedUnderwritingInput) (*EnhancedUnderwritingResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting enhanced underwriting saga with document processing", "application_id", input.ApplicationID)

	result := &EnhancedUnderwritingResult{
		ApplicationID: input.ApplicationID,
	}

	// Configure activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Process and Analyze Documents
	logger.Info("Step 1: Processing and analyzing documents")
	
	var documentAnalysis DocumentAnalysisResult
	err := workflow.ExecuteActivity(
		ctx,
		"ProcessDocuments",
		DocumentAnalysisRequest{
			ApplicationID: input.ApplicationID,
			Documents:     input.Documents,
		},
	).Get(ctx, &documentAnalysis)

	if err != nil {
		logger.Error("Document processing failed", "error", err)
		return nil, fmt.Errorf("document processing failed: %w", err)
	}

	result.DocumentAnalysis = &documentAnalysis

	// Check document analysis result
	if !documentAnalysis.Success {
		logger.Warn("Document analysis was not successful", "error", documentAnalysis.ErrorMessage)
		result.Decision = "MANUAL_REVIEW"
		result.Reasoning = fmt.Sprintf("Document analysis failed: %s", documentAnalysis.ErrorMessage)
		result.CompletedAt = time.Now()
		return result, nil
	}

	// Check authenticity score
	if documentAnalysis.AuthenticityScore < 70.0 {
		logger.Warn("Low authenticity score detected", "score", documentAnalysis.AuthenticityScore)
		result.Decision = "MANUAL_REVIEW"
		result.Reasoning = fmt.Sprintf("Low document authenticity score: %.2f", documentAnalysis.AuthenticityScore)
		result.CompletedAt = time.Now()
		return result, nil
	}

	// Check for red flags
	if len(documentAnalysis.RedFlags) > 0 {
		logger.Warn("Red flags detected in documents", "flags", documentAnalysis.RedFlags)
		result.Decision = "MANUAL_REVIEW"
		result.Reasoning = fmt.Sprintf("Document red flags: %v", documentAnalysis.RedFlags)
		result.CompletedAt = time.Now()
		return result, nil
	}

	// Step 2: Data Collection (using document data)
	logger.Info("Step 2: Collecting additional data")
	
	var dataCollectionResult map[string]interface{}
	err = workflow.ExecuteActivity(
		ctx,
		"CollectDataActivity",
		map[string]interface{}{
			"customer_id":       input.CustomerID,
			"document_analysis": documentAnalysis,
		},
	).Get(ctx, &dataCollectionResult)

	if err != nil {
		logger.Error("Data collection failed", "error", err)
		return nil, fmt.Errorf("data collection failed: %w", err)
	}

	result.DataCollection = dataCollectionResult

	// Step 3: Risk Analysis
	logger.Info("Step 3: Analyzing risk")
	
	var riskAnalysisResult map[string]interface{}
	err = workflow.ExecuteActivity(
		ctx,
		"AnalyzeRiskActivity",
		map[string]interface{}{
			"customer_id":       input.CustomerID,
			"data_collection":   dataCollectionResult,
			"document_analysis": documentAnalysis,
			"policy_type":       input.PolicyType,
			"sum_assured":       input.SumAssured,
		},
	).Get(ctx, &riskAnalysisResult)

	if err != nil {
		logger.Error("Risk analysis failed", "error", err)
		return nil, fmt.Errorf("risk analysis failed: %w", err)
	}

	result.RiskAnalysis = riskAnalysisResult

	// Extract risk score
	if riskScore, ok := riskAnalysisResult["risk_score"].(float64); ok {
		result.RiskScore = riskScore
	}

	// Step 4: Pricing and Terms
	logger.Info("Step 4: Calculating pricing and terms")
	
	var pricingResult map[string]interface{}
	err = workflow.ExecuteActivity(
		ctx,
		"CalculatePricingActivity",
		map[string]interface{}{
			"customer_id":     input.CustomerID,
			"risk_analysis":   riskAnalysisResult,
			"policy_type":     input.PolicyType,
			"sum_assured":     input.SumAssured,
		},
	).Get(ctx, &pricingResult)

	if err != nil {
		logger.Error("Pricing calculation failed", "error", err)
		return nil, fmt.Errorf("pricing calculation failed: %w", err)
	}

	result.PricingTerms = pricingResult

	// Extract premium amount
	if premium, ok := pricingResult["premium_amount"].(float64); ok {
		result.PremiumAmount = premium
	}

	// Step 5: Make Decision
	logger.Info("Step 5: Making underwriting decision")
	
	var decisionResult map[string]interface{}
	err = workflow.ExecuteActivity(
		ctx,
		"MakeUnderwritingDecisionActivity",
		map[string]interface{}{
			"application_id":    input.ApplicationID,
			"document_analysis": documentAnalysis,
			"risk_analysis":     riskAnalysisResult,
			"pricing":           pricingResult,
		},
	).Get(ctx, &decisionResult)

	if err != nil {
		logger.Error("Decision making failed", "error", err)
		return nil, fmt.Errorf("decision making failed: %w", err)
	}

	// Extract decision
	if decision, ok := decisionResult["decision"].(string); ok {
		result.Decision = decision
	}

	if reasoning, ok := decisionResult["reasoning"].(string); ok {
		result.Reasoning = reasoning
	}

	result.CompletedAt = time.Now()

	logger.Info("Enhanced underwriting saga completed",
		"application_id", input.ApplicationID,
		"decision", result.Decision,
		"risk_score", result.RiskScore,
		"premium", result.PremiumAmount,
	)

	return result, nil
}
