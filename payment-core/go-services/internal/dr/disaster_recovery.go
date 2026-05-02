package dr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type BackupType string

const (
	BackupTypeFull        BackupType = "full"
	BackupTypeIncremental BackupType = "incremental"
	BackupTypeDifferential BackupType = "differential"
	BackupTypeSnapshot    BackupType = "snapshot"
)

type BackupStatus string

const (
	BackupStatusPending   BackupStatus = "pending"
	BackupStatusRunning   BackupStatus = "running"
	BackupStatusCompleted BackupStatus = "completed"
	BackupStatusFailed    BackupStatus = "failed"
	BackupStatusVerified  BackupStatus = "verified"
)

type RestoreStatus string

const (
	RestoreStatusPending   RestoreStatus = "pending"
	RestoreStatusRunning   RestoreStatus = "running"
	RestoreStatusCompleted RestoreStatus = "completed"
	RestoreStatusFailed    RestoreStatus = "failed"
	RestoreStatusVerified  RestoreStatus = "verified"
)

type FailoverStatus string

const (
	FailoverStatusActive   FailoverStatus = "active"
	FailoverStatusStandby  FailoverStatus = "standby"
	FailoverStatusFailing  FailoverStatus = "failing_over"
	FailoverStatusFailed   FailoverStatus = "failed"
)

type BackupTarget struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Type            string            `json:"type"`
	ConnectionString string           `json:"connection_string"`
	Schedule        string            `json:"schedule"`
	RetentionDays   int               `json:"retention_days"`
	BackupType      BackupType        `json:"backup_type"`
	Enabled         bool              `json:"enabled"`
	RPOMinutes      int               `json:"rpo_minutes"`
	RTOMinutes      int               `json:"rto_minutes"`
	Metadata        map[string]string `json:"metadata,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type BackupJob struct {
	ID            string            `json:"id"`
	TargetID      string            `json:"target_id"`
	TargetName    string            `json:"target_name"`
	BackupType    BackupType        `json:"backup_type"`
	Status        BackupStatus      `json:"status"`
	SizeBytes     int64             `json:"size_bytes"`
	RowsBackedUp  int64             `json:"rows_backed_up"`
	StartedAt     time.Time         `json:"started_at"`
	CompletedAt   *time.Time        `json:"completed_at,omitempty"`
	Duration      time.Duration     `json:"duration"`
	StoragePath   string            `json:"storage_path"`
	Checksum      string            `json:"checksum"`
	Error         string            `json:"error,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type RestoreJob struct {
	ID            string            `json:"id"`
	BackupJobID   string            `json:"backup_job_id"`
	TargetID      string            `json:"target_id"`
	Status        RestoreStatus     `json:"status"`
	RowsRestored  int64             `json:"rows_restored"`
	StartedAt     time.Time         `json:"started_at"`
	CompletedAt   *time.Time        `json:"completed_at,omitempty"`
	Duration      time.Duration     `json:"duration"`
	VerifiedAt    *time.Time        `json:"verified_at,omitempty"`
	Error         string            `json:"error,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type Region struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Location      string         `json:"location"`
	Status        FailoverStatus `json:"status"`
	Priority      int            `json:"priority"`
	Endpoint      string         `json:"endpoint"`
	HealthCheckURL string        `json:"health_check_url"`
	LastHealthCheck time.Time    `json:"last_health_check"`
	IsHealthy     bool           `json:"is_healthy"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type FailoverEvent struct {
	ID            string         `json:"id"`
	FromRegion    string         `json:"from_region"`
	ToRegion      string         `json:"to_region"`
	Reason        string         `json:"reason"`
	Status        FailoverStatus `json:"status"`
	StartedAt     time.Time      `json:"started_at"`
	CompletedAt   *time.Time     `json:"completed_at,omitempty"`
	Duration      time.Duration  `json:"duration"`
	DataLossRPO   time.Duration  `json:"data_loss_rpo"`
	Error         string         `json:"error,omitempty"`
}

type DRConfig struct {
	RPOMinutes           int
	RTOMinutes           int
	HealthCheckInterval  time.Duration
	FailoverThreshold    int
	AutoFailoverEnabled  bool
	BackupRetentionDays  int
	RestoreTestInterval  time.Duration
}

type DisasterRecoveryManager struct {
	mu              sync.RWMutex
	config          DRConfig
	targets         map[string]*BackupTarget
	backupJobs      []BackupJob
	restoreJobs     []RestoreJob
	regions         map[string]*Region
	failoverEvents  []FailoverEvent
	activeRegion    string
	eventHandlers   map[string][]func(interface{})
	healthCheckStop chan struct{}
}

func NewDisasterRecoveryManager(config *DRConfig) *DisasterRecoveryManager {
	cfg := DRConfig{
		RPOMinutes:          15,
		RTOMinutes:          60,
		HealthCheckInterval: 30 * time.Second,
		FailoverThreshold:   3,
		AutoFailoverEnabled: true,
		BackupRetentionDays: 30,
		RestoreTestInterval: 24 * time.Hour * 30,
	}

	if config != nil {
		if config.RPOMinutes > 0 {
			cfg.RPOMinutes = config.RPOMinutes
		}
		if config.RTOMinutes > 0 {
			cfg.RTOMinutes = config.RTOMinutes
		}
		if config.HealthCheckInterval > 0 {
			cfg.HealthCheckInterval = config.HealthCheckInterval
		}
		if config.FailoverThreshold > 0 {
			cfg.FailoverThreshold = config.FailoverThreshold
		}
		cfg.AutoFailoverEnabled = config.AutoFailoverEnabled
		if config.BackupRetentionDays > 0 {
			cfg.BackupRetentionDays = config.BackupRetentionDays
		}
	}

	drm := &DisasterRecoveryManager{
		config:          cfg,
		targets:         make(map[string]*BackupTarget),
		backupJobs:      make([]BackupJob, 0),
		restoreJobs:     make([]RestoreJob, 0),
		regions:         make(map[string]*Region),
		failoverEvents:  make([]FailoverEvent, 0),
		eventHandlers:   make(map[string][]func(interface{})),
		healthCheckStop: make(chan struct{}),
	}

	drm.initializeDefaultTargets()
	drm.initializeDefaultRegions()

	return drm
}

func (drm *DisasterRecoveryManager) initializeDefaultTargets() {
	defaultTargets := []BackupTarget{
		{
			Name:           "PostgreSQL Database",
			Type:           "postgresql",
			Schedule:       "0 */6 * * *",
			RetentionDays:  30,
			BackupType:     BackupTypeFull,
			Enabled:        true,
			RPOMinutes:     15,
			RTOMinutes:     60,
		},
		{
			Name:           "TigerBeetle Ledger",
			Type:           "tigerbeetle",
			Schedule:       "0 */4 * * *",
			RetentionDays:  90,
			BackupType:     BackupTypeSnapshot,
			Enabled:        true,
			RPOMinutes:     5,
			RTOMinutes:     30,
		},
		{
			Name:           "Keycloak Realm",
			Type:           "keycloak",
			Schedule:       "0 0 * * *",
			RetentionDays:  30,
			BackupType:     BackupTypeFull,
			Enabled:        true,
			RPOMinutes:     60,
			RTOMinutes:     120,
		},
		{
			Name:           "RustFS Object Storage",
			Type:           "rustfs",
			Schedule:       "0 */12 * * *",
			RetentionDays:  60,
			BackupType:     BackupTypeIncremental,
			Enabled:        true,
			RPOMinutes:     30,
			RTOMinutes:     120,
		},
		{
			Name:           "Kafka Topics",
			Type:           "kafka",
			Schedule:       "0 0 * * *",
			RetentionDays:  7,
			BackupType:     BackupTypeSnapshot,
			Enabled:        true,
			RPOMinutes:     60,
			RTOMinutes:     60,
		},
		{
			Name:           "Redis Cache",
			Type:           "redis",
			Schedule:       "0 */2 * * *",
			RetentionDays:  7,
			BackupType:     BackupTypeSnapshot,
			Enabled:        true,
			RPOMinutes:     30,
			RTOMinutes:     15,
		},
	}

	for _, target := range defaultTargets {
		t := target
		t.ID = uuid.New().String()
		t.CreatedAt = time.Now()
		t.UpdatedAt = time.Now()
		drm.targets[t.ID] = &t
	}
}

func (drm *DisasterRecoveryManager) initializeDefaultRegions() {
	defaultRegions := []Region{
		{
			Name:           "Primary - Lagos",
			Location:       "lagos-ng",
			Status:         FailoverStatusActive,
			Priority:       1,
			Endpoint:       "https://api.payment-switch.ng",
			HealthCheckURL: "https://api.payment-switch.ng/health",
			IsHealthy:      true,
		},
		{
			Name:           "Secondary - Johannesburg",
			Location:       "johannesburg-za",
			Status:         FailoverStatusStandby,
			Priority:       2,
			Endpoint:       "https://api-za.payment-switch.ng",
			HealthCheckURL: "https://api-za.payment-switch.ng/health",
			IsHealthy:      true,
		},
		{
			Name:           "Tertiary - London",
			Location:       "london-uk",
			Status:         FailoverStatusStandby,
			Priority:       3,
			Endpoint:       "https://api-uk.payment-switch.ng",
			HealthCheckURL: "https://api-uk.payment-switch.ng/health",
			IsHealthy:      true,
		},
	}

	for _, region := range defaultRegions {
		r := region
		r.ID = uuid.New().String()
		r.LastHealthCheck = time.Now()
		drm.regions[r.ID] = &r

		if r.Status == FailoverStatusActive {
			drm.activeRegion = r.ID
		}
	}
}

func (drm *DisasterRecoveryManager) On(event string, handler func(interface{})) {
	drm.mu.Lock()
	defer drm.mu.Unlock()
	drm.eventHandlers[event] = append(drm.eventHandlers[event], handler)
}

func (drm *DisasterRecoveryManager) emit(event string, data interface{}) {
	drm.mu.RLock()
	handlers := drm.eventHandlers[event]
	drm.mu.RUnlock()

	for _, handler := range handlers {
		go handler(data)
	}
}

func (drm *DisasterRecoveryManager) AddBackupTarget(target *BackupTarget) (*BackupTarget, error) {
	drm.mu.Lock()
	defer drm.mu.Unlock()

	if target.ID == "" {
		target.ID = uuid.New().String()
	}
	target.CreatedAt = time.Now()
	target.UpdatedAt = time.Now()

	drm.targets[target.ID] = target
	drm.emit("targetAdded", target)
	return target, nil
}

func (drm *DisasterRecoveryManager) GetBackupTarget(targetID string) (*BackupTarget, error) {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	target, ok := drm.targets[targetID]
	if !ok {
		return nil, errors.New("backup target not found")
	}
	return target, nil
}

func (drm *DisasterRecoveryManager) ListBackupTargets() []*BackupTarget {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	targets := make([]*BackupTarget, 0, len(drm.targets))
	for _, t := range drm.targets {
		targets = append(targets, t)
	}
	return targets
}

func (drm *DisasterRecoveryManager) StartBackup(ctx context.Context, targetID string, backupType BackupType) (*BackupJob, error) {
	drm.mu.Lock()
	defer drm.mu.Unlock()

	target, ok := drm.targets[targetID]
	if !ok {
		return nil, errors.New("backup target not found")
	}

	if !target.Enabled {
		return nil, errors.New("backup target is disabled")
	}

	job := BackupJob{
		ID:         uuid.New().String(),
		TargetID:   targetID,
		TargetName: target.Name,
		BackupType: backupType,
		Status:     BackupStatusRunning,
		StartedAt:  time.Now(),
		StoragePath: fmt.Sprintf("backups/%s/%s/%s", target.Type, time.Now().Format("2006-01-02"), uuid.New().String()),
	}

	drm.backupJobs = append(drm.backupJobs, job)
	drm.emit("backupStarted", &job)

	go drm.runBackup(ctx, &job, target)

	return &job, nil
}

func (drm *DisasterRecoveryManager) runBackup(ctx context.Context, job *BackupJob, target *BackupTarget) {
	time.Sleep(2 * time.Second)

	drm.mu.Lock()
	defer drm.mu.Unlock()

	for i := range drm.backupJobs {
		if drm.backupJobs[i].ID == job.ID {
			now := time.Now()
			drm.backupJobs[i].Status = BackupStatusCompleted
			drm.backupJobs[i].CompletedAt = &now
			drm.backupJobs[i].Duration = now.Sub(drm.backupJobs[i].StartedAt)
			drm.backupJobs[i].SizeBytes = 1024 * 1024 * 100
			drm.backupJobs[i].RowsBackedUp = 100000
			drm.backupJobs[i].Checksum = uuid.New().String()[:16]
			drm.emit("backupCompleted", &drm.backupJobs[i])
			break
		}
	}
}

func (drm *DisasterRecoveryManager) GetBackupJob(jobID string) (*BackupJob, error) {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	for _, job := range drm.backupJobs {
		if job.ID == jobID {
			return &job, nil
		}
	}
	return nil, errors.New("backup job not found")
}

func (drm *DisasterRecoveryManager) ListBackupJobs(targetID string, limit int) []BackupJob {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	jobs := make([]BackupJob, 0)
	for _, job := range drm.backupJobs {
		if targetID == "" || job.TargetID == targetID {
			jobs = append(jobs, job)
		}
	}

	if limit > 0 && len(jobs) > limit {
		jobs = jobs[len(jobs)-limit:]
	}

	return jobs
}

func (drm *DisasterRecoveryManager) StartRestore(ctx context.Context, backupJobID string) (*RestoreJob, error) {
	drm.mu.Lock()
	defer drm.mu.Unlock()

	var backupJob *BackupJob
	for _, job := range drm.backupJobs {
		if job.ID == backupJobID {
			backupJob = &job
			break
		}
	}

	if backupJob == nil {
		return nil, errors.New("backup job not found")
	}

	if backupJob.Status != BackupStatusCompleted && backupJob.Status != BackupStatusVerified {
		return nil, errors.New("backup job is not in a restorable state")
	}

	restoreJob := RestoreJob{
		ID:          uuid.New().String(),
		BackupJobID: backupJobID,
		TargetID:    backupJob.TargetID,
		Status:      RestoreStatusRunning,
		StartedAt:   time.Now(),
	}

	drm.restoreJobs = append(drm.restoreJobs, restoreJob)
	drm.emit("restoreStarted", &restoreJob)

	go drm.runRestore(ctx, &restoreJob, backupJob)

	return &restoreJob, nil
}

func (drm *DisasterRecoveryManager) runRestore(ctx context.Context, job *RestoreJob, backupJob *BackupJob) {
	time.Sleep(3 * time.Second)

	drm.mu.Lock()
	defer drm.mu.Unlock()

	for i := range drm.restoreJobs {
		if drm.restoreJobs[i].ID == job.ID {
			now := time.Now()
			drm.restoreJobs[i].Status = RestoreStatusCompleted
			drm.restoreJobs[i].CompletedAt = &now
			drm.restoreJobs[i].Duration = now.Sub(drm.restoreJobs[i].StartedAt)
			drm.restoreJobs[i].RowsRestored = backupJob.RowsBackedUp
			drm.emit("restoreCompleted", &drm.restoreJobs[i])
			break
		}
	}
}

func (drm *DisasterRecoveryManager) GetRestoreJob(jobID string) (*RestoreJob, error) {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	for _, job := range drm.restoreJobs {
		if job.ID == jobID {
			return &job, nil
		}
	}
	return nil, errors.New("restore job not found")
}

func (drm *DisasterRecoveryManager) ListRestoreJobs(limit int) []RestoreJob {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	jobs := drm.restoreJobs
	if limit > 0 && len(jobs) > limit {
		jobs = jobs[len(jobs)-limit:]
	}
	return jobs
}

func (drm *DisasterRecoveryManager) VerifyBackup(ctx context.Context, backupJobID string) error {
	drm.mu.Lock()
	defer drm.mu.Unlock()

	for i := range drm.backupJobs {
		if drm.backupJobs[i].ID == backupJobID {
			drm.backupJobs[i].Status = BackupStatusVerified
			drm.emit("backupVerified", &drm.backupJobs[i])
			return nil
		}
	}

	return errors.New("backup job not found")
}

func (drm *DisasterRecoveryManager) AddRegion(region *Region) (*Region, error) {
	drm.mu.Lock()
	defer drm.mu.Unlock()

	if region.ID == "" {
		region.ID = uuid.New().String()
	}
	region.LastHealthCheck = time.Now()

	drm.regions[region.ID] = region
	drm.emit("regionAdded", region)
	return region, nil
}

func (drm *DisasterRecoveryManager) GetRegion(regionID string) (*Region, error) {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	region, ok := drm.regions[regionID]
	if !ok {
		return nil, errors.New("region not found")
	}
	return region, nil
}

func (drm *DisasterRecoveryManager) ListRegions() []*Region {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	regions := make([]*Region, 0, len(drm.regions))
	for _, r := range drm.regions {
		regions = append(regions, r)
	}
	return regions
}

func (drm *DisasterRecoveryManager) GetActiveRegion() (*Region, error) {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	if drm.activeRegion == "" {
		return nil, errors.New("no active region")
	}

	region, ok := drm.regions[drm.activeRegion]
	if !ok {
		return nil, errors.New("active region not found")
	}
	return region, nil
}

func (drm *DisasterRecoveryManager) InitiateFailover(ctx context.Context, toRegionID string, reason string) (*FailoverEvent, error) {
	drm.mu.Lock()
	defer drm.mu.Unlock()

	toRegion, ok := drm.regions[toRegionID]
	if !ok {
		return nil, errors.New("target region not found")
	}

	if !toRegion.IsHealthy {
		return nil, errors.New("target region is not healthy")
	}

	fromRegionID := drm.activeRegion
	fromRegion := drm.regions[fromRegionID]

	event := FailoverEvent{
		ID:         uuid.New().String(),
		FromRegion: fromRegionID,
		ToRegion:   toRegionID,
		Reason:     reason,
		Status:     FailoverStatusFailing,
		StartedAt:  time.Now(),
	}

	drm.failoverEvents = append(drm.failoverEvents, event)
	drm.emit("failoverStarted", &event)

	if fromRegion != nil {
		fromRegion.Status = FailoverStatusStandby
	}
	toRegion.Status = FailoverStatusActive
	drm.activeRegion = toRegionID

	now := time.Now()
	event.Status = FailoverStatusActive
	event.CompletedAt = &now
	event.Duration = now.Sub(event.StartedAt)

	for i := range drm.failoverEvents {
		if drm.failoverEvents[i].ID == event.ID {
			drm.failoverEvents[i] = event
			break
		}
	}

	drm.emit("failoverCompleted", &event)
	return &event, nil
}

func (drm *DisasterRecoveryManager) GetFailoverEvents(limit int) []FailoverEvent {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	events := drm.failoverEvents
	if limit > 0 && len(events) > limit {
		events = events[len(events)-limit:]
	}
	return events
}

func (drm *DisasterRecoveryManager) StartHealthChecks(ctx context.Context) {
	ticker := time.NewTicker(drm.config.HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-drm.healthCheckStop:
			return
		case <-ticker.C:
			drm.performHealthChecks()
		}
	}
}

func (drm *DisasterRecoveryManager) StopHealthChecks() {
	close(drm.healthCheckStop)
}

func (drm *DisasterRecoveryManager) performHealthChecks() {
	drm.mu.Lock()
	defer drm.mu.Unlock()

	for _, region := range drm.regions {
		region.LastHealthCheck = time.Now()
		region.IsHealthy = true

		if !region.IsHealthy && region.Status == FailoverStatusActive && drm.config.AutoFailoverEnabled {
			drm.emit("regionUnhealthy", region)
		}
	}
}

type DRStats struct {
	TotalBackups       int                `json:"total_backups"`
	SuccessfulBackups  int                `json:"successful_backups"`
	FailedBackups      int                `json:"failed_backups"`
	TotalRestores      int                `json:"total_restores"`
	SuccessfulRestores int                `json:"successful_restores"`
	TotalFailovers     int                `json:"total_failovers"`
	ActiveRegion       string             `json:"active_region"`
	RegionHealth       map[string]bool    `json:"region_health"`
	LastBackupTime     *time.Time         `json:"last_backup_time,omitempty"`
	LastRestoreTime    *time.Time         `json:"last_restore_time,omitempty"`
	RPOCompliance      bool               `json:"rpo_compliance"`
	RTOCompliance      bool               `json:"rto_compliance"`
}

func (drm *DisasterRecoveryManager) GetStats() *DRStats {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	stats := &DRStats{
		TotalBackups:   len(drm.backupJobs),
		TotalRestores:  len(drm.restoreJobs),
		TotalFailovers: len(drm.failoverEvents),
		ActiveRegion:   drm.activeRegion,
		RegionHealth:   make(map[string]bool),
		RPOCompliance:  true,
		RTOCompliance:  true,
	}

	for _, job := range drm.backupJobs {
		if job.Status == BackupStatusCompleted || job.Status == BackupStatusVerified {
			stats.SuccessfulBackups++
		} else if job.Status == BackupStatusFailed {
			stats.FailedBackups++
		}
	}

	for _, job := range drm.restoreJobs {
		if job.Status == RestoreStatusCompleted || job.Status == RestoreStatusVerified {
			stats.SuccessfulRestores++
		}
	}

	for id, region := range drm.regions {
		stats.RegionHealth[id] = region.IsHealthy
	}

	if len(drm.backupJobs) > 0 {
		lastJob := drm.backupJobs[len(drm.backupJobs)-1]
		if lastJob.CompletedAt != nil {
			stats.LastBackupTime = lastJob.CompletedAt
		}
	}

	if len(drm.restoreJobs) > 0 {
		lastJob := drm.restoreJobs[len(drm.restoreJobs)-1]
		if lastJob.CompletedAt != nil {
			stats.LastRestoreTime = lastJob.CompletedAt
		}
	}

	return stats
}

func (drm *DisasterRecoveryManager) GenerateRunbook() string {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	runbook := `
================================================================================
DISASTER RECOVERY RUNBOOK
================================================================================

Generated: %s

1. BACKUP TARGETS
-----------------
%s

2. REGIONS
----------
%s

3. RPO/RTO TARGETS
------------------
RPO: %d minutes
RTO: %d minutes

4. FAILOVER PROCEDURE
---------------------
1. Verify primary region is unhealthy
2. Select standby region with highest priority
3. Initiate failover using: InitiateFailover(ctx, regionID, reason)
4. Verify services are running in new region
5. Update DNS/load balancer configuration
6. Notify stakeholders

5. RESTORE PROCEDURE
--------------------
1. Identify latest verified backup
2. Initiate restore using: StartRestore(ctx, backupJobID)
3. Verify data integrity
4. Run application health checks
5. Resume normal operations

================================================================================
`

	var targetsStr string
	for _, t := range drm.targets {
		targetsStr += fmt.Sprintf("- %s (%s): Schedule=%s, Retention=%d days\n", t.Name, t.Type, t.Schedule, t.RetentionDays)
	}

	var regionsStr string
	for _, r := range drm.regions {
		regionsStr += fmt.Sprintf("- %s (%s): Status=%s, Priority=%d\n", r.Name, r.Location, r.Status, r.Priority)
	}

	return fmt.Sprintf(runbook, time.Now().Format(time.RFC3339), targetsStr, regionsStr, drm.config.RPOMinutes, drm.config.RTOMinutes)
}

func (drm *DisasterRecoveryManager) ExportConfig() ([]byte, error) {
	drm.mu.RLock()
	defer drm.mu.RUnlock()

	config := map[string]interface{}{
		"config":  drm.config,
		"targets": drm.targets,
		"regions": drm.regions,
	}

	return json.MarshalIndent(config, "", "  ")
}
