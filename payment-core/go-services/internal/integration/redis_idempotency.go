// Package integration provides infrastructure integration components
package integration

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// RedisIdempotencyStore provides distributed idempotency using Redis cluster
type RedisIdempotencyStore struct {
	client  RedisClient
	config  *IdempotencyConfig
	metrics *IdempotencyMetrics
}

// RedisClient interface for Redis operations
type RedisClient interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
	SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error)
	Del(ctx context.Context, keys ...string) error
	Expire(ctx context.Context, key string, expiration time.Duration) error
	Exists(ctx context.Context, keys ...string) (int64, error)
	Close() error
}

// IdempotencyConfig holds configuration for idempotency store
type IdempotencyConfig struct {
	KeyPrefix     string        `json:"key_prefix"`
	DefaultTTL    time.Duration `json:"default_ttl"`
	LockTTL       time.Duration `json:"lock_ttl"`
	MaxRetries    int           `json:"max_retries"`
	RetryDelay    time.Duration `json:"retry_delay"`
	EnableMetrics bool          `json:"enable_metrics"`
}

// DefaultIdempotencyConfig returns default configuration
func DefaultIdempotencyConfig() *IdempotencyConfig {
	return &IdempotencyConfig{
		KeyPrefix:     "idempotency:",
		DefaultTTL:    24 * time.Hour,
		LockTTL:       30 * time.Second,
		MaxRetries:    3,
		RetryDelay:    100 * time.Millisecond,
		EnableMetrics: true,
	}
}

// IdempotencyMetrics tracks idempotency store metrics
type IdempotencyMetrics struct {
	RequestsTotal     int64   `json:"requests_total"`
	CacheHits         int64   `json:"cache_hits"`
	CacheMisses       int64   `json:"cache_misses"`
	DuplicateRequests int64   `json:"duplicate_requests"`
	LockAcquired      int64   `json:"lock_acquired"`
	LockFailed        int64   `json:"lock_failed"`
	AvgLatencyMs      float64 `json:"avg_latency_ms"`
	mu                sync.RWMutex
}

// IdempotencyRecord represents a stored idempotency record
type IdempotencyRecord struct {
	Key         string               `json:"key"`
	RequestHash string               `json:"request_hash"`
	Status      IdempotencyStatus    `json:"status"`
	Response    *IdempotencyResponse `json:"response,omitempty"`
	CreatedAt   time.Time            `json:"created_at"`
	CompletedAt *time.Time           `json:"completed_at,omitempty"`
	ExpiresAt   time.Time            `json:"expires_at"`
	Metadata    map[string]string    `json:"metadata,omitempty"`
}

// IdempotencyStatus represents the status of an idempotent request
type IdempotencyStatus string

const (
	StatusPending   IdempotencyStatus = "pending"
	StatusCompleted IdempotencyStatus = "completed"
	StatusFailed    IdempotencyStatus = "failed"
)

// IdempotencyResponse stores the response for replay
type IdempotencyResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       []byte            `json:"body"`
}

// NewRedisIdempotencyStore creates a new Redis-backed idempotency store
func NewRedisIdempotencyStore(client RedisClient, config *IdempotencyConfig) *RedisIdempotencyStore {
	if config == nil {
		config = DefaultIdempotencyConfig()
	}

	return &RedisIdempotencyStore{
		client:  client,
		config:  config,
		metrics: &IdempotencyMetrics{},
	}
}

// CheckAndLock checks if a request is a duplicate and acquires a lock if not
func (s *RedisIdempotencyStore) CheckAndLock(ctx context.Context, key string, requestHash string) (*IdempotencyRecord, bool, error) {
	startTime := time.Now()

	s.metrics.mu.Lock()
	s.metrics.RequestsTotal++
	s.metrics.mu.Unlock()

	fullKey := s.config.KeyPrefix + key

	// Try to get existing record
	existing, err := s.getRecord(ctx, fullKey)
	if err == nil && existing != nil {
		// Record exists
		s.metrics.mu.Lock()
		s.metrics.CacheHits++
		s.metrics.mu.Unlock()

		// Check if request hash matches
		if existing.RequestHash != requestHash {
			return nil, false, fmt.Errorf("idempotency key reused with different request body")
		}

		// If completed, return the cached response
		if existing.Status == StatusCompleted {
			s.metrics.mu.Lock()
			s.metrics.DuplicateRequests++
			s.metrics.mu.Unlock()
			return existing, true, nil
		}

		// If still pending, wait and retry
		if existing.Status == StatusPending {
			return existing, true, nil
		}
	}

	s.metrics.mu.Lock()
	s.metrics.CacheMisses++
	s.metrics.mu.Unlock()

	// Try to acquire lock
	lockKey := fullKey + ":lock"
	acquired, err := s.client.SetNX(ctx, lockKey, "locked", s.config.LockTTL)
	if err != nil {
		return nil, false, fmt.Errorf("failed to acquire lock: %w", err)
	}

	if !acquired {
		s.metrics.mu.Lock()
		s.metrics.LockFailed++
		s.metrics.mu.Unlock()
		return nil, false, fmt.Errorf("request already in progress")
	}

	s.metrics.mu.Lock()
	s.metrics.LockAcquired++
	s.metrics.mu.Unlock()

	// Create pending record
	now := time.Now()
	record := &IdempotencyRecord{
		Key:         key,
		RequestHash: requestHash,
		Status:      StatusPending,
		CreatedAt:   now,
		ExpiresAt:   now.Add(s.config.DefaultTTL),
	}

	if err := s.saveRecord(ctx, fullKey, record); err != nil {
		// Release lock on failure
		s.client.Del(ctx, lockKey)
		return nil, false, fmt.Errorf("failed to save record: %w", err)
	}

	latency := time.Since(startTime).Milliseconds()
	s.metrics.mu.Lock()
	s.metrics.AvgLatencyMs = s.metrics.AvgLatencyMs*0.9 + float64(latency)*0.1
	s.metrics.mu.Unlock()

	return record, false, nil
}

// Complete marks a request as completed and stores the response
func (s *RedisIdempotencyStore) Complete(ctx context.Context, key string, response *IdempotencyResponse) error {
	fullKey := s.config.KeyPrefix + key
	lockKey := fullKey + ":lock"

	// Get existing record
	record, err := s.getRecord(ctx, fullKey)
	if err != nil {
		return fmt.Errorf("failed to get record: %w", err)
	}

	if record == nil {
		return fmt.Errorf("record not found")
	}

	// Update record
	now := time.Now()
	record.Status = StatusCompleted
	record.Response = response
	record.CompletedAt = &now

	// Save updated record
	if err := s.saveRecord(ctx, fullKey, record); err != nil {
		return fmt.Errorf("failed to save record: %w", err)
	}

	// Release lock
	s.client.Del(ctx, lockKey)

	return nil
}

// Fail marks a request as failed
func (s *RedisIdempotencyStore) Fail(ctx context.Context, key string, errorMsg string) error {
	fullKey := s.config.KeyPrefix + key
	lockKey := fullKey + ":lock"

	// Get existing record
	record, err := s.getRecord(ctx, fullKey)
	if err != nil {
		return fmt.Errorf("failed to get record: %w", err)
	}

	if record == nil {
		return fmt.Errorf("record not found")
	}

	// Update record
	now := time.Now()
	record.Status = StatusFailed
	record.CompletedAt = &now
	record.Metadata = map[string]string{"error": errorMsg}

	// Save updated record with shorter TTL for failed requests
	if err := s.saveRecordWithTTL(ctx, fullKey, record, 1*time.Hour); err != nil {
		return fmt.Errorf("failed to save record: %w", err)
	}

	// Release lock
	s.client.Del(ctx, lockKey)

	return nil
}

// getRecord retrieves an idempotency record from Redis
func (s *RedisIdempotencyStore) getRecord(ctx context.Context, key string) (*IdempotencyRecord, error) {
	data, err := s.client.Get(ctx, key)
	if err != nil {
		return nil, nil // Key doesn't exist
	}

	var record IdempotencyRecord
	if err := json.Unmarshal([]byte(data), &record); err != nil {
		return nil, fmt.Errorf("failed to unmarshal record: %w", err)
	}

	return &record, nil
}

// saveRecord saves an idempotency record to Redis
func (s *RedisIdempotencyStore) saveRecord(ctx context.Context, key string, record *IdempotencyRecord) error {
	return s.saveRecordWithTTL(ctx, key, record, s.config.DefaultTTL)
}

// saveRecordWithTTL saves an idempotency record with custom TTL
func (s *RedisIdempotencyStore) saveRecordWithTTL(ctx context.Context, key string, record *IdempotencyRecord, ttl time.Duration) error {
	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}

	return s.client.Set(ctx, key, string(data), ttl)
}

// GetMetrics returns current idempotency metrics
func (s *RedisIdempotencyStore) GetMetrics() *IdempotencyMetrics {
	s.metrics.mu.RLock()
	defer s.metrics.mu.RUnlock()

	return &IdempotencyMetrics{
		RequestsTotal:     s.metrics.RequestsTotal,
		CacheHits:         s.metrics.CacheHits,
		CacheMisses:       s.metrics.CacheMisses,
		DuplicateRequests: s.metrics.DuplicateRequests,
		LockAcquired:      s.metrics.LockAcquired,
		LockFailed:        s.metrics.LockFailed,
		AvgLatencyMs:      s.metrics.AvgLatencyMs,
	}
}

// IdempotencyMiddleware provides HTTP middleware for idempotency
type IdempotencyMiddleware struct {
	store             *RedisIdempotencyStore
	keyExtractor      IdempotencyKeyExtractor
	hashGenerator     RequestHashGenerator
	applicableMethods map[string]bool
}

// IdempotencyKeyExtractor extracts the idempotency key from a request
type IdempotencyKeyExtractor func(r *http.Request) string

// RequestHashGenerator generates a hash of the request for validation
type RequestHashGenerator func(r *http.Request) string

// NewIdempotencyMiddleware creates a new idempotency middleware
func NewIdempotencyMiddleware(store *RedisIdempotencyStore) *IdempotencyMiddleware {
	return &IdempotencyMiddleware{
		store:         store,
		keyExtractor:  DefaultKeyExtractor,
		hashGenerator: DefaultHashGenerator,
		applicableMethods: map[string]bool{
			"POST":  true,
			"PUT":   true,
			"PATCH": true,
		},
	}
}

// WithKeyExtractor sets a custom key extractor
func (m *IdempotencyMiddleware) WithKeyExtractor(extractor IdempotencyKeyExtractor) *IdempotencyMiddleware {
	m.keyExtractor = extractor
	return m
}

// WithHashGenerator sets a custom hash generator
func (m *IdempotencyMiddleware) WithHashGenerator(generator RequestHashGenerator) *IdempotencyMiddleware {
	m.hashGenerator = generator
	return m
}

// Middleware returns the HTTP middleware handler
func (m *IdempotencyMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only apply to applicable methods
		if !m.applicableMethods[r.Method] {
			next.ServeHTTP(w, r)
			return
		}

		// Extract idempotency key
		key := m.keyExtractor(r)
		if key == "" {
			// No idempotency key, proceed without idempotency
			next.ServeHTTP(w, r)
			return
		}

		// Generate request hash
		requestHash := m.hashGenerator(r)

		// Check and lock
		record, isDuplicate, err := m.store.CheckAndLock(r.Context(), key, requestHash)
		if err != nil {
			// If lock failed due to concurrent request, return 409
			if err.Error() == "request already in progress" {
				http.Error(w, "Request already in progress", http.StatusConflict)
				return
			}
			// If key reused with different body, return 422
			if err.Error() == "idempotency key reused with different request body" {
				http.Error(w, "Idempotency key reused with different request", http.StatusUnprocessableEntity)
				return
			}
			http.Error(w, "Idempotency check failed", http.StatusInternalServerError)
			return
		}

		// If duplicate with completed response, replay it
		if isDuplicate && record.Status == StatusCompleted && record.Response != nil {
			w.Header().Set("X-Idempotency-Replayed", "true")
			for k, v := range record.Response.Headers {
				w.Header().Set(k, v)
			}
			w.WriteHeader(record.Response.StatusCode)
			w.Write(record.Response.Body)
			return
		}

		// If duplicate but still pending, return 409
		if isDuplicate && record.Status == StatusPending {
			http.Error(w, "Request already in progress", http.StatusConflict)
			return
		}

		// Wrap response writer to capture response
		rw := &responseCapture{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Execute handler
		next.ServeHTTP(rw, r)

		// Store response
		response := &IdempotencyResponse{
			StatusCode: rw.statusCode,
			Headers:    make(map[string]string),
			Body:       rw.body,
		}

		// Capture relevant headers
		for _, header := range []string{"Content-Type", "X-Request-ID", "X-Correlation-ID"} {
			if v := rw.Header().Get(header); v != "" {
				response.Headers[header] = v
			}
		}

		// Mark as completed or failed based on status code
		if rw.statusCode >= 200 && rw.statusCode < 300 {
			m.store.Complete(r.Context(), key, response)
		} else if rw.statusCode >= 400 {
			m.store.Fail(r.Context(), key, fmt.Sprintf("HTTP %d", rw.statusCode))
		}
	})
}

// responseCapture captures the response for storage
type responseCapture struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (rw *responseCapture) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseCapture) Write(b []byte) (int, error) {
	rw.body = append(rw.body, b...)
	return rw.ResponseWriter.Write(b)
}

// DefaultKeyExtractor extracts idempotency key from header
func DefaultKeyExtractor(r *http.Request) string {
	// Check standard header
	key := r.Header.Get("Idempotency-Key")
	if key != "" {
		return key
	}

	// Check alternative headers
	key = r.Header.Get("X-Idempotency-Key")
	if key != "" {
		return key
	}

	// Check for Mojaloop-style transfer ID in path
	// e.g., /transfers/{transferId}
	if transferID := extractTransferIDFromPath(r.URL.Path); transferID != "" {
		return "transfer:" + transferID
	}

	return ""
}

// extractTransferIDFromPath extracts transfer ID from URL path
func extractTransferIDFromPath(path string) string {
	// Match patterns like /transfers/{id} or /api/v1/transfers/{id}
	parts := splitPath(path)
	for i, part := range parts {
		if part == "transfers" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

func splitPath(path string) []string {
	var parts []string
	for _, p := range splitString(path, '/') {
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}

func splitString(s string, sep rune) []string {
	var parts []string
	current := ""
	for _, c := range s {
		if c == sep {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// DefaultHashGenerator generates a hash of the request
func DefaultHashGenerator(r *http.Request) string {
	// Hash method + path + body
	h := sha256.New()
	h.Write([]byte(r.Method))
	h.Write([]byte(r.URL.Path))

	// Include relevant headers in hash
	for _, header := range []string{"Content-Type", "X-Payer-FSP", "X-Payee-FSP"} {
		if v := r.Header.Get(header); v != "" {
			h.Write([]byte(header + ":" + v))
		}
	}

	// Note: In production, you'd also hash the request body
	// This requires reading and buffering the body

	return hex.EncodeToString(h.Sum(nil))
}

// TransferIdempotencyKey generates an idempotency key for a transfer
func TransferIdempotencyKey(transferID string) string {
	return "transfer:" + transferID
}

// SettlementIdempotencyKey generates an idempotency key for a settlement
func SettlementIdempotencyKey(settlementID string) string {
	return "settlement:" + settlementID
}

// ParticipantIdempotencyKey generates an idempotency key for participant operations
func ParticipantIdempotencyKey(participantID, operation string) string {
	return fmt.Sprintf("participant:%s:%s", participantID, operation)
}

// RedisIdempotencySchema returns PostgreSQL schema for idempotency audit
func RedisIdempotencySchema() string {
	return `
-- Idempotency key audit log (for compliance and debugging)
CREATE TABLE IF NOT EXISTS idempotency_audit (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    request_path TEXT NOT NULL,
    response_status INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    user_id VARCHAR(255),
    ip_address VARCHAR(45)
);

-- Index for idempotency audit queries
CREATE INDEX IF NOT EXISTS idx_idempotency_audit_key 
ON idempotency_audit(idempotency_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_idempotency_audit_user 
ON idempotency_audit(user_id, created_at DESC);

-- Idempotency metrics aggregation
CREATE TABLE IF NOT EXISTS idempotency_metrics_hourly (
    hour TIMESTAMP WITH TIME ZONE NOT NULL,
    requests_total INT NOT NULL DEFAULT 0,
    cache_hits INT NOT NULL DEFAULT 0,
    cache_misses INT NOT NULL DEFAULT 0,
    duplicate_requests INT NOT NULL DEFAULT 0,
    avg_latency_ms DECIMAL(10,2),
    PRIMARY KEY (hour)
);

-- Function to clean up expired idempotency records
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_audit()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_audit 
    WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
`
}

// RedisClusterConfig holds Redis cluster configuration
type RedisClusterConfig struct {
	Addresses    []string      `json:"addresses"`
	Password     string        `json:"password"`
	MaxRetries   int           `json:"max_retries"`
	DialTimeout  time.Duration `json:"dial_timeout"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	PoolSize     int           `json:"pool_size"`
	MinIdleConns int           `json:"min_idle_conns"`
	MaxConnAge   time.Duration `json:"max_conn_age"`
	PoolTimeout  time.Duration `json:"pool_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout"`
	EnableTLS    bool          `json:"enable_tls"`
}

// DefaultRedisClusterConfig returns default Redis cluster configuration
func DefaultRedisClusterConfig() *RedisClusterConfig {
	return &RedisClusterConfig{
		Addresses: []string{
			"redis-0.redis.payment-switch.svc.cluster.local:6379",
			"redis-1.redis.payment-switch.svc.cluster.local:6379",
			"redis-2.redis.payment-switch.svc.cluster.local:6379",
		},
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     100,
		MinIdleConns: 10,
		MaxConnAge:   30 * time.Minute,
		PoolTimeout:  4 * time.Second,
		IdleTimeout:  5 * time.Minute,
		EnableTLS:    false,
	}
}

// MockRedisClient provides a mock Redis client for testing
type MockRedisClient struct {
	data map[string]string
	mu   sync.RWMutex
}

// NewMockRedisClient creates a new mock Redis client
func NewMockRedisClient() *MockRedisClient {
	return &MockRedisClient{
		data: make(map[string]string),
	}
}

func (m *MockRedisClient) Get(ctx context.Context, key string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if v, ok := m.data[key]; ok {
		return v, nil
	}
	return "", fmt.Errorf("key not found")
}

func (m *MockRedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = fmt.Sprintf("%v", value)
	return nil
}

func (m *MockRedisClient) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.data[key]; exists {
		return false, nil
	}
	m.data[key] = fmt.Sprintf("%v", value)
	return true, nil
}

func (m *MockRedisClient) Del(ctx context.Context, keys ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, key := range keys {
		delete(m.data, key)
	}
	return nil
}

func (m *MockRedisClient) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return nil
}

func (m *MockRedisClient) Exists(ctx context.Context, keys ...string) (int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var count int64
	for _, key := range keys {
		if _, ok := m.data[key]; ok {
			count++
		}
	}
	return count, nil
}

func (m *MockRedisClient) Close() error {
	return nil
}
