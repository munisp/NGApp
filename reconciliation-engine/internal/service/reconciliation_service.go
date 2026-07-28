package service

import (
	"context"
	"math"
	"reconciliation-engine/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ReconciliationService struct {
	db *gorm.DB
}

func NewReconciliationService(db *gorm.DB) *ReconciliationService {
	return &ReconciliationService{db: db}
}

func (s *ReconciliationService) CreateJob(ctx context.Context, job *models.ReconciliationJob) error {
	job.ID = uuid.New()
	job.Status = models.ReconciliationStatusPending
	return s.db.WithContext(ctx).Create(job).Error
}

func (s *ReconciliationService) StartJob(ctx context.Context, jobID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.ReconciliationJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":     models.ReconciliationStatusInProgress,
		"started_at": now,
	}).Error
}

func (s *ReconciliationService) CompleteJob(ctx context.Context, jobID uuid.UUID) error {
	var matched, unmatched int64
	var matchedAmount float64

	s.db.Model(&models.ReconciliationItem{}).Where("job_id = ? AND match_status = ?", jobID, models.MatchStatusMatched).Count(&matched)
	s.db.Model(&models.ReconciliationItem{}).Where("job_id = ? AND match_status = ?", jobID, models.MatchStatusUnmatched).Count(&unmatched)
	s.db.Model(&models.ReconciliationItem{}).Where("job_id = ? AND match_status = ?", jobID, models.MatchStatusMatched).Select("COALESCE(SUM(source_amount), 0)").Scan(&matchedAmount)

	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.ReconciliationJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":           models.ReconciliationStatusCompleted,
		"completed_at":     now,
		"matched_records":  matched,
		"unmatched_records": unmatched,
		"matched_amount":   matchedAmount,
	}).Error
}

func (s *ReconciliationService) GetJob(ctx context.Context, jobID uuid.UUID) (*models.ReconciliationJob, error) {
	var job models.ReconciliationJob
	err := s.db.WithContext(ctx).First(&job, "id = ?", jobID).Error
	return &job, err
}

func (s *ReconciliationService) GetJobs(ctx context.Context, status string) ([]models.ReconciliationJob, error) {
	var jobs []models.ReconciliationJob
	query := s.db.WithContext(ctx)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&jobs).Error
	return jobs, err
}

func (s *ReconciliationService) AddReconciliationItem(ctx context.Context, item *models.ReconciliationItem) error {
	item.ID = uuid.New()
	item.Variance = math.Abs(item.SourceAmount - item.TargetAmount)
	if item.Variance < 0.01 {
		item.MatchStatus = models.MatchStatusMatched
		item.MatchConfidence = 100
	} else if item.Variance < item.SourceAmount*0.01 {
		item.MatchStatus = models.MatchStatusPartial
		item.MatchConfidence = 95
	} else {
		item.MatchStatus = models.MatchStatusUnmatched
		item.MatchConfidence = 0
	}
	return s.db.WithContext(ctx).Create(item).Error
}

func (s *ReconciliationService) GetJobItems(ctx context.Context, jobID uuid.UUID, status string) ([]models.ReconciliationItem, error) {
	var items []models.ReconciliationItem
	query := s.db.WithContext(ctx).Where("job_id = ?", jobID)
	if status != "" {
		query = query.Where("match_status = ?", status)
	}
	err := query.Find(&items).Error
	return items, err
}

func (s *ReconciliationService) ResolveItem(ctx context.Context, itemID uuid.UUID, resolvedBy uuid.UUID, notes string) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.ReconciliationItem{}).Where("id = ?", itemID).Updates(map[string]interface{}{
		"match_status": models.MatchStatusResolved,
		"resolved_by":  resolvedBy,
		"resolved_at":  now,
		"notes":        notes,
	}).Error
}

func (s *ReconciliationService) UploadStatement(ctx context.Context, statement *models.BankStatement) error {
	statement.ID = uuid.New()
	return s.db.WithContext(ctx).Create(statement).Error
}

func (s *ReconciliationService) GetStatements(ctx context.Context, bankCode, accountNumber string) ([]models.BankStatement, error) {
	var statements []models.BankStatement
	query := s.db.WithContext(ctx)
	if bankCode != "" {
		query = query.Where("bank_code = ?", bankCode)
	}
	if accountNumber != "" {
		query = query.Where("account_number = ?", accountNumber)
	}
	err := query.Order("statement_date DESC").Find(&statements).Error
	return statements, err
}

func (s *ReconciliationService) GetReconciliationStats(ctx context.Context) (map[string]interface{}, error) {
	var totalJobs, completedJobs int64
	var totalMatched, totalUnmatched int64
	var totalVariance float64

	s.db.Model(&models.ReconciliationJob{}).Count(&totalJobs)
	s.db.Model(&models.ReconciliationJob{}).Where("status = ?", models.ReconciliationStatusCompleted).Count(&completedJobs)
	s.db.Model(&models.ReconciliationItem{}).Where("match_status = ?", models.MatchStatusMatched).Count(&totalMatched)
	s.db.Model(&models.ReconciliationItem{}).Where("match_status = ?", models.MatchStatusUnmatched).Count(&totalUnmatched)
	s.db.Model(&models.ReconciliationItem{}).Select("COALESCE(SUM(variance), 0)").Scan(&totalVariance)

	return map[string]interface{}{
		"total_jobs":       totalJobs,
		"completed_jobs":   completedJobs,
		"total_matched":    totalMatched,
		"total_unmatched":  totalUnmatched,
		"total_variance":   totalVariance,
		"match_rate":       float64(totalMatched) / float64(totalMatched+totalUnmatched) * 100,
	}, nil
}
