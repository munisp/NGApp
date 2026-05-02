package reconciliation

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// BenchmarkStreamProcessing measures per-record processing speed
func BenchmarkStreamProcessing(b *testing.B) {
	streamer := NewStreamer(StreamerConfig{
		BatchSize:       1000,
		MaxConcurrency:  8,
		CheckpointEvery: 10000,
	})

	// Create mock transaction records
	records := make([]Transaction, b.N)
	for i := range records {
		records[i] = Transaction{
			ID:        fmt.Sprintf("tx-%d", i),
			AccountID: fmt.Sprintf("acc-%d", i%100),
			Amount:    int64((i%1000 + 1) * 100),
			Currency:  "NGN",
			Reference: fmt.Sprintf("ref-%d", i),
			Status:    "completed",
			Timestamp: time.Now().Add(-time.Duration(i) * time.Millisecond),
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		streamer.ProcessRecord(context.Background(), &records[i%len(records)])
	}
}

// BenchmarkDiscrepancyDetection measures matching algorithm speed
func BenchmarkDiscrepancyDetection(b *testing.B) {
	streamer := NewStreamer(StreamerConfig{
		BatchSize:       1000,
		MaxConcurrency:  8,
		CheckpointEvery: 10000,
	})

	tx := &Transaction{
		ID:        "tx-1",
		AccountID: "acc-1",
		Amount:    50_000_00,
		Currency:  "NGN",
		Reference: "ref-1",
		Status:    "completed",
		Timestamp: time.Now(),
	}

	// Matching ledger entry
	entry := &LedgerEntry{
		Amount:    50_000_00,
		Timestamp: time.Now().UnixNano(),
		Code:      100,
		UserData:  "tx-1",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		streamer.Compare(tx, entry)
	}
}

// BenchmarkBatchReconciliation measures batch processing throughput
func BenchmarkBatchReconciliation(b *testing.B) {
	streamer := NewStreamer(StreamerConfig{
		BatchSize:       1000,
		MaxConcurrency:  8,
		CheckpointEvery: 10000,
	})

	// Create batch
	batch := make([]Transaction, 1000)
	entries := make([]LedgerEntry, 1000)
	for i := range batch {
		batch[i] = Transaction{
			ID:        fmt.Sprintf("tx-%d", i),
			AccountID: fmt.Sprintf("acc-%d", i%50),
			Amount:    int64((i%500 + 1) * 100),
			Currency:  "NGN",
			Status:    "completed",
			Timestamp: time.Now(),
		}
		entries[i] = LedgerEntry{
			Amount:    uint64((i%500 + 1) * 100),
			Timestamp: time.Now().UnixNano(),
			UserData:  fmt.Sprintf("tx-%d", i),
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		streamer.ReconcileBatch(context.Background(), batch, entries)
	}
}

// BenchmarkMemoryConstancy verifies constant memory under load
func BenchmarkMemoryConstancy(b *testing.B) {
	streamer := NewStreamer(StreamerConfig{
		BatchSize:       1000,
		MaxConcurrency:  4,
		CheckpointEvery: 5000,
	})

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		tx := &Transaction{
			ID:        fmt.Sprintf("tx-%d", i),
			AccountID: "acc-1",
			Amount:    50_000_00,
			Currency:  "NGN",
			Status:    "completed",
			Timestamp: time.Now(),
		}
		streamer.ProcessRecord(context.Background(), tx)
	}
}
