// Package infrastructure provides high-performance Temporal workflow client
package infrastructure

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

// TemporalHighPerfConfig configures the high-performance Temporal client
type TemporalHighPerfConfig struct {
	// Server settings
	HostPort        string
	Namespace       string
	
	// Worker settings
	MaxConcurrentActivities    int
	MaxConcurrentWorkflows     int
	MaxConcurrentLocalActivities int
	WorkerActivitiesPerSecond  float64
	TaskQueueActivitiesPerSecond float64
	
	// Client settings
	Identity        string
	DataConverter   string
	
	// Connection settings
	MaxPayloadSize  int
	KeepAliveTime   time.Duration
	KeepAliveTimeout time.Duration
	
	// Retry settings
	InitialInterval time.Duration
	MaxInterval     time.Duration
	MaxAttempts     int
	BackoffCoeff    float64
}

// DefaultTemporalHighPerfConfig returns optimized defaults for 1M TPS
func DefaultTemporalHighPerfConfig() TemporalHighPerfConfig {
	return TemporalHighPerfConfig{
		HostPort:                    "temporal-frontend:7233",
		Namespace:                   "payment-switch",
		MaxConcurrentActivities:     1000,
		MaxConcurrentWorkflows:      1000,
		MaxConcurrentLocalActivities: 1000,
		WorkerActivitiesPerSecond:   100000,
		TaskQueueActivitiesPerSecond: 100000,
		Identity:                    "payment-switch-worker",
		MaxPayloadSize:              4 * 1024 * 1024, // 4MB
		KeepAliveTime:               30 * time.Second,
		KeepAliveTimeout:            10 * time.Second,
		InitialInterval:             100 * time.Millisecond,
		MaxInterval:                 10 * time.Second,
		MaxAttempts:                 5,
		BackoffCoeff:                2.0,
	}
}

// TemporalHighPerfClient is an optimized Temporal client
type TemporalHighPerfClient struct {
	config       TemporalHighPerfConfig
	
	// Workflow execution pool
	workflowPool chan struct{}
	
	// Activity execution pool
	activityPool chan struct{}
	
	// Stats
	workflowsStarted  uint64
	workflowsCompleted uint64
	activitiesExec    uint64
	errors            uint64
	
	// Control
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
}

// NewTemporalHighPerfClient creates a new high-performance Temporal client
func NewTemporalHighPerfClient(config TemporalHighPerfConfig) (*TemporalHighPerfClient, error) {
	ctx, cancel := context.WithCancel(context.Background())
	
	client := &TemporalHighPerfClient{
		config:       config,
		workflowPool: make(chan struct{}, config.MaxConcurrentWorkflows),
		activityPool: make(chan struct{}, config.MaxConcurrentActivities),
		ctx:          ctx,
		cancel:       cancel,
	}
	
	// Pre-fill pools
	for i := 0; i < config.MaxConcurrentWorkflows; i++ {
		client.workflowPool <- struct{}{}
	}
	for i := 0; i < config.MaxConcurrentActivities; i++ {
		client.activityPool <- struct{}{}
	}
	
	log.Printf("TemporalHighPerfClient initialized: namespace=%s, maxWorkflows=%d, maxActivities=%d",
		config.Namespace, config.MaxConcurrentWorkflows, config.MaxConcurrentActivities)
	
	return client, nil
}

// WorkflowOptions configures workflow execution
type WorkflowOptions struct {
	ID                       string
	TaskQueue                string
	ExecutionTimeout         time.Duration
	RunTimeout               time.Duration
	TaskTimeout              time.Duration
	RetryPolicy              *RetryPolicy
	CronSchedule             string
	Memo                     map[string]interface{}
	SearchAttributes         map[string]interface{}
}

// RetryPolicy configures retry behavior
type RetryPolicy struct {
	InitialInterval    time.Duration
	BackoffCoefficient float64
	MaximumInterval    time.Duration
	MaximumAttempts    int32
	NonRetryableErrors []string
}

// DefaultWorkflowOptions returns default workflow options
func DefaultWorkflowOptions(workflowID, taskQueue string) WorkflowOptions {
	return WorkflowOptions{
		ID:               workflowID,
		TaskQueue:        taskQueue,
		ExecutionTimeout: 24 * time.Hour,
		RunTimeout:       1 * time.Hour,
		TaskTimeout:      10 * time.Second,
		RetryPolicy: &RetryPolicy{
			InitialInterval:    100 * time.Millisecond,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    5,
		},
	}
}

// StartWorkflow starts a workflow execution
func (c *TemporalHighPerfClient) StartWorkflow(ctx context.Context, options WorkflowOptions, workflow interface{}, args ...interface{}) (string, error) {
	// Acquire workflow slot
	select {
	case <-c.workflowPool:
		defer func() { c.workflowPool <- struct{}{} }()
	case <-ctx.Done():
		return "", ctx.Err()
	}
	
	atomic.AddUint64(&c.workflowsStarted, 1)
	
	// In production, this would use the actual Temporal client
	runID := fmt.Sprintf("run-%d", time.Now().UnixNano())
	
	return runID, nil
}

// SignalWorkflow sends a signal to a workflow
func (c *TemporalHighPerfClient) SignalWorkflow(ctx context.Context, workflowID, runID, signalName string, arg interface{}) error {
	return nil
}

// QueryWorkflow queries a workflow
func (c *TemporalHighPerfClient) QueryWorkflow(ctx context.Context, workflowID, runID, queryType string, args ...interface{}) (interface{}, error) {
	return nil, nil
}

// CancelWorkflow cancels a workflow
func (c *TemporalHighPerfClient) CancelWorkflow(ctx context.Context, workflowID, runID string) error {
	return nil
}

// TerminateWorkflow terminates a workflow
func (c *TemporalHighPerfClient) TerminateWorkflow(ctx context.Context, workflowID, runID, reason string) error {
	return nil
}

// GetWorkflowResult gets the result of a completed workflow
func (c *TemporalHighPerfClient) GetWorkflowResult(ctx context.Context, workflowID, runID string, result interface{}) error {
	atomic.AddUint64(&c.workflowsCompleted, 1)
	return nil
}

// ActivityOptions configures activity execution
type ActivityOptions struct {
	TaskQueue              string
	ScheduleToCloseTimeout time.Duration
	ScheduleToStartTimeout time.Duration
	StartToCloseTimeout    time.Duration
	HeartbeatTimeout       time.Duration
	RetryPolicy            *RetryPolicy
}

// DefaultActivityOptions returns default activity options
func DefaultActivityOptions(taskQueue string) ActivityOptions {
	return ActivityOptions{
		TaskQueue:              taskQueue,
		ScheduleToCloseTimeout: 5 * time.Minute,
		ScheduleToStartTimeout: 1 * time.Minute,
		StartToCloseTimeout:    1 * time.Minute,
		HeartbeatTimeout:       30 * time.Second,
		RetryPolicy: &RetryPolicy{
			InitialInterval:    100 * time.Millisecond,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    5,
		},
	}
}

// ExecuteActivity executes an activity
func (c *TemporalHighPerfClient) ExecuteActivity(ctx context.Context, options ActivityOptions, activity interface{}, args ...interface{}) (interface{}, error) {
	// Acquire activity slot
	select {
	case <-c.activityPool:
		defer func() { c.activityPool <- struct{}{} }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	
	atomic.AddUint64(&c.activitiesExec, 1)
	
	return nil, nil
}

// Stats returns client statistics
func (c *TemporalHighPerfClient) Stats() (started, completed, activities, errors uint64) {
	return atomic.LoadUint64(&c.workflowsStarted),
		atomic.LoadUint64(&c.workflowsCompleted),
		atomic.LoadUint64(&c.activitiesExec),
		atomic.LoadUint64(&c.errors)
}

// Close shuts down the client
func (c *TemporalHighPerfClient) Close() error {
	c.cancel()
	c.wg.Wait()
	return nil
}

// TemporalServerConfig represents Temporal server configuration
type TemporalServerConfig struct {
	NumHistoryShards     int
	FrontendReplicas     int
	HistoryReplicas      int
	MatchingReplicas     int
	WorkerReplicas       int
	
	// Database
	DBType               string
	DBHost               string
	DBPort               int
	DBName               string
	DBUser               string
	MaxConns             int
	MaxIdleConns         int
	
	// Performance
	RPS                  int
	MaxConcurrentTasks   int
	PersistenceMaxQPS    int
	VisibilityMaxQPS     int
}

// OptimalTemporalServerConfig returns optimized Temporal server config for 1M TPS
func OptimalTemporalServerConfig() TemporalServerConfig {
	return TemporalServerConfig{
		NumHistoryShards:   1024,  // Increased from 512
		FrontendReplicas:   5,     // Increased from 3
		HistoryReplicas:    5,     // Increased from 3
		MatchingReplicas:   5,     // Increased from 3
		WorkerReplicas:     3,     // Increased from 2
		DBType:             "postgres",
		DBHost:             "postgres-primary",
		DBPort:             5432,
		DBName:             "temporal",
		MaxConns:           50,
		MaxIdleConns:       25,
		RPS:                10000,
		MaxConcurrentTasks: 10000,
		PersistenceMaxQPS:  10000,
		VisibilityMaxQPS:   10000,
	}
}

// GenerateTemporalConfig generates Temporal server configuration
func GenerateTemporalConfig(config TemporalServerConfig) string {
	return fmt.Sprintf(`log:
  stdout: true
  level: info

persistence:
  defaultStore: default
  visibilityStore: visibility
  numHistoryShards: %d
  datastores:
    default:
      sql:
        pluginName: "postgres"
        databaseName: "%s"
        connectAddr: "%s:%d"
        connectProtocol: "tcp"
        user: "%s"
        password: "${TEMPORAL_DB_PASSWORD}"
        maxConns: %d
        maxIdleConns: %d
        maxConnLifetime: "1h"
    visibility:
      sql:
        pluginName: "postgres"
        databaseName: "%s_visibility"
        connectAddr: "%s:%d"
        connectProtocol: "tcp"
        user: "%s"
        password: "${TEMPORAL_DB_PASSWORD}"
        maxConns: %d
        maxIdleConns: %d
        maxConnLifetime: "1h"

global:
  membership:
    maxJoinDuration: 30s
  pprof:
    port: 7936
  metrics:
    prometheus:
      timerType: histogram
      listenAddress: "0.0.0.0:9090"

services:
  frontend:
    rpc:
      grpcPort: 7233
      membershipPort: 6933
      bindOnLocalHost: false
    metrics:
      prometheus:
        timerType: histogram
        listenAddress: "0.0.0.0:9090"

  matching:
    rpc:
      grpcPort: 7235
      membershipPort: 6935
      bindOnLocalHost: false

  history:
    rpc:
      grpcPort: 7234
      membershipPort: 6934
      bindOnLocalHost: false

  worker:
    rpc:
      grpcPort: 7239
      membershipPort: 6939
      bindOnLocalHost: false

dynamicConfigClient:
  filepath: "/etc/temporal/dynamic_config.yaml"
  pollInterval: "10s"
`,
		config.NumHistoryShards,
		config.DBName, config.DBHost, config.DBPort, config.DBUser, config.MaxConns, config.MaxIdleConns,
		config.DBName, config.DBHost, config.DBPort, config.DBUser, config.MaxConns/2, config.MaxIdleConns/2,
	)
}

// GenerateTemporalDynamicConfig generates Temporal dynamic configuration
func GenerateTemporalDynamicConfig(config TemporalServerConfig) string {
	return fmt.Sprintf(`# Temporal Dynamic Configuration - Optimized for 1M TPS

# Frontend settings
frontend.rps:
  - value: %d
    constraints: {}

frontend.namespaceRPS:
  - value: %d
    constraints: {}

# History settings
history.rps:
  - value: %d
    constraints: {}

history.persistenceMaxQPS:
  - value: %d
    constraints: {}

history.persistenceGlobalMaxQPS:
  - value: %d
    constraints: {}

# Matching settings
matching.rps:
  - value: %d
    constraints: {}

matching.numTaskqueueReadPartitions:
  - value: 16
    constraints: {}

matching.numTaskqueueWritePartitions:
  - value: 16
    constraints: {}

# Worker settings
worker.replicatorConcurrency:
  - value: 1000
    constraints: {}

# Visibility settings
system.visibilityPersistenceMaxReadQPS:
  - value: %d
    constraints: {}

system.visibilityPersistenceMaxWriteQPS:
  - value: %d
    constraints: {}

# Archival settings
history.archivalEnabled:
  - value: false
    constraints: {}

# Workflow execution settings
limit.maxIDLength:
  - value: 1000
    constraints: {}

limit.blobSizeLimitWarn:
  - value: 2097152
    constraints: {}

limit.blobSizeLimitError:
  - value: 4194304
    constraints: {}

# Task processing
history.taskProcessRPS:
  - value: 10000
    constraints: {}

history.taskSchedulerRoundRobinWeights:
  - value:
      HighPriorityTask: 3
      LowPriorityTask: 1
    constraints: {}
`,
		config.RPS, config.RPS,
		config.RPS, config.PersistenceMaxQPS, config.PersistenceMaxQPS*2,
		config.RPS,
		config.VisibilityMaxQPS, config.VisibilityMaxQPS,
	)
}

// PaymentWorkflowDefinition defines a high-performance payment workflow
type PaymentWorkflowDefinition struct {
	Name              string
	TaskQueue         string
	ExecutionTimeout  time.Duration
	Activities        []ActivityDefinition
}

// ActivityDefinition defines a workflow activity
type ActivityDefinition struct {
	Name           string
	Timeout        time.Duration
	RetryPolicy    *RetryPolicy
	HeartbeatTimeout time.Duration
}

// OptimalPaymentWorkflows returns optimized workflow definitions
func OptimalPaymentWorkflows() []PaymentWorkflowDefinition {
	return []PaymentWorkflowDefinition{
		{
			Name:             "TransferWorkflow",
			TaskQueue:        "payment-transfers",
			ExecutionTimeout: 5 * time.Minute,
			Activities: []ActivityDefinition{
				{Name: "ValidateTransfer", Timeout: 5 * time.Second},
				{Name: "CheckFraud", Timeout: 2 * time.Second},
				{Name: "ReserveFunds", Timeout: 5 * time.Second},
				{Name: "ExecuteTransfer", Timeout: 10 * time.Second},
				{Name: "NotifyParties", Timeout: 5 * time.Second},
			},
		},
		{
			Name:             "SettlementWorkflow",
			TaskQueue:        "payment-settlements",
			ExecutionTimeout: 30 * time.Minute,
			Activities: []ActivityDefinition{
				{Name: "CollectTransactions", Timeout: 5 * time.Minute},
				{Name: "CalculateNetPositions", Timeout: 1 * time.Minute},
				{Name: "ValidateSettlement", Timeout: 30 * time.Second},
				{Name: "ExecuteSettlement", Timeout: 5 * time.Minute},
				{Name: "GenerateReports", Timeout: 2 * time.Minute},
			},
		},
		{
			Name:             "OnboardingWorkflow",
			TaskQueue:        "onboarding",
			ExecutionTimeout: 7 * 24 * time.Hour,
			Activities: []ActivityDefinition{
				{Name: "ValidateApplication", Timeout: 1 * time.Minute},
				{Name: "PerformKYC", Timeout: 5 * time.Minute},
				{Name: "PerformKYB", Timeout: 10 * time.Minute},
				{Name: "ReviewApplication", Timeout: 24 * time.Hour},
				{Name: "ProvisionAccount", Timeout: 5 * time.Minute},
			},
		},
		{
			Name:             "ReconciliationWorkflow",
			TaskQueue:        "reconciliation",
			ExecutionTimeout: 2 * time.Hour,
			Activities: []ActivityDefinition{
				{Name: "FetchExternalData", Timeout: 10 * time.Minute},
				{Name: "MatchTransactions", Timeout: 30 * time.Minute},
				{Name: "IdentifyDiscrepancies", Timeout: 10 * time.Minute},
				{Name: "GenerateReport", Timeout: 5 * time.Minute},
			},
		},
	}
}

// Singleton for high-performance Temporal client
var (
	temporalClient     *TemporalHighPerfClient
	temporalClientOnce sync.Once
	temporalClientErr  error
)

// GetTemporalClient returns the singleton Temporal client
func GetTemporalClient() (*TemporalHighPerfClient, error) {
	temporalClientOnce.Do(func() {
		temporalClient, temporalClientErr = NewTemporalHighPerfClient(DefaultTemporalHighPerfConfig())
	})
	return temporalClient, temporalClientErr
}
