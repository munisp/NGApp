package repository

import (
	"context"
	"fmt"
	"native-mobile-ios/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errNoDB = fmt.Errorf("database not available")

type MobileRepository struct{ db *gorm.DB }
func NewMobileRepository(db *gorm.DB) *MobileRepository { return &MobileRepository{db: db} }

func (r *MobileRepository) AutoMigrate() error {
	if r.db == nil { return nil }
	return r.db.AutoMigrate(&models.MobileUser{}, &models.MobilePolicy{}, &models.MobileClaim{}, &models.MobilePayment{}, &models.PushNotification{})
}

func (r *MobileRepository) CreateUser(ctx context.Context, u *models.MobileUser) error {
	if r.db == nil { return errNoDB }
	u.ID = uuid.New(); u.CreatedAt = time.Now(); u.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(u).Error
}
func (r *MobileRepository) GetUser(ctx context.Context, ref string) (*models.MobileUser, error) {
	if r.db == nil { return nil, errNoDB }
	var u models.MobileUser; return &u, r.db.WithContext(ctx).First(&u, "user_ref = ?", ref).Error
}
func (r *MobileRepository) UpdateUser(ctx context.Context, u *models.MobileUser) error {
	if r.db == nil { return errNoDB }
	u.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(u).Error
}
func (r *MobileRepository) GetPolicies(ctx context.Context, userRef string) ([]models.MobilePolicy, error) {
	if r.db == nil { return nil, errNoDB }
	var ps []models.MobilePolicy
	return ps, r.db.WithContext(ctx).Where("user_ref = ?", userRef).Order("created_at DESC").Find(&ps).Error
}
func (r *MobileRepository) CreateClaim(ctx context.Context, c *models.MobileClaim) error {
	if r.db == nil { return errNoDB }
	c.ID = uuid.New(); c.CreatedAt = time.Now(); c.SubmittedAt = time.Now()
	return r.db.WithContext(ctx).Create(c).Error
}
func (r *MobileRepository) GetClaims(ctx context.Context, userRef string) ([]models.MobileClaim, error) {
	if r.db == nil { return nil, errNoDB }
	var cs []models.MobileClaim
	return cs, r.db.WithContext(ctx).Where("user_ref = ?", userRef).Order("created_at DESC").Find(&cs).Error
}
func (r *MobileRepository) GetClaim(ctx context.Context, ref string) (*models.MobileClaim, error) {
	if r.db == nil { return nil, errNoDB }
	var c models.MobileClaim; return &c, r.db.WithContext(ctx).First(&c, "claim_ref = ?", ref).Error
}
func (r *MobileRepository) CreatePayment(ctx context.Context, p *models.MobilePayment) error {
	if r.db == nil { return errNoDB }
	p.ID = uuid.New(); p.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(p).Error
}
func (r *MobileRepository) GetPayments(ctx context.Context, userRef string) ([]models.MobilePayment, error) {
	if r.db == nil { return nil, errNoDB }
	var ps []models.MobilePayment
	return ps, r.db.WithContext(ctx).Where("user_ref = ?", userRef).Order("created_at DESC").Limit(20).Find(&ps).Error
}
func (r *MobileRepository) CreateNotification(ctx context.Context, n *models.PushNotification) error {
	if r.db == nil { return errNoDB }
	n.ID = uuid.New(); n.CreatedAt = time.Now(); n.SentAt = time.Now()
	return r.db.WithContext(ctx).Create(n).Error
}
func (r *MobileRepository) GetNotifications(ctx context.Context, userRef string, unreadOnly bool) ([]models.PushNotification, error) {
	if r.db == nil { return nil, errNoDB }
	var ns []models.PushNotification; q := r.db.WithContext(ctx).Where("user_ref = ?", userRef)
	if unreadOnly { q = q.Where("is_read = ?", false) }
	return ns, q.Order("created_at DESC").Limit(50).Find(&ns).Error
}
func (r *MobileRepository) MarkNotificationRead(ctx context.Context, id uuid.UUID) error {
	if r.db == nil { return errNoDB }
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.PushNotification{}).Where("id = ?", id).Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}
