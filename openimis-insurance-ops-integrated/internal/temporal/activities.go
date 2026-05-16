package temporal

import (
	"context"
	"fmt"
	"time"

	"claims-reserve-service/internal/calculator"
	"claims-reserve-service/internal/db"
	"claims-reserve-service/internal/model"
	"claims-reserve-service/internal/openimis"
	"claims-reserve-service/pkg/log"
	"claims-reserve-service/pkg/metrics"

	"github.com/google/uuid"
	"go.temporal.io/sdk/activity"
	"go.uber.org/zap"
)

// Activities struct holds dependencies for Temporal activities
type Activities struct {
	ReserveRepo *db.ReserveRepository
	Calculator  *calculator.ReserveCalculator
	OpenIMIS    *openimis.Client
	Metrics     *metrics.Metrics
}

// NewActivities creates a new Activities instance
func NewActivities(repo *db.ReserveRepository, calc *calculator.ReserveCalculator, client *openimis.Client, m *metrics.Metrics) *Activities {
	return &Activities{
		ReserveRepo: repo,
		Calculator:  calc,
		OpenIMIS:    client,
		Metrics:     m,
	}
}

// FetchClaimActivity fetches the claim details from OpenIMIS
func (a *Activities) FetchClaimActivity(ctx context.Context, claimID uuid.UUID) (*model.Claim, error) {
	log.L().Info("Activity: FetchClaimActivity started", zap.String("claimID", claimID.String()))
	
	claim, err := a.OpenIMIS.GetClaim(ctx, claimID.String())
	if err != nil {
		log.L().Error("Failed to fetch claim", zap.Error(err), zap.String("claimID", claimID.String()))
		return nil, err
	}

	log.L().Info("Activity: Claim fetched successfully", zap.String("claimID", claimID.String()), zap.Float64("amount", claim.Amount))
	return &claim, nil
}

// CalculateReserveActivity calculates the appropriate reserve for the claim
func (a *Activities) CalculateReserveActivity(ctx context.Context, claim model.Claim) (*model.Reserve, error) {
	log.L().Info("Activity: CalculateReserveActivity started", zap.String("claimID", claim.ID.String()))
	
	start := time.Now()
	defer a.Metrics.ReserveCalculationDuration.WithLabelValues("individual").Observe(time.Since(start).Seconds())

	var reserve model.Reserve
	var err error

	if claim.IsLarge {
		// Large claim requires actuarial review
		reserve, err = a.Calculator.ActuarialReviewReserve(ctx, claim)
		if err != nil {
			log.L().Error("Failed to calculate actuarial reserve", zap.Error(err), zap.String("claimID", claim.ID.String()))
			return nil, err
		}
	} else {
		// Standard claim uses individual reserve calculation
		reserve, err = a.Calculator.CalculateIndividualReserve(ctx, claim)
		if err != nil {
			log.L().Error("Failed to calculate individual reserve", zap.Error(err), zap.String("claimID", claim.ID.String()))
			return nil, err
		}
	}

	log.L().Info("Activity: Reserve calculated", zap.String("claimID", claim.ID.String()), zap.Float64("amount", reserve.Amount))
	return &reserve, nil
}

// PersistReserveActivity saves the new reserve to the local database
func (a *Activities) PersistReserveActivity(ctx context.Context, reserve model.Reserve) error {
	log.L().Info("Activity: PersistReserveActivity started", zap.String("claimID", reserve.ClaimID.String()), zap.Float64("amount", reserve.Amount))

	// 1. Deactivate old reserve
	if err := a.ReserveRepo.DeactivateReservesByClaimID(ctx, reserve.ClaimID); err != nil {
		log.L().Error("Failed to deactivate old reserves", zap.Error(err), zap.String("claimID", reserve.ClaimID.String()))
		// Non-fatal error, continue to save new reserve
	}

	// 2. Save new reserve
	if err := a.ReserveRepo.SaveReserve(ctx, reserve); err != nil {
		log.L().Error("Failed to persist new reserve", zap.Error(err), zap.String("claimID", reserve.ClaimID.String()))
		return err
	}

	log.L().Info("Activity: Reserve persisted successfully", zap.String("claimID", reserve.ClaimID.String()))
	return nil
}

// SyncReserveToOpenIMISActivity sends the new reserve back to the OpenIMIS Claims Service
func (a *Activities) SyncReserveToOpenIMISActivity(ctx context.Context, reserve model.Reserve) error {
	log.L().Info("Activity: SyncReserveToOpenIMISActivity started", zap.String("claimID", reserve.ClaimID.String()), zap.Float64("amount", reserve.Amount))

	// Temporal's retry policy will handle transient network errors
	err := a.OpenIMIS.SendReserveAdjustment(ctx, reserve)
	if err != nil {
		log.L().Error("Failed to sync reserve to OpenIMIS", zap.Error(err), zap.String("claimID", reserve.ClaimID.String()))
		return err
	}

	log.L().Info("Activity: Reserve synced to OpenIMIS successfully", zap.String("claimID", reserve.ClaimID.String()))
	return nil
}

// CalculateIBNRActivity triggers the IBNR calculation and persists the result
func (a *Activities) CalculateIBNRActivity(ctx context.Context) error {
	log.L().Info("Activity: CalculateIBNRActivity started")
	
	a.Metrics.IBNRCalculationCounter.WithLabelValues("started").Inc()

	result, err := a.Calculator.CalculateIBNRReserve(ctx)
	if err != nil {
		a.Metrics.IBNRCalculationCounter.WithLabelValues("failure").Inc()
		log.L().Error("Failed to calculate IBNR", zap.Error(err))
		return err
	}

	// Persist IBNR result
	if err := a.ReserveRepo.SaveIBNRResult(ctx, result); err != nil {
		a.Metrics.IBNRCalculationCounter.WithLabelValues("failure").Inc()
		log.L().Error("Failed to persist IBNR result", zap.Error(err))
		return err
	}

	a.Metrics.IBNRCalculationCounter.WithLabelValues("success").Inc()
	log.L().Info("Activity: IBNR calculation and persistence successful", zap.Float64("totalIBNR", result.TotalIBNR))
	return nil
}
