package offline

import (
	"encoding/json"
	"sync"
	"time"
)

type QueuePriority int

const (
	PriorityLow      QueuePriority = 0
	PriorityNormal   QueuePriority = 1
	PriorityHigh     QueuePriority = 2
	PriorityCritical QueuePriority = 3
)

type SyncStatus string

const (
	SyncPending    SyncStatus = "PENDING"
	SyncInProgress SyncStatus = "IN_PROGRESS"
	SyncCompleted  SyncStatus = "COMPLETED"
	SyncFailed     SyncStatus = "FAILED"
	SyncConflict   SyncStatus = "CONFLICT"
)

type ConnectionQuality string

const (
	ConnOffline    ConnectionQuality = "OFFLINE"
	ConnPoor       ConnectionQuality = "POOR"       // <256kbps
	ConnModerate   ConnectionQuality = "MODERATE"    // 256kbps-1Mbps
	ConnGood       ConnectionQuality = "GOOD"        // 1-10Mbps
	ConnExcellent  ConnectionQuality = "EXCELLENT"   // >10Mbps
)

type QueuedOperation struct {
	ID          string
	Type        string // "payment", "transfer", "query", "update"
	Payload     json.RawMessage
	Priority    QueuePriority
	Status      SyncStatus
	CreatedAt   time.Time
	RetryCount  int
	MaxRetries  int
	LastError   string
	Checksum    string
	SizeBytes   int
	Compressed  bool
}

type OfflineQueueConfig struct {
	MaxQueueSize          int
	MaxRetries            int
	RetryBackoffMs        []int
	CompressAboveBytes    int
	PriorityOrdering      bool
	ConflictResolution    string // "last-write-wins", "merge", "manual"
	DataExpirationHours   int
	BandwidthAdaptive     bool
	MinBandwidthBps       int
	BatchSyncEnabled      bool
	BatchSize             int
	DeltaSyncEnabled      bool
	EncryptAtRest         bool
}

type SyncMetrics struct {
	QueueDepth           int
	PendingOperations    int
	CompletedOperations  int
	FailedOperations     int
	ConflictedOperations int
	TotalBytesQueued     int64
	TotalBytesSynced     int64
	AvgSyncLatencyMs     int64
	LastSyncTime         time.Time
	ConnectionQuality    ConnectionQuality
	EstimatedBandwidth   int64
	CompressionRatio     float64
}

type OfflineQueue struct {
	mu      sync.RWMutex
	queue   []QueuedOperation
	config  OfflineQueueConfig
	metrics SyncMetrics
}

var DefaultOfflineConfig = OfflineQueueConfig{
	MaxQueueSize:       10000,
	MaxRetries:         5,
	RetryBackoffMs:     []int{1000, 5000, 15000, 60000, 300000},
	CompressAboveBytes: 1024,
	PriorityOrdering:   true,
	ConflictResolution: "last-write-wins",
	DataExpirationHours: 72,
	BandwidthAdaptive:  true,
	MinBandwidthBps:    9600, // 9.6kbps — EDGE network in rural Africa
	BatchSyncEnabled:   true,
	BatchSize:          50,
	DeltaSyncEnabled:   true,
	EncryptAtRest:      true,
}

func NewOfflineQueue(cfg OfflineQueueConfig) *OfflineQueue {
	return &OfflineQueue{
		queue:  make([]QueuedOperation, 0, cfg.MaxQueueSize),
		config: cfg,
	}
}

func (q *OfflineQueue) Enqueue(op QueuedOperation) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if len(q.queue) >= q.config.MaxQueueSize {
		// Evict lowest priority expired items
		q.evictExpired()
		if len(q.queue) >= q.config.MaxQueueSize {
			return ErrQueueFull
		}
	}

	op.Status = SyncPending
	op.CreatedAt = time.Now()
	op.MaxRetries = q.config.MaxRetries
	op.SizeBytes = len(op.Payload)

	if q.config.PriorityOrdering {
		q.insertByPriority(op)
	} else {
		q.queue = append(q.queue, op)
	}

	q.metrics.QueueDepth = len(q.queue)
	q.metrics.PendingOperations++
	q.metrics.TotalBytesQueued += int64(op.SizeBytes)

	return nil
}

func (q *OfflineQueue) Dequeue(batchSize int) []QueuedOperation {
	q.mu.Lock()
	defer q.mu.Unlock()

	if batchSize <= 0 {
		batchSize = q.config.BatchSize
	}

	var batch []QueuedOperation
	batchBytes := 0
	maxBatchBytes := q.estimateMaxBatchBytes()

	for i := 0; i < len(q.queue) && len(batch) < batchSize; i++ {
		op := q.queue[i]
		if op.Status != SyncPending {
			continue
		}
		if q.config.BandwidthAdaptive && batchBytes+op.SizeBytes > maxBatchBytes {
			break
		}
		op.Status = SyncInProgress
		q.queue[i] = op
		batch = append(batch, op)
		batchBytes += op.SizeBytes
	}

	return batch
}

func (q *OfflineQueue) MarkCompleted(id string) {
	q.mu.Lock()
	defer q.mu.Unlock()

	for i, op := range q.queue {
		if op.ID == id {
			q.queue[i].Status = SyncCompleted
			q.metrics.CompletedOperations++
			q.metrics.TotalBytesSynced += int64(op.SizeBytes)
			break
		}
	}
	q.cleanup()
}

func (q *OfflineQueue) MarkFailed(id string, err string) {
	q.mu.Lock()
	defer q.mu.Unlock()

	for i, op := range q.queue {
		if op.ID == id {
			q.queue[i].RetryCount++
			q.queue[i].LastError = err
			if q.queue[i].RetryCount >= q.queue[i].MaxRetries {
				q.queue[i].Status = SyncFailed
				q.metrics.FailedOperations++
			} else {
				q.queue[i].Status = SyncPending
			}
			break
		}
	}
}

func (q *OfflineQueue) UpdateConnectionQuality(quality ConnectionQuality, bandwidthBps int64) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.metrics.ConnectionQuality = quality
	q.metrics.EstimatedBandwidth = bandwidthBps
}

func (q *OfflineQueue) GetMetrics() SyncMetrics {
	q.mu.RLock()
	defer q.mu.RUnlock()
	m := q.metrics
	m.QueueDepth = len(q.queue)
	return m
}

func (q *OfflineQueue) insertByPriority(op QueuedOperation) {
	idx := len(q.queue)
	for i, existing := range q.queue {
		if op.Priority > existing.Priority {
			idx = i
			break
		}
	}
	q.queue = append(q.queue, QueuedOperation{})
	copy(q.queue[idx+1:], q.queue[idx:])
	q.queue[idx] = op
}

func (q *OfflineQueue) evictExpired() {
	cutoff := time.Now().Add(-time.Duration(q.config.DataExpirationHours) * time.Hour)
	var kept []QueuedOperation
	for _, op := range q.queue {
		if op.CreatedAt.After(cutoff) || op.Priority >= PriorityHigh {
			kept = append(kept, op)
		}
	}
	q.queue = kept
}

func (q *OfflineQueue) cleanup() {
	var active []QueuedOperation
	for _, op := range q.queue {
		if op.Status != SyncCompleted {
			active = append(active, op)
		}
	}
	q.queue = active
}

func (q *OfflineQueue) estimateMaxBatchBytes() int {
	if !q.config.BandwidthAdaptive || q.metrics.EstimatedBandwidth == 0 {
		return 1024 * 1024 // 1MB default
	}
	// Aim for batches that can sync in 10 seconds
	return int(q.metrics.EstimatedBandwidth * 10 / 8)
}

type QueueError string

func (e QueueError) Error() string { return string(e) }

const ErrQueueFull QueueError = "offline queue is full"
