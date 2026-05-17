package service

import (
	"audit-trail-system/internal/models"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditService struct {
	db *gorm.DB
}

func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

func (s *AuditService) LogAuditEvent(ctx context.Context, event *models.AuditLog) error {
	event.ID = uuid.New()
	event.Timestamp = time.Now()
	event.Checksum = s.calculateChecksum(event)

	if err := s.db.WithContext(ctx).Create(event).Error; err != nil {
		return fmt.Errorf("failed to log audit event: %w", err)
	}
	return nil
}

func (s *AuditService) calculateChecksum(event *models.AuditLog) string {
	data := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%v",
		event.UserID.String(),
		event.Action,
		event.ResourceType,
		event.ResourceID,
		event.Timestamp.Format(time.RFC3339),
		event.Description,
		event.IsSuccessful,
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *AuditService) GetAuditLogs(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := s.db.WithContext(ctx).Model(&models.AuditLog{})

	if userID, ok := filters["user_id"]; ok {
		query = query.Where("user_id = ?", userID)
	}
	if action, ok := filters["action"]; ok {
		query = query.Where("action = ?", action)
	}
	if resourceType, ok := filters["resource_type"]; ok {
		query = query.Where("resource_type = ?", resourceType)
	}
	if startDate, ok := filters["start_date"]; ok {
		query = query.Where("timestamp >= ?", startDate)
	}
	if endDate, ok := filters["end_date"]; ok {
		query = query.Where("timestamp <= ?", endDate)
	}

	query.Count(&total)

	if err := query.Order("timestamp DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get audit logs: %w", err)
	}

	return logs, total, nil
}

func (s *AuditService) GetAuditLogByID(ctx context.Context, id uuid.UUID) (*models.AuditLog, error) {
	var log models.AuditLog
	if err := s.db.WithContext(ctx).First(&log, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("audit log not found: %w", err)
	}
	return &log, nil
}

func (s *AuditService) GenerateAuditReport(ctx context.Context, startDate, endDate time.Time, generatedBy uuid.UUID) (*models.AuditReport, error) {
	var count int64
	s.db.Model(&models.AuditLog{}).Where("timestamp BETWEEN ? AND ?", startDate, endDate).Count(&count)

	report := &models.AuditReport{
		ID:          uuid.New(),
		ReportType:  "compliance_audit",
		StartDate:   startDate,
		EndDate:     endDate,
		GeneratedBy: generatedBy,
		FilePath:    fmt.Sprintf("/reports/audit_%s.pdf", time.Now().Format("20060102_150405")),
		RecordCount: int(count),
		Status:      "completed",
	}

	if err := s.db.WithContext(ctx).Create(report).Error; err != nil {
		return nil, fmt.Errorf("failed to create audit report: %w", err)
	}

	return report, nil
}

func (s *AuditService) VerifyIntegrity(ctx context.Context, id uuid.UUID) (bool, error) {
	log, err := s.GetAuditLogByID(ctx, id)
	if err != nil {
		return false, err
	}

	calculatedChecksum := s.calculateChecksum(log)
	return calculatedChecksum == log.Checksum, nil
}

func (s *AuditService) ExportAuditLogs(ctx context.Context, filters map[string]interface{}) ([]byte, error) {
	logs, _, err := s.GetAuditLogs(ctx, filters, 10000, 0)
	if err != nil {
		return nil, err
	}

	data, err := json.Marshal(logs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal audit logs: %w", err)
	}

	return data, nil
}

func (s *AuditService) GetAuditStats(ctx context.Context, days int) (map[string]interface{}, error) {
	startDate := time.Now().AddDate(0, 0, -days)

	var totalEvents, successfulEvents, failedEvents int64
	var actionCounts []struct {
		Action string
		Count  int64
	}

	s.db.Model(&models.AuditLog{}).Where("timestamp >= ?", startDate).Count(&totalEvents)
	s.db.Model(&models.AuditLog{}).Where("timestamp >= ? AND is_successful = ?", startDate, true).Count(&successfulEvents)
	s.db.Model(&models.AuditLog{}).Where("timestamp >= ? AND is_successful = ?", startDate, false).Count(&failedEvents)

	s.db.Model(&models.AuditLog{}).
		Select("action, count(*) as count").
		Where("timestamp >= ?", startDate).
		Group("action").
		Scan(&actionCounts)

	actionMap := make(map[string]int64)
	for _, ac := range actionCounts {
		actionMap[ac.Action] = ac.Count
	}

	return map[string]interface{}{
		"total_events":      totalEvents,
		"successful_events": successfulEvents,
		"failed_events":     failedEvents,
		"action_breakdown":  actionMap,
		"period_days":       days,
	}, nil
}
