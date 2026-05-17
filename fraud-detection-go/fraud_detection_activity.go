package frauddetection

import (
	"context"
	"database/sql"
	"fmt"

	"go.temporal.io/sdk/activity"
)

// DetectFraudActivity is a Temporal activity for fraud detection
type DetectFraudActivity struct {
	service *FraudDetectionService
}

// NewDetectFraudActivity creates a new fraud detection activity
func NewDetectFraudActivity(db *sql.DB) *DetectFraudActivity {
	return &DetectFraudActivity{
		service: NewFraudDetectionService(db),
	}
}

// Execute performs fraud detection as a Temporal activity
func (a *DetectFraudActivity) Execute(ctx context.Context, req FraudDetectionRequest) (*FraudDetectionResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Starting fraud detection activity",
		"claim_id", req.ClaimID,
		"policy_id", req.PolicyID,
	)

	// Perform fraud detection
	result, err := a.service.DetectFraud(ctx, req)
	if err != nil {
		logger.Error("Fraud detection failed", "error", err)
		return nil, fmt.Errorf("fraud detection failed: %w", err)
	}

	// Log the result
	logger.Info("Fraud detection completed",
		"claim_id", req.ClaimID,
		"fraud_score", result.FraudScore,
		"risk_level", result.RiskLevel,
		"recommendation", result.Recommendation,
		"flags_count", len(result.Flags),
	)

	// Record metrics
	activity.RecordHeartbeat(ctx, result.FraudScore)

	return result, nil
}

// Example usage in a Temporal workflow
/*
func ClaimsProcessingWorkflow(ctx workflow.Context, claimID string) (*ClaimResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting claims processing workflow", "claim_id", claimID)

	// ... other activities ...

	// Fraud Detection Activity
	fraudDetectionReq := FraudDetectionRequest{
		ClaimID:  claimID,
		PolicyID: "POL-12345678901-1706437200",
		ClaimDetails: map[string]interface{}{
			"claim_amount":      5000.00,
			"sum_assured":       5500.00,
			"policy_start_date": "2026-01-01T00:00:00Z",
			"claim_date":        "2026-01-15T00:00:00Z",
			"claim_type":        "motor_accident",
			"documents_submitted": []string{"police_report", "photos"},
			"beneficiary_id":    "BEN-001",
		},
	}

	var fraudResult *FraudDetectionResult
	err := workflow.ExecuteActivity(ctx, "DetectFraudActivity", fraudDetectionReq).Get(ctx, &fraudResult)
	if err != nil {
		return nil, fmt.Errorf("fraud detection activity failed: %w", err)
	}

	// Make decision based on fraud result
	if fraudResult.Recommendation == "REJECT" {
		logger.Warn("Claim rejected due to high fraud risk",
			"claim_id", claimID,
			"fraud_score", fraudResult.FraudScore,
		)
		return &ClaimResult{
			Status: "REJECTED",
			Reason: "High fraud risk detected",
		}, nil
	}

	if fraudResult.Recommendation == "MANUAL_REVIEW" {
		logger.Info("Claim requires manual review",
			"claim_id", claimID,
			"fraud_score", fraudResult.FraudScore,
		)
		// Trigger manual review workflow
		// ...
	}

	// ... continue with claim processing ...

	return &ClaimResult{
		Status:      "APPROVED",
		FraudScore:  fraudResult.FraudScore,
		RiskLevel:   fraudResult.RiskLevel,
	}, nil
}
*/
