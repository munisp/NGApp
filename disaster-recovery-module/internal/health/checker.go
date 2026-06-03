package health

import (
	"context"
	"time"

	"github.com/munisp/NGApp/disaster-recovery-module/internal/store"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

type Checker struct {
	store  *store.PostgresStore
	redis  *redis.Client
	kafka  string
	logger *zap.Logger
}

type HealthResult struct {
	Status       string                 `json:"status"`
	Timestamp    time.Time              `json:"timestamp"`
	Dependencies map[string]DepStatus   `json:"dependencies,omitempty"`
	Details      map[string]interface{} `json:"details,omitempty"`
}

type DepStatus struct {
	Status  string `json:"status"`
	Latency int64  `json:"latency_ms"`
	Error   string `json:"error,omitempty"`
}

func NewChecker(pgStore *store.PostgresStore, redisAddr, kafkaBroker string, logger *zap.Logger) *Checker {
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	return &Checker{store: pgStore, redis: rdb, kafka: kafkaBroker, logger: logger}
}

func (c *Checker) Quick(ctx context.Context) *HealthResult {
	start := time.Now()
	err := c.store.Ping(ctx)
	latency := time.Since(start).Milliseconds()

	status := "healthy"
	if err != nil {
		status = "unhealthy"
	}

	return &HealthResult{
		Status:    status,
		Timestamp: time.Now(),
		Details:   map[string]interface{}{"db_latency_ms": latency},
	}
}

func (c *Checker) Deep(ctx context.Context) *HealthResult {
	deps := make(map[string]DepStatus)

	// Check Postgres
	start := time.Now()
	pgErr := c.store.Ping(ctx)
	deps["postgres"] = DepStatus{
		Status:  boolToStatus(pgErr == nil),
		Latency: time.Since(start).Milliseconds(),
		Error:   errStr(pgErr),
	}

	// Check Redis
	start = time.Now()
	redisErr := c.redis.Ping(ctx).Err()
	deps["redis"] = DepStatus{
		Status:  boolToStatus(redisErr == nil),
		Latency: time.Since(start).Milliseconds(),
		Error:   errStr(redisErr),
	}

	// Check Kafka
	start = time.Now()
	conn, kafkaErr := kafka.Dial("tcp", c.kafka)
	if kafkaErr == nil {
		conn.Close()
	}
	deps["kafka"] = DepStatus{
		Status:  boolToStatus(kafkaErr == nil),
		Latency: time.Since(start).Milliseconds(),
		Error:   errStr(kafkaErr),
	}

	overall := "healthy"
	for _, d := range deps {
		if d.Status != "healthy" {
			overall = "degraded"
			break
		}
	}

	return &HealthResult{
		Status:       overall,
		Timestamp:    time.Now(),
		Dependencies: deps,
	}
}

func (c *Checker) Dependencies(ctx context.Context) *HealthResult {
	return c.Deep(ctx)
}

func boolToStatus(ok bool) string {
	if ok {
		return "healthy"
	}
	return "unhealthy"
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
