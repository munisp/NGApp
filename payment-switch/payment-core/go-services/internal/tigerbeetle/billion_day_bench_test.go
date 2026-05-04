package tigerbeetle

import (
	"context"
	"crypto/rand"
	"testing"
	"time"
)

// BenchmarkBatchSerialization measures the serialization throughput
// for the optimal 8,190 transfer batch (1MB envelope).
func BenchmarkBatchSerialization(b *testing.B) {
	batch := make([]*Transfer1B, OptimalBatchSize)
	for i := range batch {
		t := &Transfer1B{
			UserData64: uint64(i),
			UserData32: uint32(i),
			Ledger:     1,
			Code:       1,
			Flags:      0,
			Timestamp:  uint64(time.Now().UnixNano()),
		}
		rand.Read(t.ID[:])
		rand.Read(t.DebitAccountID[:])
		rand.Read(t.CreditAccountID[:])
		rand.Read(t.Amount[:])
		batch[i] = t
	}

	b.ResetTimer()
	b.SetBytes(int64(OptimalBatchSize * BillionDayTransferSize))

	for i := 0; i < b.N; i++ {
		_ = serializeBatch(batch)
	}
}

// BenchmarkPipelineSubmit measures the throughput of submitting
// transfers to the batch pipeline (the hot path for producers).
func BenchmarkPipelineSubmit(b *testing.B) {
	bp := NewBatchPipeline(OptimalBatchSize, BatchFillTimeAtPeak, MaxPipelineDepth, 4)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Drain batches in background
	for _, shard := range bp.shards {
		go func(s *PipelineShard) {
			for {
				select {
				case <-ctx.Done():
					return
				case <-s.flushCh:
					// Discard
				}
			}
		}(shard)
	}

	t := &Transfer1B{
		UserData64: 1,
		Ledger:     1,
		Code:       1,
	}
	rand.Read(t.ID[:])
	rand.Read(t.DebitAccountID[:])
	rand.Read(t.CreditAccountID[:])

	b.ResetTimer()
	b.SetBytes(BillionDayTransferSize)

	for i := 0; i < b.N; i++ {
		_ = bp.Submit(ctx, t)
	}
}

// BenchmarkCapacityPlan measures how fast we can generate capacity plans.
func BenchmarkCapacityPlan(b *testing.B) {
	cfg := DefaultBillionDayConfig()
	planner := NewCapacityPlanner(cfg)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = planner.Plan()
	}
}

// TestCapacityPlanMath validates the napkin math from the article.
func TestCapacityPlanMath(t *testing.T) {
	cfg := DefaultBillionDayConfig()
	cfg.TargetTPS = PeakSeasonalTPS // 60,000 TPS
	planner := NewCapacityPlanner(cfg)
	plan := planner.Plan()

	// Verify node count: 60K TPS / 48K per node = 2 nodes minimum,
	// but config specifies 12 for redundancy
	if plan.NodesRequired < 2 {
		t.Errorf("Expected at least 2 nodes for 60K TPS, got %d", plan.NodesRequired)
	}

	// Verify batch math: 8,190 / 60,000 = 136.5ms fill time
	expectedFillMs := float64(OptimalBatchSize) / float64(PeakSeasonalTPS) * 1000
	if plan.BatchFillTimeMs < expectedFillMs-1 || plan.BatchFillTimeMs > expectedFillMs+1 {
		t.Errorf("Expected batch fill time ~%.1fms, got %.1fms", expectedFillMs, plan.BatchFillTimeMs)
	}

	// Verify daily data: 60K * 86400 * 128 = ~635 GB/day
	expectedDailyGB := float64(PeakSeasonalTPS) * 86400 * BillionDayTransferSize / (1024 * 1024 * 1024)
	if plan.DailyDataGB < expectedDailyGB*0.99 || plan.DailyDataGB > expectedDailyGB*1.01 {
		t.Errorf("Expected daily data ~%.1f GB, got %.1f GB", expectedDailyGB, plan.DailyDataGB)
	}

	// Verify batch size is exactly 1MB envelope
	if plan.BatchSizeBytes != BatchEnvelopeSize {
		t.Errorf("Expected batch size %d, got %d", BatchEnvelopeSize, plan.BatchSizeBytes)
	}

	// Verify cold tier cost is reasonable (~$2,150/month for 1B/day at 10 years)
	if plan.ColdTierMonthlyCost <= 0 {
		t.Error("Cold tier cost should be positive")
	}
}

// TestTransfer1BSize verifies the transfer struct is exactly 128 bytes.
func TestTransfer1BSize(t *testing.T) {
	// The struct should serialize to exactly 128 bytes
	transfer := &Transfer1B{}
	buf := serializeBatch([]*Transfer1B{transfer})
	if len(buf) != BillionDayTransferSize {
		t.Errorf("Expected transfer to serialize to %d bytes, got %d", BillionDayTransferSize, len(buf))
	}
}

// TestBatchEnvelopeSize verifies 8,190 transfers = 1MB.
func TestBatchEnvelopeSize(t *testing.T) {
	expected := 8190 * 128 // 1,048,320 bytes
	if BatchEnvelopeSize != expected {
		t.Errorf("Expected batch envelope %d bytes, got %d", expected, BatchEnvelopeSize)
	}

	// Should be approximately 1MB
	oneMB := 1024 * 1024 // 1,048,576
	diff := oneMB - BatchEnvelopeSize
	if diff < 0 || diff > 300 {
		t.Errorf("Batch envelope should be ≈1MB (diff: %d bytes)", diff)
	}
}
