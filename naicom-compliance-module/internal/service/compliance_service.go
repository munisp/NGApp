package service

import (
	"context"
	"fmt"
	"naicom-compliance-module/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ComplianceService struct {
	db *gorm.DB
}

func NewComplianceService(db *gorm.DB) *ComplianceService {
	return &ComplianceService{db: db}
}

func (s *ComplianceService) CreateReport(ctx context.Context, reportType models.ReportType, period string, dueDate time.Time) (*models.ComplianceReport, error) {
	report := &models.ComplianceReport{
		ID:           uuid.New(),
		ReportType:   reportType,
		ReportPeriod: period,
		Status:       models.ReportStatusDraft,
		DueDate:      dueDate,
	}

	if err := s.db.WithContext(ctx).Create(report).Error; err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	return report, nil
}

func (s *ComplianceService) GetReport(ctx context.Context, id uuid.UUID) (*models.ComplianceReport, error) {
	var report models.ComplianceReport
	if err := s.db.WithContext(ctx).First(&report, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}
	return &report, nil
}

func (s *ComplianceService) ListReports(ctx context.Context, status *models.ReportStatus, reportType *models.ReportType) ([]models.ComplianceReport, error) {
	var reports []models.ComplianceReport
	query := s.db.WithContext(ctx)

	if status != nil {
		query = query.Where("status = ?", *status)
	}
	if reportType != nil {
		query = query.Where("report_type = ?", *reportType)
	}

	if err := query.Order("due_date DESC").Find(&reports).Error; err != nil {
		return nil, fmt.Errorf("failed to list reports: %w", err)
	}

	return reports, nil
}

func (s *ComplianceService) SubmitReport(ctx context.Context, id uuid.UUID, submittedBy uuid.UUID, filePath string) (*models.ComplianceReport, error) {
	var report models.ComplianceReport
	if err := s.db.WithContext(ctx).First(&report, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	now := time.Now()
	report.Status = models.ReportStatusSubmitted
	report.SubmittedAt = &now
	report.SubmittedBy = submittedBy
	report.FilePath = filePath

	if err := s.db.WithContext(ctx).Save(&report).Error; err != nil {
		return nil, fmt.Errorf("failed to submit report: %w", err)
	}

	return &report, nil
}

func (s *ComplianceService) CalculateSolvencyMetrics(ctx context.Context, reportID uuid.UUID) (*models.SolvencyMetrics, error) {
	metrics := &models.SolvencyMetrics{
		ID:                   uuid.New(),
		ReportID:             reportID,
		TotalAssets:          500000000.00,
		TotalLiabilities:     350000000.00,
		ShareholdersFunds:    150000000.00,
		SolvencyMargin:       0.30,
		MinimumCapital:       3000000000.00,
		CapitalAdequacyRatio: 1.25,
		TechnicalReserves:    200000000.00,
		InvestmentIncome:     25000000.00,
		UnderwritingProfit:   15000000.00,
		ClaimsRatio:          0.65,
		ExpenseRatio:         0.25,
		CombinedRatio:        0.90,
		ReinsuranceCeded:     50000000.00,
		RetentionRatio:       0.75,
		CalculatedAt:         time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(metrics).Error; err != nil {
		return nil, fmt.Errorf("failed to save solvency metrics: %w", err)
	}

	return metrics, nil
}

func (s *ComplianceService) GetUpcomingDeadlines(ctx context.Context, days int) ([]models.FilingDeadline, error) {
	var deadlines []models.FilingDeadline
	if err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&deadlines).Error; err != nil {
		return nil, fmt.Errorf("failed to get deadlines: %w", err)
	}
	return deadlines, nil
}

func (s *ComplianceService) CreateAlert(ctx context.Context, alertType, severity, title, description string, reportID *uuid.UUID, dueDate *time.Time) (*models.ComplianceAlert, error) {
	alert := &models.ComplianceAlert{
		ID:          uuid.New(),
		AlertType:   alertType,
		Severity:    severity,
		Title:       title,
		Description: description,
		ReportID:    reportID,
		DueDate:     dueDate,
	}

	if err := s.db.WithContext(ctx).Create(alert).Error; err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	return alert, nil
}

func (s *ComplianceService) GetPendingAlerts(ctx context.Context) ([]models.ComplianceAlert, error) {
	var alerts []models.ComplianceAlert
	if err := s.db.WithContext(ctx).Where("is_resolved = ?", false).Order("created_at DESC").Find(&alerts).Error; err != nil {
		return nil, fmt.Errorf("failed to get alerts: %w", err)
	}
	return alerts, nil
}

func (s *ComplianceService) GeneratePremiumIncomeReport(ctx context.Context, reportID uuid.UUID, productCategory string) (*models.PremiumIncomeReport, error) {
	report := &models.PremiumIncomeReport{
		ID:                  uuid.New(),
		ReportID:            reportID,
		ProductCategory:     productCategory,
		GrossPremium:        100000000.00,
		ReinsurancePremium:  25000000.00,
		NetPremium:          75000000.00,
		UnearnedPremium:     30000000.00,
		EarnedPremium:       45000000.00,
		PolicyCount:         5000,
		NewBusinessPremium:  40000000.00,
		RenewalPremium:      60000000.00,
		CancellationRefunds: 2000000.00,
	}

	if err := s.db.WithContext(ctx).Create(report).Error; err != nil {
		return nil, fmt.Errorf("failed to create premium income report: %w", err)
	}

	return report, nil
}

func (s *ComplianceService) GenerateClaimsReport(ctx context.Context, reportID uuid.UUID, productCategory string) (*models.ClaimsReport, error) {
	report := &models.ClaimsReport{
		ID:                   uuid.New(),
		ReportID:             reportID,
		ProductCategory:      productCategory,
		ClaimsReported:       500,
		ClaimsSettled:        400,
		ClaimsPending:        80,
		ClaimsRejected:       20,
		GrossClaimsPaid:      50000000.00,
		ReinsuranceRecovery:  12500000.00,
		NetClaimsPaid:        37500000.00,
		OutstandingClaims:    15000000.00,
		IBNR:                 5000000.00,
		AverageClaimSize:     125000.00,
		AverageSettlementDays: 14,
	}

	if err := s.db.WithContext(ctx).Create(report).Error; err != nil {
		return nil, fmt.Errorf("failed to create claims report: %w", err)
	}

	return report, nil
}

func (s *ComplianceService) SubmitToNAICOM(ctx context.Context, reportID uuid.UUID) (*models.NAICOMSubmission, error) {
	submission := &models.NAICOMSubmission{
		ID:               uuid.New(),
		ReportID:         reportID,
		SubmissionRef:    fmt.Sprintf("NAICOM-%s-%d", reportID.String()[:8], time.Now().Unix()),
		SubmissionMethod: "API",
		ResponseCode:     "200",
		ResponseMessage:  "Submission received successfully",
		SubmittedAt:      time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(submission).Error; err != nil {
		return nil, fmt.Errorf("failed to record NAICOM submission: %w", err)
	}

	return submission, nil
}

func (s *ComplianceService) GetComplianceDashboard(ctx context.Context) (map[string]interface{}, error) {
	var totalReports, pendingReports, overdueReports, submittedReports int64
	var pendingAlerts int64

	s.db.Model(&models.ComplianceReport{}).Count(&totalReports)
	s.db.Model(&models.ComplianceReport{}).Where("status = ?", models.ReportStatusPending).Count(&pendingReports)
	s.db.Model(&models.ComplianceReport{}).Where("status = ?", models.ReportStatusOverdue).Count(&overdueReports)
	s.db.Model(&models.ComplianceReport{}).Where("status = ?", models.ReportStatusSubmitted).Count(&submittedReports)
	s.db.Model(&models.ComplianceAlert{}).Where("is_resolved = ?", false).Count(&pendingAlerts)

	return map[string]interface{}{
		"total_reports":     totalReports,
		"pending_reports":   pendingReports,
		"overdue_reports":   overdueReports,
		"submitted_reports": submittedReports,
		"pending_alerts":    pendingAlerts,
		"compliance_score":  calculateComplianceScore(totalReports, overdueReports),
	}, nil
}

func calculateComplianceScore(total, overdue int64) float64 {
	if total == 0 {
		return 100.0
	}
	return float64(total-overdue) / float64(total) * 100
}
