package service

import (
	"audit-trail-system/internal/middleware"
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

type EnhancedAuditService struct {
	db         *gorm.DB
	middleware *middleware.MiddlewareClients
}

func NewEnhancedAuditService(db *gorm.DB, mw *middleware.MiddlewareClients) *EnhancedAuditService {
	return &EnhancedAuditService{db: db, middleware: mw}
}

func (s *EnhancedAuditService) LogAuditEvent(ctx context.Context, log *models.AuditLog) error {
	log.ID = uuid.New()
	log.Timestamp = time.Now()

	data, _ := json.Marshal(map[string]interface{}{
		"action":        log.Action,
		"entity_type":   log.EntityType,
		"entity_id":     log.EntityID,
		"user_id":       log.UserID,
		"timestamp":     log.Timestamp,
		"ip_address":    log.IPAddress,
		"user_agent":    log.UserAgent,
		"old_values":    log.OldValues,
		"new_values":    log.NewValues,
	})
	hash := sha256.Sum256(data)
	log.Checksum = hex.EncodeToString(hash[:])

	if err := s.db.WithContext(ctx).Create(log).Error; err != nil {
		return fmt.Errorf("failed to create audit log: %w", err)
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.AuditEvent{
			ID:           log.ID,
			EventType:    "AUDIT_LOG_CREATED",
			UserID:       log.UserID,
			Action:       log.Action,
			ResourceType: log.EntityType,
			ResourceID:   log.EntityID,
			Timestamp:    log.Timestamp,
			Metadata: map[string]interface{}{
				"ip_address": log.IPAddress,
				"checksum":   log.Checksum,
			},
		}
		go s.middleware.Kafka.PublishAuditEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		logData, _ := json.Marshal(log)
		go s.middleware.Redis.CacheAuditLog(context.Background(), log.ID, logData, 24*time.Hour)
		go s.middleware.Redis.IncrementEventCounter(context.Background(), log.Action)
	}

	return nil
}

func (s *EnhancedAuditService) GetAuditLog(ctx context.Context, id uuid.UUID) (*models.AuditLog, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedAuditLog(ctx, id); err == nil {
			var log models.AuditLog
			if json.Unmarshal(cached, &log) == nil {
				return &log, nil
			}
		}
	}

	var log models.AuditLog
	if err := s.db.WithContext(ctx).First(&log, "id = ?", id).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		logData, _ := json.Marshal(log)
		go s.middleware.Redis.CacheAuditLog(context.Background(), log.ID, logData, 24*time.Hour)
	}

	return &log, nil
}

func (s *EnhancedAuditService) GetAuditLogs(ctx context.Context, filter *models.AuditLogFilter) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := s.db.WithContext(ctx).Model(&models.AuditLog{})

	if filter.UserID != uuid.Nil {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.EntityType != "" {
		query = query.Where("entity_type = ?", filter.EntityType)
	}
	if filter.EntityID != "" {
		query = query.Where("entity_id = ?", filter.EntityID)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if !filter.StartDate.IsZero() {
		query = query.Where("timestamp >= ?", filter.StartDate)
	}
	if !filter.EndDate.IsZero() {
		query = query.Where("timestamp <= ?", filter.EndDate)
	}

	query.Count(&total)

	if filter.Limit > 0 {
		query = query.Limit(filter.Limit)
	}
	if filter.Offset > 0 {
		query = query.Offset(filter.Offset)
	}

	err := query.Order("timestamp DESC").Find(&logs).Error
	return logs, total, err
}

func (s *EnhancedAuditService) VerifyIntegrity(ctx context.Context, id uuid.UUID) (bool, error) {
	var log models.AuditLog
	if err := s.db.WithContext(ctx).First(&log, "id = ?", id).Error; err != nil {
		return false, err
	}

	data, _ := json.Marshal(map[string]interface{}{
		"action":        log.Action,
		"entity_type":   log.EntityType,
		"entity_id":     log.EntityID,
		"user_id":       log.UserID,
		"timestamp":     log.Timestamp,
		"ip_address":    log.IPAddress,
		"user_agent":    log.UserAgent,
		"old_values":    log.OldValues,
		"new_values":    log.NewValues,
	})
	hash := sha256.Sum256(data)
	calculatedChecksum := hex.EncodeToString(hash[:])

	return calculatedChecksum == log.Checksum, nil
}

func (s *EnhancedAuditService) BatchVerifyIntegrity(ctx context.Context, startDate, endDate time.Time) (*models.IntegrityReport, error) {
	if s.middleware != nil && s.middleware.Temporal != nil {
		batchID := uuid.New()
		runID, err := s.middleware.Temporal.StartIntegrityCheckWorkflow(ctx, batchID)
		if err != nil {
			return nil, err
		}
		return &models.IntegrityReport{
			ID:         batchID,
			WorkflowID: runID,
			Status:     "PROCESSING",
			StartedAt:  time.Now(),
		}, nil
	}

	var logs []models.AuditLog
	s.db.WithContext(ctx).Where("timestamp BETWEEN ? AND ?", startDate, endDate).Find(&logs)

	report := &models.IntegrityReport{
		ID:          uuid.New(),
		TotalLogs:   len(logs),
		ValidLogs:   0,
		InvalidLogs: 0,
		StartedAt:   time.Now(),
	}

	for _, log := range logs {
		valid, _ := s.VerifyIntegrity(ctx, log.ID)
		if valid {
			report.ValidLogs++
		} else {
			report.InvalidLogs++
			report.InvalidLogIDs = append(report.InvalidLogIDs, log.ID)
		}
	}

	report.CompletedAt = time.Now()
	report.Status = "COMPLETED"
	return report, nil
}

func (s *EnhancedAuditService) GenerateComplianceReport(ctx context.Context, params *models.ReportParams) (*models.ComplianceReport, error) {
	if s.middleware != nil && s.middleware.Temporal != nil {
		reportID := uuid.New()
		runID, err := s.middleware.Temporal.StartAuditReportWorkflow(ctx, reportID, map[string]interface{}{
			"start_date":  params.StartDate,
			"end_date":    params.EndDate,
			"report_type": params.ReportType,
		})
		if err != nil {
			return nil, err
		}
		return &models.ComplianceReport{
			ID:         reportID,
			WorkflowID: runID,
			Status:     "GENERATING",
			StartedAt:  time.Now(),
		}, nil
	}

	var logs []models.AuditLog
	s.db.WithContext(ctx).Where("timestamp BETWEEN ? AND ?", params.StartDate, params.EndDate).Find(&logs)

	report := &models.ComplianceReport{
		ID:         uuid.New(),
		ReportType: params.ReportType,
		StartDate:  params.StartDate,
		EndDate:    params.EndDate,
		TotalEvents: len(logs),
		Status:     "COMPLETED",
		GeneratedAt: time.Now(),
	}

	actionCounts := make(map[string]int)
	entityCounts := make(map[string]int)
	userCounts := make(map[string]int)

	for _, log := range logs {
		actionCounts[log.Action]++
		entityCounts[log.EntityType]++
		userCounts[log.UserID.String()]++
	}

	report.ActionBreakdown = actionCounts
	report.EntityBreakdown = entityCounts
	report.UniqueUsers = len(userCounts)

	return report, nil
}

func (s *EnhancedAuditService) ArchiveOldLogs(ctx context.Context, olderThan time.Time) (*models.ArchiveResult, error) {
	if s.middleware != nil && s.middleware.Temporal != nil {
		archiveID := uuid.New()
		runID, err := s.middleware.Temporal.StartArchiveWorkflow(ctx, archiveID, olderThan, time.Now())
		if err != nil {
			return nil, err
		}
		return &models.ArchiveResult{
			ID:         archiveID,
			WorkflowID: runID,
			Status:     "ARCHIVING",
			StartedAt:  time.Now(),
		}, nil
	}

	var count int64
	s.db.Model(&models.AuditLog{}).Where("timestamp < ?", olderThan).Count(&count)

	result := s.db.Where("timestamp < ?", olderThan).Delete(&models.AuditLog{})
	
	return &models.ArchiveResult{
		ID:           uuid.New(),
		ArchivedLogs: int(count),
		Status:       "COMPLETED",
		CompletedAt:  time.Now(),
	}, result.Error
}

func (s *EnhancedAuditService) GetAuditStats(ctx context.Context) (map[string]interface{}, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedAuditStats(ctx); err == nil {
			return cached, nil
		}
	}

	var totalLogs, todayLogs, criticalEvents int64
	var uniqueUsers int64

	s.db.Model(&models.AuditLog{}).Count(&totalLogs)
	s.db.Model(&models.AuditLog{}).Where("timestamp >= ?", time.Now().Truncate(24*time.Hour)).Count(&todayLogs)
	s.db.Model(&models.AuditLog{}).Where("action IN ?", []string{"DELETE", "SECURITY_ALERT", "UNAUTHORIZED_ACCESS"}).Count(&criticalEvents)
	s.db.Model(&models.AuditLog{}).Distinct("user_id").Count(&uniqueUsers)

	stats := map[string]interface{}{
		"total_logs":      totalLogs,
		"today_logs":      todayLogs,
		"critical_events": criticalEvents,
		"unique_users":    uniqueUsers,
		"generated_at":    time.Now(),
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		counters, _ := s.middleware.Redis.GetEventCounters(ctx)
		stats["event_counters"] = counters
		go s.middleware.Redis.CacheAuditStats(context.Background(), stats, 5*time.Minute)
	}

	return stats, nil
}

func (s *EnhancedAuditService) GetMiddlewareStatus(ctx context.Context) *middleware.MiddlewareStatus {
	if s.middleware == nil {
		return nil
	}
	return s.middleware.GetStatus(ctx)
}

func (s *EnhancedAuditService) SearchAuditLogs(ctx context.Context, query string, limit int) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	searchQuery := "%" + query + "%"
	err := s.db.WithContext(ctx).
		Where("action LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR CAST(old_values AS TEXT) LIKE ? OR CAST(new_values AS TEXT) LIKE ?",
			searchQuery, searchQuery, searchQuery, searchQuery, searchQuery).
		Limit(limit).
		Order("timestamp DESC").
		Find(&logs).Error
	return logs, err
}

func (s *EnhancedAuditService) GetUserActivityTimeline(ctx context.Context, userID uuid.UUID, days int) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	startDate := time.Now().AddDate(0, 0, -days)
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND timestamp >= ?", userID, startDate).
		Order("timestamp DESC").
		Find(&logs).Error
	return logs, err
}

func (s *EnhancedAuditService) GetEntityHistory(ctx context.Context, entityType, entityID string) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	err := s.db.WithContext(ctx).
		Where("entity_type = ? AND entity_id = ?", entityType, entityID).
		Order("timestamp DESC").
		Find(&logs).Error
	return logs, err
}
