package highperf

import (
	"crypto/rand"
	"sync"
	"testing"
)

// BenchmarkRequestQueueEnqueue measures per-core queue throughput
func BenchmarkRequestQueueEnqueue(b *testing.B) {
	q := NewRequestQueue(65536)
	req := Request{Amount: 1_000_000, Ledger: 1, Code: 100}
	rand.Read(req.ID[:])
	rand.Read(req.DebitAccountID[:])
	rand.Read(req.CreditAccountID[:])

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			q.TryEnqueue(req)
		}
	})
}

// BenchmarkRequestQueueDequeue measures dequeue performance
func BenchmarkRequestQueueDequeue(b *testing.B) {
	q := NewRequestQueue(65536)
	req := Request{Amount: 1_000_000, Ledger: 1, Code: 100}

	// Pre-fill
	for i := 0; i < 1000; i++ {
		q.TryEnqueue(req)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.TryDequeue()
		q.TryEnqueue(req)
	}
}

// BenchmarkJWTCacheLookup measures JWT cache hit performance
func BenchmarkJWTCacheLookup(b *testing.B) {
	cache := NewJWTCache(10000, 300) // 10K entries, 5min TTL

	// Pre-populate cache
	tokens := make([]string, 1000)
	for i := range tokens {
		token := make([]byte, 64)
		rand.Read(token)
		tokens[i] = string(token)
		cache.Set(tokens[i], &JWTClaims{
			Subject:   "user-" + string(rune(i)),
			ExpiresAt: 9999999999,
		})
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			cache.Get(tokens[i%1000])
			i++
		}
	})
}

// BenchmarkJWTCacheMiss measures cache miss performance
func BenchmarkJWTCacheMiss(b *testing.B) {
	cache := NewJWTCache(10000, 300)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cache.Get("nonexistent-token")
	}
}

// BenchmarkFastFraudGateCheck measures fraud pre-screening speed
func BenchmarkFastFraudGateCheck(b *testing.B) {
	gate := NewFastFraudGate(FraudGateConfig{
		MaxAmountCents:   100_000_000, // 1M
		VelocityWindowMs: 60000,
		MaxVelocity:      100,
		BlockedPrefixes:  []string{"BLOCKED"},
	})

	req := &FraudCheckRequest{
		Amount:    50_000_00, // 50K
		Currency:  "NGN",
		PayerID:   "user-12345",
		PayeeID:   "merchant-67890",
		Channel:   "card",
		IPAddress: "192.168.1.1",
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			gate.Check(req)
		}
	})
}

// BenchmarkRoutingCacheLookup measures routing resolution speed
func BenchmarkRoutingCacheLookup(b *testing.B) {
	cache := NewRoutingCache(10000, 300)

	// Pre-populate
	fsps := []string{"access-bank", "gtbank", "uba", "zenith", "firstbank", "stanbic", "wema", "fcmb"}
	for _, fsp := range fsps {
		cache.Set(fsp, &RouteEntry{
			Endpoint: "grpc://internal-" + fsp + ":50051",
			Priority: 1,
			Weight:   100,
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

// BenchmarkKafkaOutboxEnqueue measures outbox write throughput
func BenchmarkKafkaOutboxEnqueue(b *testing.B) {
	outbox := NewKafkaOutbox(KafkaOutboxConfig{
		BufferSize:     65536,
		FlushInterval:  1,
		MaxBatchSize:   500,
		RequiredAcks:   1,
	})

	msg := &OutboxMessage{
		Topic: "transactions",
		Key:   []byte("tx-12345"),
		Value: []byte(`{"id":"tx-12345","amount":50000,"currency":"NGN"}`),
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			outbox.Enqueue(msg)
		}
	})
}

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
