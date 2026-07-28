package repository

import (
	"context"
	"performance-monitoring-dashboard/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PerfMonRepository struct{ db *gorm.DB }

func NewPerfMonRepository(db *gorm.DB) *PerfMonRepository { return &PerfMonRepository{db: db} }

func (r *PerfMonRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&models.ServiceHealth{}, &models.PerformanceMetric{}, &models.AlertConfig{}, &models.PerformanceAlert{}, &models.SLAConfig{}, &models.SLAReport{})
}

func (r *PerfMonRepository) UpsertServiceHealth(ctx context.Context, sh *models.ServiceHealth) error {
	var existing models.ServiceHealth
	if err := r.db.WithContext(ctx).First(&existing, "service_name = ?", sh.ServiceName).Error; err != nil {
		sh.ID = uuid.New(); sh.CreatedAt = time.Now()
		return r.db.WithContext(ctx).Create(sh).Error
	}
	sh.ID = existing.ID; sh.CreatedAt = existing.CreatedAt
	return r.db.WithContext(ctx).Save(sh).Error
}

func (r *PerfMonRepository) GetServiceHealth(ctx context.Context, serviceName string) (*models.ServiceHealth, error) {
	var sh models.ServiceHealth
	return &sh, r.db.WithContext(ctx).First(&sh, "service_name = ?", serviceName).Error
}

func (r *PerfMonRepository) ListServiceHealth(ctx context.Context) ([]models.ServiceHealth, error) {
	var services []models.ServiceHealth
	return services, r.db.WithContext(ctx).Order("service_name").Find(&services).Error
}

func (r *PerfMonRepository) RecordMetric(ctx context.Context, m *models.PerformanceMetric) error {
	m.ID = uuid.New(); m.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *PerfMonRepository) GetMetrics(ctx context.Context, serviceName, metricName string, from, to time.Time) ([]models.PerformanceMetric, error) {
	var metrics []models.PerformanceMetric; q := r.db.WithContext(ctx)
	if serviceName != "" { q = q.Where("service_name = ?", serviceName) }
	if metricName != "" { q = q.Where("metric_name = ?", metricName) }
	if !from.IsZero() { q = q.Where("recorded_at >= ?", from) }
	if !to.IsZero() { q = q.Where("recorded_at <= ?", to) }
	return metrics, q.Order("recorded_at DESC").Limit(500).Find(&metrics).Error
}

func (r *PerfMonRepository) GetAvgMetric(ctx context.Context, serviceName, metricName string, from, to time.Time) (float64, error) {
	var avg float64
	return avg, r.db.WithContext(ctx).Model(&models.PerformanceMetric{}).Where("service_name = ? AND metric_name = ? AND recorded_at BETWEEN ? AND ?", serviceName, metricName, from, to).Select("COALESCE(AVG(metric_value), 0)").Scan(&avg).Error
}

func (r *PerfMonRepository) CreateAlertConfig(ctx context.Context, ac *models.AlertConfig) error {
	ac.ID = uuid.New(); ac.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(ac).Error
}

func (r *PerfMonRepository) ListAlertConfigs(ctx context.Context) ([]models.AlertConfig, error) {
	var configs []models.AlertConfig
	return configs, r.db.WithContext(ctx).Where("is_active = ?", true).Find(&configs).Error
}

func (r *PerfMonRepository) CreateAlert(ctx context.Context, a *models.PerformanceAlert) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *PerfMonRepository) ListAlerts(ctx context.Context, status string) ([]models.PerformanceAlert, error) {
	var alerts []models.PerformanceAlert; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("status = ?", status) }
	return alerts, q.Order("created_at DESC").Limit(100).Find(&alerts).Error
}

func (r *PerfMonRepository) CreateSLAConfig(ctx context.Context, sc *models.SLAConfig) error {
	sc.ID = uuid.New(); sc.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(sc).Error
}

func (r *PerfMonRepository) GetSLAConfig(ctx context.Context, serviceName string) (*models.SLAConfig, error) {
	var sc models.SLAConfig
	return &sc, r.db.WithContext(ctx).First(&sc, "service_name = ?", serviceName).Error
}

func (r *PerfMonRepository) CreateSLAReport(ctx context.Context, sr *models.SLAReport) error {
	sr.ID = uuid.New(); sr.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(sr).Error
}

func (r *PerfMonRepository) GetSLAReports(ctx context.Context, serviceName string) ([]models.SLAReport, error) {
	var reports []models.SLAReport; q := r.db.WithContext(ctx)
	if serviceName != "" { q = q.Where("service_name = ?", serviceName) }
	return reports, q.Order("created_at DESC").Limit(12).Find(&reports).Error
}
