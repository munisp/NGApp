package service

import (
	"context"
	"fmt"
	"strategic-implementations/internal/models"
	"strategic-implementations/internal/repository"
	"time"
)

type StrategyService struct{ repo *repository.StrategyRepository }
func NewStrategyService(repo *repository.StrategyRepository) *StrategyService { return &StrategyService{repo: repo} }

func (s *StrategyService) CreateInitiative(ctx context.Context, req CreateInitiativeRequest) (*models.StrategicInitiative, error) {
	init := &models.StrategicInitiative{
		InitiativeRef: fmt.Sprintf("STR-%d", time.Now().UnixNano()%1000000),
		Title: req.Title, Description: req.Description, Category: req.Category,
		Priority: req.Priority, OwnerID: req.OwnerID, OwnerName: req.OwnerName,
		StartDate: req.StartDate, TargetDate: req.TargetDate, Budget: req.Budget,
		Status: "planning", Progress: 0, RiskLevel: "low",
	}
	if err := s.repo.CreateInitiative(ctx, init); err != nil {
		return nil, fmt.Errorf("failed to create initiative: %w", err)
	}
	return init, nil
}

func (s *StrategyService) UpdateProgress(ctx context.Context, ref string, progress float64, spent float64) error {
	init, err := s.repo.GetInitiative(ctx, ref)
	if err != nil { return fmt.Errorf("initiative not found") }
	init.Progress = progress
	if spent > 0 { init.SpentAmount = spent }
	if progress >= 100 {
		init.Status = "completed"; now := time.Now(); init.CompletedDate = &now
	} else if progress > 0 && init.Status == "planning" {
		init.Status = "in_progress"
	}
	if init.Budget > 0 && init.SpentAmount > init.Budget*0.9 { init.RiskLevel = "high" }
	return s.repo.UpdateInitiative(ctx, init)
}

func (s *StrategyService) AddMilestone(ctx context.Context, req AddMilestoneRequest) (*models.Milestone, error) {
	m := &models.Milestone{
		InitiativeRef: req.InitiativeRef, Title: req.Title,
		Description: req.Description, DueDate: req.DueDate, Status: "pending",
	}
	if err := s.repo.CreateMilestone(ctx, m); err != nil {
		return nil, fmt.Errorf("failed to add milestone: %w", err)
	}
	return m, nil
}

func (s *StrategyService) CompleteMilestone(ctx context.Context, ref string, milestoneID string) error {
	milestones, _ := s.repo.GetMilestones(ctx, ref)
	for _, m := range milestones {
		if m.ID.String() == milestoneID {
			now := time.Now(); m.Status = "completed"; m.CompletedAt = &now
			return s.repo.UpdateMilestone(ctx, &m)
		}
	}
	return fmt.Errorf("milestone not found")
}

func (s *StrategyService) CreateKPI(ctx context.Context, req CreateKPIRequest) (*models.KPI, error) {
	k := &models.KPI{
		InitiativeRef: req.InitiativeRef, Name: req.Name, Description: req.Description,
		TargetValue: req.TargetValue, Unit: req.Unit, Frequency: req.Frequency,
		Status: "on_track", LastUpdated: time.Now(),
	}
	if err := s.repo.CreateKPI(ctx, k); err != nil {
		return nil, fmt.Errorf("failed to create KPI: %w", err)
	}
	return k, nil
}

func (s *StrategyService) UpdateKPIValue(ctx context.Context, kpiID string, value float64) error {
	kpis, _ := s.repo.GetKPIs(ctx, "")
	for _, k := range kpis {
		if k.ID.String() == kpiID {
			k.CurrentValue = value; k.LastUpdated = time.Now()
			ratio := value / k.TargetValue
			if ratio >= 1.0 { k.Status = "exceeded" } else if ratio >= 0.7 { k.Status = "on_track" } else if ratio >= 0.4 { k.Status = "at_risk" } else { k.Status = "behind" }
			return s.repo.UpdateKPI(ctx, &k)
		}
	}
	return fmt.Errorf("KPI not found")
}

func (s *StrategyService) AddRisk(ctx context.Context, req AddRiskRequest) (*models.RiskRegister, error) {
	probScore := map[string]float64{"low": 1, "medium": 2, "high": 3}
	impactScore := map[string]float64{"low": 1, "medium": 2, "high": 3, "critical": 4}
	riskScore := probScore[req.Probability] * impactScore[req.Impact]
	r := &models.RiskRegister{
		InitiativeRef: req.InitiativeRef, Title: req.Title, Description: req.Description,
		Probability: req.Probability, Impact: req.Impact, RiskScore: riskScore,
		Mitigation: req.Mitigation, Owner: req.Owner, Status: "identified",
	}
	if err := s.repo.CreateRisk(ctx, r); err != nil {
		return nil, fmt.Errorf("failed to add risk: %w", err)
	}
	return r, nil
}

func (s *StrategyService) GenerateReport(ctx context.Context, reportType, period string) (*models.StrategicReport, error) {
	initiatives, _ := s.repo.ListInitiatives(ctx, "", "")
	total := len(initiatives)
	completed, inProgress := 0, 0
	totalBudget, totalSpent, avgProgress := 0.0, 0.0, 0.0
	for _, i := range initiatives {
		if i.Status == "completed" { completed++ }
		if i.Status == "in_progress" { inProgress++ }
		totalBudget += i.Budget; totalSpent += i.SpentAmount; avgProgress += i.Progress
	}
	if total > 0 { avgProgress /= float64(total) }
	report := &models.StrategicReport{
		ReportType: reportType, Period: period,
		Title: fmt.Sprintf("Strategic %s - %s", reportType, period),
		Summary: fmt.Sprintf("%d initiatives, %d completed, %d in progress, %.1f%% avg progress", total, completed, inProgress, avgProgress),
		Metrics: map[string]interface{}{
			"total_initiatives": total, "completed": completed, "in_progress": inProgress,
			"total_budget": totalBudget, "total_spent": totalSpent,
			"avg_progress": avgProgress, "budget_utilization": totalSpent / max(totalBudget, 1) * 100,
		},
		GeneratedBy: "system",
	}
	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to generate report: %w", err)
	}
	return report, nil
}

func max(a, b float64) float64 { if a > b { return a }; return b }

func (s *StrategyService) GetInitiative(ctx context.Context, ref string) (*models.StrategicInitiative, error) { return s.repo.GetInitiative(ctx, ref) }
func (s *StrategyService) ListInitiatives(ctx context.Context, status, category string) ([]models.StrategicInitiative, error) { return s.repo.ListInitiatives(ctx, status, category) }
func (s *StrategyService) GetMilestones(ctx context.Context, ref string) ([]models.Milestone, error) { return s.repo.GetMilestones(ctx, ref) }
func (s *StrategyService) GetKPIs(ctx context.Context, ref string) ([]models.KPI, error) { return s.repo.GetKPIs(ctx, ref) }
func (s *StrategyService) GetRisks(ctx context.Context, ref string) ([]models.RiskRegister, error) { return s.repo.GetRisks(ctx, ref) }
func (s *StrategyService) GetReports(ctx context.Context, reportType string) ([]models.StrategicReport, error) { return s.repo.GetReports(ctx, reportType) }
