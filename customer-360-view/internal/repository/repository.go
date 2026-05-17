package repository

import (
	"context"
	"customer-360-view/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Customer360Repository struct{ db *gorm.DB }

func NewCustomer360Repository(db *gorm.DB) *Customer360Repository { return &Customer360Repository{db: db} }

func (r *Customer360Repository) AutoMigrate() error {
	return r.db.AutoMigrate(&models.CustomerProfile{}, &models.PolicySummary{}, &models.ClaimSummary{}, &models.InteractionLog{}, &models.PaymentHistory{}, &models.CustomerRiskProfile{})
}

func (r *Customer360Repository) CreateProfile(ctx context.Context, p *models.CustomerProfile) error {
	p.ID = uuid.New(); p.CreatedAt = time.Now(); p.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *Customer360Repository) GetProfile(ctx context.Context, customerRef string) (*models.CustomerProfile, error) {
	var p models.CustomerProfile
	return &p, r.db.WithContext(ctx).First(&p, "customer_ref = ?", customerRef).Error
}

func (r *Customer360Repository) SearchProfiles(ctx context.Context, query, segment string) ([]models.CustomerProfile, error) {
	var profiles []models.CustomerProfile; q := r.db.WithContext(ctx)
	if query != "" { q = q.Where("first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?", "%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%") }
	if segment != "" { q = q.Where("segment_code = ?", segment) }
	return profiles, q.Limit(50).Find(&profiles).Error
}

func (r *Customer360Repository) UpdateProfile(ctx context.Context, p *models.CustomerProfile) error {
	p.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(p).Error
}

func (r *Customer360Repository) AddPolicy(ctx context.Context, ps *models.PolicySummary) error {
	ps.ID = uuid.New(); ps.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(ps).Error
}

func (r *Customer360Repository) GetPolicies(ctx context.Context, customerRef string) ([]models.PolicySummary, error) {
	var policies []models.PolicySummary
	return policies, r.db.WithContext(ctx).Where("customer_ref = ?", customerRef).Order("created_at DESC").Find(&policies).Error
}

func (r *Customer360Repository) AddClaim(ctx context.Context, cs *models.ClaimSummary) error {
	cs.ID = uuid.New(); cs.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(cs).Error
}

func (r *Customer360Repository) GetClaims(ctx context.Context, customerRef string) ([]models.ClaimSummary, error) {
	var claims []models.ClaimSummary
	return claims, r.db.WithContext(ctx).Where("customer_ref = ?", customerRef).Order("filed_date DESC").Find(&claims).Error
}

func (r *Customer360Repository) AddInteraction(ctx context.Context, il *models.InteractionLog) error {
	il.ID = uuid.New(); il.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(il).Error
}

func (r *Customer360Repository) GetInteractions(ctx context.Context, customerRef string) ([]models.InteractionLog, error) {
	var logs []models.InteractionLog
	return logs, r.db.WithContext(ctx).Where("customer_ref = ?", customerRef).Order("created_at DESC").Limit(50).Find(&logs).Error
}

func (r *Customer360Repository) AddPayment(ctx context.Context, ph *models.PaymentHistory) error {
	ph.ID = uuid.New(); ph.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(ph).Error
}

func (r *Customer360Repository) GetPayments(ctx context.Context, customerRef string) ([]models.PaymentHistory, error) {
	var payments []models.PaymentHistory
	return payments, r.db.WithContext(ctx).Where("customer_ref = ?", customerRef).Order("paid_at DESC").Limit(50).Find(&payments).Error
}

func (r *Customer360Repository) SaveRiskProfile(ctx context.Context, rp *models.CustomerRiskProfile) error {
	rp.ID = uuid.New(); rp.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Save(rp).Error
}

func (r *Customer360Repository) GetRiskProfile(ctx context.Context, customerRef string) (*models.CustomerRiskProfile, error) {
	var rp models.CustomerRiskProfile
	return &rp, r.db.WithContext(ctx).First(&rp, "customer_ref = ?", customerRef).Error
}

func (r *Customer360Repository) GetActivePolicyCount(ctx context.Context, customerRef string) (int64, error) {
	var count int64
	return count, r.db.WithContext(ctx).Model(&models.PolicySummary{}).Where("customer_ref = ? AND status = ?", customerRef, "active").Count(&count).Error
}

func (r *Customer360Repository) GetTotalPremium(ctx context.Context, customerRef string) (float64, error) {
	var total float64
	return total, r.db.WithContext(ctx).Model(&models.PolicySummary{}).Where("customer_ref = ? AND status = ?", customerRef, "active").Select("COALESCE(SUM(premium), 0)").Scan(&total).Error
}

func (r *Customer360Repository) GetTotalClaimsPaid(ctx context.Context, customerRef string) (float64, error) {
	var total float64
	return total, r.db.WithContext(ctx).Model(&models.ClaimSummary{}).Where("customer_ref = ?", customerRef).Select("COALESCE(SUM(amount_paid), 0)").Scan(&total).Error
}
