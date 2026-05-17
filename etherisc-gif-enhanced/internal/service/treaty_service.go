package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/etherisc/treaty-reinsurance-service/internal/models"
	"github.com/etherisc/treaty-reinsurance-service/internal/repository"
	"github.com/etherisc/treaty-reinsurance-service/pkg/reinsurance"
	"github.com/sirupsen/logrus"
)

// TreatyService defines the business logic for treaty management and cession calculation
type TreatyService struct {
	repo repository.Repository
	log  *logrus.Logger
}

// NewTreatyService creates a new instance of TreatyService
func NewTreatyService(repo repository.Repository, log *logrus.Logger) *TreatyService {
	return &TreatyService{repo: repo, log: log}
}

// CreateTreaty creates a new reinsurance treaty
func (s *TreatyService) CreateTreaty(ctx context.Context, treaty *models.Treaty) error {
	s.log.WithField("treaty_name", treaty.Name).Info("Creating new treaty")
	return s.repo.CreateTreaty(ctx, treaty)
}

// GetTreatyByID retrieves a treaty by its ID
func (s *TreatyService) GetTreatyByID(ctx context.Context, id uint) (*models.Treaty, error) {
	return s.repo.GetTreatyByID(ctx, id)
}

// GetAllTreaties retrieves all treaties
func (s *TreatyService) GetAllTreaties(ctx context.Context) ([]models.Treaty, error) {
	return s.repo.GetAllTreaties(ctx)
}

// UpdateTreaty updates an existing treaty
func (s *TreatyService) UpdateTreaty(ctx context.Context, treaty *models.Treaty) error {
	s.log.WithField("treaty_id", treaty.ID).Info("Updating treaty")
	return s.repo.UpdateTreaty(ctx, treaty)
}

// DeleteTreaty deletes a treaty by its ID
func (s *TreatyService) DeleteTreaty(ctx context.Context, id uint) error {
	s.log.WithField("treaty_id", id).Warn("Deleting treaty")
	return s.repo.DeleteTreaty(ctx, id)
}

// CalculateCession finds the applicable treaty and calculates the automatic cession.
// externalRefID is the ID of the policy or claim that is being ceded.
// originalAmount is the amount of risk (for proportional) or loss (for non-proportional) to be ceded.
func (s *TreatyService) CalculateCession(ctx context.Context, externalRefID string, originalAmount float64) (*models.Cession, error) {
	// 1. Find applicable treaty (simplification: assume one active treaty for now)
	treaties, err := s.repo.GetAllTreaties(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get all treaties: %w", err)
	}
	if len(treaties) == 0 {
		return nil, errors.New("no active treaties found for cession calculation")
	}
	// For simplicity, we'll use the first active treaty found. In a real system,
	// complex underwriting rules would determine the applicable treaty.
	treaty := &treaties[0]

	var result *reinsurance.CessionResult
	var utilization *models.Utilization

	switch treaty.TreatyType {
	case models.TreatyTypeQuotaShare, models.TreatyTypeSurplus:
		result, err = reinsurance.CalculateProportionalCession(treaty, originalAmount)
	case models.TreatyTypeExcessOfLoss:
		// XL is calculated per-loss, no utilization tracking needed for the calculation itself
		result, err = reinsurance.CalculateNonProportionalCession(treaty, originalAmount, nil)
	case models.TreatyTypeStopLoss:
		// Stop Loss requires utilization tracking
		utilization, err = s.repo.GetUtilizationByTreatyID(ctx, treaty.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get utilization for treaty %d: %w", treaty.ID, err)
		}
		result, err = reinsurance.CalculateNonProportionalCession(treaty, originalAmount, utilization)
	default:
		return nil, fmt.Errorf("unsupported treaty type: %s", treaty.TreatyType)
	}

	if err != nil {
		return nil, fmt.Errorf("cession calculation failed: %w", err)
	}

	// 2. Create Cession record
	cession := &models.Cession{
		TreatyID:       treaty.ID,
		ExternalRefID:  externalRefID,
		CessionType:    treaty.TreatyType,
		OriginalAmount: originalAmount,
		CededAmount:    result.CededAmount,
		RetainedAmount: result.RetainedAmount,
		CededPercentage: result.CededPercentage,
		CessionDate:    time.Now(),
	}

	// 3. Save Cession record
	if err := s.repo.CreateCession(ctx, cession); err != nil {
		return nil, fmt.Errorf("failed to save cession record: %w", err)
	}

	// 4. Update Utilization for non-proportional treaties (if applicable)
	if treaty.TreatyType == models.TreatyTypeStopLoss && result.CededAmount > 0 {
		// Only update utilization if a cession occurred
		utilization.CurrentLosses += result.RetainedAmount // The retained amount is added to the aggregate
		if err := s.repo.UpdateUtilization(ctx, utilization); err != nil {
			s.log.WithError(err).Error("Failed to update utilization after Stop Loss cession")
			// Log the error but don't fail the whole operation, as the cession record is saved
		}
	}

	s.log.WithFields(logrus.Fields{
		"treaty_id": treaty.ID,
		"ref_id":    externalRefID,
		"ceded":     result.CededAmount,
		"retained":  result.RetainedAmount,
	}).Info("Cession calculated and recorded successfully")

	return cession, nil
}

// GetUtilizationByTreatyID retrieves the utilization for a specific treaty
func (s *TreatyService) GetUtilizationByTreatyID(ctx context.Context, treatyID uint) (*models.Utilization, error) {
	return s.repo.GetUtilizationByTreatyID(ctx, treatyID)
}
