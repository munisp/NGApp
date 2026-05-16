package service

import (
	"context"
	"fmt"
	"math"
	"performance-monitoring-dashboard/internal/models"
	"performance-monitoring-dashboard/internal/repository"
	"time"
)

type PerfMonService struct{ repo *repository.PerfMonRepository }

func NewPerfMonService(repo *repository.PerfMonRepository) *PerfMonService {
	return &PerfMonService{repo: repo}
}

type PlatformOverview struct {
	TotalServices int                   `json:"total_services"`
	Healthy       int                   `json:"healthy"`
	Degraded      int                   `json:"degraded"`
	Down          int                   `json:"down"`
	AvgUptime     float64               `json:"avg_uptime"`
	AvgResponse   float64               `json:"avg_response_ms"`
	Services      []models.ServiceHealth `json:"services"`
	OpenAlerts    int                   `json:"open_alerts"`
}

func (s *PerfMonService) ReportHealth(ctx context.Context, req ReportHealthRequest) (*models.ServiceHealth, error) {
	sh := &models.ServiceHealth{
		ServiceName: req.ServiceName, ServiceType: req.ServiceType, Status: req.Status,
		Uptime: req.Uptime, ResponseTimeMs: req.ResponseTimeMs, ErrorRate: req.ErrorRate,
		CPU: req.CPU, Memory: req.Memory, DiskUsage: req.DiskUsage,
		ActiveConns: req.ActiveConns, Version: req.Version, Endpoint: req.Endpoint,
		LastChecked: time.Now(),
	}
	if sh.Status == "" {
		if sh.ErrorRate > 50 { sh.Status = "down"
		} else if sh.ErrorRate > 10 || sh.ResponseTimeMs > 5000 { sh.Status = "degraded"
		} else { sh.Status = "healthy" }
	}
	if err := s.repo.UpsertServiceHealth(ctx, sh); err != nil {
		return nil, fmt.Errorf("failed to report health: %w", err)
	}
	go s.checkAlerts(ctx, sh)
	return sh, nil
}

func (s *PerfMonService) GetPlatformOverview(ctx context.Context) (*PlatformOverview, error) {
	services, err := s.repo.ListServiceHealth(ctx)
	if err != nil { return nil, err }
	overview := &PlatformOverview{TotalServices: len(services), Services: services}
	totalUptime, totalResp := 0.0, 0.0
	for _, svc := range services {
		totalUptime += svc.Uptime; totalResp += svc.ResponseTimeMs
		switch svc.Status {
		case "healthy": overview.Healthy++
		case "degraded": overview.Degraded++
		case "down": overview.Down++
		}
	}
	if len(services) > 0 {
		overview.AvgUptime = math.Round(totalUptime/float64(len(services))*100) / 100
		overview.AvgResponse = math.Round(totalResp/float64(len(services))*100) / 100
	}
	alerts, _ := s.repo.ListAlerts(ctx, "open")
	overview.OpenAlerts = len(alerts)
	return overview, nil
}

func (s *PerfMonService) RecordMetric(ctx context.Context, req RecordMetricRequest) error {
	m := &models.PerformanceMetric{
		ServiceName: req.ServiceName, MetricName: req.MetricName,
		MetricValue: req.MetricValue, Unit: req.Unit,
		Tags: req.Tags, Period: req.Period, RecordedAt: time.Now(),
	}
	return s.repo.RecordMetric(ctx, m)
}

func (s *PerfMonService) GetMetrics(ctx context.Context, serviceName, metricName string, from, to time.Time) ([]models.PerformanceMetric, error) {
	return s.repo.GetMetrics(ctx, serviceName, metricName, from, to)
}

func (s *PerfMonService) CreateAlertConfig(ctx context.Context, req CreateAlertConfigRequest) (*models.AlertConfig, error) {
	ac := &models.AlertConfig{
		Name: req.Name, ServiceName: req.ServiceName, MetricName: req.MetricName,
		Operator: req.Operator, Threshold: req.Threshold, Duration: req.Duration,
		Severity: req.Severity, NotifyChannel: req.NotifyChannel, IsActive: true,
	}
	if err := s.repo.CreateAlertConfig(ctx, ac); err != nil {
		return nil, fmt.Errorf("failed to create alert config: %w", err)
	}
	return ac, nil
}

func (s *PerfMonService) GetAlerts(ctx context.Context, status string) ([]models.PerformanceAlert, error) {
	return s.repo.ListAlerts(ctx, status)
}

func (s *PerfMonService) SetSLA(ctx context.Context, req SetSLARequest) (*models.SLAConfig, error) {
	sc := &models.SLAConfig{
		ServiceName: req.ServiceName, TargetUptime: req.TargetUptime,
		MaxResponseMs: req.MaxResponseMs, MaxErrorRate: req.MaxErrorRate,
		MeasurePeriod: req.MeasurePeriod,
	}
	if err := s.repo.CreateSLAConfig(ctx, sc); err != nil {
		return nil, fmt.Errorf("failed to set SLA: %w", err)
	}
	return sc, nil
}

func (s *PerfMonService) GenerateSLAReport(ctx context.Context, serviceName, period string) (*models.SLAReport, error) {
	slaConfig, err := s.repo.GetSLAConfig(ctx, serviceName)
	if err != nil { return nil, fmt.Errorf("SLA config not found for service") }

	start, _ := time.Parse("2006-01", period)
	end := start.AddDate(0, 1, 0)
	avgResponse, _ := s.repo.GetAvgMetric(ctx, serviceName, "latency_p50", start, end)
	p95Response, _ := s.repo.GetAvgMetric(ctx, serviceName, "latency_p95", start, end)
	errorRate, _ := s.repo.GetAvgMetric(ctx, serviceName, "error_rate", start, end)

	sh, _ := s.repo.GetServiceHealth(ctx, serviceName)
	actualUptime := 99.9
	if sh != nil { actualUptime = sh.Uptime }

	slaMet := actualUptime >= slaConfig.TargetUptime && avgResponse <= slaConfig.MaxResponseMs && errorRate <= slaConfig.MaxErrorRate

	report := &models.SLAReport{
		ServiceName: serviceName, Period: period, ActualUptime: actualUptime,
		TargetUptime: slaConfig.TargetUptime, SLAMet: slaMet,
		AvgResponseMs: avgResponse, P95ResponseMs: p95Response, ErrorRate: errorRate,
		Details: map[string]interface{}{"max_response_target": slaConfig.MaxResponseMs, "max_error_target": slaConfig.MaxErrorRate},
	}
	if err := s.repo.CreateSLAReport(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to create SLA report: %w", err)
	}
	return report, nil
}

func (s *PerfMonService) GetSLAReports(ctx context.Context, serviceName string) ([]models.SLAReport, error) {
	return s.repo.GetSLAReports(ctx, serviceName)
}

func (s *PerfMonService) checkAlerts(ctx context.Context, sh *models.ServiceHealth) {
	configs, _ := s.repo.ListAlertConfigs(ctx)
	for _, config := range configs {
		if config.ServiceName != "" && config.ServiceName != sh.ServiceName { continue }
		var value float64
		switch config.MetricName {
		case "error_rate": value = sh.ErrorRate
		case "response_time": value = sh.ResponseTimeMs
		case "cpu": value = sh.CPU
		case "memory": value = sh.Memory
		default: continue
		}
		triggered := false
		switch config.Operator {
		case "gt": triggered = value > config.Threshold
		case "gte": triggered = value >= config.Threshold
		case "lt": triggered = value < config.Threshold
		case "lte": triggered = value <= config.Threshold
		}
		if triggered {
			alert := &models.PerformanceAlert{
				ConfigID: config.ID, ServiceName: sh.ServiceName, AlertName: config.Name,
				Severity: config.Severity, CurrentValue: value, Threshold: config.Threshold,
				Message: fmt.Sprintf("%s: %s %.2f %s %.2f", sh.ServiceName, config.MetricName, value, config.Operator, config.Threshold),
				Status: "open",
			}
			s.repo.CreateAlert(ctx, alert)
		}
	}
}
