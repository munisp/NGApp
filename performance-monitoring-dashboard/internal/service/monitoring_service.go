package service

import (
	"context"
	"performance-monitoring-dashboard/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MonitoringService struct {
	db *gorm.DB
}

func NewMonitoringService(db *gorm.DB) *MonitoringService {
	return &MonitoringService{db: db}
}

func (s *MonitoringService) RecordServiceHealth(ctx context.Context, health *models.ServiceHealth) error {
	health.ID = uuid.New()
	health.LastCheckAt = time.Now()
	return s.db.WithContext(ctx).Create(health).Error
}

func (s *MonitoringService) GetServiceHealth(ctx context.Context, serviceName string) (*models.ServiceHealth, error) {
	var health models.ServiceHealth
	err := s.db.WithContext(ctx).Where("service_name = ?", serviceName).Order("last_check_at DESC").First(&health).Error
	return &health, err
}

func (s *MonitoringService) GetAllServicesHealth(ctx context.Context) ([]models.ServiceHealth, error) {
	var services []models.ServiceHealth
	err := s.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (service_name) * FROM service_healths 
		ORDER BY service_name, last_check_at DESC
	`).Scan(&services).Error
	return services, err
}

func (s *MonitoringService) RecordMetric(ctx context.Context, metric *models.PerformanceMetric) error {
	metric.ID = uuid.New()
	return s.db.WithContext(ctx).Create(metric).Error
}

func (s *MonitoringService) GetMetrics(ctx context.Context, serviceName, metricName string, from, to time.Time) ([]models.PerformanceMetric, error) {
	var metrics []models.PerformanceMetric
	query := s.db.WithContext(ctx).Where("recorded_at BETWEEN ? AND ?", from, to)
	if serviceName != "" {
		query = query.Where("service_name = ?", serviceName)
	}
	if metricName != "" {
		query = query.Where("metric_name = ?", metricName)
	}
	err := query.Order("recorded_at DESC").Find(&metrics).Error
	return metrics, err
}

func (s *MonitoringService) CreateSLA(ctx context.Context, sla *models.SLADefinition) error {
	sla.ID = uuid.New()
	return s.db.WithContext(ctx).Create(sla).Error
}

func (s *MonitoringService) GetSLAs(ctx context.Context) ([]models.SLADefinition, error) {
	var slas []models.SLADefinition
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&slas).Error
	return slas, err
}

func (s *MonitoringService) GenerateSLAReport(ctx context.Context, slaID uuid.UUID, periodStart, periodEnd time.Time) (*models.SLAReport, error) {
	var sla models.SLADefinition
	if err := s.db.WithContext(ctx).First(&sla, "id = ?", slaID).Error; err != nil {
		return nil, err
	}

	var avgValue float64
	s.db.Model(&models.PerformanceMetric{}).
		Where("service_name = ? AND metric_name = ? AND recorded_at BETWEEN ? AND ?", sla.ServiceName, sla.MetricName, periodStart, periodEnd).
		Select("COALESCE(AVG(metric_value), 0)").Scan(&avgValue)

	isMet := false
	if sla.ComparisonType == "LTE" {
		isMet = avgValue <= sla.TargetValue
	} else {
		isMet = avgValue >= sla.TargetValue
	}

	compliancePercent := (avgValue / sla.TargetValue) * 100
	if compliancePercent > 100 {
		compliancePercent = 100
	}

	report := &models.SLAReport{
		ID:                uuid.New(),
		SLAID:             slaID,
		ServiceName:       sla.ServiceName,
		PeriodStart:       periodStart,
		PeriodEnd:         periodEnd,
		TargetValue:       sla.TargetValue,
		ActualValue:       avgValue,
		CompliancePercent: compliancePercent,
		IsMet:             isMet,
	}

	if err := s.db.WithContext(ctx).Create(report).Error; err != nil {
		return nil, err
	}
	return report, nil
}

func (s *MonitoringService) GetSLAReports(ctx context.Context, serviceName string) ([]models.SLAReport, error) {
	var reports []models.SLAReport
	query := s.db.WithContext(ctx)
	if serviceName != "" {
		query = query.Where("service_name = ?", serviceName)
	}
	err := query.Order("created_at DESC").Find(&reports).Error
	return reports, err
}

func (s *MonitoringService) CreateAlert(ctx context.Context, alert *models.Alert) error {
	alert.ID = uuid.New()
	return s.db.WithContext(ctx).Create(alert).Error
}

func (s *MonitoringService) GetAlerts(ctx context.Context, severity string, resolved bool) ([]models.Alert, error) {
	var alerts []models.Alert
	query := s.db.WithContext(ctx).Where("is_resolved = ?", resolved)
	if severity != "" {
		query = query.Where("severity = ?", severity)
	}
	err := query.Order("created_at DESC").Find(&alerts).Error
	return alerts, err
}

func (s *MonitoringService) AcknowledgeAlert(ctx context.Context, alertID, userID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.Alert{}).Where("id = ?", alertID).Updates(map[string]interface{}{
		"is_acknowledged":  true,
		"acknowledged_by":  userID,
		"acknowledged_at":  now,
	}).Error
}

func (s *MonitoringService) ResolveAlert(ctx context.Context, alertID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.Alert{}).Where("id = ?", alertID).Updates(map[string]interface{}{
		"is_resolved": true,
		"resolved_at": now,
	}).Error
}

func (s *MonitoringService) GetDashboardStats(ctx context.Context) (map[string]interface{}, error) {
	var totalServices, healthyServices, degradedServices, unhealthyServices int64
	var activeAlerts, criticalAlerts int64
	var avgResponseTime float64

	s.db.Model(&models.ServiceHealth{}).Select("COUNT(DISTINCT service_name)").Scan(&totalServices)
	s.db.Model(&models.ServiceHealth{}).Where("status = ?", models.HealthStatusHealthy).Select("COUNT(DISTINCT service_name)").Scan(&healthyServices)
	s.db.Model(&models.ServiceHealth{}).Where("status = ?", models.HealthStatusDegraded).Select("COUNT(DISTINCT service_name)").Scan(&degradedServices)
	s.db.Model(&models.ServiceHealth{}).Where("status = ?", models.HealthStatusUnhealthy).Select("COUNT(DISTINCT service_name)").Scan(&unhealthyServices)
	s.db.Model(&models.Alert{}).Where("is_resolved = ?", false).Count(&activeAlerts)
	s.db.Model(&models.Alert{}).Where("is_resolved = ? AND severity = ?", false, models.AlertSeverityCritical).Count(&criticalAlerts)
	s.db.Model(&models.PerformanceMetric{}).Where("metric_name = ?", "response_time").Select("COALESCE(AVG(metric_value), 0)").Scan(&avgResponseTime)

	return map[string]interface{}{
		"total_services":      totalServices,
		"healthy_services":    healthyServices,
		"degraded_services":   degradedServices,
		"unhealthy_services":  unhealthyServices,
		"active_alerts":       activeAlerts,
		"critical_alerts":     criticalAlerts,
		"avg_response_time_ms": avgResponseTime,
	}, nil
}
