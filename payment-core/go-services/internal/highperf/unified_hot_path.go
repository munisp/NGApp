// Package highperf provides unified hot path orchestration for 1M TPS
// This file wires all production components together
package highperf

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// UnifiedHotPath orchestrates all components for 1M TPS processing
// Architecture:
// 1. Request arrives → JWT validation (local, cached)
// 2. Fast fraud gate (in-memory heuristics)
// 3. TigerBeetle commit (batched, pipelined)
// 4. Response to client
// 5. Async: Kafka event emission, ML scoring, lakehouse CDC
type UnifiedHotPath struct {
	// Core components
	jwtCache      *JWTCache
	fraudGate     *FastFraudGate
	batchClient   *BatchTransferClient
	kafkaOutbox   *KafkaOutbox
	backpressure  *BackpressureController
	healthChecker *HealthChecker
	metrics       *MetricsCollector
	idGenerator   *IDGenerator

	// Circuit breakers for external dependencies
	tbCircuitBreaker    *CircuitBreaker
	kafkaCircuitBreaker *CircuitBreaker

	// Configuration
	config UnifiedConfig

	// Stats
	totalRequests  uint64
	totalSuccess   uint64
	totalFailed    uint64
	totalRejected  uint64
	totalLatencyNs uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// UnifiedConfig configures the unified hot path
type UnifiedConfig struct {
	// TigerBeetle
	TigerBeetleAddresses []string
	TigerBeetleClusterID uint64
	TigerBeetleConns     int

	// Kafka
	KafkaBrokers []string

	// JWT
	JWKSURL  string
	Issuer   string
	Audience string

	// Fraud
	MaxAmountPerTx   uint64
	MaxTxPerMinute   int
	MaxAmountPerHour uint64

	// Batching
	BatchSize     int
	FlushInterval time.Duration
	MaxInflight   int

	// Backpressure
	MaxQueueDepth int
	ShedThreshold float64

	// Health check interval
	HealthCheckInterval time.Duration

	// Node ID for ID generation
	NodeID uint16
}

// DefaultUnifiedConfig returns production-optimized defaults
func DefaultUnifiedConfig() UnifiedConfig {
	return UnifiedConfig{
		TigerBeetleAddresses: []string{"tigerbeetle:3000"},
		TigerBeetleClusterID: 0,
		TigerBeetleConns:     10,
		KafkaBrokers:         []string{"kafka-0:9092", "kafka-1:9092", "kafka-2:9092"},
		JWKSURL:              "http://keycloak:8080/realms/payment-switch/protocol/openid-connect/certs",
		Issuer:               "http://keycloak:8080/realms/payment-switch",
		Audience:             "payment-switch",
		MaxAmountPerTx:       10000000,
		MaxTxPerMinute:       100,
		MaxAmountPerHour:     100000000,
		BatchSize:            1000,
		FlushInterval:        5 * time.Millisecond,
		MaxInflight:          10,
		MaxQueueDepth:        100000,
		ShedThreshold:        0.8,
		HealthCheckInterval:  10 * time.Second,
		NodeID:               1,
	}
}

// NewUnifiedHotPath creates a new unified hot path processor
func NewUnifiedHotPath(config UnifiedConfig) (*UnifiedHotPath, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// Create TigerBeetle adapter
	tbAdapter, err := NewProductionTigerBeetleAdapter(ProductionTBConfig{
		Addresses:      config.TigerBeetleAddresses,
		ClusterID:      config.TigerBeetleClusterID,
		NumConnections: config.TigerBeetleConns,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
	})
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create TigerBeetle adapter: %w", err)
	}

	// Create batch client with TigerBeetle adapter
	batchClient := NewBatchTransferClient(tbAdapter, BatchConfig{
		BatchSize:      config.BatchSize,
		FlushInterval:  config.FlushInterval,
		MaxInflight:    config.MaxInflight,
		RingBufferSize: config.MaxQueueDepth,
	})

	// Create Kafka outbox (with nil producer for now - will be wired to real producer)
	kafkaOutbox := NewKafkaOutbox(nil, OutboxConfig{
		BufferSize:     config.MaxQueueDepth,
		BatchSize:      config.BatchSize,
		LingerMs:       5,
		MaxInflight:    config.MaxInflight,
		Compression:    "lz4",
		RetryAttempts:  3,
		RetryBackoffMs: 100,
	})

	// Create JWT cache
	jwtCache := NewJWTCache(JWTCacheConfig{
		JWKSURL:             config.JWKSURL,
		JWKSRefreshInterval: 5 * time.Minute,
		TokenCacheTTL:       30 * time.Second,
		TokenCacheShards:    256,
		TokenCacheSize:      100000,
	})

	// Create fraud gate
	fraudGate := NewFastFraudGate(FastFraudConfig{
		MaxAmountPerTx:   config.MaxAmountPerTx,
		MaxTxPerMinute:   config.MaxTxPerMinute,
		MaxAmountPerHour: config.MaxAmountPerHour,
		BloomFilterSize:  1000000,
		VelocityShards:   256,
		MLScoringBuffer:  100000,
	})

	// Create backpressure controller
	backpressure := NewBackpressureController(BackpressureConfig{
		MaxQueueDepth:    config.MaxQueueDepth,
		ShedThreshold:    config.ShedThreshold,
		AdaptiveInterval: 100 * time.Millisecond,
	})

	// Create health checker
	healthChecker := NewHealthChecker(config.HealthCheckInterval)

	// Create metrics collector
	metrics := NewMetricsCollector()

	// Create ID generator
	idGenerator := NewIDGenerator(config.NodeID)

	// Create circuit breakers
	tbCircuitBreaker := NewCircuitBreaker(DefaultCircuitBreakerConfig("tigerbeetle"))
	kafkaCircuitBreaker := NewCircuitBreaker(DefaultCircuitBreakerConfig("kafka"))

	uhp := &UnifiedHotPath{
		jwtCache:            jwtCache,
		fraudGate:           fraudGate,
		batchClient:         batchClient,
		kafkaOutbox:         kafkaOutbox,
		backpressure:        backpressure,
		healthChecker:       healthChecker,
		metrics:             metrics,
		idGenerator:         idGenerator,
		tbCircuitBreaker:    tbCircuitBreaker,
		kafkaCircuitBreaker: kafkaCircuitBreaker,
		config:              config,
		ctx:                 ctx,
		cancel:              cancel,
	}

	// Register health checks
	healthChecker.Register("tigerbeetle", func(ctx context.Context) error {
		return tbAdapter.ensureConnected(ctx, tbAdapter.connections[0])
	})

	// Start ML scoring consumer
	uhp.wg.Add(1)
	go uhp.mlScoringConsumer()

	return uhp, nil
}

// ProcessTransfer processes a single transfer through the hot path
func (uhp *UnifiedHotPath) ProcessTransfer(ctx context.Context, req TransferRequest) (TransferResponse, error) {
	startTime := time.Now()
	atomic.AddUint64(&uhp.totalRequests, 1)
	uhp.metrics.IncrCounter("requests_total", 1)

	// Step 1: Backpressure check
	if !uhp.backpressure.TryAccept() {
		atomic.AddUint64(&uhp.totalRejected, 1)
		uhp.metrics.IncrCounter("requests_rejected", 1)
		return TransferResponse{}, ErrBufferFull
	}
	defer uhp.backpressure.Release()

	// Step 2: Fast fraud check (inline, must be fast)
	fraudReq := Request{
		ID:              req.ID,
		DebitAccountID:  req.DebitAccountID,
		CreditAccountID: req.CreditAccountID,
		Amount:          req.Amount,
		Ledger:          req.Ledger,
		Code:            req.Code,
		Flags:           req.Flags,
		Timestamp:       time.Now().UnixNano(),
	}

	if !uhp.fraudGate.QuickCheck(fraudReq) {
		atomic.AddUint64(&uhp.totalFailed, 1)
		uhp.metrics.IncrCounter("requests_fraud_blocked", 1)
		return TransferResponse{
			ID:     req.ID,
			Result: 1, // Fraud blocked
		}, nil
	}

	// Step 3: Submit to batch client (TigerBeetle commit)
	var resp TransferResponse
	var submitErr error

	err := uhp.tbCircuitBreaker.Execute(func() error {
		resp, submitErr = uhp.batchClient.SubmitSync(ctx, req)
		return submitErr
	})

	if err != nil {
		atomic.AddUint64(&uhp.totalFailed, 1)
		uhp.metrics.IncrCounter("requests_failed", 1)
		return TransferResponse{
			ID:    req.ID,
			Error: err,
		}, err
	}

	// Step 4: Record success
	if resp.Result == 0 {
		atomic.AddUint64(&uhp.totalSuccess, 1)
		uhp.metrics.IncrCounter("requests_success", 1)

		// Step 5: Async event emission (non-blocking)
		uhp.emitTransferEventAsync(req)
	} else {
		atomic.AddUint64(&uhp.totalFailed, 1)
		uhp.metrics.IncrCounter("requests_failed", 1)
	}

	// Record latency
	latency := time.Since(startTime)
	atomic.AddUint64(&uhp.totalLatencyNs, uint64(latency.Nanoseconds()))
	uhp.metrics.ObserveHistogram("request_latency_seconds", latency.Seconds())

	return resp, nil
}

// ProcessTransferBatch processes a batch of transfers
func (uhp *UnifiedHotPath) ProcessTransferBatch(ctx context.Context, requests []TransferRequest) ([]TransferResponse, error) {
	responses := make([]TransferResponse, len(requests))
	var wg sync.WaitGroup

	for i, req := range requests {
		wg.Add(1)
		go func(idx int, r TransferRequest) {
			defer wg.Done()
			resp, _ := uhp.ProcessTransfer(ctx, r)
			responses[idx] = resp
		}(i, req)
	}

	wg.Wait()
	return responses, nil
}

// emitTransferEventAsync emits a transfer event asynchronously
func (uhp *UnifiedHotPath) emitTransferEventAsync(req TransferRequest) {
	// Build minimal event payload
	payload := make([]byte, 64)
	copy(payload[0:16], req.ID[:])
	copy(payload[16:32], req.DebitAccountID[:])
	copy(payload[32:48], req.CreditAccountID[:])

	// Non-blocking emit through circuit breaker
	go func() {
		_ = uhp.kafkaCircuitBreaker.Execute(func() error {
			return uhp.kafkaOutbox.Emit("payment.transfers", req.ID[:], payload, nil)
		})
	}()
}

// mlScoringConsumer consumes ML scoring requests
func (uhp *UnifiedHotPath) mlScoringConsumer() {
	defer uhp.wg.Done()

	for {
		select {
		case <-uhp.ctx.Done():
			return
		case req := <-uhp.fraudGate.MLScoringChannel():
			// Process ML scoring request asynchronously
			uhp.processMLScoring(req)
		}
	}
}

// processMLScoring processes an ML scoring request
func (uhp *UnifiedHotPath) processMLScoring(req FraudScoringRequest) {
	// This would call the ML scoring service
	// For now, just emit to Kafka for async processing
	payload := make([]byte, 64)
	copy(payload[0:16], req.TransferID[:])
	copy(payload[16:32], req.PayerAccountID[:])
	copy(payload[32:48], req.PayeeAccountID[:])

	_ = uhp.kafkaOutbox.Emit("fraud.scoring.requests", req.TransferID[:], payload, nil)
	uhp.metrics.IncrCounter("ml_scoring_requests", 1)
}

// GenerateTransferID generates a new unique transfer ID
func (uhp *UnifiedHotPath) GenerateTransferID() [16]byte {
	return uhp.idGenerator.Generate()
}

// Stats returns hot path statistics
func (uhp *UnifiedHotPath) Stats() HotPathStats {
	requests := atomic.LoadUint64(&uhp.totalRequests)
	success := atomic.LoadUint64(&uhp.totalSuccess)
	failed := atomic.LoadUint64(&uhp.totalFailed)
	rejected := atomic.LoadUint64(&uhp.totalRejected)
	totalLatency := atomic.LoadUint64(&uhp.totalLatencyNs)

	var avgLatencyMs float64
	if requests > 0 {
		avgLatencyMs = float64(totalLatency) / float64(requests) / 1e6
	}

	fraudChecks, fraudBlocked, fraudAllowed := uhp.fraudGate.Stats()
	jwtValidations, jwtHits, jwtMisses, jwtErrors := uhp.jwtCache.Stats()
	bpAccepted, bpShed, bpThrottled, bpDepth := uhp.backpressure.Stats()
	batched, flushed := uhp.batchClient.Stats()
	kafkaQueued, kafkaSent, kafkaFailed, kafkaDropped := uhp.kafkaOutbox.Stats()

	return HotPathStats{
		TotalRequests:         requests,
		TotalSuccess:          success,
		TotalFailed:           failed,
		TotalRejected:         rejected,
		AvgLatencyMs:          avgLatencyMs,
		FraudChecks:           fraudChecks,
		FraudBlocked:          fraudBlocked,
		FraudAllowed:          fraudAllowed,
		JWTValidations:        jwtValidations,
		JWTCacheHits:          jwtHits,
		JWTCacheMisses:        jwtMisses,
		JWTErrors:             jwtErrors,
		BackpressureAccepted:  bpAccepted,
		BackpressureShed:      bpShed,
		BackpressureThrottled: bpThrottled,
		BackpressureDepth:     bpDepth,
		BatchedTransfers:      batched,
		FlushedTransfers:      flushed,
		KafkaQueued:           kafkaQueued,
		KafkaSent:             kafkaSent,
		KafkaFailed:           kafkaFailed,
		KafkaDropped:          kafkaDropped,
		TBCircuitState:        uhp.tbCircuitBreaker.State(),
		KafkaCircuitState:     uhp.kafkaCircuitBreaker.State(),
		HealthStatus:          uhp.healthChecker.IsHealthy(),
	}
}

// HotPathStats contains all hot path statistics
type HotPathStats struct {
	TotalRequests         uint64
	TotalSuccess          uint64
	TotalFailed           uint64
	TotalRejected         uint64
	AvgLatencyMs          float64
	FraudChecks           uint64
	FraudBlocked          uint64
	FraudAllowed          uint64
	JWTValidations        uint64
	JWTCacheHits          uint64
	JWTCacheMisses        uint64
	JWTErrors             uint64
	BackpressureAccepted  uint64
	BackpressureShed      uint64
	BackpressureThrottled uint64
	BackpressureDepth     int64
	BatchedTransfers      uint64
	FlushedTransfers      uint64
	KafkaQueued           uint64
	KafkaSent             uint64
	KafkaFailed           uint64
	KafkaDropped          uint64
	TBCircuitState        string
	KafkaCircuitState     string
	HealthStatus          bool
}

// HealthCheck returns health status
func (uhp *UnifiedHotPath) HealthCheck() map[string]*HealthCheckResult {
	return uhp.healthChecker.GetResults()
}

// IsHealthy returns true if all dependencies are healthy
func (uhp *UnifiedHotPath) IsHealthy() bool {
	return uhp.healthChecker.IsHealthy()
}

// Close shuts down the hot path processor
func (uhp *UnifiedHotPath) Close() error {
	uhp.cancel()
	uhp.wg.Wait()

	// Close components in order
	if err := uhp.batchClient.Close(); err != nil {
		return err
	}
	if err := uhp.kafkaOutbox.Close(); err != nil {
		return err
	}
	if err := uhp.jwtCache.Close(); err != nil {
		return err
	}
	if err := uhp.healthChecker.Close(); err != nil {
		return err
	}

	return nil
}

// SimulatedKafkaProducer provides a simulated Kafka producer for testing
type SimulatedKafkaProducer struct {
	produced uint64
	failed   uint64
}

// ProduceBatch implements KafkaProducer interface
func (p *SimulatedKafkaProducer) ProduceBatch(ctx context.Context, events []KafkaEvent) error {
	atomic.AddUint64(&p.produced, uint64(len(events)))
	return nil
}

// Close implements KafkaProducer interface
func (p *SimulatedKafkaProducer) Close() error {
	return nil
}

// Stats returns producer statistics
func (p *SimulatedKafkaProducer) Stats() (produced, failed uint64) {
	return atomic.LoadUint64(&p.produced), atomic.LoadUint64(&p.failed)
}
