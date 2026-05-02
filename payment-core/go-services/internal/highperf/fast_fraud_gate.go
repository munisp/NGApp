// Package highperf provides fast fraud scoring gate for hot path
package highperf

import (
	"sync"
	"sync/atomic"
	"time"
)

// FastFraudGate provides ultra-fast inline fraud checks
// Design: Only cheap heuristics inline, expensive ML scoring async
type FastFraudGate struct {
	// Velocity counters (per-account, per-minute)
	velocityCounters *ShardedCounterMap

	// Blocklists (in-memory, refreshed async)
	blockedAccounts  *BloomFilter
	blockedIPs       *BloomFilter
	blockedDevices   *BloomFilter

	// Thresholds
	maxAmountPerTx   uint64
	maxTxPerMinute   int
	maxAmountPerHour uint64

	// Stats
	totalChecks      uint64
	totalBlocked     uint64
	totalAllowed     uint64

	// Async ML scoring channel
	mlScoringChan    chan FraudScoringRequest
}

// FraudScoringRequest for async ML scoring
type FraudScoringRequest struct {
	TransferID      [16]byte
	PayerAccountID  [16]byte
	PayeeAccountID  [16]byte
	Amount          uint64
	Timestamp       int64
	DeviceID        string
	IPAddress       string
}

// FastFraudConfig configures the fraud gate
type FastFraudConfig struct {
	MaxAmountPerTx   uint64
	MaxTxPerMinute   int
	MaxAmountPerHour uint64
	BloomFilterSize  int
	VelocityShards   int
	MLScoringBuffer  int
}

// DefaultFraudConfig returns optimized defaults
func DefaultFraudConfig() FastFraudConfig {
	return FastFraudConfig{
		MaxAmountPerTx:   10000000, // 10M in smallest unit
		MaxTxPerMinute:   100,
		MaxAmountPerHour: 100000000, // 100M in smallest unit
		BloomFilterSize:  1000000,
		VelocityShards:   256,
		MLScoringBuffer:  100000,
	}
}

// NewFastFraudGate creates a new fraud gate
func NewFastFraudGate(config FastFraudConfig) *FastFraudGate {
	return &FastFraudGate{
		velocityCounters: NewShardedCounterMap(config.VelocityShards),
		blockedAccounts:  NewBloomFilter(config.BloomFilterSize),
		blockedIPs:       NewBloomFilter(config.BloomFilterSize),
		blockedDevices:   NewBloomFilter(config.BloomFilterSize),
		maxAmountPerTx:   config.MaxAmountPerTx,
		maxTxPerMinute:   config.MaxTxPerMinute,
		maxAmountPerHour: config.MaxAmountPerHour,
		mlScoringChan:    make(chan FraudScoringRequest, config.MLScoringBuffer),
	}
}

// QuickCheck performs fast inline fraud check
// Returns true if transaction should proceed, false if blocked
func (g *FastFraudGate) QuickCheck(req Request) bool {
	atomic.AddUint64(&g.totalChecks, 1)

	// Check 1: Amount limit (instant)
	if req.Amount > g.maxAmountPerTx {
		atomic.AddUint64(&g.totalBlocked, 1)
		return false
	}

	// Check 2: Account blocklist (bloom filter, O(1))
	if g.blockedAccounts.MayContain(req.DebitAccountID[:]) {
		atomic.AddUint64(&g.totalBlocked, 1)
		return false
	}

	// Check 3: Velocity check (sharded counters, low contention)
	key := string(req.DebitAccountID[:])
	minuteKey := key + ":m:" + minuteBucket()
	
	count := g.velocityCounters.Increment(minuteKey)
	if count > g.maxTxPerMinute {
		atomic.AddUint64(&g.totalBlocked, 1)
		return false
	}

	// Check 4: Hourly amount limit
	hourKey := key + ":h:" + hourBucket()
	hourlyAmount := g.velocityCounters.Add(hourKey, int(req.Amount))
	if uint64(hourlyAmount) > g.maxAmountPerHour {
		atomic.AddUint64(&g.totalBlocked, 1)
		return false
	}

	atomic.AddUint64(&g.totalAllowed, 1)

	// Queue for async ML scoring (non-blocking)
	select {
	case g.mlScoringChan <- FraudScoringRequest{
		TransferID:     req.ID,
		PayerAccountID: req.DebitAccountID,
		PayeeAccountID: req.CreditAccountID,
		Amount:         req.Amount,
		Timestamp:      req.Timestamp,
	}:
	default:
		// Channel full, skip ML scoring for this tx
	}

	return true
}

// AddToBlocklist adds an account to the blocklist
func (g *FastFraudGate) AddToBlocklist(accountID []byte) {
	g.blockedAccounts.Add(accountID)
}

// Stats returns fraud gate statistics
func (g *FastFraudGate) Stats() (checks, blocked, allowed uint64) {
	return atomic.LoadUint64(&g.totalChecks),
		atomic.LoadUint64(&g.totalBlocked),
		atomic.LoadUint64(&g.totalAllowed)
}

// MLScoringChannel returns the channel for async ML scoring
func (g *FastFraudGate) MLScoringChannel() <-chan FraudScoringRequest {
	return g.mlScoringChan
}

// ShardedCounterMap provides low-contention counters
type ShardedCounterMap struct {
	shards    []counterShard
	numShards int
}

type counterShard struct {
	counters map[string]*atomicCounter
	mu       sync.RWMutex
	_padding [48]byte // Prevent false sharing
}

type atomicCounter struct {
	value    int64
	expireAt int64
}

// NewShardedCounterMap creates a new sharded counter map
func NewShardedCounterMap(numShards int) *ShardedCounterMap {
	shards := make([]counterShard, numShards)
	for i := range shards {
		shards[i].counters = make(map[string]*atomicCounter)
	}
	return &ShardedCounterMap{
		shards:    shards,
		numShards: numShards,
	}
}

// Increment increments a counter and returns new value
func (m *ShardedCounterMap) Increment(key string) int {
	return m.Add(key, 1)
}

// Add adds a value to a counter and returns new value
func (m *ShardedCounterMap) Add(key string, delta int) int {
	shard := &m.shards[fastHashString(key)%uint64(m.numShards)]

	shard.mu.RLock()
	counter, ok := shard.counters[key]
	shard.mu.RUnlock()

	if ok && time.Now().UnixNano() < counter.expireAt {
		return int(atomic.AddInt64(&counter.value, int64(delta)))
	}

	// Need to create or reset counter
	shard.mu.Lock()
	defer shard.mu.Unlock()

	counter, ok = shard.counters[key]
	if !ok || time.Now().UnixNano() >= counter.expireAt {
		counter = &atomicCounter{
			value:    int64(delta),
			expireAt: time.Now().Add(time.Minute).UnixNano(),
		}
		shard.counters[key] = counter
		return delta
	}

	return int(atomic.AddInt64(&counter.value, int64(delta)))
}

// BloomFilter provides probabilistic set membership
type BloomFilter struct {
	bits    []uint64
	numBits uint64
	numHash int
}

// NewBloomFilter creates a new bloom filter
func NewBloomFilter(size int) *BloomFilter {
	numBits := uint64(size * 10) // 10 bits per element
	numWords := (numBits + 63) / 64
	return &BloomFilter{
		bits:    make([]uint64, numWords),
		numBits: numBits,
		numHash: 7, // Optimal for ~1% false positive rate
	}
}

// Add adds an element to the filter
func (bf *BloomFilter) Add(data []byte) {
	h1, h2 := bf.hash(data)
	for i := 0; i < bf.numHash; i++ {
		pos := (h1 + uint64(i)*h2) % bf.numBits
		wordIdx := pos / 64
		bitIdx := pos % 64
		mask := uint64(1) << bitIdx
		for {
			old := atomic.LoadUint64(&bf.bits[wordIdx])
			if atomic.CompareAndSwapUint64(&bf.bits[wordIdx], old, old|mask) {
				break
			}
		}
	}
}

// MayContain checks if element might be in the filter
func (bf *BloomFilter) MayContain(data []byte) bool {
	h1, h2 := bf.hash(data)
	for i := 0; i < bf.numHash; i++ {
		pos := (h1 + uint64(i)*h2) % bf.numBits
		wordIdx := pos / 64
		bitIdx := pos % 64
		if atomic.LoadUint64(&bf.bits[wordIdx])&(1<<bitIdx) == 0 {
			return false
		}
	}
	return true
}

// hash computes two hash values for double hashing
func (bf *BloomFilter) hash(data []byte) (uint64, uint64) {
	// FNV-1a for h1
	var h1 uint64 = 14695981039346656037
	for _, b := range data {
		h1 ^= uint64(b)
		h1 *= 1099511628211
	}

	// Different seed for h2
	var h2 uint64 = 2166136261
	for _, b := range data {
		h2 ^= uint64(b)
		h2 *= 16777619
	}

	return h1, h2
}

// Helper functions
func minuteBucket() string {
	return time.Now().Format("200601021504")
}

func hourBucket() string {
	return time.Now().Format("2006010215")
}

func fastHashString(s string) uint64 {
	var h uint64 = 14695981039346656037
	for i := 0; i < len(s); i++ {
		h ^= uint64(s[i])
		h *= 1099511628211
	}
	return h
}

// RateLimiter provides token bucket rate limiting
type RateLimiter struct {
	buckets   *ShardedTokenBuckets
	ratePerSec int
	burstSize  int
}

// ShardedTokenBuckets provides sharded token buckets
type ShardedTokenBuckets struct {
	shards    []tokenBucketShard
	numShards int
}

type tokenBucketShard struct {
	buckets map[string]*tokenBucket
	mu      sync.RWMutex
}

type tokenBucket struct {
	tokens     float64
	lastUpdate int64
	rate       float64
	burst      float64
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(ratePerSec, burstSize, numShards int) *RateLimiter {
	shards := make([]tokenBucketShard, numShards)
	for i := range shards {
		shards[i].buckets = make(map[string]*tokenBucket)
	}
	return &RateLimiter{
		buckets: &ShardedTokenBuckets{
			shards:    shards,
			numShards: numShards,
		},
		ratePerSec: ratePerSec,
		burstSize:  burstSize,
	}
}

// Allow checks if a request is allowed
func (rl *RateLimiter) Allow(key string) bool {
	shard := &rl.buckets.shards[fastHashString(key)%uint64(rl.buckets.numShards)]

	shard.mu.Lock()
	defer shard.mu.Unlock()

	now := time.Now().UnixNano()
	bucket, ok := shard.buckets[key]

	if !ok {
		bucket = &tokenBucket{
			tokens:     float64(rl.burstSize),
			lastUpdate: now,
			rate:       float64(rl.ratePerSec),
			burst:      float64(rl.burstSize),
		}
		shard.buckets[key] = bucket
	}

	// Refill tokens
	elapsed := float64(now-bucket.lastUpdate) / float64(time.Second)
	bucket.tokens += elapsed * bucket.rate
	if bucket.tokens > bucket.burst {
		bucket.tokens = bucket.burst
	}
	bucket.lastUpdate = now

	// Try to consume
	if bucket.tokens >= 1 {
		bucket.tokens--
		return true
	}

	return false
}
