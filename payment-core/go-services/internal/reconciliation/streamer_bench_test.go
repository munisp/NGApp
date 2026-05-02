package reconciliation

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// mockTxSource implements StreamTransactionSource for benchmarks
type mockTxSource struct {
	records []StreamTransaction
	cursor  int
}

func (m *mockTxSource) FetchBatch(_ context.Context, cursor string, limit int) ([]StreamTransaction, string, error) {
	start := m.cursor
	if start >= len(m.records) {
		return nil, "", nil
	}
	end := start + limit
	if end > len(m.records) {
		end = len(m.records)
	}
	m.cursor = end
	nextCursor := ""
	if end < len(m.records) {
		nextCursor = fmt.Sprintf("%d", end)
	}
	return m.records[start:end], nextCursor, nil
}

// mockLedgerSource implements StreamLedgerSource for benchmarks
type mockLedgerSource struct{}

func (m *mockLedgerSource) GetByReference(_ context.Context, reference string) (*StreamLedgerEntry, error) {
	// Simulate a successful lookup
	return &StreamLedgerEntry{
		Amount:    50_000_00,
		Timestamp: time.Now().UnixNano(),
		UserData:  reference,
	}, nil
}

func (m *mockLedgerSource) GetByTimeRange(_ context.Context, _, _ time.Time, _ string, _ int) ([]StreamLedgerEntry, string, error) {
	return nil, "", nil
}

// BenchmarkStreamProcessing measures per-record processing speed via full Run
func BenchmarkStreamProcessing(b *testing.B) {
	records := make([]StreamTransaction, 1000)
	for i := range records {
		records[i] = StreamTransaction{
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
		src := &mockTxSource{records: records, cursor: 0}
		streamer := NewStreamer(DefaultStreamConfig(), src, &mockLedgerSource{})
		_, _ = streamer.Run(context.Background())
	}
}

// BenchmarkReconcileTransaction measures single transaction reconciliation throughput
func BenchmarkReconcileTransaction(b *testing.B) {
	src := &mockTxSource{}
	streamer := NewStreamer(DefaultStreamConfig(), src, &mockLedgerSource{})

	tx := &StreamTransaction{
		ID:        "tx-1",
		AccountID: "acc-1",
		Amount:    50_000_00,
		Currency:  "NGN",
		Reference: "ref-1",
		Status:    "completed",
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		streamer.reconcileTransaction(context.Background(), tx)
	}
}

// BenchmarkBatchReconciliation measures batch processing throughput
func BenchmarkBatchReconciliation(b *testing.B) {
	batch := make([]StreamTransaction, 1000)
	for i := range batch {
		batch[i] = StreamTransaction{
			ID:        fmt.Sprintf("tx-%d", i),
			AccountID: fmt.Sprintf("acc-%d", i%50),
			Amount:    int64((i%500 + 1) * 100),
			Currency:  "NGN",
			Reference: fmt.Sprintf("ref-%d", i),
			Status:    "completed",
			Timestamp: time.Now(),
		}
	}

	src := &mockTxSource{}
	streamer := NewStreamer(DefaultStreamConfig(), src, &mockLedgerSource{})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		streamer.processBatch(context.Background(), batch)
	}
}

// BenchmarkMemoryConstancy verifies constant memory under load
func BenchmarkMemoryConstancy(b *testing.B) {
	src := &mockTxSource{}
	streamer := NewStreamer(DefaultStreamConfig(), src, &mockLedgerSource{})

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		tx := &StreamTransaction{
			ID:        fmt.Sprintf("tx-%d", i),
			AccountID: "acc-1",
			Amount:    50_000_00,
			Currency:  "NGN",
			Reference: fmt.Sprintf("ref-%d", i),
			Status:    "completed",
			Timestamp: time.Now(),
		}
		streamer.reconcileTransaction(context.Background(), tx)
	}
}
