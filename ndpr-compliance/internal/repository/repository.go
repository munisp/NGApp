package repository

import (
	"context"
	"fmt"
	"ndpr-compliance/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errNoDB = fmt.Errorf("database not available")

type NDPRRepository struct{ db *gorm.DB }
func NewNDPRRepository(db *gorm.DB) *NDPRRepository { return &NDPRRepository{db: db} }

func (r *NDPRRepository) AutoMigrate() error {
	if r.db == nil { return nil }
	return r.db.AutoMigrate(&models.NDPRDataController{}, &models.NDPRConsentRecord{}, &models.NDPRDataRequest{}, &models.NDPRAuditLog{}, &models.NDPRBreachNotification{}, &models.NDPRComplianceAssessment{})
}

func (r *NDPRRepository) CreateController(ctx context.Context, c *models.NDPRDataController) error {
	c.ID = uuid.New(); c.CreatedAt = time.Now(); return r.db.WithContext(ctx).Create(c).Error
}
func (r *NDPRRepository) GetController(ctx context.Context, ref string) (*models.NDPRDataController, error) {
	var c models.NDPRDataController; return &c, r.db.WithContext(ctx).First(&c, "controller_ref = ?", ref).Error
}
func (r *NDPRRepository) CreateConsent(ctx context.Context, cr *models.NDPRConsentRecord) error {
	cr.ID = uuid.New(); cr.CreatedAt = time.Now(); return r.db.WithContext(ctx).Create(cr).Error
}
func (r *NDPRRepository) GetConsents(ctx context.Context, subjectID string) ([]models.NDPRConsentRecord, error) {
	var cs []models.NDPRConsentRecord; return cs, r.db.WithContext(ctx).Where("subject_id = ?", subjectID).Order("created_at DESC").Find(&cs).Error
}
func (r *NDPRRepository) CreateRequest(ctx context.Context, dr *models.NDPRDataRequest) error {
	dr.ID = uuid.New(); dr.CreatedAt = time.Now(); dr.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Create(dr).Error
}
func (r *NDPRRepository) GetRequest(ctx context.Context, ref string) (*models.NDPRDataRequest, error) {
	var dr models.NDPRDataRequest; return &dr, r.db.WithContext(ctx).First(&dr, "request_ref = ?", ref).Error
}
func (r *NDPRRepository) ListRequests(ctx context.Context, status string) ([]models.NDPRDataRequest, error) {
	var rs []models.NDPRDataRequest; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("status = ?", status) }
	return rs, q.Order("created_at DESC").Limit(50).Find(&rs).Error
}
func (r *NDPRRepository) UpdateRequest(ctx context.Context, dr *models.NDPRDataRequest) error {
	dr.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(dr).Error
}
func (r *NDPRRepository) CreateAuditLog(ctx context.Context, al *models.NDPRAuditLog) error {
	al.ID = uuid.New(); al.CreatedAt = time.Now(); return r.db.WithContext(ctx).Create(al).Error
}
func (r *NDPRRepository) GetAuditLogs(ctx context.Context, subjectID string, limit int) ([]models.NDPRAuditLog, error) {
	var ls []models.NDPRAuditLog; q := r.db.WithContext(ctx)
	if subjectID != "" { q = q.Where("subject_id = ?", subjectID) }
	if limit <= 0 { limit = 100 }
	return ls, q.Order("created_at DESC").Limit(limit).Find(&ls).Error
}
func (r *NDPRRepository) CreateBreach(ctx context.Context, b *models.NDPRBreachNotification) error {
	b.ID = uuid.New(); b.CreatedAt = time.Now(); return r.db.WithContext(ctx).Create(b).Error
}
func (r *NDPRRepository) ListBreaches(ctx context.Context) ([]models.NDPRBreachNotification, error) {
	var bs []models.NDPRBreachNotification; return bs, r.db.WithContext(ctx).Order("created_at DESC").Find(&bs).Error
}
func (r *NDPRRepository) UpdateBreach(ctx context.Context, b *models.NDPRBreachNotification) error {
	return r.db.WithContext(ctx).Save(b).Error
}
func (r *NDPRRepository) CreateAssessment(ctx context.Context, a *models.NDPRComplianceAssessment) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now(); return r.db.WithContext(ctx).Create(a).Error
}
func (r *NDPRRepository) ListAssessments(ctx context.Context) ([]models.NDPRComplianceAssessment, error) {
	var as []models.NDPRComplianceAssessment; return as, r.db.WithContext(ctx).Order("created_at DESC").Find(&as).Error
}
