package temporal

import (
	"context"
	"fmt"
	"math"
	"time"

	"go.temporal.io/sdk/activity"
	"underwriting-risk-integrator/internal/openimis"
	"underwriting-risk-integrator/pkg/models"
)

// ActivityContext holds dependencies for Temporal activities.
type ActivityContext struct {
	OpenIMISClient openimis.Client
}

// NewActivityContext creates a new ActivityContext.
func NewActivityContext(client openimis.Client) *ActivityContext {
	return &ActivityContext{
		OpenIMISClient: client,
	}
}

// AssessRiskActivity calls the OpenIMIS risk assessment service.
func (ac *ActivityContext) AssessRiskActivity(ctx context.Context, uc models.UnderwritingCase) (*models.RiskAssessmentResult, error) {
	activity.GetLogger(ctx).Info("Assessing risk with OpenIMIS", "case_id", uc.CaseID)
	return ac.OpenIMISClient.AssessRisk(ctx, uc)
}

// LookupMortalityTableActivity calls the OpenIMIS mortality table lookup.
func (ac *ActivityContext) LookupMortalityTableActivity(ctx context.Context, age int, gender string) (*models.MortalityTableEntry, error) {
	activity.GetLogger(ctx).Info("Looking up mortality table", "age", age, "gender", gender)
	// Mock gender to 'M' for simplicity in mock client, as the mock client only uses age for rate calculation.
	// In a real scenario, the gender would be passed through.
	return ac.OpenIMISClient.LookupMortalityTable(ctx, age, "M")
}

// SyncUnderwritingDecisionActivity syncs the final decision back to OpenIMIS.
func (ac *ActivityContext) SyncUnderwritingDecisionActivity(ctx context.Context, decision models.UnderwritingDecision) error {
	activity.GetLogger(ctx).Info("Syncing underwriting decision to OpenIMIS", "case_id", decision.CaseID, "decision", decision.Decision)
	return ac.OpenIMISClient.SyncUnderwritingDecision(ctx, decision)
}

// ValidateActuarialGuidelinesActivity validates the risk assessment against internal actuarial guidelines.
func (ac *ActivityContext) ValidateActuarialGuidelinesActivity(ctx context.Context, uc models.UnderwritingCase, rate *models.MortalityTableEntry, result *models.RiskAssessmentResult) (bool, string, error) {
	activity.GetLogger(ctx).Info("Validating actuarial guidelines", "case_id", uc.CaseID)

	// Guideline 1: Check if the recommended premium is within an acceptable range based on mortality rate.
	// Simple check: Recommended premium should be at least 100 times the mortality rate.
	minAcceptablePremium := rate.MortalityRate * 100 * uc.SumAssured
	if result.RecommendedPremium < minAcceptablePremium {
		reason := fmt.Sprintf("Recommended premium (%.2f) is below minimum acceptable premium (%.2f) based on mortality rate (%.4f).",
			result.RecommendedPremium, minAcceptablePremium, rate.MortalityRate)
		return false, reason, nil
	}

	// Guideline 2: Decline if risk score is too high, regardless of OpenIMIS category.
	if result.RiskScore > 60 && result.RiskCategory != "Declined" {
		reason := fmt.Sprintf("Internal guideline violation: Risk score (%.2f) is too high, overriding OpenIMIS category '%s'.",
			result.RiskScore, result.RiskCategory)
		return false, reason, nil
	}

	// Guideline 3: Substandard risk requires a minimum sum assured.
	if result.RiskCategory == "Substandard" && uc.SumAssured < 50000 {
		reason := fmt.Sprintf("Substandard risk requires a minimum sum assured of 50000, but is %.2f.", uc.SumAssured)
		return false, reason, nil
	}

	return true, "Actuarial guidelines passed.", nil
}

// DetermineFinalDecisionActivity determines the final underwriting decision.
func (ac *ActivityContext) DetermineFinalDecisionActivity(ctx context.Context, uc models.UnderwritingCase, isValid bool, validationReason string, result *models.RiskAssessmentResult) (*models.UnderwritingDecision, error) {
	activity.GetLogger(ctx).Info("Determining final decision", "case_id", uc.CaseID)

	decision := models.UnderwritingDecision{
		CaseID:       uc.CaseID,
		DecisionDate: time.Now(),
		FinalPremium: result.RecommendedPremium,
	}

	if !isValid {
		decision.Decision = "Declined"
		decision.ReasonCode = "ACTUARIAL_GUIDELINE_VIOLATION"
		decision.FinalPremium = 0.0
		activity.GetLogger(ctx).Warn("Case declined due to actuarial guideline violation", "reason", validationReason)
		return &decision, nil
	}

	switch result.RiskCategory {
	case "Standard":
		decision.Decision = "Approved"
	case "Substandard":
		// For simplicity, we approve substandard cases with the recommended premium loading.
		// In a real system, this might require manual referral.
		decision.Decision = "Approved"
	case "Declined":
		decision.Decision = "Declined"
		decision.ReasonCode = "OPENIMIS_RISK_DECLINE"
		decision.FinalPremium = 0.0
	default:
		// Fallback for unexpected risk categories
		decision.Decision = "Referred"
		decision.ReasonCode = "UNEXPECTED_RISK_CATEGORY"
	}

	// Final check: Ensure premium is a positive number if approved
	if decision.Decision == "Approved" && decision.FinalPremium <= 0 {
		decision.Decision = "Declined"
		decision.ReasonCode = "ZERO_OR_NEGATIVE_PREMIUM"
		decision.FinalPremium = 0.0
	}

	// Round premium to 2 decimal places
	decision.FinalPremium = math.Round(decision.FinalPremium*100) / 100

	return &decision, nil
}
