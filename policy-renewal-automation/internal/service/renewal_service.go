package service

import (
	"context"
	"fmt"
	"policy-renewal-automation/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RenewalService struct {
	db *gorm.DB
}

func NewRenewalService(db *gorm.DB) *RenewalService {
	return &RenewalService{db: db}
}

func (s *RenewalService) GetUpcomingRenewals(ctx context.Context, daysAhead int) ([]models.PolicyRenewal, error) {
	var renewals []models.PolicyRenewal
	cutoffDate := time.Now().AddDate(0, 0, daysAhead)
	err := s.db.WithContext(ctx).Where("current_expiry_date <= ? AND status = ?", cutoffDate, models.RenewalStatusPending).Find(&renewals).Error
	return renewals, err
}

func (s *RenewalService) ProcessRenewal(ctx context.Context, renewalID uuid.UUID) error {
	var renewal models.PolicyRenewal
	if err := s.db.WithContext(ctx).First(&renewal, "id = ?", renewalID).Error; err != nil {
		return err
	}

	if renewal.AutoRenewal {
		return s.autoRenew(ctx, &renewal)
	}
	return s.sendRenewalNotification(ctx, &renewal)
}

func (s *RenewalService) autoRenew(ctx context.Context, renewal *models.PolicyRenewal) error {
	now := time.Now()
	newExpiry := renewal.CurrentExpiryDate.AddDate(1, 0, 0)
	renewal.NewExpiryDate = &newExpiry
	renewal.Status = models.RenewalStatusRenewed
	renewal.RenewedAt = &now
	return s.db.WithContext(ctx).Save(renewal).Error
}

func (s *RenewalService) sendRenewalNotification(ctx context.Context, renewal *models.PolicyRenewal) error {
	notification := &models.RenewalNotification{
		ID:               uuid.New(),
		RenewalID:        renewal.ID,
		NotificationType: "RENEWAL_REMINDER",
		Channel:          "EMAIL",
		Subject:          fmt.Sprintf("Policy %s Renewal Reminder", renewal.PolicyNumber),
		Content:          fmt.Sprintf("Your policy expires on %s. Please renew to maintain coverage.", renewal.CurrentExpiryDate.Format("2006-01-02")),
		Status:           "PENDING",
	}

	if err := s.db.WithContext(ctx).Create(notification).Error; err != nil {
		return err
	}

	now := time.Now()
	renewal.LastNotifiedAt = &now
	renewal.Status = models.RenewalStatusNotified
	renewal.RenewalAttempts++
	return s.db.WithContext(ctx).Save(renewal).Error
}

func (s *RenewalService) StartGracePeriod(ctx context.Context, renewalID uuid.UUID) error {
	var renewal models.PolicyRenewal
	if err := s.db.WithContext(ctx).First(&renewal, "id = ?", renewalID).Error; err != nil {
		return err
	}

	gracePeriodEnd := renewal.CurrentExpiryDate.AddDate(0, 0, renewal.GracePeriodDays)
	renewal.GracePeriodEnd = &gracePeriodEnd
	renewal.Status = models.RenewalStatusGracePeriod
	return s.db.WithContext(ctx).Save(renewal).Error
}

func (s *RenewalService) MarkAsLapsed(ctx context.Context, renewalID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.PolicyRenewal{}).Where("id = ?", renewalID).Updates(map[string]interface{}{
		"status":    models.RenewalStatusLapsed,
		"lapsed_at": now,
	}).Error
}

func (s *RenewalService) GetRenewalStats(ctx context.Context) (map[string]interface{}, error) {
	var total, renewed, lapsed, pending int64
	s.db.Model(&models.PolicyRenewal{}).Count(&total)
	s.db.Model(&models.PolicyRenewal{}).Where("status = ?", models.RenewalStatusRenewed).Count(&renewed)
	s.db.Model(&models.PolicyRenewal{}).Where("status = ?", models.RenewalStatusLapsed).Count(&lapsed)
	s.db.Model(&models.PolicyRenewal{}).Where("status IN ?", []models.RenewalStatus{models.RenewalStatusPending, models.RenewalStatusNotified}).Count(&pending)

	renewalRate := float64(0)
	if total > 0 {
		renewalRate = float64(renewed) / float64(total) * 100
	}

	return map[string]interface{}{
		"total_renewals":   total,
		"renewed":          renewed,
		"lapsed":           lapsed,
		"pending":          pending,
		"renewal_rate":     renewalRate,
		"lapse_rate":       float64(lapsed) / float64(total) * 100,
	}, nil
}

func (s *RenewalService) CreateRenewalSchedule(ctx context.Context, schedule *models.RenewalSchedule) error {
	schedule.ID = uuid.New()
	return s.db.WithContext(ctx).Create(schedule).Error
}

func (s *RenewalService) GetRenewalSchedules(ctx context.Context) ([]models.RenewalSchedule, error) {
	var schedules []models.RenewalSchedule
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&schedules).Error
	return schedules, err
}
