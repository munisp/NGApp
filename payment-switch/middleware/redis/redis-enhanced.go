package redis

import (
	"context"
	"fmt"
	"hash"
	"hash/fnv"
	"math"
	"sync"
	"sync/atomic"
	"time"
)

// --- Redis Sentinel/Cluster (#8) ---

type RedisTopology string

const (
	TopologySentinel RedisTopology = "sentinel"
	TopologyCluster  RedisTopology = "cluster"
)

type SentinelConfig struct {
	MasterName    string   `json:"master_name"`
	SentinelAddrs []string `json:"sentinel_addrs"`
	Password      string   `json:"password"`
	DB            int      `json:"db"`
	MaxRetries    int      `json:"max_retries"`
	PoolSize      int      `json:"pool_size"`
	MinIdleConns  int      `json:"min_idle_conns"`
	ReadTimeout   time.Duration `json:"read_timeout"`
	WriteTimeout  time.Duration `json:"write_timeout"`
}

type ClusterConfig struct {
	Addrs        []string `json:"addrs"`
	Password     string   `json:"password"`
	MaxRetries   int      `json:"max_retries"`
	PoolSize     int      `json:"pool_size"`
	MinIdleConns int      `json:"min_idle_conns"`
	ReadOnly     bool     `json:"read_only"`
	RouteByLatency bool   `json:"route_by_latency"`
}

var DefaultSentinelConfig = SentinelConfig{
	MasterName: "payment-switch-master",
	SentinelAddrs: []string{
		"redis-sentinel-0.payment-switch.svc:26379",
		"redis-sentinel-1.payment-switch.svc:26379",
		"redis-sentinel-2.payment-switch.svc:26379",
	},
	MaxRetries:   3,
	PoolSize:     100,
	MinIdleConns: 20,
	ReadTimeout:  3 * time.Second,
	WriteTimeout: 3 * time.Second,
}

var DefaultClusterConfig = ClusterConfig{
	Addrs: []string{
		"redis-cluster-0.payment-switch.svc:6379",
		"redis-cluster-1.payment-switch.svc:6379",
		"redis-cluster-2.payment-switch.svc:6379",
		"redis-cluster-3.payment-switch.svc:6379",
		"redis-cluster-4.payment-switch.svc:6379",
		"redis-cluster-5.payment-switch.svc:6379",
	},
	MaxRetries:     3,
	PoolSize:       100,
	MinIdleConns:   20,
	ReadOnly:       true,
	RouteByLatency: true,
}

// --- Redis Streams for Event Sourcing (#9) ---

type StreamEvent struct {
	ID        string            `json:"id"`
	Stream    string            `json:"stream"`
	Fields    map[string]string `json:"fields"`
	Timestamp time.Time         `json:"timestamp"`
}

type PaymentStream struct {
	Name         string `json:"name"`
	MaxLen       int64  `json:"max_len"`
	ConsumerGroup string `json:"consumer_group"`
	RetentionMs  int64  `json:"retention_ms"`
}

var PaymentStreams = []PaymentStream{
	{Name: "stream:nip:status", MaxLen: 1000000, ConsumerGroup: "nip-status-consumers", RetentionMs: 86400000},
	{Name: "stream:nip:realtime", MaxLen: 500000, ConsumerGroup: "nip-realtime-consumers", RetentionMs: 3600000},
	{Name: "stream:settlement:updates", MaxLen: 100000, ConsumerGroup: "settlement-consumers", RetentionMs: 604800000},
	{Name: "stream:fraud:alerts", MaxLen: 500000, ConsumerGroup: "fraud-alert-consumers", RetentionMs: 2592000000},
	{Name: "stream:remittance:status", MaxLen: 200000, ConsumerGroup: "remittance-consumers", RetentionMs: 86400000},
}

// --- Bloom Filter for Deduplication (#10) ---

type BloomFilter struct {
	mu       sync.RWMutex
	bitset   []bool
	size     uint64
	hashFns  int
	count    atomic.Int64
	fpRate   float64
}

func NewBloomFilter(expectedItems uint64, fpRate float64) *BloomFilter {
	size := optimalSize(expectedItems, fpRate)
	hashFns := optimalHashCount(size, expectedItems)
	return &BloomFilter{
		bitset:  make([]bool, size),
		size:    size,
		hashFns: hashFns,
		fpRate:  fpRate,
	}
}

func optimalSize(n uint64, p float64) uint64 {
	return uint64(math.Ceil(-float64(n) * math.Log(p) / (math.Log(2) * math.Log(2))))
}

func optimalHashCount(m, n uint64) int {
	return int(math.Ceil(float64(m) / float64(n) * math.Log(2)))
}

func (bf *BloomFilter) Add(item string) {
	bf.mu.Lock()
	defer bf.mu.Unlock()

	for i := 0; i < bf.hashFns; i++ {
		idx := bf.hash(item, i)
		bf.bitset[idx] = true
	}
	bf.count.Add(1)
}

func (bf *BloomFilter) Contains(item string) bool {
	bf.mu.RLock()
	defer bf.mu.RUnlock()

	for i := 0; i < bf.hashFns; i++ {
		idx := bf.hash(item, i)
		if !bf.bitset[idx] {
			return false
		}
	}
	return true
}

func (bf *BloomFilter) hash(item string, seed int) uint64 {
	var h hash.Hash64 = fnv.New64a()
	h.Write([]byte(fmt.Sprintf("%s:%d", item, seed)))
	return h.Sum64() % bf.size
}

// --- Connection Pool Sidecar (#11) ---

type ConnectionPoolConfig struct {
	MaxConnections     int           `json:"max_connections"`
	MinIdleConnections int           `json:"min_idle_connections"`
	MaxIdleTime        time.Duration `json:"max_idle_time"`
	ConnectionTimeout  time.Duration `json:"connection_timeout"`
	ReadTimeout        time.Duration `json:"read_timeout"`
	WriteTimeout       time.Duration `json:"write_timeout"`
	HealthCheckPeriod  time.Duration `json:"health_check_period"`
	MaxRetries         int           `json:"max_retries"`
	RetryBackoff       time.Duration `json:"retry_backoff"`
}

var DefaultPoolConfig = ConnectionPoolConfig{
	MaxConnections:     500,
	MinIdleConnections: 50,
	MaxIdleTime:        5 * time.Minute,
	ConnectionTimeout:  5 * time.Second,
	ReadTimeout:        3 * time.Second,
	WriteTimeout:       3 * time.Second,
	HealthCheckPeriod:  30 * time.Second,
	MaxRetries:         3,
	RetryBackoff:       100 * time.Millisecond,
}

// --- Cache Warming (#12) ---

type CacheWarmer struct {
	mu          sync.Mutex
	warmupKeys  []WarmupKeySet
	lastWarmed  time.Time
	warmupCount atomic.Int64
}

type WarmupKeySet struct {
	Pattern     string `json:"pattern"`
	Source      string `json:"source"` // "postgresql", "tigerbeetle"
	Query       string `json:"query"`
	TTL         time.Duration `json:"ttl"`
	Priority    int    `json:"priority"` // 1=highest
	Description string `json:"description"`
}

func NewCacheWarmer() *CacheWarmer {
	return &CacheWarmer{
		warmupKeys: []WarmupKeySet{
			{Pattern: "bank:config:*", Source: "postgresql", Query: "SELECT * FROM bank_participants WHERE active=true", TTL: 1 * time.Hour, Priority: 1, Description: "Active bank participant configs"},
			{Pattern: "account:balance:*", Source: "tigerbeetle", Query: "GET_ACCOUNT_BALANCES", TTL: 30 * time.Second, Priority: 1, Description: "Hot account balances from TigerBeetle"},
			{Pattern: "rate:limit:*", Source: "postgresql", Query: "SELECT * FROM rate_limit_configs", TTL: 5 * time.Minute, Priority: 2, Description: "Rate limit configurations"},
			{Pattern: "merchant:*", Source: "postgresql", Query: "SELECT * FROM merchants WHERE status='ACTIVE'", TTL: 15 * time.Minute, Priority: 2, Description: "Active merchant data"},
			{Pattern: "sanctions:list:*", Source: "postgresql", Query: "SELECT * FROM sanctions_lists", TTL: 24 * time.Hour, Priority: 1, Description: "Sanctions screening lists"},
			{Pattern: "fee:schedule:*", Source: "postgresql", Query: "SELECT * FROM fee_schedules WHERE active=true", TTL: 1 * time.Hour, Priority: 2, Description: "Fee schedule configs"},
			{Pattern: "corridor:config:*", Source: "postgresql", Query: "SELECT * FROM remittance_corridors WHERE active=true", TTL: 1 * time.Hour, Priority: 3, Description: "Remittance corridor configs"},
		},
	}
}

func (cw *CacheWarmer) WarmCache(ctx context.Context) error {
	cw.mu.Lock()
	defer cw.mu.Unlock()

	for _, ks := range cw.warmupKeys {
		_ = ks // In production, execute query and populate Redis
		cw.warmupCount.Add(1)
	}
	cw.lastWarmed = time.Now()
	return nil
}

func (cw *CacheWarmer) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_warmed":  cw.warmupCount.Load(),
		"last_warmed":   cw.lastWarmed,
		"warmup_sets":   len(cw.warmupKeys),
	}
}
