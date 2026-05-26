package enhancements

import (
	"fmt"
	"sync"
	"time"
)

// RateLockStatus represents the state of a locked rate
type RateLockStatus string

const (
	RateLockActive   RateLockStatus = "active"
	RateLockUsed     RateLockStatus = "used"
	RateLockExpired  RateLockStatus = "expired"
	RateLockCancelled RateLockStatus = "cancelled"
)

// FXRateLock represents a locked FX rate for a specific duration
type FXRateLock struct {
	LockID        string         `json:"lockId"`
	ParticipantID string         `json:"participantId"`
	FromCurrency  string         `json:"fromCurrency"`
	ToCurrency    string         `json:"toCurrency"`
	LockedRate    float64        `json:"lockedRate"`
	MarketRate    float64        `json:"marketRate"`
	Spread        float64        `json:"spread"`
	AmountFrom    float64        `json:"amountFrom"`
	AmountTo      float64        `json:"amountTo"`
	CorridorID    string         `json:"corridorId"`
	Status        RateLockStatus `json:"status"`
	LockedAt      time.Time      `json:"lockedAt"`
	ExpiresAt     time.Time      `json:"expiresAt"`
	UsedAt        *time.Time     `json:"usedAt,omitempty"`
	TransferRef   string         `json:"transferRef,omitempty"`
}

// FXRateLockConfig defines lock parameters
type FXRateLockConfig struct {
	DefaultTTLSeconds int     `json:"defaultTtlSeconds"`
	MaxTTLSeconds     int     `json:"maxTtlSeconds"`
	MaxSpreadBPS      float64 `json:"maxSpreadBps"`
	MaxLockAmountUSD  float64 `json:"maxLockAmountUsd"`
}

// FXRateLockService manages rate locks
type FXRateLockService struct {
	mu     sync.RWMutex
	locks  map[string]*FXRateLock
	config FXRateLockConfig
}

// NewFXRateLockService creates a new rate lock service
func NewFXRateLockService() *FXRateLockService {
	return &FXRateLockService{
		locks: make(map[string]*FXRateLock),
		config: FXRateLockConfig{
			DefaultTTLSeconds: 60,
			MaxTTLSeconds:     300,
			MaxSpreadBPS:      200, // 2% max spread
			MaxLockAmountUSD:  1_000_000,
		},
	}
}

// LockRate creates a new rate lock for a corridor
func (s *FXRateLockService) LockRate(participantID, corridorID, fromCurrency, toCurrency string, marketRate, spread, amountFrom float64, ttlSeconds int) (*FXRateLock, error) {
	if ttlSeconds <= 0 {
		ttlSeconds = s.config.DefaultTTLSeconds
	}
	if ttlSeconds > s.config.MaxTTLSeconds {
		return nil, fmt.Errorf("TTL %ds exceeds maximum %ds", ttlSeconds, s.config.MaxTTLSeconds)
	}
	if spread > s.config.MaxSpreadBPS {
		return nil, fmt.Errorf("spread %.0f bps exceeds maximum %.0f bps", spread, s.config.MaxSpreadBPS)
	}

	lockedRate := marketRate * (1 + spread/10000)
	amountTo := amountFrom / lockedRate

	lock := &FXRateLock{
		LockID:        fmt.Sprintf("LOCK-%s-%d", participantID, time.Now().UnixMilli()),
		ParticipantID: participantID,
		FromCurrency:  fromCurrency,
		ToCurrency:    toCurrency,
		LockedRate:    lockedRate,
		MarketRate:    marketRate,
		Spread:        spread,
		AmountFrom:    amountFrom,
		AmountTo:      amountTo,
		CorridorID:    corridorID,
		Status:        RateLockActive,
		LockedAt:      time.Now(),
		ExpiresAt:     time.Now().Add(time.Duration(ttlSeconds) * time.Second),
	}

	s.mu.Lock()
	s.locks[lock.LockID] = lock
	s.mu.Unlock()

	return lock, nil
}

// UseLock consumes a rate lock (associates it with a transfer)
func (s *FXRateLockService) UseLock(lockID, transferRef string) (*FXRateLock, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	lock, ok := s.locks[lockID]
	if !ok {
		return nil, fmt.Errorf("rate lock %s not found", lockID)
	}
	if lock.Status != RateLockActive {
		return nil, fmt.Errorf("rate lock %s is %s", lockID, lock.Status)
	}
	if time.Now().After(lock.ExpiresAt) {
		lock.Status = RateLockExpired
		return nil, fmt.Errorf("rate lock %s has expired", lockID)
	}

	now := time.Now()
	lock.Status = RateLockUsed
	lock.UsedAt = &now
	lock.TransferRef = transferRef
	return lock, nil
}

// GetActiveLocks returns all active locks for a participant
func (s *FXRateLockService) GetActiveLocks(participantID string) []*FXRateLock {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*FXRateLock
	now := time.Now()
	for _, lock := range s.locks {
		if lock.ParticipantID == participantID || participantID == "" {
			if lock.Status == RateLockActive && now.Before(lock.ExpiresAt) {
				result = append(result, lock)
			}
		}
	}
	return result
}

// ExpireStale marks expired locks
func (s *FXRateLockService) ExpireStale() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := 0
	now := time.Now()
	for _, lock := range s.locks {
		if lock.Status == RateLockActive && now.After(lock.ExpiresAt) {
			lock.Status = RateLockExpired
			count++
		}
	}
	return count
}

// GetConfig returns the current lock configuration
func (s *FXRateLockService) GetConfig() FXRateLockConfig {
	return s.config
}
