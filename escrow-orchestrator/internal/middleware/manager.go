package middleware

import (
	"context"
	"sync"

	"github.com/escrowprotect/orchestrator/internal/config"
	"github.com/rs/zerolog/log"
)

// Manager manages all middleware connections
type Manager struct {
	cfg    *config.Config
	kafka  *KafkaClient
	redis  *RedisClient
	dapr   *DaprClient
	mu     sync.RWMutex
}

// NewManager creates a new middleware manager
func NewManager(cfg *config.Config) *Manager {
	return &Manager{
		cfg:   cfg,
		kafka: NewKafkaClient(cfg),
		redis: NewRedisClient(cfg),
		dapr:  NewDaprClient(cfg),
	}
}

// Initialize connects to all middleware
func (m *Manager) Initialize(ctx context.Context) error {
	log.Info().Msg("Initializing middleware connections")

	// Connect to Kafka
	if err := m.kafka.Connect(ctx); err != nil {
		log.Warn().Err(err).Msg("Kafka connection failed, continuing without Kafka")
	}

	// Connect to Redis
	if err := m.redis.Connect(ctx); err != nil {
		log.Warn().Err(err).Msg("Redis connection failed, continuing without Redis")
	}

	// Connect to Dapr
	if err := m.dapr.Connect(ctx); err != nil {
		log.Warn().Err(err).Msg("Dapr connection failed, continuing without Dapr")
	}

	log.Info().Msg("Middleware initialization complete")
	return nil
}

// Kafka returns the Kafka client
func (m *Manager) Kafka() *KafkaClient {
	return m.kafka
}

// Redis returns the Redis client
func (m *Manager) Redis() *RedisClient {
	return m.redis
}

// Dapr returns the Dapr client
func (m *Manager) Dapr() *DaprClient {
	return m.dapr
}

// HealthCheck returns health status of all middleware
func (m *Manager) HealthCheck(ctx context.Context) map[string]bool {
	return map[string]bool{
		"kafka": m.kafka.IsConnected(),
		"redis": m.redis.IsConnected(),
		"dapr":  m.dapr.IsConnected(),
	}
}

// Close closes all middleware connections
func (m *Manager) Close() error {
	log.Info().Msg("Closing middleware connections")

	if err := m.kafka.Close(); err != nil {
		log.Warn().Err(err).Msg("Error closing Kafka")
	}

	if err := m.redis.Close(); err != nil {
		log.Warn().Err(err).Msg("Error closing Redis")
	}

	if err := m.dapr.Close(); err != nil {
		log.Warn().Err(err).Msg("Error closing Dapr")
	}

	return nil
}
