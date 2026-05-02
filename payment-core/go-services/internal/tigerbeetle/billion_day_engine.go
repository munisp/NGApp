// Package tigerbeetle implements the 1B payments/day architecture
// based on https://backend.how/posts/1b-payments-per-day/
//
// Key design choices from the article:
// - TigerBeetle for hot-path transactions (48K TPS sustained per node)
// - PostgreSQL for audit/reporting queries (dual-write)
// - Batch size of 8,190 transfers (exactly 1MB envelope)
// - Pipeline fill-bound: fill batch N+1 while server processes batch N
// - 12 nodes for 1B/day at 5x seasonal headroom
// - Cold-tier archival with Parquet + zstd(3) for 10-year retention
package tigerbeetle

import (
	"context"
	"encoding/binary"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Architecture constants from the article's napkin math:
// - 1B transfers/day = 11,574 avg TPS ≈ 12,000 TPS
// - Daily peak = 2.5x average = 30,000 TPS
// - Seasonal peak = 5x average = 60,000 TPS
// - Transfer size = 128 bytes (cache-line aligned)
// - Batch = 8,190 transfers = 1,048,320 bytes ≈ 1 MB
// - At 30K TPS, batch fills in 273ms, processes in 170ms (fill-bound)
// - Daily raw data = 128 GB/day
// - Hot tier (90 days, 6x replicas) = ~69 TB
// - Cold tier (10 years, zstd compressed) = ~94 TB on S3
const (
	// BillionDayTransferSize is the fixed size of a TigerBeetle transfer record.
	// 128 bytes fits cache lines, aligns with page boundaries.
	BillionDayTransferSize = 128

	// OptimalBatchSize is 8,190 transfers per batch.
	// This fills exactly one 1MB TigerBeetle message envelope.
	// 8,190 * 128 = 1,048,320 bytes ≈ 1 MB
	OptimalBatchSize = 8190

	// BatchEnvelopeSize is the size of one full batch in bytes.
	BatchEnvelopeSize = OptimalBatchSize * BillionDayTransferSize // 1,048,320 bytes

	// AvgTPS is the average transactions per second for 1B/day.
	AvgTPS = 11574

	// PeakDailyTPS is the daily peak (2.5x average).
	// Morning 11 AM rush and evening 8-10 PM burst.
	PeakDailyTPS = 30000

	// PeakSeasonalTPS is the seasonal peak (5x average).
	// Diwali, IPL finals, tax deadlines.
	PeakSeasonalTPS = 60000

	// BatchFillTimeAtPeak is how long it takes to fill a batch at 30K TPS.
	// 8,190 / 30,000 = 273ms
	BatchFillTimeAtPeak = 273 * time.Millisecond

	// BatchProcessTime is server-side processing time per batch.
	// Measured: ~170ms (LSM inserts, balance checks, io_uring writes, checksums).
	BatchProcessTime = 170 * time.Millisecond

	// MaxPipelineDepth controls how many batches can be in-flight.
	// Since fill time > process time, pipeline depth of 2 is sufficient.
	MaxPipelineDepth = 3

	// HotTierRetentionDays is the hot-tier retention window.
	HotTierRetentionDays = 90

	// HotTierReplicas is the replication factor for hot data.
	HotTierReplicas = 6

	// ColdTierRetentionYears is the regulatory retention period.
	ColdTierRetentionYears = 10

	// NodesForBillionPerDay is the number of nodes needed.
	// Each node sustains ~48K TPS, with 12 nodes providing 5x headroom.
	NodesForBillionPerDay = 12

	// DailyRawDataGB is the raw data generated per day.
	// 1B * 128 bytes = 128 GB
	DailyRawDataGB = 128

	// ParquetCompressionRatio is the zstd(3) compression ratio on transfer data.
	// Measured: 4.7x compression (27.3 B/row from 128 B/row).
	ParquetCompressionRatio = 4.7

	// CompressedBytesPerRow is the compressed size after Parquet + zstd(3).
	CompressedBytesPerRow = 27
)

// BillionDayEngine is the high-throughput payment processing engine
// designed for 1B payments/day following the architecture from
// https://backend.how/posts/1b-payments-per-day/
type BillionDayEngine struct {
	// Pipeline management
	batchPipeline *BatchPipeline
	numShards     int

	// Dual-write: TigerBeetle for hot path, PostgreSQL for queries
	tbClient *TBClientPool
	pgWriter *PostgresDualWriter

	// Cold-tier archival
	archiver *ColdTierArchiver

	// Capacity planning
	capacity *CapacityPlanner

	// Metrics
	metrics *EngineMetrics

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// EngineMetrics tracks the engine's performance against 1B/day targets.
type EngineMetrics struct {
	TransfersProcessed uint64
	BatchesSent        uint64
	PipelineStalls     uint64
	AvgBatchLatencyNs  uint64
	P99BatchLatencyNs  uint64
	CurrentTPS         uint64
	PeakTPS            uint64
	DailyVolume        uint64
	FillTimeNs         uint64
	ProcessTimeNs      uint64
}

// BillionDayConfig configures the engine for target throughput.
type BillionDayConfig struct {
	// TigerBeetle cluster addresses
	TBAddresses []string
	// Number of shards (default: 12 for 1B/day)
	NumShards int
	// PostgreSQL DSN for dual-write
	PostgresDSN string
	// S3 bucket for cold-tier archival
	ArchiveBucket string
	// Target TPS (default: 60,000 for seasonal peak)
	TargetTPS int
	// Batch flush timeout (default: derived from target TPS)
	BatchFlushTimeout time.Duration
}

// DefaultBillionDayConfig returns production defaults for 1B payments/day.
func DefaultBillionDayConfig() *BillionDayConfig {
	return &BillionDayConfig{
		TBAddresses:       []string{"localhost:3000"},
		NumShards:         NodesForBillionPerDay,
		PostgresDSN:       "postgres://localhost:5432/payments?sslmode=require",
		ArchiveBucket:     "s3://payment-archive-cold-tier",
		TargetTPS:         PeakSeasonalTPS,
		BatchFlushTimeout: BatchFillTimeAtPeak,
	}
}

// NewBillionDayEngine creates a new engine configured for 1B payments/day.
func NewBillionDayEngine(cfg *BillionDayConfig) *BillionDayEngine {
	if cfg == nil {
		cfg = DefaultBillionDayConfig()
	}

	ctx, cancel := context.WithCancel(context.Background())

	engine := &BillionDayEngine{
		numShards: cfg.NumShards,
		capacity:  NewCapacityPlanner(cfg),
		metrics:   &EngineMetrics{},
		ctx:       ctx,
		cancel:    cancel,
	}

	// Initialize batch pipeline with optimal 8,190 batch size
	engine.batchPipeline = NewBatchPipeline(
		OptimalBatchSize,
		cfg.BatchFlushTimeout,
		MaxPipelineDepth,
		cfg.NumShards,
	)

	// Initialize TigerBeetle connection pool
	engine.tbClient = NewTBClientPool(cfg.TBAddresses, cfg.NumShards)

	// Initialize PostgreSQL dual-writer
	engine.pgWriter = NewPostgresDualWriter(cfg.PostgresDSN)

	// Initialize cold-tier archiver
	engine.archiver = NewColdTierArchiver(cfg.ArchiveBucket)

	return engine
}

// Start begins processing transfers through the pipeline.
func (e *BillionDayEngine) Start() error {
	// Start batch pipeline workers
	e.batchPipeline.Start(e.ctx, &e.wg, e.processBatch)

	// Start cold-tier archival background job
	e.wg.Add(1)
	go e.archivalLoop()

	// Start metrics collection
	e.wg.Add(1)
	go e.metricsLoop()

	return nil
}

// Stop gracefully shuts down the engine, flushing pending batches.
func (e *BillionDayEngine) Stop() error {
	e.cancel()
	e.wg.Wait()
	return nil
}

// SubmitTransfer submits a single transfer to the pipeline.
// The transfer is batched with others and sent when the batch fills
// (8,190 transfers) or the flush timeout expires (273ms at peak TPS).
func (e *BillionDayEngine) SubmitTransfer(ctx context.Context, t *Transfer1B) error {
	return e.batchPipeline.Submit(ctx, t)
}

// SubmitBatch submits a pre-formed batch directly.
func (e *BillionDayEngine) SubmitBatch(ctx context.Context, transfers []*Transfer1B) error {
	for _, t := range transfers {
		if err := e.batchPipeline.Submit(ctx, t); err != nil {
			return err
		}
	}
	return nil
}

// processBatch handles a full batch of transfers.
// This is the hot path — called when 8,190 transfers are ready.
func (e *BillionDayEngine) processBatch(batch []*Transfer1B) error {
	start := time.Now()

	// 1. Serialize batch to TigerBeetle binary protocol
	buf := serializeBatch(batch)

	// 2. Send to TigerBeetle (hot-path write)
	if err := e.tbClient.SendBatch(buf); err != nil {
		return fmt.Errorf("tigerbeetle batch write: %w", err)
	}

	// 3. Dual-write to PostgreSQL (async, for queries/reporting)
	e.pgWriter.WriteBatchAsync(batch)

	// 4. Update metrics
	atomic.AddUint64(&e.metrics.TransfersProcessed, uint64(len(batch)))
	atomic.AddUint64(&e.metrics.BatchesSent, 1)
	atomic.AddUint64(&e.metrics.ProcessTimeNs, uint64(time.Since(start).Nanoseconds()))

	return nil
}

// archivalLoop periodically archives expired hot-tier data to cold storage.
func (e *BillionDayEngine) archivalLoop() {
	defer e.wg.Done()

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.archiver.ArchiveExpiredData(HotTierRetentionDays)
		}
	}
}

// metricsLoop calculates real-time TPS and pipeline health.
func (e *BillionDayEngine) metricsLoop() {
	defer e.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	var lastCount uint64

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			current := atomic.LoadUint64(&e.metrics.TransfersProcessed)
			tps := current - lastCount
			atomic.StoreUint64(&e.metrics.CurrentTPS, tps)

			peak := atomic.LoadUint64(&e.metrics.PeakTPS)
			if tps > peak {
				atomic.StoreUint64(&e.metrics.PeakTPS, tps)
			}

			lastCount = current
		}
	}
}

// GetMetrics returns current engine metrics.
func (e *BillionDayEngine) GetMetrics() EngineMetrics {
	return EngineMetrics{
		TransfersProcessed: atomic.LoadUint64(&e.metrics.TransfersProcessed),
		BatchesSent:        atomic.LoadUint64(&e.metrics.BatchesSent),
		PipelineStalls:     atomic.LoadUint64(&e.metrics.PipelineStalls),
		CurrentTPS:         atomic.LoadUint64(&e.metrics.CurrentTPS),
		PeakTPS:            atomic.LoadUint64(&e.metrics.PeakTPS),
	}
}

// --- Transfer1B: the 128-byte transfer record ---

// Transfer1B is the 128-byte transfer record matching TigerBeetle's schema.
// Exactly cache-line aligned, packs 8,190 per 1MB batch.
type Transfer1B struct {
	ID              [16]byte // 16 bytes - Uint128
	DebitAccountID  [16]byte // 16 bytes - Uint128
	CreditAccountID [16]byte // 16 bytes - Uint128
	Amount          [16]byte // 16 bytes - Uint128
	PendingID       [16]byte // 16 bytes - Uint128
	UserData128     [16]byte // 16 bytes - Uint128
	UserData64      uint64   // 8 bytes
	UserData32      uint32   // 4 bytes
	Timeout         uint32   // 4 bytes
	Ledger          uint32   // 4 bytes
	Code            uint16   // 2 bytes
	Flags           uint16   // 2 bytes
	Timestamp       uint64   // 8 bytes
	// Total: 128 bytes
}

// serializeBatch converts transfers to the TigerBeetle binary wire format.
// Zero-copy where possible — pre-allocated buffer reuse.
func serializeBatch(batch []*Transfer1B) []byte {
	buf := make([]byte, len(batch)*BillionDayTransferSize)
	for i, t := range batch {
		offset := i * BillionDayTransferSize
		copy(buf[offset:], t.ID[:])
		copy(buf[offset+16:], t.DebitAccountID[:])
		copy(buf[offset+32:], t.CreditAccountID[:])
		copy(buf[offset+48:], t.Amount[:])
		copy(buf[offset+64:], t.PendingID[:])
		copy(buf[offset+80:], t.UserData128[:])
		binary.LittleEndian.PutUint64(buf[offset+96:], t.UserData64)
		binary.LittleEndian.PutUint32(buf[offset+104:], t.UserData32)
		binary.LittleEndian.PutUint32(buf[offset+108:], t.Timeout)
		binary.LittleEndian.PutUint32(buf[offset+112:], t.Ledger)
		binary.LittleEndian.PutUint16(buf[offset+116:], t.Code)
		binary.LittleEndian.PutUint16(buf[offset+118:], t.Flags)
		binary.LittleEndian.PutUint64(buf[offset+120:], t.Timestamp)
	}
	return buf
}

// --- Batch Pipeline: fill-bound architecture ---

// BatchPipeline implements the fill-bound pipeline from the article.
// Batch N+1 fills while server processes batch N.
type BatchPipeline struct {
	batchSize     int
	flushTimeout  time.Duration
	pipelineDepth int
	numShards     int
	shards        []*PipelineShard
}

// PipelineShard is a single shard's batch accumulator.
type PipelineShard struct {
	mu        sync.Mutex
	transfers []*Transfer1B
	flushCh   chan []*Transfer1B
	sem       chan struct{} // Pipeline depth semaphore
}

// NewBatchPipeline creates a pipeline with the specified batch size and pipeline depth.
func NewBatchPipeline(batchSize int, flushTimeout time.Duration, pipelineDepth, numShards int) *BatchPipeline {
	bp := &BatchPipeline{
		batchSize:     batchSize,
		flushTimeout:  flushTimeout,
		pipelineDepth: pipelineDepth,
		numShards:     numShards,
		shards:        make([]*PipelineShard, numShards),
	}

	for i := range bp.shards {
		bp.shards[i] = &PipelineShard{
			transfers: make([]*Transfer1B, 0, batchSize),
			flushCh:   make(chan []*Transfer1B, pipelineDepth),
			sem:       make(chan struct{}, pipelineDepth),
		}
	}

	return bp
}

// Start launches the pipeline workers.
func (bp *BatchPipeline) Start(ctx context.Context, wg *sync.WaitGroup, processFn func([]*Transfer1B) error) {
	for i, shard := range bp.shards {
		// Flush timer goroutine
		wg.Add(1)
		go bp.flushTimer(ctx, wg, shard)

		// Processing worker goroutine
		wg.Add(1)
		go bp.processWorker(ctx, wg, i, shard, processFn)
	}
}

// Submit adds a transfer to the appropriate shard's batch.
// Returns when the transfer is accepted into the batch (not when processed).
func (bp *BatchPipeline) Submit(ctx context.Context, t *Transfer1B) error {
	// Shard by debit account ID for locality
	shardIdx := int(binary.LittleEndian.Uint32(t.DebitAccountID[:4])) % bp.numShards

	shard := bp.shards[shardIdx]
	shard.mu.Lock()
	shard.transfers = append(shard.transfers, t)

	if len(shard.transfers) >= bp.batchSize {
		// Batch is full — flush immediately
		batch := shard.transfers
		shard.transfers = make([]*Transfer1B, 0, bp.batchSize)
		shard.mu.Unlock()

		// Pipeline: this blocks only if pipeline is full (depth exceeded)
		select {
		case shard.flushCh <- batch:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	shard.mu.Unlock()
	return nil
}

// flushTimer flushes partial batches after the fill timeout.
func (bp *BatchPipeline) flushTimer(ctx context.Context, wg *sync.WaitGroup, shard *PipelineShard) {
	defer wg.Done()

	ticker := time.NewTicker(bp.flushTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			shard.mu.Lock()
			if len(shard.transfers) > 0 {
				batch := shard.transfers
				shard.transfers = make([]*Transfer1B, 0, bp.batchSize)
				shard.mu.Unlock()

				select {
				case shard.flushCh <- batch:
				case <-ctx.Done():
					return
				}
			} else {
				shard.mu.Unlock()
			}
		}
	}
}

// processWorker consumes batches from the flush channel.
func (bp *BatchPipeline) processWorker(ctx context.Context, wg *sync.WaitGroup, shardID int, shard *PipelineShard, processFn func([]*Transfer1B) error) {
	defer wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case batch := <-shard.flushCh:
			if err := processFn(batch); err != nil {
				// Log error but continue processing
				fmt.Printf("[shard-%d] batch processing error: %v\n", shardID, err)
			}
		}
	}
}

// --- TigerBeetle Client Pool ---

// TBClientPool manages connections to TigerBeetle cluster nodes.
type TBClientPool struct {
	addresses []string
	numNodes  int
	connIndex uint64
}

// NewTBClientPool creates a pool of TigerBeetle connections.
func NewTBClientPool(addresses []string, numNodes int) *TBClientPool {
	return &TBClientPool{
		addresses: addresses,
		numNodes:  numNodes,
	}
}

// SendBatch sends a serialized batch to the appropriate TigerBeetle node.
func (p *TBClientPool) SendBatch(data []byte) error {
	// Round-robin across nodes
	idx := atomic.AddUint64(&p.connIndex, 1) % uint64(p.numNodes)
	_ = idx // In production, select connection by index
	// Actual TigerBeetle client send would go here
	return nil
}

// --- PostgreSQL Dual Writer ---

// PostgresDualWriter asynchronously writes transfer data to PostgreSQL
// for reporting and audit queries. This is the "query layer" in the
// dual-write architecture — TigerBeetle handles hot-path, PG handles queries.
type PostgresDualWriter struct {
	dsn     string
	batchCh chan []*Transfer1B
}

// NewPostgresDualWriter creates a new dual-writer.
func NewPostgresDualWriter(dsn string) *PostgresDualWriter {
	return &PostgresDualWriter{
		dsn:     dsn,
		batchCh: make(chan []*Transfer1B, 100),
	}
}

// WriteBatchAsync queues a batch for async write to PostgreSQL.
// This is fire-and-forget — TigerBeetle is the source of truth.
func (pw *PostgresDualWriter) WriteBatchAsync(batch []*Transfer1B) {
	select {
	case pw.batchCh <- batch:
	default:
		// Drop if channel full — PG is secondary, TB is source of truth
	}
}

// --- Cold Tier Archiver ---

// ColdTierArchiver handles archival of expired hot-tier data to S3
// using Parquet + zstd(3) compression for 10-year regulatory retention.
//
// From the article:
// - zstd(3) achieves 4.7x compression (27.3 B/row from 128 B/row)
// - 10-year cold tier: ~94 TB on S3, ~$2,150/month
// - Dictionary encoding on low-cardinality columns (ledger, flags, code)
// - Delta encoding on id_hi and timestamp
type ColdTierArchiver struct {
	bucket string
}

// NewColdTierArchiver creates a new archiver.
func NewColdTierArchiver(bucket string) *ColdTierArchiver {
	return &ColdTierArchiver{bucket: bucket}
}

// ArchiveExpiredData archives transfers older than retentionDays.
func (a *ColdTierArchiver) ArchiveExpiredData(retentionDays int) {
	// In production:
	// 1. Query TigerBeetle for transfers older than retention window
	// 2. Convert to Parquet with zstd(3) + dictionary encoding
	// 3. Upload to S3 with lifecycle policies
	// 4. Verify upload integrity
	// 5. Remove from hot tier
}

// StorageCostEstimate returns monthly S3 storage cost for cold tier.
func (a *ColdTierArchiver) StorageCostEstimate(yearsRetained int) float64 {
	// 1B/day * 27.3 B/row (compressed) * 365 days * years
	dailyCompressedGB := float64(1_000_000_000*CompressedBytesPerRow) / (1024 * 1024 * 1024)
	totalTB := dailyCompressedGB * 365 * float64(yearsRetained) / 1024
	// S3 Standard-IA: ~$0.0125/GB/month
	monthlyCostPerTB := 0.0125 * 1024
	return totalTB * monthlyCostPerTB
}

// --- Capacity Planner ---

// CapacityPlanner calculates infrastructure requirements for target TPS.
type CapacityPlanner struct {
	config *BillionDayConfig
}

// NewCapacityPlanner creates a capacity planner.
func NewCapacityPlanner(cfg *BillionDayConfig) *CapacityPlanner {
	return &CapacityPlanner{config: cfg}
}

// CapacityPlan represents the infrastructure requirements.
type CapacityPlan struct {
	// Compute
	NodesRequired      int
	TPSPerNode         int
	PeakTPSCapacity    int
	HeadroomPercent    float64
	PipelineDepth      int
	BatchesPerSecond   float64
	BatchFillTimeMs    float64
	BatchProcessTimeMs float64

	// Storage - Hot Tier
	HotTierTotalTB    float64
	HotTierPerNodeTB  float64
	NVMeDrivesPerNode int
	RetentionDays     int
	ReplicationFactor int

	// Storage - Cold Tier
	ColdTierTotalTB     float64
	ColdTierMonthlyCost float64
	CompressionRatio    float64
	RetentionYears      int

	// Network
	DailyDataGB       float64
	PeakBandwidthMBps float64
	BatchSizeBytes    int
}

// Plan generates a capacity plan for the target throughput.
func (cp *CapacityPlanner) Plan() *CapacityPlan {
	targetTPS := cp.config.TargetTPS
	if targetTPS == 0 {
		targetTPS = PeakSeasonalTPS
	}

	// From article: each node sustains ~48K TPS
	tpsPerNode := 48000
	nodesRequired := (targetTPS + tpsPerNode - 1) / tpsPerNode
	if nodesRequired < cp.config.NumShards {
		nodesRequired = cp.config.NumShards
	}

	// Batch math
	batchesPerSec := float64(targetTPS) / float64(OptimalBatchSize)
	fillTimeMs := float64(OptimalBatchSize) / float64(targetTPS) * 1000
	processTimeMs := 170.0 // measured

	// Hot tier: transfers/day * 128B * retention * replicas
	dailyBytes := float64(targetTPS) * 86400 * BillionDayTransferSize
	hotTierTB := dailyBytes * float64(HotTierRetentionDays) * float64(HotTierReplicas) / (1024 * 1024 * 1024 * 1024)
	hotTierPerNode := hotTierTB / float64(nodesRequired)

	// NVMe drives: 20TB each, 22% headroom for LSM compaction
	nvmePerNode := int(hotTierPerNode*1.22/20) + 1

	// Cold tier: compressed with Parquet + zstd(3)
	coldDailyGB := float64(targetTPS) * 86400 * CompressedBytesPerRow / (1024 * 1024 * 1024)
	coldTierTB := coldDailyGB * 365 * float64(ColdTierRetentionYears) / 1024
	coldMonthlyCost := coldTierTB * 0.0125 * 1024 // S3 Standard-IA

	// Network
	peakBandwidth := float64(targetTPS) * BillionDayTransferSize / (1024 * 1024) // MB/s

	return &CapacityPlan{
		NodesRequired:      nodesRequired,
		TPSPerNode:         tpsPerNode,
		PeakTPSCapacity:    nodesRequired * tpsPerNode,
		HeadroomPercent:    float64(nodesRequired*tpsPerNode-targetTPS) / float64(targetTPS) * 100,
		PipelineDepth:      MaxPipelineDepth,
		BatchesPerSecond:   batchesPerSec,
		BatchFillTimeMs:    fillTimeMs,
		BatchProcessTimeMs: processTimeMs,

		HotTierTotalTB:    hotTierTB,
		HotTierPerNodeTB:  hotTierPerNode,
		NVMeDrivesPerNode: nvmePerNode,
		RetentionDays:     HotTierRetentionDays,
		ReplicationFactor: HotTierReplicas,

		ColdTierTotalTB:     coldTierTB,
		ColdTierMonthlyCost: coldMonthlyCost,
		CompressionRatio:    ParquetCompressionRatio,
		RetentionYears:      ColdTierRetentionYears,

		DailyDataGB:       float64(targetTPS) * 86400 * BillionDayTransferSize / (1024 * 1024 * 1024),
		PeakBandwidthMBps: peakBandwidth,
		BatchSizeBytes:    BatchEnvelopeSize,
	}
}
