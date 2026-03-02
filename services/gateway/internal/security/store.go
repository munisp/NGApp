package security

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// Store provides a Redis-backed persistence layer for security components.
// Falls back to in-memory storage when Redis is unreachable.
// Used by SessionManager, DDoSProtection, and InsiderThreatMonitor
// to survive restarts and work across multiple gateway replicas.
type Store struct {
	rdb      *redis.Client
	useRedis bool
	ctx      context.Context
}

// NewStore creates a Redis-backed security store with fallback
func NewStore(redisURL string) *Store {
	s := &Store{ctx: context.Background()}

	if redisURL == "" {
		log.Println("[SecurityStore] No Redis URL — using in-memory only")
		return s
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("[SecurityStore] Invalid Redis URL: %v — using in-memory only", err)
		return s
	}
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.WriteTimeout = 2 * time.Second

	rdb := redis.NewClient(opts)
	if err := rdb.Ping(s.ctx).Err(); err != nil {
		log.Printf("[SecurityStore] Cannot reach Redis: %v — using in-memory fallback", err)
		return s
	}

	s.rdb = rdb
	s.useRedis = true
	log.Println("[SecurityStore] Connected to Redis for persistent security state")
	return s
}

// --- Session operations ---

const sessionPrefix = "nexcom:session:"
const sessionUserPrefix = "nexcom:session:user:"

// SetSession stores a session in Redis with TTL
func (s *Store) SetSession(session *Session) error {
	if !s.useRedis {
		return nil // handled by in-memory map
	}
	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	ttl := time.Until(session.ExpiresAt)
	if ttl <= 0 {
		ttl = time.Second
	}
	pipe := s.rdb.Pipeline()
	pipe.Set(s.ctx, sessionPrefix+session.ID, data, ttl)
	// Track session in user's session set
	pipe.SAdd(s.ctx, sessionUserPrefix+session.UserID, session.ID)
	pipe.Expire(s.ctx, sessionUserPrefix+session.UserID, 24*time.Hour)
	_, err = pipe.Exec(s.ctx)
	return err
}

// GetSession retrieves a session from Redis
func (s *Store) GetSession(sessionID string) (*Session, error) {
	if !s.useRedis {
		return nil, fmt.Errorf("redis not available")
	}
	data, err := s.rdb.Get(s.ctx, sessionPrefix+sessionID).Bytes()
	if err != nil {
		return nil, err
	}
	var session Session
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteSession removes a session from Redis
func (s *Store) DeleteSession(sessionID, userID string) error {
	if !s.useRedis {
		return nil
	}
	pipe := s.rdb.Pipeline()
	pipe.Del(s.ctx, sessionPrefix+sessionID)
	pipe.SRem(s.ctx, sessionUserPrefix+userID, sessionID)
	_, err := pipe.Exec(s.ctx)
	return err
}

// --- DDoS operations ---

const ddosBlockPrefix = "nexcom:ddos:block:"
const ddosReputationPrefix = "nexcom:ddos:rep:"
const ddosIPCountPrefix = "nexcom:ddos:ipc:"

// BlockIPRedis blocks an IP in Redis with TTL
func (s *Store) BlockIPRedis(ip string, duration time.Duration) error {
	if !s.useRedis {
		return nil
	}
	return s.rdb.Set(s.ctx, ddosBlockPrefix+ip, "blocked", duration).Err()
}

// IsIPBlocked checks if an IP is blocked in Redis
func (s *Store) IsIPBlocked(ip string) (bool, time.Duration) {
	if !s.useRedis {
		return false, 0
	}
	ttl, err := s.rdb.TTL(s.ctx, ddosBlockPrefix+ip).Result()
	if err != nil || ttl <= 0 {
		return false, 0
	}
	return true, ttl
}

// IncrIPCount increments and returns per-IP request count with 1-minute window
func (s *Store) IncrIPCount(ip string) (int64, error) {
	if !s.useRedis {
		return 0, fmt.Errorf("redis not available")
	}
	key := ddosIPCountPrefix + ip
	count, err := s.rdb.Incr(s.ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if count == 1 {
		s.rdb.Expire(s.ctx, key, time.Minute)
	}
	return count, nil
}

// SetReputation sets IP reputation score in Redis
func (s *Store) SetReputation(ip string, score float64) error {
	if !s.useRedis {
		return nil
	}
	return s.rdb.Set(s.ctx, ddosReputationPrefix+ip, score, 24*time.Hour).Err()
}

// GetReputation gets IP reputation score from Redis
func (s *Store) GetReputation(ip string) float64 {
	if !s.useRedis {
		return 0
	}
	val, err := s.rdb.Get(s.ctx, ddosReputationPrefix+ip).Float64()
	if err != nil {
		return 0
	}
	return val
}

// --- Insider threat operations ---

const insiderAlertPrefix = "nexcom:insider:alert:"
const insiderAlertList = "nexcom:insider:alerts"

// StoreAlert persists an insider threat alert
func (s *Store) StoreAlert(alert InsiderAlert) error {
	if !s.useRedis {
		return nil
	}
	data, err := json.Marshal(alert)
	if err != nil {
		return err
	}
	pipe := s.rdb.Pipeline()
	pipe.Set(s.ctx, insiderAlertPrefix+alert.ID, data, 30*24*time.Hour)
	pipe.LPush(s.ctx, insiderAlertList, data)
	pipe.LTrim(s.ctx, insiderAlertList, 0, 9999)
	_, err = pipe.Exec(s.ctx)
	return err
}

// IsAvailable returns whether Redis is connected
func (s *Store) IsAvailable() bool {
	return s.useRedis
}

// Close closes the Redis connection
func (s *Store) Close() {
	if s.rdb != nil {
		s.rdb.Close()
	}
}
