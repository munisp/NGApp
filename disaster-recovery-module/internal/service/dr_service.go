package service

import (
	"context"
	"disaster-recovery-module/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DRService struct {
	db *gorm.DB
}

func NewDRService(db *gorm.DB) *DRService {
	return &DRService{db: db}
}

func (s *DRService) CreateBackup(ctx context.Context, backup *models.Backup) error {
	backup.ID = uuid.New()
	backup.Status = models.BackupStatusPending
	expiresAt := time.Now().AddDate(0, 0, backup.RetentionDays)
	backup.ExpiresAt = &expiresAt
	return s.db.WithContext(ctx).Create(backup).Error
}

func (s *DRService) StartBackup(ctx context.Context, backupID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.Backup{}).Where("id = ?", backupID).Updates(map[string]interface{}{
		"status":     models.BackupStatusRunning,
		"started_at": now,
	}).Error
}

func (s *DRService) CompleteBackup(ctx context.Context, backupID uuid.UUID, sizeBytes int64, checksum string) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.Backup{}).Where("id = ?", backupID).Updates(map[string]interface{}{
		"status":       models.BackupStatusCompleted,
		"completed_at": now,
		"size_bytes":   sizeBytes,
		"checksum":     checksum,
	}).Error
}

func (s *DRService) FailBackup(ctx context.Context, backupID uuid.UUID, errorMessage string) error {
	return s.db.WithContext(ctx).Model(&models.Backup{}).Where("id = ?", backupID).Updates(map[string]interface{}{
		"status":        models.BackupStatusFailed,
		"error_message": errorMessage,
	}).Error
}

func (s *DRService) GetBackup(ctx context.Context, backupID uuid.UUID) (*models.Backup, error) {
	var backup models.Backup
	err := s.db.WithContext(ctx).First(&backup, "id = ?", backupID).Error
	return &backup, err
}

func (s *DRService) GetBackups(ctx context.Context, status string) ([]models.Backup, error) {
	var backups []models.Backup
	query := s.db.WithContext(ctx)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&backups).Error
	return backups, err
}

func (s *DRService) CreateSchedule(ctx context.Context, schedule *models.BackupSchedule) error {
	schedule.ID = uuid.New()
	return s.db.WithContext(ctx).Create(schedule).Error
}

func (s *DRService) GetSchedules(ctx context.Context) ([]models.BackupSchedule, error) {
	var schedules []models.BackupSchedule
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&schedules).Error
	return schedules, err
}

func (s *DRService) CreateFailoverConfig(ctx context.Context, config *models.FailoverConfig) error {
	config.ID = uuid.New()
	config.Status = models.FailoverStatusStandby
	return s.db.WithContext(ctx).Create(config).Error
}

func (s *DRService) GetFailoverConfigs(ctx context.Context) ([]models.FailoverConfig, error) {
	var configs []models.FailoverConfig
	err := s.db.WithContext(ctx).Find(&configs).Error
	return configs, err
}

func (s *DRService) TriggerFailover(ctx context.Context, configID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.FailoverConfig{}).Where("id = ?", configID).Updates(map[string]interface{}{
		"status":        models.FailoverStatusActive,
		"last_failover": now,
	}).Error
}

func (s *DRService) RecoverFromFailover(ctx context.Context, configID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&models.FailoverConfig{}).Where("id = ?", configID).Update("status", models.FailoverStatusStandby).Error
}

func (s *DRService) CreateRecoveryPoint(ctx context.Context, point *models.RecoveryPoint) error {
	point.ID = uuid.New()
	return s.db.WithContext(ctx).Create(point).Error
}

func (s *DRService) GetRecoveryPoints(ctx context.Context, backupID uuid.UUID) ([]models.RecoveryPoint, error) {
	var points []models.RecoveryPoint
	err := s.db.WithContext(ctx).Where("backup_id = ?", backupID).Order("point_in_time DESC").Find(&points).Error
	return points, err
}

func (s *DRService) GetDRStats(ctx context.Context) (map[string]interface{}, error) {
	var totalBackups, completedBackups, failedBackups int64
	var totalSize int64

	s.db.Model(&models.Backup{}).Count(&totalBackups)
	s.db.Model(&models.Backup{}).Where("status = ?", models.BackupStatusCompleted).Count(&completedBackups)
	s.db.Model(&models.Backup{}).Where("status = ?", models.BackupStatusFailed).Count(&failedBackups)
	s.db.Model(&models.Backup{}).Where("status = ?", models.BackupStatusCompleted).Select("COALESCE(SUM(size_bytes), 0)").Scan(&totalSize)

	return map[string]interface{}{
		"total_backups":      totalBackups,
		"completed_backups":  completedBackups,
		"failed_backups":     failedBackups,
		"total_storage_bytes": totalSize,
		"success_rate":       float64(completedBackups) / float64(totalBackups) * 100,
	}, nil
}
