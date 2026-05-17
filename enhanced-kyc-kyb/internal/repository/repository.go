package repository

import (
	"context"
	"fmt"
	"enhanced-kyc-kyb/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errNoDB = fmt.Errorf("database not available")

type KYCRepository struct{ db *gorm.DB }
func NewKYCRepository(db *gorm.DB) *KYCRepository { return &KYCRepository{db: db} }

func (r *KYCRepository) AutoMigrate() error {
	if r.db == nil { return nil }
	return r.db.AutoMigrate(&models.KYCApplication{}, &models.KYBApplication{}, &models.VerificationCheck{}, &models.WatchlistEntry{}, &models.DocumentVerification{})
}

func (r *KYCRepository) CreateKYC(ctx context.Context, a *models.KYCApplication) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now(); a.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(a).Error
}
func (r *KYCRepository) GetKYC(ctx context.Context, ref string) (*models.KYCApplication, error) {
	var a models.KYCApplication; return &a, r.db.WithContext(ctx).First(&a, "application_ref = ?", ref).Error
}
func (r *KYCRepository) UpdateKYC(ctx context.Context, a *models.KYCApplication) error {
	a.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(a).Error
}
func (r *KYCRepository) ListKYC(ctx context.Context, status string) ([]models.KYCApplication, error) {
	var apps []models.KYCApplication; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("status = ?", status) }
	return apps, q.Order("created_at DESC").Limit(50).Find(&apps).Error
}
func (r *KYCRepository) CreateKYB(ctx context.Context, a *models.KYBApplication) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now(); a.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(a).Error
}
func (r *KYCRepository) GetKYB(ctx context.Context, ref string) (*models.KYBApplication, error) {
	var a models.KYBApplication; return &a, r.db.WithContext(ctx).First(&a, "application_ref = ?", ref).Error
}
func (r *KYCRepository) UpdateKYB(ctx context.Context, a *models.KYBApplication) error {
	a.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(a).Error
}
func (r *KYCRepository) ListKYB(ctx context.Context, status string) ([]models.KYBApplication, error) {
	var apps []models.KYBApplication; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("status = ?", status) }
	return apps, q.Order("created_at DESC").Limit(50).Find(&apps).Error
}
func (r *KYCRepository) CreateVerification(ctx context.Context, v *models.VerificationCheck) error {
	v.ID = uuid.New(); v.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(v).Error
}
func (r *KYCRepository) GetVerifications(ctx context.Context, ref string) ([]models.VerificationCheck, error) {
	var checks []models.VerificationCheck
	return checks, r.db.WithContext(ctx).Where("application_ref = ?", ref).Find(&checks).Error
}
func (r *KYCRepository) SearchWatchlist(ctx context.Context, name string) ([]models.WatchlistEntry, error) {
	var entries []models.WatchlistEntry
	return entries, r.db.WithContext(ctx).Where("entity_name LIKE ? AND is_active = ?", "%"+name+"%", true).Find(&entries).Error
}
func (r *KYCRepository) CreateDocument(ctx context.Context, d *models.DocumentVerification) error {
	d.ID = uuid.New(); d.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(d).Error
}
func (r *KYCRepository) GetDocuments(ctx context.Context, ref string) ([]models.DocumentVerification, error) {
	var docs []models.DocumentVerification
	return docs, r.db.WithContext(ctx).Where("application_ref = ?", ref).Find(&docs).Error
}
