package service

import (
	"audit-trail-system/internal/models"
	"audit-trail-system/internal/repository"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type AuditService struct{ repo *repository.AuditRepository }

func NewAuditService(repo *repository.AuditRepository) *AuditService {
	return &AuditService{repo: repo}
}

func (s *AuditService) RecordEvent(ctx context.Context, req RecordEventRequest) (*models.AuditEvent, error) {
	riskLevel := s.assessRiskLevel(req.EventType, req.EntityType)
	event := &models.AuditEvent{
		EventType: req.EventType, EntityType: req.EntityType, EntityID: req.EntityID,
		Module: req.Module, ActorID: req.ActorID, ActorName: req.ActorName,
		ActorRole: req.ActorRole, ActorIP: req.ActorIP, UserAgent: req.UserAgent,
		Description: req.Description, OldValue: req.OldValue, NewValue: req.NewValue,
		Changes: req.Changes, Metadata: req.Metadata, RiskLevel: riskLevel,
		Outcome: req.Outcome, ErrorMessage: req.ErrorMessage,
		CorrelationID: req.CorrelationID, SessionID: req.SessionID,
	}
	if event.Outcome == "" { event.Outcome = "success" }
	if err := s.repo.CreateEvent(ctx, event); err != nil {
		return nil, fmt.Errorf("failed to record audit event: %w", err)
	}
	go s.checkAlertRules(ctx, event)
	return event, nil
}

func (s *AuditService) SearchEvents(ctx context.Context, req SearchEventsRequest) ([]models.AuditEvent, error) {
	return s.repo.SearchEvents(ctx, req.EntityType, req.EntityID, req.ActorID, req.EventType, req.Module, req.From, req.To, req.Limit)
}

func (s *AuditService) GetEventsByCorrelation(ctx context.Context, correlationID string) ([]models.AuditEvent, error) {
	return s.repo.GetEventsByCorrelation(ctx, correlationID)
}

func (s *AuditService) CreatePolicy(ctx context.Context, req CreatePolicyRequest) (*models.AuditPolicy, error) {
	policy := &models.AuditPolicy{
		Name: req.Name, EntityType: req.EntityType, EventTypes: strings.Join(req.EventTypes, ","),
		RetentionDays: req.RetentionDays, RequiresApproval: req.RequiresApproval,
		AlertOnEvent: req.AlertOnEvent, RiskLevel: req.RiskLevel, IsActive: true,
	}
	if policy.RetentionDays == 0 { policy.RetentionDays = 2555 }
	if err := s.repo.CreatePolicy(ctx, policy); err != nil {
		return nil, fmt.Errorf("failed to create policy: %w", err)
	}
	return policy, nil
}

func (s *AuditService) GetPolicies(ctx context.Context) ([]models.AuditPolicy, error) {
	return s.repo.ListPolicies(ctx)
}

func (s *AuditService) GenerateComplianceReport(ctx context.Context, req GenerateReportRequest) (*models.ComplianceReport, error) {
	start, _ := time.Parse("2006-01", req.Period)
	end := start.AddDate(0, 3, 0)
	totalEvents, _ := s.repo.CountEvents(ctx, "", "", start, end)
	highRisk, _ := s.repo.CountHighRiskEvents(ctx, start, end)

	summary := map[string]interface{}{
		"period": req.Period, "total_events": totalEvents, "high_risk_events": highRisk,
		"report_type": req.ReportType,
	}

	entityTypes := []string{"policy", "claim", "payment", "user"}
	for _, et := range entityTypes {
		count, _ := s.repo.CountEvents(ctx, et, "", start, end)
		summary[et+"_events"] = count
	}

	report := &models.ComplianceReport{
		ReportType: req.ReportType, Period: req.Period, GeneratedBy: req.GeneratedBy,
		TotalEvents: int(totalEvents), HighRiskCount: int(highRisk),
		Summary: summary, Status: "generated",
	}
	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to generate report: %w", err)
	}
	return report, nil
}

func (s *AuditService) GetReports(ctx context.Context, reportType string) ([]models.ComplianceReport, error) {
	return s.repo.ListReports(ctx, reportType)
}

func (s *AuditService) CreateAlertRule(ctx context.Context, req CreateAlertRuleRequest) (*models.AlertRule, error) {
	rule := &models.AlertRule{
		Name: req.Name, Description: req.Description, Condition: req.Condition,
		EntityType: req.EntityType, EventType: req.EventType,
		Threshold: req.Threshold, WindowMinutes: req.WindowMinutes,
		Severity: req.Severity, NotifyChannel: req.NotifyChannel, IsActive: true,
	}
	if err := s.repo.CreateAlertRule(ctx, rule); err != nil {
		return nil, fmt.Errorf("failed to create alert rule: %w", err)
	}
	return rule, nil
}

func (s *AuditService) GetAlerts(ctx context.Context, status string) ([]models.Alert, error) {
	return s.repo.ListAlerts(ctx, status)
}

func (s *AuditService) AcknowledgeAlert(ctx context.Context, alertID uuid.UUID, by string) error {
	alerts, _ := s.repo.ListAlerts(ctx, "open")
	for _, a := range alerts {
		if a.ID == alertID {
			a.Status = "acknowledged"; a.AcknowledgedBy = by
			return s.repo.UpdateAlert(ctx, &a)
		}
	}
	return fmt.Errorf("alert not found")
}

func (s *AuditService) assessRiskLevel(eventType, entityType string) string {
	highRiskEvents := map[string]bool{"delete": true, "export": true, "approve": true}
	highRiskEntities := map[string]bool{"payment": true, "claim": true, "user": true}
	if highRiskEvents[eventType] && highRiskEntities[entityType] { return "critical" }
	if highRiskEvents[eventType] || highRiskEntities[entityType] { return "high" }
	if eventType == "update" { return "medium" }
	return "low"
}

func (s *AuditService) checkAlertRules(ctx context.Context, event *models.AuditEvent) {
	rules, _ := s.repo.ListAlertRules(ctx)
	for _, rule := range rules {
		if rule.EventType != "" && rule.EventType != event.EventType { continue }
		if rule.EntityType != "" && rule.EntityType != event.EntityType { continue }
		count, _ := s.repo.GetRecentEventCount(ctx, rule.EventType, rule.EntityType, rule.WindowMinutes)
		if int(count) >= rule.Threshold {
			alert := &models.Alert{
				RuleID: rule.ID, RuleName: rule.Name, Severity: rule.Severity,
				Message: fmt.Sprintf("Alert: %s - %d events in %d minutes (threshold: %d)", rule.Name, count, rule.WindowMinutes, rule.Threshold),
				Details: map[string]interface{}{"event_count": count, "window_minutes": rule.WindowMinutes, "trigger_event_id": event.ID.String()},
				Status: "open",
			}
			s.repo.CreateAlert(ctx, alert)
		}
	}
}
