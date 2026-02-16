package shared

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type RateLimiter struct {
	name       string
	rate       int
	interval   time.Duration
	tokens     chan struct{}
	mu         sync.Mutex
	totalOps   int64
	rejected   int64
	logger     *StructuredLogger
}

func NewRateLimiter(name string, ratePerSecond int, logger *StructuredLogger) *RateLimiter {
	rl := &RateLimiter{
		name:     name,
		rate:     ratePerSecond,
		interval: time.Second / time.Duration(ratePerSecond),
		tokens:   make(chan struct{}, ratePerSecond),
		logger:   logger,
	}

	for i := 0; i < ratePerSecond; i++ {
		rl.tokens <- struct{}{}
	}

	go rl.refill()
	return rl
}

func (rl *RateLimiter) refill() {
	ticker := time.NewTicker(rl.interval)
	defer ticker.Stop()
	for range ticker.C {
		select {
		case rl.tokens <- struct{}{}:
		default:
		}
	}
}

func (rl *RateLimiter) Allow() bool {
	select {
	case <-rl.tokens:
		rl.mu.Lock()
		rl.totalOps++
		rl.mu.Unlock()
		return true
	default:
		rl.mu.Lock()
		rl.rejected++
		rl.mu.Unlock()
		return false
	}
}

func (rl *RateLimiter) Wait(ctx context.Context) error {
	select {
	case <-rl.tokens:
		rl.mu.Lock()
		rl.totalOps++
		rl.mu.Unlock()
		return nil
	case <-ctx.Done():
		rl.mu.Lock()
		rl.rejected++
		rl.mu.Unlock()
		return ctx.Err()
	}
}

func (rl *RateLimiter) Stats() map[string]interface{} {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	return map[string]interface{}{
		"name":         rl.name,
		"rate_per_sec": rl.rate,
		"total_ops":    rl.totalOps,
		"rejected":     rl.rejected,
	}
}

type BatchRateLimiter struct {
	limiters map[string]*RateLimiter
	mu       sync.RWMutex
	logger   *StructuredLogger
}

func NewBatchRateLimiter(logger *StructuredLogger) *BatchRateLimiter {
	return &BatchRateLimiter{
		limiters: make(map[string]*RateLimiter),
		logger:   logger,
	}
}

func (brl *BatchRateLimiter) Register(name string, ratePerSecond int) {
	brl.mu.Lock()
	defer brl.mu.Unlock()
	brl.limiters[name] = NewRateLimiter(name, ratePerSecond, brl.logger)
}

func (brl *BatchRateLimiter) Allow(name string) bool {
	brl.mu.RLock()
	rl, ok := brl.limiters[name]
	brl.mu.RUnlock()
	if !ok {
		return true
	}
	return rl.Allow()
}

func (brl *BatchRateLimiter) Wait(ctx context.Context, name string) error {
	brl.mu.RLock()
	rl, ok := brl.limiters[name]
	brl.mu.RUnlock()
	if !ok {
		return nil
	}
	return rl.Wait(ctx)
}

func (brl *BatchRateLimiter) Stats() map[string]interface{} {
	brl.mu.RLock()
	defer brl.mu.RUnlock()
	stats := make(map[string]interface{})
	for name, rl := range brl.limiters {
		stats[name] = rl.Stats()
	}
	return stats
}

func DefaultBackfillLimiters(logger *StructuredLogger) *BatchRateLimiter {
	brl := NewBatchRateLimiter(logger)
	brl.Register("model-retraining-writes", 100)
	brl.Register("lakehouse-etl-inserts", 500)
	brl.Register("analytics-backfill", 200)
	brl.Register("kyc-batch-verification", 50)
	brl.Register("transaction-history-migration", 1000)
	brl.Register("fraud-score-recalculation", 150)
	logger.Info("backfill rate limiters initialized", map[string]interface{}{
		"limiters": fmt.Sprintf("%d registered", len(brl.limiters)),
	})
	return brl
}
