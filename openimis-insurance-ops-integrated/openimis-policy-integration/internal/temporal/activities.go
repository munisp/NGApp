package temporal

import (
	"context"
	"time"

	"go.temporal.io/sdk/activity"
	"go.uber.org/zap"

	"openimis-policy-integration/internal/openimis"
)

// Activities is a struct to hold dependencies for Temporal activities.
type Activities struct {
	OpenIMISClient openimis.Client
	Logger         *zap.Logger
}

// PremiumCalculationInput is the input for the CalculatePremiumActivity.
type PremiumCalculationInput struct {
	PolicyID      string
	EnrollmentDate string
	FamilyMembers []openimis.Member
	SchemeID      string
}

// PremiumCalculationOutput is the output from the CalculatePremiumActivity.
type PremiumCalculationOutput struct {
	CalculatedPremium float64
	Currency          string
}

// CalculatePremiumActivity calls the OpenIMIS premium calculator API.
func (a *Activities) CalculatePremiumActivity(ctx context.Context, input PremiumCalculationInput) (*PremiumCalculationOutput, error) {
	log := activity.GetLogger(ctx)
	log.Info("Starting premium calculation activity", zap.String("policy_id", input.PolicyID))

	req := openimis.PremiumCalculationRequest{
		PolicyID:      input.PolicyID,
		EnrollmentDate: input.EnrollmentDate,
		FamilyMembers: input.FamilyMembers,
		SchemeID:      input.SchemeID,
	}

	// Simulate a long-running process for demonstration
	time.Sleep(1 * time.Second)

	resp, err := a.OpenIMISClient.CalculatePremium(ctx, req)
	if err != nil {
		log.Error("Failed to calculate premium with OpenIMIS", zap.Error(err))
		return nil, err
	}

	log.Info("Premium calculation successful", zap.Float64("premium", resp.CalculatedPremium), zap.String("currency", resp.Currency))

	return &PremiumCalculationOutput{
		CalculatedPremium: resp.CalculatedPremium,
		Currency:          resp.Currency,
	}, nil
}
