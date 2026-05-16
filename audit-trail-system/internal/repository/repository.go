package repository

import (
	"audit-trail-system/internal/models"
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditRepository struct{ db *gorm.DB }

func NewAuditRepository(db *gorm.DB) *AuditRepository { return &AuditRepository{db: db} }

func (r *AuditRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&models.AuditEvent{}, &models.AuditPolicy{}, &models.ComplianceReport{}, &models.AlertRule{}, &models.Alert{})
}

func (r *AuditRepository) CreateEvent(ctx context.Context, e *models.AuditEvent) error {
	e.ID = uuid.New(); e.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(e).Error
}

func (r *AuditRepository) GetEvent(ctx context.Context, id uuid.UUID) (*models.AuditEvent, error) {
	var e models.AuditEvent; return &e, r.db.WithContext(ctx).First(&e, "id = ?", id).Error
}

func (r *AuditRepository) SearchEvents(ctx context.Context, entityType, entityID, actorID, eventType, module string, from, to time.Time, limit int) ([]models.AuditEvent, error) {
	var events []models.AuditEvent; q := r.db.WithContext(ctx)
	if entityType != "" { q = q.Where("entity_type = ?", entityType) }
	if entityID != "" { q = q.Where("entity_id = ?", entityID) }
	if actorID != "" { q = q.Where("actor_id = ?", actorID) }
	if eventType != "" { q = q.Where("event_type = ?", eventType) }
	if module != "" { q = q.Where("module = ?", module) }
	if !from.IsZero() { q = q.Where("created_at >= ?", from) }
	if !to.IsZero() { q = q.Where("created_at <= ?", to) }
	if limit <= 0 { limit = 100 }
	return events, q.Order("created_at DESC").Limit(limit).Find(&events).Error
}

func (r *AuditRepository) GetEventsByCorrelation(ctx context.Context, correlationID string) ([]models.AuditEvent, error) {
	var events []models.AuditEvent
	return events, r.db.WithContext(ctx).Where("correlation_id = ?", correlationID).Order("created_at").Find(&events).Error
}

func (r *AuditRepository) CountEvents(ctx context.Context, entityType, eventType string, from, to time.Time) (int64, error) {
	var count int64; q := r.db.WithContext(ctx).Model(&models.AuditEvent{})
	if entityType != "" { q = q.Where("entity_type = ?", entityType) }
	if eventType != "" { q = q.Where("event_type = ?", eventType) }
	if !from.IsZero() { q = q.Where("created_at >= ?", from) }
	if !to.IsZero() { q = q.Where("created_at <= ?", to) }
	return count, q.Count(&count).Error
}

func (r *AuditRepository) CountHighRiskEvents(ctx context.Context, from, to time.Time) (int64, error) {
	var count int64
	return count, r.db.WithContext(ctx).Model(&models.AuditEvent{}).Where("risk_level IN ? AND created_at BETWEEN ? AND ?", []string{"high", "critical"}, from, to).Count(&count).Error
}

func (r *AuditRepository) CreatePolicy(ctx context.Context, p *models.AuditPolicy) error {
	p.ID = uuid.New(); p.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *AuditRepository) ListPolicies(ctx context.Context) ([]models.AuditPolicy, error) {
	var policies []models.AuditPolicy
	return policies, r.db.WithContext(ctx).Where("is_active = ?", true).Find(&policies).Error
}

func (r *AuditRepository) CreateReport(ctx context.Context, rpt *models.ComplianceReport) error {
	rpt.ID = uuid.New(); rpt.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(rpt).Error
}

func (r *AuditRepository) ListReports(ctx context.Context, reportType string) ([]models.ComplianceReport, error) {
	var reports []models.ComplianceReport; q := r.db.WithContext(ctx)
	if reportType != "" { q = q.Where("report_type = ?", reportType) }
	return reports, q.Order("created_at DESC").Find(&reports).Error
}

func (r *AuditRepository) CreateAlertRule(ctx context.Context, ar *models.AlertRule) error {
	ar.ID = uuid.New(); ar.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(ar).Error
}

func (r *AuditRepository) ListAlertRules(ctx context.Context) ([]models.AlertRule, error) {
	var rules []models.AlertRule
	return rules, r.db.WithContext(ctx).Where("is_active = ?", true).Find(&rules).Error
}

func (r *AuditRepository) CreateAlert(ctx context.Context, a *models.Alert) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *AuditRepository) ListAlerts(ctx context.Context, status string) ([]models.Alert, error) {
	var alerts []models.Alert; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("status = ?", status) }
	return alerts, q.Order("created_at DESC").Limit(100).Find(&alerts).Error
}

func (r *AuditRepository) UpdateAlert(ctx context.Context, a *models.Alert) error {
	return r.db.WithContext(ctx).Save(a).Error
}

func (r *AuditRepository) GetRecentEventCount(ctx context.Context, eventType, entityType string, windowMinutes int) (int64, error) {
	var count int64
	since := time.Now().Add(-time.Duration(windowMinutes) * time.Minute)
	q := r.db.WithContext(ctx).Model(&models.AuditEvent{}).Where("created_at >= ?", since)
	if eventType != "" { q = q.Where("event_type = ?", eventType) }
	if entityType != "" { q = q.Where("entity_type = ?", entityType) }
	return count, q.Count(&count).Error
}
