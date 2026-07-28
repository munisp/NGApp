package service

import (
	"batch-processing-engine/internal/middleware"
	"batch-processing-engine/internal/models"
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedBatchService struct {
	db         *gorm.DB
	middleware *middleware.MiddlewareClients
}

func NewEnhancedBatchService(db *gorm.DB, mw *middleware.MiddlewareClients) *EnhancedBatchService {
	return &EnhancedBatchService{db: db, middleware: mw}
}

func (s *EnhancedBatchService) CreateBatchJob(ctx context.Context, job *models.BatchJob) error {
	job.ID = uuid.New()
	job.Status = "PENDING"
	job.CreatedAt = time.Now()

	if err := s.db.WithContext(ctx).Create(job).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.BatchEvent{
			ID:        uuid.New(),
			EventType: "JOB_CREATED",
			JobID:     job.ID,
			JobType:   job.JobType,
			Status:    "PENDING",
			Timestamp: time.Now(),
		}
		go s.middleware.Kafka.PublishBatchEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		data, _ := json.Marshal(job)
		go s.middleware.Redis.CacheJobState(context.Background(), job.ID, data, 24*time.Hour)
	}

	return nil
}

func (s *EnhancedBatchService) StartBatchJob(ctx context.Context, jobID uuid.UUID) (*models.JobExecutionResult, error) {
	var job models.BatchJob
	if err := s.db.WithContext(ctx).First(&job, "id = ?", jobID).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Temporal != nil {
		var items []interface{}
		json.Unmarshal(job.Items, &items)

		runID, err := s.middleware.Temporal.StartBatchJobWorkflow(ctx, jobID, job.JobType, items)
		if err != nil {
			return nil, err
		}

		job.Status = "RUNNING"
		job.WorkflowID = runID
		job.StartedAt = time.Now()
		s.db.Save(&job)

		if s.middleware.Kafka != nil {
			event := &middleware.BatchEvent{
				ID:         uuid.New(),
				EventType:  "JOB_STARTED",
				JobID:      jobID,
				JobType:    job.JobType,
				Status:     "RUNNING",
				ItemsTotal: job.TotalItems,
				Timestamp:  time.Now(),
			}
			go s.middleware.Kafka.PublishBatchEvent(context.Background(), event)
		}

		return &models.JobExecutionResult{
			JobID:      jobID,
			WorkflowID: runID,
			Status:     "RUNNING",
			StartedAt:  job.StartedAt,
		}, nil
	}

	job.Status = "RUNNING"
	job.StartedAt = time.Now()
	s.db.Save(&job)

	go s.processJobItems(context.Background(), &job)

	return &models.JobExecutionResult{
		JobID:     jobID,
		Status:    "RUNNING",
		StartedAt: job.StartedAt,
	}, nil
}

func (s *EnhancedBatchService) processJobItems(ctx context.Context, job *models.BatchJob) {
	var items []interface{}
	json.Unmarshal(job.Items, &items)

	for i, item := range items {
		result := s.ProcessBatchItem(ctx, job.ID, item)

		if result.Success {
			job.ProcessedItems++
		} else {
			job.FailedItems++
		}

		if s.middleware != nil && s.middleware.Redis != nil {
			s.middleware.Redis.UpdateJobProgress(ctx, job.ID, job.ProcessedItems+job.FailedItems, job.TotalItems)
		}

		if s.middleware != nil && s.middleware.Kafka != nil {
			event := &middleware.BatchEvent{
				ID:             uuid.New(),
				EventType:      "ITEM_PROCESSED",
				JobID:          job.ID,
				JobType:        job.JobType,
				Status:         "RUNNING",
				Progress:       int(float64(i+1) / float64(len(items)) * 100),
				ItemsTotal:     job.TotalItems,
				ItemsProcessed: job.ProcessedItems + job.FailedItems,
				Timestamp:      time.Now(),
			}
			go s.middleware.Kafka.PublishBatchEvent(context.Background(), event)
		}
	}

	job.Status = "COMPLETED"
	job.CompletedAt = time.Now()
	s.db.Save(job)

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.BatchEvent{
			ID:             uuid.New(),
			EventType:      "JOB_COMPLETED",
			JobID:          job.ID,
			JobType:        job.JobType,
			Status:         "COMPLETED",
			Progress:       100,
			ItemsTotal:     job.TotalItems,
			ItemsProcessed: job.ProcessedItems,
			Timestamp:      time.Now(),
		}
		go s.middleware.Kafka.PublishBatchEvent(context.Background(), event)
	}
}

func (s *EnhancedBatchService) ProcessBatchItem(ctx context.Context, jobID uuid.UUID, item interface{}) *models.ItemResult {
	return &models.ItemResult{
		ItemID:  uuid.New(),
		Success: true,
	}
}

func (s *EnhancedBatchService) PauseBatchJob(ctx context.Context, jobID uuid.UUID) error {
	result := s.db.WithContext(ctx).Model(&models.BatchJob{}).
		Where("id = ? AND status = ?", jobID, "RUNNING").
		Update("status", "PAUSED")

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.BatchEvent{
			ID:        uuid.New(),
			EventType: "JOB_PAUSED",
			JobID:     jobID,
			Status:    "PAUSED",
			Timestamp: time.Now(),
		}
		go s.middleware.Kafka.PublishBatchEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedBatchService) ResumeBatchJob(ctx context.Context, jobID uuid.UUID) error {
	result := s.db.WithContext(ctx).Model(&models.BatchJob{}).
		Where("id = ? AND status = ?", jobID, "PAUSED").
		Update("status", "RUNNING")

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.BatchEvent{
			ID:        uuid.New(),
			EventType: "JOB_RESUMED",
			JobID:     jobID,
			Status:    "RUNNING",
			Timestamp: time.Now(),
		}
		go s.middleware.Kafka.PublishBatchEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedBatchService) CancelBatchJob(ctx context.Context, jobID uuid.UUID) error {
	var job models.BatchJob
	s.db.First(&job, "id = ?", jobID)

	if s.middleware != nil && s.middleware.Temporal != nil && job.WorkflowID != "" {
		s.middleware.Temporal.CancelWorkflow(ctx, job.WorkflowID)
	}

	result := s.db.WithContext(ctx).Model(&models.BatchJob{}).
		Where("id = ?", jobID).
		Update("status", "CANCELLED")

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.BatchEvent{
			ID:        uuid.New(),
			EventType: "JOB_CANCELLED",
			JobID:     jobID,
			Status:    "CANCELLED",
			Timestamp: time.Now(),
		}
		go s.middleware.Kafka.PublishBatchEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedBatchService) RetryFailedItems(ctx context.Context, jobID uuid.UUID) (*models.JobExecutionResult, error) {
	var job models.BatchJob
	if err := s.db.WithContext(ctx).First(&job, "id = ?", jobID).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Temporal != nil {
		var failedItems []interface{}
		runID, err := s.middleware.Temporal.StartRetryWorkflow(ctx, jobID, failedItems)
		if err != nil {
			return nil, err
		}

		return &models.JobExecutionResult{
			JobID:      jobID,
			WorkflowID: runID,
			Status:     "RETRYING",
			StartedAt:  time.Now(),
		}, nil
	}

	return &models.JobExecutionResult{
		JobID:     jobID,
		Status:    "RETRYING",
		StartedAt: time.Now(),
	}, nil
}

func (s *EnhancedBatchService) CreateSchedule(ctx context.Context, schedule *models.BatchSchedule) error {
	schedule.ID = uuid.New()
	schedule.IsActive = true

	if err := s.db.WithContext(ctx).Create(schedule).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Temporal != nil {
		s.middleware.Temporal.StartScheduledJobWorkflow(ctx, schedule.ID, schedule.CronExpression, schedule.JobType)
	}

	return nil
}

func (s *EnhancedBatchService) GetBatchJobs(ctx context.Context, status string) ([]models.BatchJob, error) {
	var jobs []models.BatchJob
	query := s.db.WithContext(ctx)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&jobs).Error
	return jobs, err
}

func (s *EnhancedBatchService) GetJobProgress(ctx context.Context, jobID uuid.UUID) (map[string]interface{}, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if progress, err := s.middleware.Redis.GetJobProgress(ctx, jobID); err == nil {
			return progress, nil
		}
	}

	var job models.BatchJob
	if err := s.db.WithContext(ctx).First(&job, "id = ?", jobID).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"job_id":     jobID,
		"status":     job.Status,
		"total":      job.TotalItems,
		"processed":  job.ProcessedItems,
		"failed":     job.FailedItems,
		"percent":    float64(job.ProcessedItems+job.FailedItems) / float64(job.TotalItems) * 100,
		"started_at": job.StartedAt,
	}, nil
}

func (s *EnhancedBatchService) GetBatchStats(ctx context.Context) (map[string]interface{}, error) {
	var totalJobs, runningJobs, completedToday, failedToday int64

	s.db.Model(&models.BatchJob{}).Count(&totalJobs)
	s.db.Model(&models.BatchJob{}).Where("status = ?", "RUNNING").Count(&runningJobs)
	s.db.Model(&models.BatchJob{}).Where("status = ? AND completed_at >= ?", "COMPLETED", time.Now().Truncate(24*time.Hour)).Count(&completedToday)
	s.db.Model(&models.BatchJob{}).Where("status = ? AND completed_at >= ?", "FAILED", time.Now().Truncate(24*time.Hour)).Count(&failedToday)

	return map[string]interface{}{
		"total_jobs":      totalJobs,
		"running_jobs":    runningJobs,
		"completed_today": completedToday,
		"failed_today":    failedToday,
	}, nil
}

func (s *EnhancedBatchService) GetMiddlewareStatus(ctx context.Context) *middleware.MiddlewareStatus {
	if s.middleware == nil {
		return nil
	}
	return s.middleware.GetStatus(ctx)
}
