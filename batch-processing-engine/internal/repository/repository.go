package repository

import (
	"batch-processing-engine/internal/models"
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BatchRepository struct{ db *gorm.DB }

func NewBatchRepository(db *gorm.DB) *BatchRepository { return &BatchRepository{db: db} }

func (r *BatchRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&models.BatchJob{}, &models.BatchItem{}, &models.BatchSchedule{}, &models.BatchMetrics{})
}

func (r *BatchRepository) CreateJob(ctx context.Context, j *models.BatchJob) error {
	j.ID = uuid.New(); j.CreatedAt = time.Now(); j.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(j).Error
}

func (r *BatchRepository) GetJob(ctx context.Context, id uuid.UUID) (*models.BatchJob, error) {
	var j models.BatchJob; return &j, r.db.WithContext(ctx).First(&j, "id = ?", id).Error
}

func (r *BatchRepository) ListJobs(ctx context.Context, jobType, status string) ([]models.BatchJob, error) {
	var jobs []models.BatchJob; q := r.db.WithContext(ctx)
	if jobType != "" { q = q.Where("job_type = ?", jobType) }
	if status != "" { q = q.Where("status = ?", status) }
	return jobs, q.Order("created_at DESC").Limit(50).Find(&jobs).Error
}

func (r *BatchRepository) UpdateJob(ctx context.Context, j *models.BatchJob) error {
	j.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(j).Error
}

func (r *BatchRepository) CreateItem(ctx context.Context, i *models.BatchItem) error {
	i.ID = uuid.New(); i.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(i).Error
}

func (r *BatchRepository) CreateItems(ctx context.Context, items []models.BatchItem) error {
	for i := range items { items[i].ID = uuid.New(); items[i].CreatedAt = time.Now() }
	return r.db.WithContext(ctx).Create(&items).Error
}

func (r *BatchRepository) GetPendingItems(ctx context.Context, jobID uuid.UUID, limit int) ([]models.BatchItem, error) {
	var items []models.BatchItem
	return items, r.db.WithContext(ctx).Where("job_id = ? AND status = ?", jobID, "pending").Limit(limit).Find(&items).Error
}

func (r *BatchRepository) UpdateItem(ctx context.Context, i *models.BatchItem) error {
	return r.db.WithContext(ctx).Save(i).Error
}

func (r *BatchRepository) GetJobItemCounts(ctx context.Context, jobID uuid.UUID) (total, processed, failed, skipped int64, err error) {
	r.db.WithContext(ctx).Model(&models.BatchItem{}).Where("job_id = ?", jobID).Count(&total)
	r.db.WithContext(ctx).Model(&models.BatchItem{}).Where("job_id = ? AND status = ?", jobID, "completed").Count(&processed)
	r.db.WithContext(ctx).Model(&models.BatchItem{}).Where("job_id = ? AND status = ?", jobID, "failed").Count(&failed)
	r.db.WithContext(ctx).Model(&models.BatchItem{}).Where("job_id = ? AND status = ?", jobID, "skipped").Count(&skipped)
	return
}

func (r *BatchRepository) CreateSchedule(ctx context.Context, s *models.BatchSchedule) error {
	s.ID = uuid.New(); s.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *BatchRepository) ListSchedules(ctx context.Context) ([]models.BatchSchedule, error) {
	var schedules []models.BatchSchedule
	return schedules, r.db.WithContext(ctx).Where("is_active = ?", true).Find(&schedules).Error
}

func (r *BatchRepository) UpdateSchedule(ctx context.Context, s *models.BatchSchedule) error {
	return r.db.WithContext(ctx).Save(s).Error
}

func (r *BatchRepository) CreateMetrics(ctx context.Context, m *models.BatchMetrics) error {
	m.ID = uuid.New(); m.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *BatchRepository) GetMetrics(ctx context.Context, jobType string) ([]models.BatchMetrics, error) {
	var metrics []models.BatchMetrics; q := r.db.WithContext(ctx)
	if jobType != "" { q = q.Where("job_type = ?", jobType) }
	return metrics, q.Order("created_at DESC").Limit(50).Find(&metrics).Error
}
