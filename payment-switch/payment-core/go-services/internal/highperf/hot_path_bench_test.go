package highperf

import (
	"context"
	"crypto/rand"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// BenchmarkRequestQueuePush measures per-core queue throughput
func BenchmarkRequestQueuePush(b *testing.B) {
	q := NewRequestQueue(65536)
	req := Request{Amount: 1_000_000, Ledger: 1, Code: 100}
	rand.Read(req.ID[:])
	rand.Read(req.DebitAccountID[:])
	rand.Read(req.CreditAccountID[:])

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			q.Push(req)
		}
	})
}

// BenchmarkRequestQueuePopBatch measures dequeue performance
func BenchmarkRequestQueuePopBatch(b *testing.B) {
	q := NewRequestQueue(65536)
	req := Request{Amount: 1_000_000, Ledger: 1, Code: 100}

	// Pre-fill
	for i := 0; i < 1000; i++ {
		q.Push(req)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.PopBatch(10)
		q.Push(req)
	}
}

// BenchmarkJWTCacheValidation measures JWT cache hit performance
func BenchmarkJWTCacheValidation(b *testing.B) {
	config := DefaultJWTCacheConfig()
	cache := NewJWTCache(config)

	// The cache validates tokens - we test the validate path
	// In production, first call fills cache, subsequent calls hit cache
	token := "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjk5OTk5OTk5OTl9.test"

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			cache.ValidateToken(token)
		}
	})
}

// BenchmarkFastFraudGateCheck measures fraud pre-screening speed
func BenchmarkFastFraudGateCheck(b *testing.B) {
	config := DefaultFraudConfig()
	gate := NewFastFraudGate(config)

	req := Request{
		Amount: 50_000_00,
		Ledger: 1,
		Code:   100,
	}
	rand.Read(req.ID[:])
	rand.Read(req.DebitAccountID[:])
	rand.Read(req.CreditAccountID[:])

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			gate.QuickCheck(req)
		}
	})
}

// BenchmarkRoutingCacheLookup measures routing resolution speed
func BenchmarkRoutingCacheLookup(b *testing.B) {
	cache := NewRoutingCache(10000, 5*time.Minute)

	// Pre-populate
	fsps := []string{"access-bank", "gtbank", "uba", "zenith", "firstbank", "stanbic", "wema", "fcmb"}
	for _, fsp := range fsps {
		cache.Set(fsp, &RoutingEntry{
			FSP:    fsp,
			Ledger: 1,
		})
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			cache.Get(fsps[i%len(fsps)])
			i++
		}
	})
}

// BenchmarkKafkaOutboxEmit measures outbox write throughput
func BenchmarkKafkaOutboxEmit(b *testing.B) {
	config := DefaultOutboxConfig()
	// Use a no-op producer for benchmarking
	outbox := NewKafkaOutbox(&noopProducer{}, config)

	key := []byte("tx-12345")
	value := []byte(`{"id":"tx-12345","amount":50000,"currency":"NGN"}`)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			outbox.Emit("transactions", key, value, nil)
		}
	})
}

// noopProducer is a no-op Kafka producer for benchmarking
type noopProducer struct{}

func (p *noopProducer) ProduceBatch(_ context.Context, events []KafkaEvent) error { return nil }
func (p *noopProducer) Close() error                                              { return nil }

// BenchmarkObjectPoolAllocation measures sync.Pool vs new
func BenchmarkObjectPoolAllocation(b *testing.B) {
	pool := &sync.Pool{
		New: func() interface{} {
			return &Request{}
		},
	}

	b.Run("pool_get_put", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				req := pool.Get().(*Request)
				req.Amount = 1_000_000
				pool.Put(req)
			}
		})
	})

	b.Run("new_allocation", func(b *testing.B) {
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				req := &Request{}
				req.Amount = 1_000_000
				_ = req
			}
		})
	})
}

// BenchmarkAtomicStats measures lock-free counter throughput
func BenchmarkAtomicStats(b *testing.B) {
	var counter uint64

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = atomic.AddUint64(&counter, 1)
		}
	})
}
