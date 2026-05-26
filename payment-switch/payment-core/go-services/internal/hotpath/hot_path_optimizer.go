package hotpath

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

type Priority int

const (
	PriorityCritical Priority = 0 // NIP instant payments
	PriorityHigh     Priority = 1 // Reversals
	PriorityNormal   Priority = 2 // NEFT, NACS
	PriorityLow      Priority = 3 // Analytics, reporting
)

type ProcessingMode string

const (
	ModeSynchronous  ProcessingMode = "SYNC"
	ModeAsynchronous ProcessingMode = "ASYNC"
	ModeBatched      ProcessingMode = "BATCH"
)

type PaymentRequest struct {
	ID           string
	Type         string
	Priority     Priority
	Amount       float64
	SenderBank   string
	ReceiverBank string
	CreatedAt    time.Time
}

type ProcessingConfig struct {
	FraudScoring       ProcessingMode
	SanctionsScreening ProcessingMode
	AuditLogging       ProcessingMode
	OpenSearchIndexing ProcessingMode
	KafkaPublishing    ProcessingMode
	LakehouseIngestion ProcessingMode
	NotificationSend   ProcessingMode
}

type HotPathOptimizer struct {
	mu             sync.RWMutex
	configs        map[string]*ProcessingConfig
	metrics        *HotPathMetrics
	asyncQueue     chan asyncTask
	batchBuffer    []*batchItem
	batchSize      int
	batchInterval  time.Duration
	lowValueThresh float64
}

type HotPathMetrics struct {
	TotalRequests   atomic.Int64
	SyncProcessed   atomic.Int64
	AsyncDeferred   atomic.Int64
	BatchDeferred   atomic.Int64
	AvgLatencyNs    atomic.Int64
	P99LatencyNs    atomic.Int64
	SkippedOps      atomic.Int64
}

type asyncTask struct {
	operation string
	payload   interface{}
	createdAt time.Time
}

type batchItem struct {
	operation string
	payload   interface{}
}

func NewHotPathOptimizer() *HotPathOptimizer {
	h := &HotPathOptimizer{
		configs:        make(map[string]*ProcessingConfig),
		metrics:        &HotPathMetrics{},
		asyncQueue:     make(chan asyncTask, 100_000),
		batchBuffer:    make([]*batchItem, 0, 1000),
		batchSize:      500,
		batchInterval:  100 * time.Millisecond,
		lowValueThresh: 100_000, // ₦100K
	}
	h.initConfigs()
	go h.processAsyncQueue()
	go h.processBatchBuffer()
	return h
}

func (h *HotPathOptimizer) initConfigs() {
	// NIP: optimize for <100ms P99
	h.configs["NIP"] = &ProcessingConfig{
		FraudScoring:       ModeSynchronous,  // must be sync for safety
		SanctionsScreening: ModeSynchronous,  // regulatory requirement
		AuditLogging:       ModeAsynchronous, // defer to Kafka consumer
		OpenSearchIndexing: ModeAsynchronous, // defer to Kafka consumer
		KafkaPublishing:    ModeSynchronous,  // fire-and-forget with acks=1
		LakehouseIngestion: ModeBatched,      // batch every 100ms
		NotificationSend:   ModeAsynchronous, // non-critical path
	}

	// NEFT: batch is acceptable
	h.configs["NEFT"] = &ProcessingConfig{
		FraudScoring:       ModeSynchronous,
		SanctionsScreening: ModeSynchronous,
		AuditLogging:       ModeBatched,
		OpenSearchIndexing: ModeBatched,
		KafkaPublishing:    ModeSynchronous,
		LakehouseIngestion: ModeBatched,
		NotificationSend:   ModeBatched,
	}

	// Reversals: near-realtime
	h.configs["REVERSAL"] = &ProcessingConfig{
		FraudScoring:       ModeAsynchronous, // skip for reversals
		SanctionsScreening: ModeAsynchronous, // already screened on original
		AuditLogging:       ModeSynchronous,  // audit trail critical
		OpenSearchIndexing: ModeAsynchronous,
		KafkaPublishing:    ModeSynchronous,
		LakehouseIngestion: ModeBatched,
		NotificationSend:   ModeSynchronous,  // notify immediately
	}

	// Low-value NIP: relax fraud scoring
	h.configs["NIP_LOW_VALUE"] = &ProcessingConfig{
		FraudScoring:       ModeAsynchronous, // post-hoc scoring for low value
		SanctionsScreening: ModeSynchronous,
		AuditLogging:       ModeAsynchronous,
		OpenSearchIndexing: ModeAsynchronous,
		KafkaPublishing:    ModeSynchronous,
		LakehouseIngestion: ModeBatched,
		NotificationSend:   ModeAsynchronous,
	}
}

func (h *HotPathOptimizer) GetConfig(paymentType string, amount float64) *ProcessingConfig {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if paymentType == "NIP" && amount < h.lowValueThresh {
		return h.configs["NIP_LOW_VALUE"]
	}
	if cfg, ok := h.configs[paymentType]; ok {
		return cfg
	}
	return h.configs["NEFT"]
}

func (h *HotPathOptimizer) ProcessPayment(ctx context.Context, req *PaymentRequest) error {
	start := time.Now()
	h.metrics.TotalRequests.Add(1)

	config := h.GetConfig(req.Type, req.Amount)

	// Synchronous operations (critical path)
	if config.FraudScoring == ModeSynchronous {
		if err := h.scoreFraudSync(ctx, req); err != nil {
			return fmt.Errorf("fraud scoring failed: %w", err)
		}
		h.metrics.SyncProcessed.Add(1)
	} else {
		h.deferAsync("fraud_scoring", req)
		h.metrics.AsyncDeferred.Add(1)
	}

	if config.SanctionsScreening == ModeSynchronous {
		if err := h.screenSanctionsSync(ctx, req); err != nil {
			return fmt.Errorf("sanctions screening failed: %w", err)
		}
		h.metrics.SyncProcessed.Add(1)
	}

	// Async operations
	if config.AuditLogging == ModeAsynchronous {
		h.deferAsync("audit_log", req)
		h.metrics.AsyncDeferred.Add(1)
	}
	if config.OpenSearchIndexing == ModeAsynchronous {
		h.deferAsync("opensearch_index", req)
		h.metrics.AsyncDeferred.Add(1)
	}
	if config.NotificationSend == ModeAsynchronous {
		h.deferAsync("notification", req)
		h.metrics.AsyncDeferred.Add(1)
	}

	// Batched operations
	if config.LakehouseIngestion == ModeBatched {
		h.deferBatch("lakehouse_ingest", req)
		h.metrics.BatchDeferred.Add(1)
	}

	latency := time.Since(start).Nanoseconds()
	h.metrics.AvgLatencyNs.Store(latency)
	return nil
}

func (h *HotPathOptimizer) scoreFraudSync(ctx context.Context, req *PaymentRequest) error {
	return nil // calls fraud scoring service synchronously
}

func (h *HotPathOptimizer) screenSanctionsSync(ctx context.Context, req *PaymentRequest) error {
	return nil // calls sanctions engine synchronously
}

func (h *HotPathOptimizer) deferAsync(operation string, payload interface{}) {
	select {
	case h.asyncQueue <- asyncTask{operation: operation, payload: payload, createdAt: time.Now()}:
	default:
		h.metrics.SkippedOps.Add(1) // queue full, skip non-critical
	}
}

func (h *HotPathOptimizer) deferBatch(operation string, payload interface{}) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.batchBuffer = append(h.batchBuffer, &batchItem{operation: operation, payload: payload})
}

func (h *HotPathOptimizer) processAsyncQueue() {
	for task := range h.asyncQueue {
		_ = task // process async task
	}
}

func (h *HotPathOptimizer) processBatchBuffer() {
	ticker := time.NewTicker(h.batchInterval)
	defer ticker.Stop()

	for range ticker.C {
		h.mu.Lock()
		if len(h.batchBuffer) == 0 {
			h.mu.Unlock()
			continue
		}
		batch := h.batchBuffer
		h.batchBuffer = make([]*batchItem, 0, 1000)
		h.mu.Unlock()
		_ = batch // flush batch to lakehouse/opensearch
	}
}

func (h *HotPathOptimizer) GetMetrics() map[string]int64 {
	return map[string]int64{
		"total_requests":  h.metrics.TotalRequests.Load(),
		"sync_processed":  h.metrics.SyncProcessed.Load(),
		"async_deferred":  h.metrics.AsyncDeferred.Load(),
		"batch_deferred":  h.metrics.BatchDeferred.Load(),
		"avg_latency_ns":  h.metrics.AvgLatencyNs.Load(),
		"skipped_ops":     h.metrics.SkippedOps.Load(),
	}
}
