package service

import (
	"context"
	"encoding/json"
	"fmt"
	"policy-renewal-automation/internal/middleware"
	"policy-renewal-automation/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedRenewalService struct {
	db         *gorm.DB
	middleware *middleware.MiddlewareClients
}

func NewEnhancedRenewalService(db *gorm.DB, mw *middleware.MiddlewareClients) *EnhancedRenewalService {
	return &EnhancedRenewalService{db: db, middleware: mw}
}

func (s *EnhancedRenewalService) GetUpcomingRenewals(ctx context.Context, days int) ([]models.PolicyRenewal, error) {
	var renewals []models.PolicyRenewal
	endDate := time.Now().AddDate(0, 0, days)
	err := s.db.WithContext(ctx).
		Where("expiry_date <= ? AND status NOT IN ?", endDate, []string{"RENEWED", "LAPSED", "CANCELLED"}).
		Order("expiry_date ASC").
		Find(&renewals).Error
	return renewals, err
}

func (s *EnhancedRenewalService) ProcessRenewal(ctx context.Context, policyID uuid.UUID) (*models.RenewalResult, error) {
	var renewal models.PolicyRenewal
	if err := s.db.WithContext(ctx).First(&renewal, "policy_id = ?", policyID).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Temporal != nil {
		runID, err := s.middleware.Temporal.StartRenewalWorkflow(ctx, policyID, map[string]interface{}{
			"policy_id":    policyID,
			"auto_renew":   renewal.AutoRenew,
			"expiry_date":  renewal.ExpiryDate,
		})
		if err != nil {
			return nil, err
		}

		if s.middleware.Kafka != nil {
			event := &middleware.RenewalEvent{
				ID:          uuid.New(),
				EventType:   "RENEWAL_WORKFLOW_STARTED",
				PolicyID:    policyID,
				CustomerID:  renewal.CustomerID,
				RenewalDate: renewal.ExpiryDate,
				Status:      "PROCESSING",
				Timestamp:   time.Now(),
			}
			go s.middleware.Kafka.PublishRenewalEvent(context.Background(), event)
		}

		return &models.RenewalResult{
			PolicyID:   policyID,
			WorkflowID: runID,
			Status:     "PROCESSING",
			StartedAt:  time.Now(),
		}, nil
	}

	if renewal.AutoRenew {
		return s.autoRenew(ctx, &renewal)
	}
	return s.sendRenewalNotification(ctx, &renewal)
}

func (s *EnhancedRenewalService) autoRenew(ctx context.Context, renewal *models.PolicyRenewal) (*models.RenewalResult, error) {
	renewal.Status = "RENEWED"
	renewal.RenewedAt = time.Now()
	newExpiry := renewal.ExpiryDate.AddDate(1, 0, 0)
	renewal.ExpiryDate = newExpiry

	if err := s.db.WithContext(ctx).Save(renewal).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.RenewalEvent{
			ID:          uuid.New(),
			EventType:   "POLICY_AUTO_RENEWED",
			PolicyID:    renewal.PolicyID,
			CustomerID:  renewal.CustomerID,
			RenewalDate: newExpiry,
			Status:      "RENEWED",
			Timestamp:   time.Now(),
		}
		go s.middleware.Kafka.PublishRenewalEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		data, _ := json.Marshal(renewal)
		go s.middleware.Redis.CacheRenewal(context.Background(), renewal.PolicyID, data, 24*time.Hour)
	}

	return &models.RenewalResult{
		PolicyID:    renewal.PolicyID,
		Status:      "RENEWED",
		NewExpiry:   newExpiry,
		CompletedAt: time.Now(),
	}, nil
}

func (s *EnhancedRenewalService) sendRenewalNotification(ctx context.Context, renewal *models.PolicyRenewal) (*models.RenewalResult, error) {
	renewal.Status = "REMINDER_SENT"
	renewal.LastReminderAt = time.Now()

	if err := s.db.WithContext(ctx).Save(renewal).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Dapr != nil {
		go s.middleware.Dapr.SendEmail(context.Background(), renewal.CustomerEmail, "Policy Renewal Reminder", fmt.Sprintf("Your policy %s is due for renewal on %s", renewal.PolicyNumber, renewal.ExpiryDate.Format("2006-01-02")))
		go s.middleware.Dapr.SendSMS(context.Background(), renewal.CustomerPhone, fmt.Sprintf("Your policy %s expires on %s. Renew now!", renewal.PolicyNumber, renewal.ExpiryDate.Format("2006-01-02")))
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.RenewalEvent{
			ID:          uuid.New(),
			EventType:   "RENEWAL_REMINDER_SENT",
			PolicyID:    renewal.PolicyID,
			CustomerID:  renewal.CustomerID,
			RenewalDate: renewal.ExpiryDate,
			Status:      "REMINDER_SENT",
			Timestamp:   time.Now(),
		}
		go s.middleware.Kafka.PublishRenewalEvent(context.Background(), event)
	}

	return &models.RenewalResult{
		PolicyID:    renewal.PolicyID,
		Status:      "REMINDER_SENT",
		CompletedAt: time.Now(),
	}, nil
}

func (s *EnhancedRenewalService) ProcessBatchRenewals(ctx context.Context, policyIDs []uuid.UUID) (*models.BatchRenewalResult, error) {
	if s.middleware != nil && s.middleware.Temporal != nil {
		batchID := uuid.New()
		runID, err := s.middleware.Temporal.StartBatchRenewalWorkflow(ctx, batchID, policyIDs)
		if err != nil {
			return nil, err
		}

		return &models.BatchRenewalResult{
			BatchID:    batchID,
			WorkflowID: runID,
			TotalCount: len(policyIDs),
			Status:     "PROCESSING",
			StartedAt:  time.Now(),
		}, nil
	}

	result := &models.BatchRenewalResult{
		BatchID:    uuid.New(),
		TotalCount: len(policyIDs),
		StartedAt:  time.Now(),
	}

	for _, policyID := range policyIDs {
		renewalResult, err := s.ProcessRenewal(ctx, policyID)
		if err != nil {
			result.FailedCount++
			continue
		}
		if renewalResult.Status == "RENEWED" {
			result.RenewedCount++
		} else {
			result.PendingCount++
		}
	}

	result.Status = "COMPLETED"
	result.CompletedAt = time.Now()
	return result, nil
}

func (s *EnhancedRenewalService) StartGracePeriod(ctx context.Context, policyID uuid.UUID, graceDays int) error {
	var renewal models.PolicyRenewal
	if err := s.db.WithContext(ctx).First(&renewal, "policy_id = ?", policyID).Error; err != nil {
		return err
	}

	renewal.Status = "GRACE_PERIOD"
	renewal.GraceEndDate = time.Now().AddDate(0, 0, graceDays)

	if err := s.db.WithContext(ctx).Save(&renewal).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Temporal != nil {
		s.middleware.Temporal.StartGracePeriodWorkflow(ctx, policyID, graceDays)
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.RenewalEvent{
			ID:          uuid.New(),
			EventType:   "GRACE_PERIOD_STARTED",
			PolicyID:    policyID,
			CustomerID:  renewal.CustomerID,
			RenewalDate: renewal.GraceEndDate,
			Status:      "GRACE_PERIOD",
			Timestamp:   time.Now(),
			Metadata: map[string]interface{}{
				"grace_days":    graceDays,
				"grace_end":     renewal.GraceEndDate,
			},
		}
		go s.middleware.Kafka.PublishRenewalEvent(context.Background(), event)
	}

	return nil
}

func (s *EnhancedRenewalService) MarkAsLapsed(ctx context.Context, policyID uuid.UUID) error {
	result := s.db.WithContext(ctx).Model(&models.PolicyRenewal{}).
		Where("policy_id = ?", policyID).
		Update("status", "LAPSED")

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.RenewalEvent{
			ID:        uuid.New(),
			EventType: "POLICY_LAPSED",
			PolicyID:  policyID,
			Status:    "LAPSED",
			Timestamp: time.Now(),
		}
		go s.middleware.Kafka.PublishRenewalEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedRenewalService) GetRenewalStats(ctx context.Context) (map[string]interface{}, error) {
	var upcomingCount, renewedCount, lapsedCount, gracePeriodCount int64

	s.db.Model(&models.PolicyRenewal{}).Where("status = ?", "PENDING").Count(&upcomingCount)
	s.db.Model(&models.PolicyRenewal{}).Where("status = ?", "RENEWED").Count(&renewedCount)
	s.db.Model(&models.PolicyRenewal{}).Where("status = ?", "LAPSED").Count(&lapsedCount)
	s.db.Model(&models.PolicyRenewal{}).Where("status = ?", "GRACE_PERIOD").Count(&gracePeriodCount)

	var autoRenewCount int64
	s.db.Model(&models.PolicyRenewal{}).Where("auto_renew = ?", true).Count(&autoRenewCount)

	return map[string]interface{}{
		"upcoming_renewals":   upcomingCount,
		"renewed_policies":    renewedCount,
		"lapsed_policies":     lapsedCount,
		"grace_period":        gracePeriodCount,
		"auto_renew_enabled":  autoRenewCount,
		"renewal_rate":        float64(renewedCount) / float64(renewedCount+lapsedCount) * 100,
	}, nil
}

func (s *EnhancedRenewalService) GetMiddlewareStatus(ctx context.Context) *middleware.MiddlewareStatus {
	if s.middleware == nil {
		return nil
	}
	return s.middleware.GetStatus(ctx)
}
