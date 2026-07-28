package service

import (
	"batch-processing-engine/internal/models"
	"batch-processing-engine/internal/repository"
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type BatchService struct{ repo *repository.BatchRepository }

func NewBatchService(repo *repository.BatchRepository) *BatchService {
	return &BatchService{repo: repo}
}

func (s *BatchService) CreateJob(ctx context.Context, req CreateJobRequest) (*models.BatchJob, error) {
	job := &models.BatchJob{
		JobName: req.JobName, JobType: req.JobType, Description: req.Description,
		Schedule: req.Schedule, Priority: req.Priority, MaxRetries: req.MaxRetries,
		TimeoutMins: req.TimeoutMins, Config: req.Config, Status: "pending",
		CreatedBy: req.CreatedBy,
	}
	if job.Priority == 0 { job.Priority = 5 }
	if job.MaxRetries == 0 { job.MaxRetries = 3 }
	if job.TimeoutMins == 0 { job.TimeoutMins = 60 }
	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, fmt.Errorf("failed to create batch job: %w", err)
	}
	return job, nil
}

func (s *BatchService) AddItems(ctx context.Context, jobID uuid.UUID, items []BatchItemInput) (int, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil { return 0, fmt.Errorf("job not found") }
	batchItems := make([]models.BatchItem, len(items))
	for i, item := range items {
		batchItems[i] = models.BatchItem{
			JobID: jobID, ItemRef: item.ItemRef, ItemType: item.ItemType,
			InputData: item.InputData, Status: "pending",
		}
	}
	if err := s.repo.CreateItems(ctx, batchItems); err != nil {
		return 0, fmt.Errorf("failed to add items: %w", err)
	}
	job.TotalItems += len(items)
	s.repo.UpdateJob(ctx, job)
	return len(items), nil
}

func (s *BatchService) StartJob(ctx context.Context, jobID uuid.UUID) error {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil { return fmt.Errorf("job not found") }
	if job.Status != "pending" && job.Status != "paused" { return fmt.Errorf("job cannot be started in state: %s", job.Status) }
	now := time.Now()
	job.Status = "running"; job.StartedAt = &now
	return s.repo.UpdateJob(ctx, job)
}

func (s *BatchService) ProcessBatch(ctx context.Context, jobID uuid.UUID, batchSize int) (*BatchProcessResult, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil { return nil, fmt.Errorf("job not found") }
	if job.Status != "running" { return nil, fmt.Errorf("job is not running") }
	if batchSize <= 0 { batchSize = 100 }

	items, err := s.repo.GetPendingItems(ctx, jobID, batchSize)
	if err != nil { return nil, fmt.Errorf("failed to get pending items: %w", err) }

	result := &BatchProcessResult{TotalProcessed: len(items)}
	for i := range items {
		processErr := s.processItem(ctx, job, &items[i])
		now := time.Now()
		items[i].ProcessedAt = &now
		if processErr != nil {
			items[i].RetryCount++
			if items[i].RetryCount >= job.MaxRetries {
				items[i].Status = "failed"; items[i].ErrorMessage = processErr.Error()
				result.Failed++
			} else {
				items[i].Status = "pending"
			}
		} else {
			items[i].Status = "completed"; result.Succeeded++
		}
		s.repo.UpdateItem(ctx, &items[i])
	}

	total, processed, failed, skipped, _ := s.repo.GetJobItemCounts(ctx, jobID)
	job.ProcessedItems = int(processed); job.FailedItems = int(failed); job.SkippedItems = int(skipped)
	if total > 0 { job.Progress = float64(processed+failed+skipped) / float64(total) * 100 }
	if processed+failed+skipped >= total && total > 0 {
		now := time.Now()
		job.Status = "completed"; job.CompletedAt = &now
		s.recordMetrics(ctx, job)
	}
	s.repo.UpdateJob(ctx, job)
	return result, nil
}

func (s *BatchService) processItem(ctx context.Context, job *models.BatchJob, item *models.BatchItem) error {
	switch job.JobType {
	case "premium_collection":
		item.OutputData = map[string]interface{}{"collected": true, "ref": fmt.Sprintf("PC-%d", time.Now().UnixNano()%10000)}
	case "policy_renewal":
		item.OutputData = map[string]interface{}{"renewed": true, "new_expiry": time.Now().AddDate(1, 0, 0).Format("2006-01-02")}
	case "claims_batch":
		item.OutputData = map[string]interface{}{"processed": true, "status": "assessed"}
	case "report_generation":
		item.OutputData = map[string]interface{}{"generated": true, "format": "pdf"}
	case "reconciliation":
		item.OutputData = map[string]interface{}{"reconciled": true, "matched": true}
	default:
		item.OutputData = map[string]interface{}{"processed": true}
	}
	return nil
}

func (s *BatchService) recordMetrics(ctx context.Context, job *models.BatchJob) {
	duration := int64(0)
	if job.StartedAt != nil && job.CompletedAt != nil {
		duration = int64(job.CompletedAt.Sub(*job.StartedAt).Seconds())
	}
	throughput := 0.0
	if duration > 0 { throughput = float64(job.ProcessedItems) / float64(duration) }
	successRate := 0.0
	if job.TotalItems > 0 { successRate = float64(job.ProcessedItems) / float64(job.TotalItems) * 100 }

	metrics := &models.BatchMetrics{
		JobID: job.ID, JobType: job.JobType, DurationSeconds: duration,
		ThroughputPerSec: throughput, SuccessRate: successRate,
		Period: time.Now().Format("2006-01"),
	}
	s.repo.CreateMetrics(ctx, metrics)
}

func (s *BatchService) CancelJob(ctx context.Context, jobID uuid.UUID) error {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil { return fmt.Errorf("job not found") }
	job.Status = "cancelled"
	return s.repo.UpdateJob(ctx, job)
}

func (s *BatchService) CreateSchedule(ctx context.Context, req CreateScheduleRequest) (*models.BatchSchedule, error) {
	schedule := &models.BatchSchedule{
		Name: req.Name, JobType: req.JobType, CronExpr: req.CronExpr,
		Description: req.Description, IsActive: true, Config: req.Config,
	}
	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}
	return schedule, nil
}

func (s *BatchService) GetJobs(ctx context.Context, jobType, status string) ([]models.BatchJob, error) {
	return s.repo.ListJobs(ctx, jobType, status)
}

func (s *BatchService) GetJob(ctx context.Context, id uuid.UUID) (*models.BatchJob, error) {
	return s.repo.GetJob(ctx, id)
}

func (s *BatchService) GetSchedules(ctx context.Context) ([]models.BatchSchedule, error) {
	return s.repo.ListSchedules(ctx)
}

func (s *BatchService) GetMetrics(ctx context.Context, jobType string) ([]models.BatchMetrics, error) {
	return s.repo.GetMetrics(ctx, jobType)
}

type BatchProcessResult struct {
	TotalProcessed int `json:"total_processed"`
	Succeeded      int `json:"succeeded"`
	Failed         int `json:"failed"`
}
