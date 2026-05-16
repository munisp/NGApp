package repository

import (
	"context"
	"policy-renewal-automation/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RenewalRepository struct{ db *gorm.DB }

func NewRenewalRepository(db *gorm.DB) *RenewalRepository { return &RenewalRepository{db: db} }

func (r *RenewalRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&models.RenewalPolicy{}, &models.RenewalQuote{}, &models.RenewalNotification{}, &models.RenewalCampaign{}, &models.RenewalMetrics{})
}

func (r *RenewalRepository) CreatePolicy(ctx context.Context, p *models.RenewalPolicy) error {
	p.ID = uuid.New(); p.CreatedAt = time.Now(); p.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *RenewalRepository) GetPolicy(ctx context.Context, id uuid.UUID) (*models.RenewalPolicy, error) {
	var p models.RenewalPolicy; return &p, r.db.WithContext(ctx).First(&p, "id = ?", id).Error
}

func (r *RenewalRepository) GetPoliciesDueForRenewal(ctx context.Context, daysAhead int) ([]models.RenewalPolicy, error) {
	var policies []models.RenewalPolicy
	deadline := time.Now().AddDate(0, 0, daysAhead)
	return policies, r.db.WithContext(ctx).Where("expiry_date <= ? AND renewal_status IN ?", deadline, []string{"pending", "notified"}).Order("expiry_date").Find(&policies).Error
}

func (r *RenewalRepository) ListPolicies(ctx context.Context, status, policyType string) ([]models.RenewalPolicy, error) {
	var policies []models.RenewalPolicy; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("renewal_status = ?", status) }
	if policyType != "" { q = q.Where("policy_type = ?", policyType) }
	return policies, q.Order("expiry_date").Limit(100).Find(&policies).Error
}

func (r *RenewalRepository) UpdatePolicy(ctx context.Context, p *models.RenewalPolicy) error {
	p.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(p).Error
}

func (r *RenewalRepository) CreateQuote(ctx context.Context, q *models.RenewalQuote) error {
	q.ID = uuid.New(); q.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(q).Error
}

func (r *RenewalRepository) GetQuotesByPolicy(ctx context.Context, policyID uuid.UUID) ([]models.RenewalQuote, error) {
	var quotes []models.RenewalQuote
	return quotes, r.db.WithContext(ctx).Where("policy_id = ?", policyID).Order("created_at DESC").Find(&quotes).Error
}

func (r *RenewalRepository) CreateNotification(ctx context.Context, n *models.RenewalNotification) error {
	n.ID = uuid.New(); n.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(n).Error
}

func (r *RenewalRepository) GetNotifications(ctx context.Context, policyID uuid.UUID) ([]models.RenewalNotification, error) {
	var notifs []models.RenewalNotification
	return notifs, r.db.WithContext(ctx).Where("policy_id = ?", policyID).Order("created_at DESC").Find(&notifs).Error
}

func (r *RenewalRepository) CreateCampaign(ctx context.Context, c *models.RenewalCampaign) error {
	c.ID = uuid.New(); c.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *RenewalRepository) ListActiveCampaigns(ctx context.Context) ([]models.RenewalCampaign, error) {
	var campaigns []models.RenewalCampaign
	return campaigns, r.db.WithContext(ctx).Where("is_active = ? AND end_date >= ?", true, time.Now()).Find(&campaigns).Error
}

func (r *RenewalRepository) UpdateCampaign(ctx context.Context, c *models.RenewalCampaign) error {
	return r.db.WithContext(ctx).Save(c).Error
}

func (r *RenewalRepository) CreateMetrics(ctx context.Context, m *models.RenewalMetrics) error {
	m.ID = uuid.New(); m.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *RenewalRepository) GetMetrics(ctx context.Context, policyType string) ([]models.RenewalMetrics, error) {
	var metrics []models.RenewalMetrics; q := r.db.WithContext(ctx)
	if policyType != "" { q = q.Where("policy_type = ?", policyType) }
	return metrics, q.Order("period DESC").Limit(12).Find(&metrics).Error
}

func (r *RenewalRepository) CountByStatus(ctx context.Context, status string) (int64, error) {
	var count int64
	return count, r.db.WithContext(ctx).Model(&models.RenewalPolicy{}).Where("renewal_status = ?", status).Count(&count).Error
}

func (r *RenewalRepository) GetTotalPremiumByStatus(ctx context.Context, status string) (float64, error) {
	var total float64
	return total, r.db.WithContext(ctx).Model(&models.RenewalPolicy{}).Where("renewal_status = ?", status).Select("COALESCE(SUM(current_premium), 0)").Scan(&total).Error
}
