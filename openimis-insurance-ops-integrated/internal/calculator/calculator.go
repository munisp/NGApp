package calculator

import (
	"context"
	"fmt"
	"time"

	"claims-reserve-service/internal/model"
	"claims-reserve-service/internal/openimis"
	"claims-reserve-service/pkg/log"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ReserveCalculator handles the business logic for calculating reserves
type ReserveCalculator struct {
	openIMISClient *openimis.Client
}

// NewReserveCalculator creates a new ReserveCalculator
func NewReserveCalculator(client *openimis.Client) *ReserveCalculator {
	return &ReserveCalculator{
		openIMISClient: client,
	}
}

// CalculateIndividualReserve calculates the reserve for a single claim
func (c *ReserveCalculator) CalculateIndividualReserve(ctx context.Context, claim model.Claim) (model.Reserve, error) {
	log.L().Info("Calculating individual reserve", zap.String("claimID", claim.ID.String()))

	// Simple reserve calculation logic: 
	// Reserve = Claim Amount * Multiplier
	// Multiplier could be based on claim status, policy type, etc.
	// For simplicity, we use a fixed multiplier for PENDING claims.
	
	multiplier := 1.0
	reserveType := "INDIVIDUAL"

	if claim.Status == "PENDING" {
		multiplier = 1.05 // 5% buffer for pending claims
	} else if claim.Status == "APPROVED" {
		multiplier = 1.0 // Reserve equals approved amount
	} else if claim.Status == "REJECTED" {
		multiplier = 0.0 // No reserve needed
	}

	reserveAmount := claim.Amount * multiplier

	reserve := model.Reserve{
		ID:        uuid.New(),
		ClaimID:   claim.ID,
		ReserveType: reserveType,
		Amount:    reserveAmount,
		Timestamp: time.Now(),
		IsActive:  true,
	}

	log.L().Info("Individual reserve calculated", 
		zap.String("claimID", claim.ID.String()),
		zap.Float64("claimAmount", claim.Amount),
		zap.Float64("reserveAmount", reserveAmount),
	)

	return reserve, nil
}

// ActuarialReviewReserve triggers an external actuarial review for large claims
func (c *ReserveCalculator) ActuarialReviewReserve(ctx context.Context, claim model.Claim) (model.Reserve, error) {
	log.L().Info("Triggering actuarial review for large claim", zap.String("claimID", claim.ID.String()))

	req := model.ActuarialReviewRequest{
		ClaimID: claim.ID,
		ClaimAmount: claim.Amount,
	}

	resp, err := c.openIMISClient.RequestActuarialReview(ctx, req)
	if err != nil {
		return model.Reserve{}, fmt.Errorf("failed to request actuarial review: %w", err)
	}

	reserve := model.Reserve{
		ID:        uuid.New(),
		ClaimID:   claim.ID,
		ReserveType: "ACTUARIAL",
		Amount:    resp.RecommendedReserve,
		Timestamp: time.Now(),
		IsActive:  true,
	}

	log.L().Info("Actuarial reserve calculated", 
		zap.String("claimID", claim.ID.String()),
		zap.Float64("recommendedReserve", resp.RecommendedReserve),
		zap.String("reviewer", resp.ReviewerID),
	)

	return reserve, nil
}

// CalculateIBNRReserve triggers the IBNR calculation and returns the result
func (c *ReserveCalculator) CalculateIBNRReserve(ctx context.Context) (model.IBNRCalculationResult, error) {
	log.L().Info("Triggering IBNR calculation")

	result, err := c.openIMISClient.TriggerIBNRCalculation(ctx)
	if err != nil {
		return model.IBNRCalculationResult{}, fmt.Errorf("failed to trigger IBNR calculation: %w", err)
	}

	log.L().Info("IBNR calculation result received", zap.Float64("totalIBNR", result.TotalIBNR))
	return result, nil
}
