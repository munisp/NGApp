package temporal

import (
	"context"

	"underwriting-risk-integrator/pkg/models"
)

// Workflow is the interface for the risk assessment workflow.
type Workflow interface {
	UnderwritingRiskAssessment(ctx context.Context, input models.UnderwritingCase) (*models.UnderwritingDecision, error)
}

// Activities is the interface for the workflow activities.
type Activities interface {
	// OpenIMIS Activities
	AssessRiskActivity(ctx context.Context, uc models.UnderwritingCase) (*models.RiskAssessmentResult, error)
	LookupMortalityTableActivity(ctx context.Context, age int, gender string) (*models.MortalityTableEntry, error)
	SyncUnderwritingDecisionActivity(ctx context.Context, decision models.UnderwritingDecision) error

	// Internal Activities
	ValidateActuarialGuidelinesActivity(ctx context.Context, uc models.UnderwritingCase, rate *models.MortalityTableEntry, result *models.RiskAssessmentResult) (bool, string, error)
	DetermineFinalDecisionActivity(ctx context.Context, uc models.UnderwritingCase, isValid bool, validationReason string, result *models.RiskAssessmentResult) (*models.UnderwritingDecision, error)
}
