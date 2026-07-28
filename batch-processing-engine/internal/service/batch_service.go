package service

import (
	"batch-processing-engine/internal/models"
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BatchService struct {
	db *gorm.DB
}

func NewBatchService(db *gorm.DB) *BatchService {
	return &BatchService{db: db}
}

func (s *BatchService) CreateBatchJob(ctx context.Context, job *models.BatchJob) error {
	job.ID = uuid.New()
	job.Status = models.BatchStatusPending
	return s.db.WithContext(ctx).Create(job).Error
}

func (s *BatchService) StartBatchJob(ctx context.Context, jobID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.BatchJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":     models.BatchStatusRunning,
		"started_at": now,
	}).Error
}

func (s *BatchService) ProcessBatchItem(ctx context.Context, item *models.BatchItem) error {
	now := time.Now()
	item.ProcessedAt = &now
	item.Status = "COMPLETED"
	return s.db.WithContext(ctx).Save(item).Error
}

func (s *BatchService) CompleteBatchJob(ctx context.Context, jobID uuid.UUID) error {
	now := time.Now()
	var successCount, failureCount int64
	s.db.Model(&models.BatchItem{}).Where("batch_job_id = ? AND status = ?", jobID, "COMPLETED").Count(&successCount)
	s.db.Model(&models.BatchItem{}).Where("batch_job_id = ? AND status = ?", jobID, "FAILED").Count(&failureCount)

	return s.db.WithContext(ctx).Model(&models.BatchJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":        models.BatchStatusCompleted,
		"completed_at":  now,
		"success_count": successCount,
		"failure_count": failureCount,
	}).Error
}

func (s *BatchService) GetBatchJob(ctx context.Context, jobID uuid.UUID) (*models.BatchJob, error) {
	var job models.BatchJob
	err := s.db.WithContext(ctx).First(&job, "id = ?", jobID).Error
	return &job, err
}

func (s *BatchService) GetBatchJobs(ctx context.Context, status string) ([]models.BatchJob, error) {
	var jobs []models.BatchJob
	query := s.db.WithContext(ctx)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&jobs).Error
	return jobs, err
}

func (s *BatchService) GetBatchItems(ctx context.Context, jobID uuid.UUID) ([]models.BatchItem, error) {
	var items []models.BatchItem
	err := s.db.WithContext(ctx).Where("batch_job_id = ?", jobID).Order("item_index ASC").Find(&items).Error
	return items, err
}

func (s *BatchService) CancelBatchJob(ctx context.Context, jobID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&models.BatchJob{}).Where("id = ?", jobID).Update("status", models.BatchStatusCancelled).Error
}

func (s *BatchService) CreateSchedule(ctx context.Context, schedule *models.BatchSchedule) error {
	schedule.ID = uuid.New()
	return s.db.WithContext(ctx).Create(schedule).Error
}

func (s *BatchService) GetSchedules(ctx context.Context) ([]models.BatchSchedule, error) {
	var schedules []models.BatchSchedule
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&schedules).Error
	return schedules, err
}

func (s *BatchService) GetBatchStats(ctx context.Context) (map[string]interface{}, error) {
	var total, running, completed, failed int64
	s.db.Model(&models.BatchJob{}).Count(&total)
	s.db.Model(&models.BatchJob{}).Where("status = ?", models.BatchStatusRunning).Count(&running)
	s.db.Model(&models.BatchJob{}).Where("status = ?", models.BatchStatusCompleted).Count(&completed)
	s.db.Model(&models.BatchJob{}).Where("status = ?", models.BatchStatusFailed).Count(&failed)

	return map[string]interface{}{
		"total_jobs":     total,
		"running_jobs":   running,
		"completed_jobs": completed,
		"failed_jobs":    failed,
		"success_rate":   float64(completed) / float64(total) * 100,
	}, nil
}
