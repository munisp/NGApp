package redis

import "time"

// Redis configuration — caching, session management, rate limiting,
// pub/sub real-time updates, and distributed locking for CRM platform

type RedisConfig struct {
	Sentinel   SentinelConfig `json:"sentinel"`
	Cluster    ClusterConfig  `json:"cluster"`
	Database   int            `json:"database"`
	MaxRetries int            `json:"max_retries"`
	PoolSize   int            `json:"pool_size"`
	MinIdleConns int          `json:"min_idle_conns"`
	DialTimeout  time.Duration `json:"dial_timeout"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
}

type SentinelConfig struct {
	MasterName string   `json:"master_name"`
	Addresses  []string `json:"addresses"`
	Password   string   `json:"-"`
}

type ClusterConfig struct {
	Addresses []string `json:"addresses"`
	Password  string   `json:"-"`
}

func DefaultRedisConfig() *RedisConfig {
	return &RedisConfig{
		Sentinel: SentinelConfig{
			MasterName: "crm-master",
			Addresses:  []string{"redis-sentinel-0.redis.crm.svc:26379", "redis-sentinel-1.redis.crm.svc:26379", "redis-sentinel-2.redis.crm.svc:26379"},
		},
		Database:     0,
		MaxRetries:   3,
		PoolSize:     100,
		MinIdleConns: 10,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	}
}

// Cache key patterns for CRM entities
type CacheKeyPattern struct {
	Pattern string        `json:"pattern"`
	TTL     time.Duration `json:"ttl"`
	Purpose string        `json:"purpose"`
}

func CRMCachePatterns() []CacheKeyPattern {
	return []CacheKeyPattern{
		{Pattern: "tenant:{tenant_id}:config", TTL: 5 * time.Minute, Purpose: "Tenant configuration and product entitlements"},
		{Pattern: "tenant:{tenant_id}:customer:{id}", TTL: 10 * time.Minute, Purpose: "Customer profile cache"},
		{Pattern: "tenant:{tenant_id}:customer:search:{query}", TTL: 2 * time.Minute, Purpose: "Customer search results cache"},
		{Pattern: "tenant:{tenant_id}:dashboard:metrics", TTL: 30 * time.Second, Purpose: "Dashboard real-time metrics"},
		{Pattern: "tenant:{tenant_id}:agent:{id}:float", TTL: 15 * time.Second, Purpose: "Agent float balance (near real-time)"},
		{Pattern: "tenant:{tenant_id}:campaign:{id}:stats", TTL: 60 * time.Second, Purpose: "Campaign delivery statistics"},
		{Pattern: "session:{session_id}", TTL: 30 * time.Minute, Purpose: "User session data"},
		{Pattern: "rate_limit:ip:{ip}", TTL: 60 * time.Second, Purpose: "Per-IP rate limiting counter"},
		{Pattern: "rate_limit:tenant:{tenant_id}", TTL: 60 * time.Second, Purpose: "Per-tenant rate limiting counter"},
		{Pattern: "rate_limit:api_key:{key}", TTL: 60 * time.Second, Purpose: "Per-API-key rate limiting counter"},
		{Pattern: "lock:tenant:{tenant_id}:txn:{txn_id}", TTL: 30 * time.Second, Purpose: "Distributed lock for transaction processing"},
		{Pattern: "lock:tenant:{tenant_id}:customer:{id}", TTL: 10 * time.Second, Purpose: "Customer record update lock"},
		{Pattern: "pbac:tenant:{tenant_id}:policies", TTL: 5 * time.Minute, Purpose: "PBAC policy cache per tenant"},
		{Pattern: "pbac:tenant:{tenant_id}:decision:{hash}", TTL: 60 * time.Second, Purpose: "Access decision cache"},
		{Pattern: "kyc:verification:{request_id}", TTL: 24 * time.Hour, Purpose: "KYC verification in-flight status"},
		{Pattern: "otp:{phone}:{code}", TTL: 5 * time.Minute, Purpose: "OTP verification codes"},
		{Pattern: "token:blacklist:{jti}", TTL: 24 * time.Hour, Purpose: "JWT token blacklist for logout"},
		{Pattern: "websocket:presence:{tenant_id}", TTL: 60 * time.Second, Purpose: "Online user presence tracking"},
	}
}

// Pub/Sub channels for real-time updates
type PubSubChannel struct {
	Name    string `json:"name"`
	Purpose string `json:"purpose"`
}

func CRMPubSubChannels() []PubSubChannel {
	return []PubSubChannel{
		{Name: "crm:notifications:{tenant_id}", Purpose: "Real-time notification delivery to tenant users"},
		{Name: "crm:dashboard:{tenant_id}", Purpose: "Dashboard metric updates"},
		{Name: "crm:campaign:{campaign_id}:progress", Purpose: "Campaign delivery progress"},
		{Name: "crm:agent:{tenant_id}:status", Purpose: "Agent online/offline status updates"},
		{Name: "crm:security:alerts", Purpose: "Security threat alerts (broadcast)"},
		{Name: "crm:audit:stream", Purpose: "Real-time audit event stream"},
		{Name: "crm:sync:{device_id}", Purpose: "Device sync status updates"},
		{Name: "crm:task:{tenant_id}:updates", Purpose: "Task assignment and status changes"},
	}
}

// Redis Streams for ordered event processing
type StreamConfig struct {
	Name           string `json:"name"`
	MaxLen         int64  `json:"max_len"`
	ConsumerGroup  string `json:"consumer_group"`
	RetentionHours int    `json:"retention_hours"`
}

func CRMStreams() []StreamConfig {
	return []StreamConfig{
		{Name: "crm:events:customer", MaxLen: 100000, ConsumerGroup: "customer-processors", RetentionHours: 168},
		{Name: "crm:events:transaction", MaxLen: 500000, ConsumerGroup: "transaction-processors", RetentionHours: 168},
		{Name: "crm:events:campaign", MaxLen: 200000, ConsumerGroup: "campaign-processors", RetentionHours: 72},
		{Name: "crm:events:security", MaxLen: 100000, ConsumerGroup: "security-processors", RetentionHours: 720},
		{Name: "crm:events:audit", MaxLen: 200000, ConsumerGroup: "audit-processors", RetentionHours: 2160},
	}
}
