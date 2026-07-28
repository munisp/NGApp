package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"reconciliation-engine/internal/matching"
	"reconciliation-engine/internal/middleware"
	"reconciliation-engine/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedReconciliationService struct {
	db              *gorm.DB
	kafka           *middleware.KafkaClient
	temporal        *middleware.TemporalClient
	redis           *middleware.RedisClient
	tigerbeetle     *middleware.TigerBeetleClient
	lakehouse       *middleware.LakehouseClient
	fluvio          *middleware.FluvioClient
	dapr            *middleware.DaprClient
	keycloak        *middleware.KeycloakClient
	permify         *middleware.PermifyClient
	apisix          *middleware.APISIXClient
	openappsec      *middleware.OpenAppSecClient
	fuzzyMatcher    *matching.FuzzyMatcher
}

type EnhancedReconciliationConfig struct {
	KafkaBrokers       []string
	TemporalHost       string
	TemporalNamespace  string
	RedisAddr          string
	RedisPassword      string
	TigerBeetleCluster uint64
	TigerBeetleAddrs   []string
	SparkMaster        string
	DeltaTablePath     string
	FluvioEndpoint     string
	DaprPort           int
	KeycloakURL        string
	KeycloakRealm      string
	KeycloakClientID   string
	KeycloakSecret     string
	PermifyURL         string
	PermifyTenant      string
	APISIXAdminURL     string
	APISIXAPIKey       string
	OpenAppSecURL      string
	OpenAppSecAPIKey   string
}

func NewEnhancedReconciliationService(db *gorm.DB, config *EnhancedReconciliationConfig) (*EnhancedReconciliationService, error) {
	kafka, err := middleware.NewKafkaClient(config.KafkaBrokers, "reconciliation-consumer-group")
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka client: %w", err)
	}

	temporal, err := middleware.NewTemporalClient(config.TemporalHost, config.TemporalNamespace)
	if err != nil {
		return nil, fmt.Errorf("failed to create temporal client: %w", err)
	}

	redis, err := middleware.NewRedisClient(config.RedisAddr, config.RedisPassword, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to create redis client: %w", err)
	}

	tigerbeetle, err := middleware.NewTigerBeetleClient(config.TigerBeetleCluster, config.TigerBeetleAddrs)
	if err != nil {
		return nil, fmt.Errorf("failed to create tigerbeetle client: %w", err)
	}

	lakehouse, err := middleware.NewLakehouseClient(config.SparkMaster, config.DeltaTablePath, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create lakehouse client: %w", err)
	}

	fluvio, err := middleware.NewFluvioClient(config.FluvioEndpoint, "reconciliation-consumer")
	if err != nil {
		return nil, fmt.Errorf("failed to create fluvio client: %w", err)
	}

	dapr, err := middleware.NewDaprClient(config.DaprPort, "reconciliation-engine")
	if err != nil {
		return nil, fmt.Errorf("failed to create dapr client: %w", err)
	}

	keycloak, err := middleware.NewKeycloakClient(config.KeycloakURL, config.KeycloakRealm, config.KeycloakClientID, config.KeycloakSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to create keycloak client: %w", err)
	}

	permify, err := middleware.NewPermifyClient(config.PermifyURL, config.PermifyTenant)
	if err != nil {
		return nil, fmt.Errorf("failed to create permify client: %w", err)
	}

	apisix, err := middleware.NewAPISIXClient(config.APISIXAdminURL, config.APISIXAPIKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create apisix client: %w", err)
	}

	openappsec, err := middleware.NewOpenAppSecClient(config.OpenAppSecURL, config.OpenAppSecAPIKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create openappsec client: %w", err)
	}

	fuzzyMatcher := matching.NewFuzzyMatcher(nil)

	return &EnhancedReconciliationService{
		db:           db,
		kafka:        kafka,
		temporal:     temporal,
		redis:        redis,
		tigerbeetle:  tigerbeetle,
		lakehouse:    lakehouse,
		fluvio:       fluvio,
		dapr:         dapr,
		keycloak:     keycloak,
		permify:      permify,
		apisix:       apisix,
		openappsec:   openappsec,
		fuzzyMatcher: fuzzyMatcher,
	}, nil
}

func (s *EnhancedReconciliationService) CreateJob(ctx context.Context, job *models.ReconciliationJob, token string, userID string) error {
	canCreate, err := s.keycloak.CanCreateReconciliationJob(ctx, token)
	if err != nil || !canCreate {
		return fmt.Errorf("unauthorized to create reconciliation job")
	}

	canCreatePerm, err := s.permify.CanCreateReconciliationJob(ctx, userID, "default-org")
	if err != nil || !canCreatePerm {
		return fmt.Errorf("permission denied to create reconciliation job")
	}

	job.ID = uuid.New()
	job.Status = models.ReconciliationStatusPending
	job.CreatedBy = uuid.MustParse(userID)

	if err := s.db.WithContext(ctx).Create(job).Error; err != nil {
		return fmt.Errorf("failed to create job in database: %w", err)
	}

	if err := s.permify.AssignJobOwner(ctx, job.ID.String(), userID); err != nil {
		return fmt.Errorf("failed to assign job owner: %w", err)
	}

	cachedJob := &middleware.CachedReconciliationJob{
		ID:                 job.ID.String(),
		JobName:            job.JobName,
		ReconciliationType: job.ReconciliationType,
		Status:             string(job.Status),
	}
	if err := s.redis.CacheJob(ctx, cachedJob, 24*time.Hour); err != nil {
		return fmt.Errorf("failed to cache job: %w", err)
	}

	if err := s.kafka.PublishJobCreated(ctx, job.ID.String(), job.JobName, job.ReconciliationType); err != nil {
		return fmt.Errorf("failed to publish job created event: %w", err)
	}

	if err := s.dapr.LogAuditEvent(ctx, "CREATE", "reconciliation_job", job.ID.String(), map[string]interface{}{
		"job_name":            job.JobName,
		"reconciliation_type": job.ReconciliationType,
		"created_by":          userID,
	}); err != nil {
		return fmt.Errorf("failed to log audit event: %w", err)
	}

	return nil
}

func (s *EnhancedReconciliationService) StartJob(ctx context.Context, jobID uuid.UUID, token string, userID string) (string, error) {
	canRead, err := s.permify.CanReadReconciliationJob(ctx, userID, jobID.String())
	if err != nil || !canRead {
		return "", fmt.Errorf("permission denied to start reconciliation job")
	}

	job, err := s.GetJob(ctx, jobID)
	if err != nil {
		return "", fmt.Errorf("failed to get job: %w", err)
	}

	workflowInput := &middleware.ReconciliationWorkflowInput{
		JobID:              jobID.String(),
		JobName:            job.JobName,
		ReconciliationType: job.ReconciliationType,
		SourceSystem:       job.SourceSystem,
		TargetSystem:       job.TargetSystem,
		PeriodStart:        job.PeriodStart,
		PeriodEnd:          job.PeriodEnd,
	}

	workflowID, err := s.temporal.StartReconciliationWorkflow(ctx, workflowInput)
	if err != nil {
		return "", fmt.Errorf("failed to start temporal workflow: %w", err)
	}

	now := time.Now()
	if err := s.db.WithContext(ctx).Model(&models.ReconciliationJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":     models.ReconciliationStatusInProgress,
		"started_at": now,
	}).Error; err != nil {
		return "", fmt.Errorf("failed to update job status: %w", err)
	}

	if err := s.redis.InvalidateJobCache(ctx, jobID.String()); err != nil {
		return "", fmt.Errorf("failed to invalidate job cache: %w", err)
	}

	if err := s.kafka.PublishJobStarted(ctx, jobID.String()); err != nil {
		return "", fmt.Errorf("failed to publish job started event: %w", err)
	}

	if err := s.fluvio.ProduceEvent(ctx, middleware.TopicReconciliationStream, &middleware.ReconciliationStreamEvent{
		EventType: "JOB_STARTED",
		JobID:     jobID.String(),
		Timestamp: now,
	}); err != nil {
		return "", fmt.Errorf("failed to produce fluvio event: %w", err)
	}

	return workflowID, nil
}

func (s *EnhancedReconciliationService) CompleteJob(ctx context.Context, jobID uuid.UUID) error {
	var matched, unmatched int64
	var matchedAmount, totalVariance float64

	s.db.Model(&models.ReconciliationItem{}).Where("job_id = ? AND match_status = ?", jobID, models.MatchStatusMatched).Count(&matched)
	s.db.Model(&models.ReconciliationItem{}).Where("job_id = ? AND match_status = ?", jobID, models.MatchStatusUnmatched).Count(&unmatched)
	s.db.Model(&models.ReconciliationItem{}).Where("job_id = ? AND match_status = ?", jobID, models.MatchStatusMatched).Select("COALESCE(SUM(source_amount), 0)").Scan(&matchedAmount)
	s.db.Model(&models.ReconciliationItem{}).Where("job_id = ?", jobID).Select("COALESCE(SUM(ABS(variance)), 0)").Scan(&totalVariance)

	now := time.Now()
	if err := s.db.WithContext(ctx).Model(&models.ReconciliationJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":            models.ReconciliationStatusCompleted,
		"completed_at":      now,
		"matched_records":   matched,
		"unmatched_records": unmatched,
		"matched_amount":    matchedAmount,
		"variance":          totalVariance,
	}).Error; err != nil {
		return fmt.Errorf("failed to update job: %w", err)
	}

	if err := s.kafka.PublishJobCompleted(ctx, jobID.String(), int(matched), int(unmatched), totalVariance); err != nil {
		return fmt.Errorf("failed to publish job completed event: %w", err)
	}

	job, _ := s.GetJob(ctx, jobID)
	analytics := &middleware.ReconciliationAnalytics{
		JobID:              jobID.String(),
		ReconciliationType: job.ReconciliationType,
		PeriodStart:        job.PeriodStart,
		PeriodEnd:          job.PeriodEnd,
		TotalRecords:       int64(job.TotalRecords),
		MatchedRecords:     matched,
		UnmatchedRecords:   unmatched,
		TotalVariance:      totalVariance,
		MatchRate:          float64(matched) / float64(matched+unmatched) * 100,
	}
	if err := s.lakehouse.WriteReconciliationAnalytics(ctx, analytics); err != nil {
		return fmt.Errorf("failed to write analytics: %w", err)
	}

	summary, _ := s.tigerbeetle.GetReconciliationSummary(ctx, jobID.String())
	if summary != nil {
		if isBalanced, ok := summary["is_balanced"].(bool); ok && !isBalanced {
			if netVariance, ok := summary["net_variance"].(int64); ok {
				s.tigerbeetle.RecordVarianceEntry(ctx, jobID.String(), "FINAL", netVariance)
			}
		}
	}

	return nil
}

func (s *EnhancedReconciliationService) GetJob(ctx context.Context, jobID uuid.UUID) (*models.ReconciliationJob, error) {
	cachedJob, err := s.redis.GetCachedJob(ctx, jobID.String())
	if err == nil && cachedJob != nil {
		return &models.ReconciliationJob{
			ID:                 jobID,
			JobName:            cachedJob.JobName,
			ReconciliationType: cachedJob.ReconciliationType,
			Status:             models.ReconciliationStatus(cachedJob.Status),
			MatchedRecords:     cachedJob.MatchedRecords,
			UnmatchedRecords:   cachedJob.UnmatchedRecords,
			Variance:           cachedJob.TotalVariance,
		}, nil
	}

	var job models.ReconciliationJob
	if err := s.db.WithContext(ctx).First(&job, "id = ?", jobID).Error; err != nil {
		return nil, err
	}

	s.redis.CacheJob(ctx, &middleware.CachedReconciliationJob{
		ID:                 job.ID.String(),
		JobName:            job.JobName,
		ReconciliationType: job.ReconciliationType,
		Status:             string(job.Status),
		MatchedRecords:     job.MatchedRecords,
		UnmatchedRecords:   job.UnmatchedRecords,
		TotalVariance:      job.Variance,
	}, 1*time.Hour)

	return &job, nil
}

func (s *EnhancedReconciliationService) PerformFuzzyMatching(ctx context.Context, jobID uuid.UUID, sources []matching.SourceRecord, targets []matching.TargetRecord) (*matching.MatchingStats, error) {
	results, stats, err := s.fuzzyMatcher.MatchRecords(ctx, sources, targets)
	if err != nil {
		return nil, fmt.Errorf("failed to perform fuzzy matching: %w", err)
	}

	for _, result := range results {
		item := &models.ReconciliationItem{
			ID:              uuid.MustParse(result.ID),
			JobID:           jobID,
			SourceRef:       result.SourceID,
			TargetRef:       result.TargetID,
			MatchStatus:     models.MatchStatus(result.MatchStatus),
			MatchConfidence: result.ConfidenceScore,
			Variance:        result.AmountVariance,
		}

		if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
			continue
		}

		if result.MatchStatus == "MATCHED" {
			s.tigerbeetle.RecordMatchedTransaction(ctx, jobID.String(), result.SourceID, result.TargetID, uint64(math.Abs(result.AmountVariance)*100))
		}

		s.fluvio.ProduceEvent(ctx, middleware.TopicMatchingStream, &middleware.ReconciliationStreamEvent{
			EventType:   "MATCHING_RESULT",
			JobID:       jobID.String(),
			ItemID:      result.ID,
			SourceRef:   result.SourceID,
			TargetRef:   result.TargetID,
			MatchStatus: result.MatchStatus,
			Confidence:  result.ConfidenceScore,
			Variance:    result.AmountVariance,
			Timestamp:   time.Now(),
		})
	}

	return stats, nil
}

func (s *EnhancedReconciliationService) ResolveItem(ctx context.Context, itemID uuid.UUID, userID string, notes string, token string) error {
	canResolve, err := s.permify.CanResolveItem(ctx, userID, itemID.String())
	if err != nil || !canResolve {
		return fmt.Errorf("permission denied to resolve item")
	}

	now := time.Now()
	resolvedByUUID := uuid.MustParse(userID)

	if err := s.db.WithContext(ctx).Model(&models.ReconciliationItem{}).Where("id = ?", itemID).Updates(map[string]interface{}{
		"match_status": models.MatchStatusResolved,
		"resolved_by":  resolvedByUUID,
		"resolved_at":  now,
		"notes":        notes,
	}).Error; err != nil {
		return fmt.Errorf("failed to resolve item: %w", err)
	}

	s.kafka.PublishEvent(ctx, middleware.TopicReconciliationItemResolved, &middleware.ReconciliationEvent{
		EventType: "ITEM_RESOLVED",
		ItemID:    itemID.String(),
		Metadata: map[string]interface{}{
			"resolved_by": userID,
			"notes":       notes,
		},
	})

	s.dapr.LogAuditEvent(ctx, "RESOLVE", "reconciliation_item", itemID.String(), map[string]interface{}{
		"resolved_by": userID,
		"notes":       notes,
	})

	return nil
}

func (s *EnhancedReconciliationService) DisputeItem(ctx context.Context, itemID uuid.UUID, userID string, reason string, token string) error {
	canDispute, err := s.permify.CanDisputeItem(ctx, userID, itemID.String())
	if err != nil || !canDispute {
		return fmt.Errorf("permission denied to dispute item")
	}

	if err := s.db.WithContext(ctx).Model(&models.ReconciliationItem{}).Where("id = ?", itemID).Updates(map[string]interface{}{
		"match_status": models.MatchStatusDisputed,
		"notes":        reason,
	}).Error; err != nil {
		return fmt.Errorf("failed to dispute item: %w", err)
	}

	s.kafka.PublishEvent(ctx, middleware.TopicReconciliationItemDisputed, &middleware.ReconciliationEvent{
		EventType: "ITEM_DISPUTED",
		ItemID:    itemID.String(),
		Metadata: map[string]interface{}{
			"disputed_by": userID,
			"reason":      reason,
		},
	})

	return nil
}

func (s *EnhancedReconciliationService) UploadStatement(ctx context.Context, statement *models.BankStatement, userID string, token string) error {
	statement.ID = uuid.New()

	if err := s.db.WithContext(ctx).Create(statement).Error; err != nil {
		return fmt.Errorf("failed to create statement: %w", err)
	}

	workflowInput := &middleware.StatementProcessingInput{
		StatementID:   statement.ID.String(),
		BankCode:      statement.BankCode,
		AccountNumber: statement.AccountNumber,
	}

	if _, err := s.temporal.StartStatementProcessingWorkflow(ctx, workflowInput); err != nil {
		return fmt.Errorf("failed to start statement processing workflow: %w", err)
	}

	s.kafka.PublishEvent(ctx, middleware.TopicStatementUploaded, &middleware.ReconciliationEvent{
		EventType: "STATEMENT_UPLOADED",
		Metadata: map[string]interface{}{
			"statement_id":   statement.ID.String(),
			"bank_code":      statement.BankCode,
			"account_number": statement.AccountNumber,
			"uploaded_by":    userID,
		},
	})

	s.tigerbeetle.CreateBankReconciliationAccount(ctx, statement.BankCode, statement.AccountNumber)

	return nil
}

func (s *EnhancedReconciliationService) ScheduleReconciliation(ctx context.Context, scheduleID string, cronSchedule string, jobTemplate *models.ReconciliationJob) error {
	workflowInput := &middleware.ReconciliationWorkflowInput{
		JobName:            jobTemplate.JobName,
		ReconciliationType: jobTemplate.ReconciliationType,
		SourceSystem:       jobTemplate.SourceSystem,
		TargetSystem:       jobTemplate.TargetSystem,
	}

	return s.temporal.ScheduleReconciliation(ctx, scheduleID, cronSchedule, workflowInput)
}

func (s *EnhancedReconciliationService) GetReconciliationStats(ctx context.Context) (map[string]interface{}, error) {
	var totalJobs, completedJobs int64
	var totalMatched, totalUnmatched int64
	var totalVariance float64

	s.db.Model(&models.ReconciliationJob{}).Count(&totalJobs)
	s.db.Model(&models.ReconciliationJob{}).Where("status = ?", models.ReconciliationStatusCompleted).Count(&completedJobs)
	s.db.Model(&models.ReconciliationItem{}).Where("match_status = ?", models.MatchStatusMatched).Count(&totalMatched)
	s.db.Model(&models.ReconciliationItem{}).Where("match_status = ?", models.MatchStatusUnmatched).Count(&totalUnmatched)
	s.db.Model(&models.ReconciliationItem{}).Select("COALESCE(SUM(variance), 0)").Scan(&totalVariance)

	dashboardData, _ := s.lakehouse.GetReconciliationDashboardData(ctx)

	queueLength, _ := s.redis.GetQueueLength(ctx)
	processingCount, _ := s.redis.GetProcessingCount(ctx)
	activeAlerts, _ := s.redis.GetActiveAlerts(ctx)

	return map[string]interface{}{
		"total_jobs":       totalJobs,
		"completed_jobs":   completedJobs,
		"total_matched":    totalMatched,
		"total_unmatched":  totalUnmatched,
		"total_variance":   totalVariance,
		"match_rate":       float64(totalMatched) / float64(totalMatched+totalUnmatched) * 100,
		"queue_length":     queueLength,
		"processing_count": processingCount,
		"active_alerts":    activeAlerts,
		"dashboard":        dashboardData,
	}, nil
}

func (s *EnhancedReconciliationService) GetVarianceTrends(ctx context.Context, reconciliationType string, days int) ([]middleware.VarianceTrend, error) {
	return s.lakehouse.GetVarianceTrends(ctx, reconciliationType, days)
}

func (s *EnhancedReconciliationService) GetReconciliationPerformance(ctx context.Context, startDate, endDate time.Time) ([]middleware.ReconciliationPerformance, error) {
	return s.lakehouse.GetReconciliationPerformance(ctx, startDate, endDate)
}

func (s *EnhancedReconciliationService) GetBankReconciliationInsights(ctx context.Context, bankCode string) ([]middleware.BankReconciliationInsight, error) {
	return s.lakehouse.GetBankReconciliationInsights(ctx, bankCode)
}

func (s *EnhancedReconciliationService) StreamReconciliationProgress(ctx context.Context, jobID string) (<-chan *middleware.ReconciliationStreamEvent, error) {
	progress := make(chan *middleware.ReconciliationStreamEvent, 100)
	if err := s.fluvio.StreamReconciliationProgress(ctx, jobID, progress); err != nil {
		return nil, err
	}
	return progress, nil
}

func (s *EnhancedReconciliationService) GetSecurityMetrics(ctx context.Context, period string) (*middleware.SecurityMetrics, error) {
	return s.openappsec.GetSecurityMetrics(ctx, period)
}

func (s *EnhancedReconciliationService) SetupAPIRoutes(ctx context.Context) error {
	return s.apisix.SetupReconciliationRoutes(ctx)
}

func (s *EnhancedReconciliationService) SetupSecurityPolicy(ctx context.Context) error {
	return s.openappsec.SetupReconciliationSecurity(ctx)
}

func (s *EnhancedReconciliationService) ExportReconciliationData(ctx context.Context, jobID string, format string) ([]byte, error) {
	job, err := s.GetJob(ctx, uuid.MustParse(jobID))
	if err != nil {
		return nil, err
	}

	items, err := s.GetJobItems(ctx, uuid.MustParse(jobID), "")
	if err != nil {
		return nil, err
	}

	exportData := map[string]interface{}{
		"job":       job,
		"items":     items,
		"exported_at": time.Now(),
	}

	return json.Marshal(exportData)
}

func (s *EnhancedReconciliationService) GetJobItems(ctx context.Context, jobID uuid.UUID, status string) ([]models.ReconciliationItem, error) {
	var items []models.ReconciliationItem
	query := s.db.WithContext(ctx).Where("job_id = ?", jobID)
	if status != "" {
		query = query.Where("match_status = ?", status)
	}
	err := query.Find(&items).Error
	return items, err
}

func (s *EnhancedReconciliationService) Close() error {
	s.kafka.Close()
	s.temporal.Close()
	s.redis.Close()
	s.tigerbeetle.Close()
	s.lakehouse.Close()
	s.fluvio.Close()
	s.keycloak.Close()
	s.permify.Close()
	s.apisix.Close()
	s.openappsec.Close()
	return nil
}
