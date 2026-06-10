package enhancements

import (
	"fmt"
	"sync"
	"time"
)

// APIKeyTier defines rate limit tiers for API access
type APIKeyTier string

const (
	APIKeyStarter    APIKeyTier = "starter"
	APIKeyGrowth     APIKeyTier = "growth"
	APIKeyEnterprise APIKeyTier = "enterprise"
	APIKeyPremium    APIKeyTier = "premium"
)

// RateLimitConfig defines limits per tier
type RateLimitConfig struct {
	Tier           APIKeyTier `json:"tier"`
	RequestsPerMin int        `json:"requestsPerMin"`
	RequestsPerDay int        `json:"requestsPerDay"`
	BurstLimit     int        `json:"burstLimit"`
	MaxBatchSize   int        `json:"maxBatchSize"`
}

// APIKeyRecord tracks a participant's API key and usage
type APIKeyRecord struct {
	KeyID         string     `json:"keyId"`
	ParticipantID string     `json:"participantId"`
	Tier          APIKeyTier `json:"tier"`
	CreatedAt     time.Time  `json:"createdAt"`
	LastUsed      time.Time  `json:"lastUsed"`
	Active        bool       `json:"active"`
	// Usage tracking
	RequestsToday   int     `json:"requestsToday"`
	RequestsThisMin int     `json:"requestsThisMin"`
	TotalRequests   int64   `json:"totalRequests"`
	DayResetAt      time.Time `json:"dayResetAt"`
	MinResetAt      time.Time `json:"minResetAt"`
}

// UsageSummary provides API usage analytics
type UsageSummary struct {
	ParticipantID   string  `json:"participantId"`
	Tier            string  `json:"tier"`
	TotalRequests   int64   `json:"totalRequests"`
	RequestsToday   int     `json:"requestsToday"`
	DailyLimit      int     `json:"dailyLimit"`
	DailyUsagePercent float64 `json:"dailyUsagePercent"`
	RatePerMin      int     `json:"ratePerMin"`
	CurrentMinUsage int     `json:"currentMinUsage"`
}

// RateLimiterService manages API rate limiting per participant
type RateLimiterService struct {
	mu      sync.RWMutex
	keys    map[string]*APIKeyRecord // keyID -> record
	configs map[APIKeyTier]RateLimitConfig
}

// NewRateLimiterService creates a rate limiter with default tier configs
func NewRateLimiterService() *RateLimiterService {
	return &RateLimiterService{
		keys: make(map[string]*APIKeyRecord),
		configs: map[APIKeyTier]RateLimitConfig{
			APIKeyStarter:    {Tier: APIKeyStarter, RequestsPerMin: 30, RequestsPerDay: 5000, BurstLimit: 10, MaxBatchSize: 100},
			APIKeyGrowth:     {Tier: APIKeyGrowth, RequestsPerMin: 100, RequestsPerDay: 25000, BurstLimit: 30, MaxBatchSize: 500},
			APIKeyEnterprise: {Tier: APIKeyEnterprise, RequestsPerMin: 500, RequestsPerDay: 100000, BurstLimit: 100, MaxBatchSize: 2000},
			APIKeyPremium:    {Tier: APIKeyPremium, RequestsPerMin: 2000, RequestsPerDay: 500000, BurstLimit: 500, MaxBatchSize: 5000},
		},
	}
}

// RegisterKey creates a new API key for a participant
func (s *RateLimiterService) RegisterKey(participantID string, tier APIKeyTier) (*APIKeyRecord, error) {
	if _, ok := s.configs[tier]; !ok {
		return nil, fmt.Errorf("unknown tier: %s", tier)
	}

	now := time.Now()
	key := &APIKeyRecord{
		KeyID:         fmt.Sprintf("ak_%s_%d", participantID, now.UnixMilli()),
		ParticipantID: participantID,
		Tier:          tier,
		CreatedAt:     now,
		Active:        true,
		DayResetAt:    now.Truncate(24 * time.Hour).Add(24 * time.Hour),
		MinResetAt:    now.Add(time.Minute),
	}

	s.mu.Lock()
	s.keys[key.KeyID] = key
	s.mu.Unlock()

	return key, nil
}

// CheckRateLimit verifies if a request is within limits
func (s *RateLimiterService) CheckRateLimit(keyID string) (bool, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key, ok := s.keys[keyID]
	if !ok {
		return false, "", fmt.Errorf("API key %s not found", keyID)
	}
	if !key.Active {
		return false, "key_disabled", nil
	}

	config := s.configs[key.Tier]
	now := time.Now()

	// Reset daily counter
	if now.After(key.DayResetAt) {
		key.RequestsToday = 0
		key.DayResetAt = now.Truncate(24 * time.Hour).Add(24 * time.Hour)
	}
	// Reset per-minute counter
	if now.After(key.MinResetAt) {
		key.RequestsThisMin = 0
		key.MinResetAt = now.Add(time.Minute)
	}

	if key.RequestsToday >= config.RequestsPerDay {
		return false, "daily_limit_exceeded", nil
	}
	if key.RequestsThisMin >= config.RequestsPerMin {
		return false, "rate_limit_exceeded", nil
	}

	key.RequestsToday++
	key.RequestsThisMin++
	key.TotalRequests++
	key.LastUsed = now

	return true, "ok", nil
}

// GetUsageSummary returns usage stats for a participant's key
func (s *RateLimiterService) GetUsageSummary(keyID string) (*UsageSummary, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key, ok := s.keys[keyID]
	if !ok {
		return nil, fmt.Errorf("API key %s not found", keyID)
	}

	config := s.configs[key.Tier]
	dailyPercent := 0.0
	if config.RequestsPerDay > 0 {
		dailyPercent = float64(key.RequestsToday) / float64(config.RequestsPerDay) * 100
	}

	return &UsageSummary{
		ParticipantID:     key.ParticipantID,
		Tier:              string(key.Tier),
		TotalRequests:     key.TotalRequests,
		RequestsToday:     key.RequestsToday,
		DailyLimit:        config.RequestsPerDay,
		DailyUsagePercent: dailyPercent,
		RatePerMin:        config.RequestsPerMin,
		CurrentMinUsage:   key.RequestsThisMin,
	}, nil
}

// GetConfigs returns all tier configurations
func (s *RateLimiterService) GetConfigs() map[APIKeyTier]RateLimitConfig {
	return s.configs
}
