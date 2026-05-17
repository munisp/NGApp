package service

import (
	"ab-testing-framework/internal/models"
	"context"
	"crypto/md5"
	"encoding/binary"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ExperimentService struct {
	db *gorm.DB
}

func NewExperimentService(db *gorm.DB) *ExperimentService {
	return &ExperimentService{db: db}
}

func (s *ExperimentService) CreateExperiment(ctx context.Context, exp *models.Experiment) error {
	exp.ID = uuid.New()
	exp.Status = models.ExperimentStatusDraft
	return s.db.WithContext(ctx).Create(exp).Error
}

func (s *ExperimentService) GetExperiment(ctx context.Context, expID uuid.UUID) (*models.Experiment, error) {
	var exp models.Experiment
	err := s.db.WithContext(ctx).First(&exp, "id = ?", expID).Error
	return &exp, err
}

func (s *ExperimentService) GetExperiments(ctx context.Context, status string) ([]models.Experiment, error) {
	var experiments []models.Experiment
	query := s.db.WithContext(ctx)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&experiments).Error
	return experiments, err
}

func (s *ExperimentService) StartExperiment(ctx context.Context, expID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.Experiment{}).Where("id = ?", expID).Updates(map[string]interface{}{
		"status":     models.ExperimentStatusRunning,
		"start_date": now,
	}).Error
}

func (s *ExperimentService) StopExperiment(ctx context.Context, expID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.Experiment{}).Where("id = ?", expID).Updates(map[string]interface{}{
		"status":   models.ExperimentStatusCompleted,
		"end_date": now,
	}).Error
}

func (s *ExperimentService) CreateVariant(ctx context.Context, variant *models.Variant) error {
	variant.ID = uuid.New()
	return s.db.WithContext(ctx).Create(variant).Error
}

func (s *ExperimentService) GetVariants(ctx context.Context, expID uuid.UUID) ([]models.Variant, error) {
	var variants []models.Variant
	err := s.db.WithContext(ctx).Where("experiment_id = ?", expID).Find(&variants).Error
	return variants, err
}

func (s *ExperimentService) AssignUser(ctx context.Context, expID, userID uuid.UUID) (*models.ExperimentAssignment, error) {
	var existing models.ExperimentAssignment
	if err := s.db.WithContext(ctx).Where("experiment_id = ? AND user_id = ?", expID, userID).First(&existing).Error; err == nil {
		return &existing, nil
	}

	var variants []models.Variant
	s.db.WithContext(ctx).Where("experiment_id = ? AND is_active = ?", expID, true).Find(&variants)

	if len(variants) == 0 {
		return nil, nil
	}

	hash := md5.Sum([]byte(userID.String() + expID.String()))
	hashValue := binary.BigEndian.Uint64(hash[:8])
	bucket := float64(hashValue%10000) / 100

	var cumulativeWeight float64
	var selectedVariant *models.Variant
	for i := range variants {
		cumulativeWeight += variants[i].TrafficWeight
		if bucket < cumulativeWeight {
			selectedVariant = &variants[i]
			break
		}
	}

	if selectedVariant == nil {
		selectedVariant = &variants[0]
	}

	assignment := &models.ExperimentAssignment{
		ID:           uuid.New(),
		ExperimentID: expID,
		VariantID:    selectedVariant.ID,
		UserID:       userID,
	}

	if err := s.db.WithContext(ctx).Create(assignment).Error; err != nil {
		return nil, err
	}
	return assignment, nil
}

func (s *ExperimentService) TrackEvent(ctx context.Context, event *models.ExperimentEvent) error {
	event.ID = uuid.New()
	return s.db.WithContext(ctx).Create(event).Error
}

func (s *ExperimentService) GetResults(ctx context.Context, expID uuid.UUID) ([]models.ExperimentResult, error) {
	var results []models.ExperimentResult
	err := s.db.WithContext(ctx).Where("experiment_id = ?", expID).Find(&results).Error
	return results, err
}

func (s *ExperimentService) CalculateResults(ctx context.Context, expID uuid.UUID) error {
	var variants []models.Variant
	s.db.WithContext(ctx).Where("experiment_id = ?", expID).Find(&variants)

	for _, variant := range variants {
		var sampleSize int64
		var totalValue float64
		var conversionCount int64

		s.db.Model(&models.ExperimentAssignment{}).Where("experiment_id = ? AND variant_id = ?", expID, variant.ID).Count(&sampleSize)
		s.db.Model(&models.ExperimentEvent{}).Where("experiment_id = ? AND variant_id = ? AND event_type = ?", expID, variant.ID, "CONVERSION").Count(&conversionCount)
		s.db.Model(&models.ExperimentEvent{}).Where("experiment_id = ? AND variant_id = ?", expID, variant.ID).Select("COALESCE(SUM(event_value), 0)").Scan(&totalValue)

		conversionRate := float64(0)
		if sampleSize > 0 {
			conversionRate = float64(conversionCount) / float64(sampleSize)
		}

		result := &models.ExperimentResult{
			ID:             uuid.New(),
			ExperimentID:   expID,
			VariantID:      variant.ID,
			SampleSize:     int(sampleSize),
			ConversionRate: conversionRate,
			MeanValue:      totalValue / float64(sampleSize),
		}

		s.db.WithContext(ctx).Create(result)
	}
	return nil
}

func (s *ExperimentService) GetExperimentStats(ctx context.Context) (map[string]interface{}, error) {
	var total, running, completed int64
	s.db.Model(&models.Experiment{}).Count(&total)
	s.db.Model(&models.Experiment{}).Where("status = ?", models.ExperimentStatusRunning).Count(&running)
	s.db.Model(&models.Experiment{}).Where("status = ?", models.ExperimentStatusCompleted).Count(&completed)

	return map[string]interface{}{
		"total_experiments":     total,
		"running_experiments":   running,
		"completed_experiments": completed,
	}, nil
}
