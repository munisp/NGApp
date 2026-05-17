package service

import (
	"ab-testing-framework/internal/middleware"
	"ab-testing-framework/internal/models"
	"context"
	"encoding/json"
	"math"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedExperimentService struct {
	db         *gorm.DB
	middleware *middleware.MiddlewareClients
}

func NewEnhancedExperimentService(db *gorm.DB, mw *middleware.MiddlewareClients) *EnhancedExperimentService {
	return &EnhancedExperimentService{db: db, middleware: mw}
}

func (s *EnhancedExperimentService) CreateExperiment(ctx context.Context, experiment *models.Experiment) error {
	experiment.ID = uuid.New()
	experiment.Status = "DRAFT"
	experiment.CreatedAt = time.Now()

	if err := s.db.WithContext(ctx).Create(experiment).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.ExperimentEvent{
			ID:           uuid.New(),
			EventType:    "EXPERIMENT_CREATED",
			ExperimentID: experiment.ID,
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishExperimentEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		data, _ := json.Marshal(experiment)
		go s.middleware.Redis.CacheExperimentConfig(context.Background(), experiment.ID, data, 24*time.Hour)
	}

	return nil
}

func (s *EnhancedExperimentService) StartExperiment(ctx context.Context, experimentID uuid.UUID) error {
	now := time.Now()
	result := s.db.WithContext(ctx).Model(&models.Experiment{}).
		Where("id = ?", experimentID).
		Updates(map[string]interface{}{
			"status":     "RUNNING",
			"started_at": now,
		})

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.ExperimentEvent{
			ID:           uuid.New(),
			EventType:    "EXPERIMENT_STARTED",
			ExperimentID: experimentID,
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishExperimentEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.FeatureFlag != nil {
		var experiment models.Experiment
		s.db.First(&experiment, "id = ?", experimentID)
		go s.middleware.FeatureFlag.SetFeatureFlag(context.Background(), experiment.FeatureFlag, true, experiment.TrafficAllocation)
	}

	return result.Error
}

func (s *EnhancedExperimentService) StopExperiment(ctx context.Context, experimentID uuid.UUID) error {
	now := time.Now()
	result := s.db.WithContext(ctx).Model(&models.Experiment{}).
		Where("id = ?", experimentID).
		Updates(map[string]interface{}{
			"status":   "STOPPED",
			"ended_at": now,
		})

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.ExperimentEvent{
			ID:           uuid.New(),
			EventType:    "EXPERIMENT_STOPPED",
			ExperimentID: experimentID,
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishExperimentEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedExperimentService) AssignUserToVariant(ctx context.Context, experimentID, userID uuid.UUID) (*models.Variant, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if variantID, err := s.middleware.Redis.GetCachedUserAssignment(ctx, experimentID, userID); err == nil {
			var variant models.Variant
			s.db.First(&variant, "id = ?", variantID)
			return &variant, nil
		}
	}

	var assignment models.UserAssignment
	if err := s.db.WithContext(ctx).Where("experiment_id = ? AND user_id = ?", experimentID, userID).First(&assignment).Error; err == nil {
		var variant models.Variant
		s.db.First(&variant, "id = ?", assignment.VariantID)
		return &variant, nil
	}

	var variants []models.Variant
	s.db.Where("experiment_id = ?", experimentID).Find(&variants)

	if len(variants) == 0 {
		return nil, nil
	}

	totalWeight := 0.0
	for _, v := range variants {
		totalWeight += v.Weight
	}

	r := rand.Float64() * totalWeight
	cumulative := 0.0
	var selectedVariant *models.Variant

	for i := range variants {
		cumulative += variants[i].Weight
		if r <= cumulative {
			selectedVariant = &variants[i]
			break
		}
	}

	if selectedVariant == nil {
		selectedVariant = &variants[0]
	}

	assignment = models.UserAssignment{
		ID:           uuid.New(),
		ExperimentID: experimentID,
		UserID:       userID,
		VariantID:    selectedVariant.ID,
		AssignedAt:   time.Now(),
	}
	s.db.Create(&assignment)

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.CacheUserAssignment(context.Background(), experimentID, userID, selectedVariant.ID, 30*24*time.Hour)
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.ExperimentEvent{
			ID:           uuid.New(),
			EventType:    "USER_ASSIGNED",
			ExperimentID: experimentID,
			VariantID:    selectedVariant.ID,
			UserID:       userID,
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishExperimentEvent(context.Background(), event)
	}

	return selectedVariant, nil
}

func (s *EnhancedExperimentService) TrackEvent(ctx context.Context, experimentID, userID uuid.UUID, eventName string, eventValue float64) error {
	var assignment models.UserAssignment
	if err := s.db.WithContext(ctx).Where("experiment_id = ? AND user_id = ?", experimentID, userID).First(&assignment).Error; err != nil {
		return err
	}

	event := &models.ExperimentEvent{
		ID:           uuid.New(),
		ExperimentID: experimentID,
		VariantID:    assignment.VariantID,
		UserID:       userID,
		EventName:    eventName,
		EventValue:   eventValue,
		Timestamp:    time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(event).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.IncrementVariantCounter(context.Background(), experimentID, assignment.VariantID, eventName)
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		kafkaEvent := &middleware.ExperimentEvent{
			ID:           uuid.New(),
			EventType:    "EVENT_TRACKED",
			ExperimentID: experimentID,
			VariantID:    assignment.VariantID,
			UserID:       userID,
			EventName:    eventName,
			EventValue:   eventValue,
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishExperimentEvent(context.Background(), kafkaEvent)
	}

	if s.middleware != nil && s.middleware.Lakehouse != nil {
		go s.middleware.Lakehouse.StoreExperimentData(context.Background(), experimentID, map[string]interface{}{
			"variant_id":  assignment.VariantID,
			"user_id":     userID,
			"event_name":  eventName,
			"event_value": eventValue,
			"timestamp":   time.Now(),
		})
	}

	return nil
}

func (s *EnhancedExperimentService) CalculateResults(ctx context.Context, experimentID uuid.UUID) (*models.ExperimentResults, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedStatisticalResult(ctx, experimentID); err == nil {
			return &models.ExperimentResults{
				ExperimentID: experimentID,
				PValue:       cached.PValue,
				Significance: cached.Significance,
				Uplift:       cached.Uplift,
			}, nil
		}
	}

	var variants []models.Variant
	s.db.Where("experiment_id = ?", experimentID).Find(&variants)

	results := &models.ExperimentResults{
		ExperimentID:   experimentID,
		VariantResults: make([]models.VariantResult, 0),
	}

	var controlRate, treatmentRate float64
	var controlSample, treatmentSample int64

	for _, variant := range variants {
		var totalUsers, conversions int64
		s.db.Model(&models.UserAssignment{}).Where("variant_id = ?", variant.ID).Count(&totalUsers)
		s.db.Model(&models.ExperimentEvent{}).Where("variant_id = ? AND event_name = ?", variant.ID, "conversion").Count(&conversions)

		conversionRate := 0.0
		if totalUsers > 0 {
			conversionRate = float64(conversions) / float64(totalUsers) * 100
		}

		variantResult := models.VariantResult{
			VariantID:      variant.ID,
			VariantName:    variant.Name,
			TotalUsers:     int(totalUsers),
			Conversions:    int(conversions),
			ConversionRate: conversionRate,
		}
		results.VariantResults = append(results.VariantResults, variantResult)

		if variant.IsControl {
			controlRate = conversionRate
			controlSample = totalUsers
		} else {
			treatmentRate = conversionRate
			treatmentSample = totalUsers
		}
	}

	if controlRate > 0 {
		results.Uplift = (treatmentRate - controlRate) / controlRate * 100
	}

	results.PValue = s.calculatePValue(controlRate, treatmentRate, controlSample, treatmentSample)
	results.Significance = (1 - results.PValue) * 100
	results.CalculatedAt = time.Now()

	if s.middleware != nil && s.middleware.Redis != nil {
		statResult := &middleware.StatisticalResult{
			ExperimentID:  experimentID,
			ControlRate:   controlRate,
			TreatmentRate: treatmentRate,
			Uplift:        results.Uplift,
			PValue:        results.PValue,
			Significance:  results.Significance,
		}
		go s.middleware.Redis.CacheStatisticalResult(context.Background(), experimentID, statResult, 15*time.Minute)
	}

	return results, nil
}

func (s *EnhancedExperimentService) calculatePValue(controlRate, treatmentRate float64, controlN, treatmentN int64) float64 {
	if controlN == 0 || treatmentN == 0 {
		return 1.0
	}

	pooledRate := (controlRate*float64(controlN) + treatmentRate*float64(treatmentN)) / float64(controlN+treatmentN)
	se := math.Sqrt(pooledRate * (100 - pooledRate) * (1/float64(controlN) + 1/float64(treatmentN)))

	if se == 0 {
		return 1.0
	}

	z := math.Abs(treatmentRate-controlRate) / se
	pValue := 2 * (1 - normalCDF(z))

	return pValue
}

func normalCDF(x float64) float64 {
	return 0.5 * (1 + math.Erf(x/math.Sqrt(2)))
}

func (s *EnhancedExperimentService) GetExperiment(ctx context.Context, experimentID uuid.UUID) (*models.Experiment, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedExperimentConfig(ctx, experimentID); err == nil {
			var experiment models.Experiment
			if json.Unmarshal(cached, &experiment) == nil {
				return &experiment, nil
			}
		}
	}

	var experiment models.Experiment
	if err := s.db.WithContext(ctx).First(&experiment, "id = ?", experimentID).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		data, _ := json.Marshal(experiment)
		go s.middleware.Redis.CacheExperimentConfig(context.Background(), experimentID, data, 24*time.Hour)
	}

	return &experiment, nil
}

func (s *EnhancedExperimentService) GetExperiments(ctx context.Context, status string) ([]models.Experiment, error) {
	var experiments []models.Experiment
	query := s.db.WithContext(ctx)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&experiments).Error
	return experiments, err
}

func (s *EnhancedExperimentService) GetExperimentStats(ctx context.Context) (map[string]interface{}, error) {
	var totalExperiments, runningExperiments, completedExperiments int64
	var avgUplift float64

	s.db.Model(&models.Experiment{}).Count(&totalExperiments)
	s.db.Model(&models.Experiment{}).Where("status = ?", "RUNNING").Count(&runningExperiments)
	s.db.Model(&models.Experiment{}).Where("status = ?", "COMPLETED").Count(&completedExperiments)

	return map[string]interface{}{
		"total_experiments":     totalExperiments,
		"running_experiments":   runningExperiments,
		"completed_experiments": completedExperiments,
		"avg_uplift":            avgUplift,
	}, nil
}

func (s *EnhancedExperimentService) GetMiddlewareStatus(ctx context.Context) *middleware.MiddlewareStatus {
	if s.middleware == nil {
		return nil
	}
	return s.middleware.GetStatus(ctx)
}
