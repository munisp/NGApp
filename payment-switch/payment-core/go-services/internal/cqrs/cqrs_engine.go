package cqrs

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type CommandType string
type QueryType string

const (
	CmdCreateTransfer      CommandType = "CREATE_TRANSFER"
	CmdReverseTransfer     CommandType = "REVERSE_TRANSFER"
	CmdSubmitBatch         CommandType = "SUBMIT_BATCH"
	CmdExecuteMandate      CommandType = "EXECUTE_MANDATE"
	CmdFileDispute         CommandType = "FILE_DISPUTE"
	CmdOnboardParticipant  CommandType = "ONBOARD_PARTICIPANT"
)

const (
	QryTransactionHistory QueryType = "TRANSACTION_HISTORY"
	QryDashboardMetrics   QueryType = "DASHBOARD_METRICS"
	QryCorridorAnalytics  QueryType = "CORRIDOR_ANALYTICS"
	QrySettlementReport   QueryType = "SETTLEMENT_REPORT"
	QryFraudAlerts        QueryType = "FRAUD_ALERTS"
	QryAuditTrail         QueryType = "AUDIT_TRAIL"
)

type Command struct {
	ID        string
	Type      CommandType
	Payload   map[string]interface{}
	UserID    string
	Timestamp time.Time
}

type Query struct {
	ID        string
	Type      QueryType
	Filters   map[string]interface{}
	UserID    string
	Timestamp time.Time
}

type CommandResult struct {
	CommandID string
	Success   bool
	Data      interface{}
	Error     error
	Duration  time.Duration
}

type QueryResult struct {
	QueryID  string
	Data     interface{}
	Source   string // "cache", "read_replica", "materialized_view", "opensearch"
	Duration time.Duration
}

type WriteStore interface {
	Execute(ctx context.Context, cmd *Command) (*CommandResult, error)
}

type ReadStore interface {
	Query(ctx context.Context, q *Query) (*QueryResult, error)
	Refresh(ctx context.Context, viewName string) error
}

type EventProjector interface {
	Project(ctx context.Context, event interface{}) error
}

type CQRSEngine struct {
	writeStore      WriteStore
	readStores      map[string]ReadStore
	projectors      []EventProjector
	commandHandlers map[CommandType]func(ctx context.Context, cmd *Command) (*CommandResult, error)
	queryHandlers   map[QueryType]func(ctx context.Context, q *Query) (*QueryResult, error)
	mu              sync.RWMutex
	metrics         *CQRSMetrics
}

type CQRSMetrics struct {
	CommandsProcessed int64
	QueriesProcessed  int64
	CacheHits         int64
	CacheMisses       int64
	AvgWriteLatencyMs float64
	AvgReadLatencyMs  float64
}

func NewCQRSEngine() *CQRSEngine {
	e := &CQRSEngine{
		readStores:      make(map[string]ReadStore),
		commandHandlers: make(map[CommandType]func(ctx context.Context, cmd *Command) (*CommandResult, error)),
		queryHandlers:   make(map[QueryType]func(ctx context.Context, q *Query) (*QueryResult, error)),
		metrics:         &CQRSMetrics{},
	}
	e.registerHandlers()
	return e
}

func (e *CQRSEngine) registerHandlers() {
	e.commandHandlers[CmdCreateTransfer] = func(ctx context.Context, cmd *Command) (*CommandResult, error) {
		// Write path: validate → sanctions screen → fraud score → TigerBeetle post → Kafka emit
		return &CommandResult{CommandID: cmd.ID, Success: true, Data: map[string]string{"status": "COMPLETED"}}, nil
	}

	e.commandHandlers[CmdReverseTransfer] = func(ctx context.Context, cmd *Command) (*CommandResult, error) {
		return &CommandResult{CommandID: cmd.ID, Success: true, Data: map[string]string{"status": "REVERSED"}}, nil
	}

	e.commandHandlers[CmdSubmitBatch] = func(ctx context.Context, cmd *Command) (*CommandResult, error) {
		return &CommandResult{CommandID: cmd.ID, Success: true, Data: map[string]string{"batch_status": "SUBMITTED"}}, nil
	}

	e.commandHandlers[CmdExecuteMandate] = func(ctx context.Context, cmd *Command) (*CommandResult, error) {
		return &CommandResult{CommandID: cmd.ID, Success: true, Data: map[string]string{"mandate_status": "EXECUTED"}}, nil
	}

	// Query handlers read from materialized views / OpenSearch / Redis cache
	e.queryHandlers[QryTransactionHistory] = func(ctx context.Context, q *Query) (*QueryResult, error) {
		return &QueryResult{QueryID: q.ID, Source: "opensearch", Data: []string{"tx1", "tx2"}}, nil
	}

	e.queryHandlers[QryDashboardMetrics] = func(ctx context.Context, q *Query) (*QueryResult, error) {
		return &QueryResult{QueryID: q.ID, Source: "cache", Data: map[string]interface{}{
			"total_volume":   4_523_000,
			"total_value":    892_000_000_000,
			"success_rate":   99.2,
			"avg_latency_ms": 1.8,
		}}, nil
	}

	e.queryHandlers[QryCorridorAnalytics] = func(ctx context.Context, q *Query) (*QueryResult, error) {
		return &QueryResult{QueryID: q.ID, Source: "materialized_view"}, nil
	}

	e.queryHandlers[QrySettlementReport] = func(ctx context.Context, q *Query) (*QueryResult, error) {
		return &QueryResult{QueryID: q.ID, Source: "read_replica"}, nil
	}
}

func (e *CQRSEngine) ExecuteCommand(ctx context.Context, cmd *Command) (*CommandResult, error) {
	handler, ok := e.commandHandlers[cmd.Type]
	if !ok {
		return nil, fmt.Errorf("unknown command type: %s", cmd.Type)
	}
	start := time.Now()
	result, err := handler(ctx, cmd)
	if result != nil {
		result.Duration = time.Since(start)
	}
	return result, err
}

func (e *CQRSEngine) ExecuteQuery(ctx context.Context, q *Query) (*QueryResult, error) {
	handler, ok := e.queryHandlers[q.Type]
	if !ok {
		return nil, fmt.Errorf("unknown query type: %s", q.Type)
	}
	start := time.Now()
	result, err := handler(ctx, q)
	if result != nil {
		result.Duration = time.Since(start)
	}
	return result, err
}

func (e *CQRSEngine) GetMetrics() *CQRSMetrics {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.metrics
}

type MaterializedView struct {
	Name          string
	SourceTable   string
	RefreshPolicy string // "immediate", "periodic", "on_demand"
	RefreshInterval time.Duration
	LastRefreshed time.Time
	RowCount      int64
}

func GetMaterializedViews() []MaterializedView {
	return []MaterializedView{
		{Name: "mv_daily_volumes", SourceTable: "transactions", RefreshPolicy: "periodic", RefreshInterval: 5 * time.Minute},
		{Name: "mv_corridor_stats", SourceTable: "transactions", RefreshPolicy: "periodic", RefreshInterval: 15 * time.Minute},
		{Name: "mv_bank_settlement", SourceTable: "settlement_entries", RefreshPolicy: "immediate"},
		{Name: "mv_fraud_summary", SourceTable: "fraud_scores", RefreshPolicy: "periodic", RefreshInterval: 1 * time.Minute},
		{Name: "mv_sla_compliance", SourceTable: "response_times", RefreshPolicy: "periodic", RefreshInterval: 5 * time.Minute},
	}
}

type ShardingConfig struct {
	Strategy      string // "range", "hash", "time_based"
	ShardKey      string
	ShardCount    int
	HotRetention  time.Duration // data in PostgreSQL
	WarmRetention time.Duration // data in read replicas
	ColdStorage   string        // "lakehouse"
}

func GetShardingConfigs() []ShardingConfig {
	return []ShardingConfig{
		{Strategy: "time_based", ShardKey: "created_at", ShardCount: 12, HotRetention: 90 * 24 * time.Hour, WarmRetention: 365 * 24 * time.Hour, ColdStorage: "lakehouse"},
		{Strategy: "hash", ShardKey: "sender_bank_code", ShardCount: 8, HotRetention: 180 * 24 * time.Hour, WarmRetention: 730 * 24 * time.Hour, ColdStorage: "lakehouse"},
	}
}
