package health

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/repository"
)

// HealthService defines the interface for health check operations
type HealthService interface {
	// Health check operations
	HealthCheck(ctx context.Context) (*HealthStatus, error)
	ReadinessCheck(ctx context.Context) (*ReadinessStatus, error)
	LivenessCheck(ctx context.Context) (*LivenessStatus, error)
	
	// Component health checks
	CheckDatabase(ctx context.Context) (*ComponentHealth, error)
	CheckRedis(ctx context.Context) (*ComponentHealth, error)
	CheckExternalServices(ctx context.Context) (*ComponentHealth, error)
}

// healthService implements HealthService interface
type healthService struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewHealthService creates a new health service
func NewHealthService(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) HealthService {
	return &healthService{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// Health status structures
type HealthStatus struct {
	Status     string                     `json:"status"`
	Timestamp  time.Time                  `json:"timestamp"`
	Version    string                     `json:"version"`
	Service    string                     `json:"service"`
	Uptime     string                     `json:"uptime"`
	Components map[string]ComponentHealth `json:"components"`
}

type ReadinessStatus struct {
	Ready      bool                       `json:"ready"`
	Timestamp  time.Time                  `json:"timestamp"`
	Service    string                     `json:"service"`
	Components map[string]ComponentHealth `json:"components"`
	Message    string                     `json:"message,omitempty"`
}

type LivenessStatus struct {
	Alive     bool      `json:"alive"`
	Timestamp time.Time `json:"timestamp"`
	Service   string    `json:"service"`
	Uptime    string    `json:"uptime"`
}

type ComponentHealth struct {
	Status      string            `json:"status"`
	Healthy     bool              `json:"healthy"`
	ResponseTime string           `json:"response_time"`
	Message     string            `json:"message,omitempty"`
	Details     map[string]string `json:"details,omitempty"`
	LastChecked time.Time         `json:"last_checked"`
}

// Application start time for uptime calculation
var startTime = time.Now()

// HealthCheck performs a comprehensive health check
func (s *healthService) HealthCheck(ctx context.Context) (*HealthStatus, error) {
	s.logger.Info("Performing health check")
	
	components := make(map[string]ComponentHealth)
	overallStatus := "healthy"

	// Check database
	dbHealth, err := s.CheckDatabase(ctx)
	if err != nil {
		s.logger.WithError(err).Error("Database health check failed")
		overallStatus = "unhealthy"
	}
	components["database"] = *dbHealth

	// Check Redis
	redisHealth, err := s.CheckRedis(ctx)
	if err != nil {
		s.logger.WithError(err).Error("Redis health check failed")
		overallStatus = "degraded"
	}
	components["redis"] = *redisHealth

	// Check external services
	externalHealth, err := s.CheckExternalServices(ctx)
	if err != nil {
		s.logger.WithError(err).Error("External services health check failed")
		if overallStatus == "healthy" {
			overallStatus = "degraded"
		}
	}
	components["external_services"] = *externalHealth

	// Calculate uptime
	uptime := time.Since(startTime).String()

	health := &HealthStatus{
		Status:     overallStatus,
		Timestamp:  time.Now().UTC(),
		Version:    "1.0.0", // This could be injected from build info
		Service:    "customer-service",
		Uptime:     uptime,
		Components: components,
	}

	s.logger.WithField("status", overallStatus).Info("Health check completed")
	return health, nil
}

// ReadinessCheck checks if the service is ready to accept requests
func (s *healthService) ReadinessCheck(ctx context.Context) (*ReadinessStatus, error) {
	s.logger.Info("Performing readiness check")
	
	components := make(map[string]ComponentHealth)
	ready := true
	var message string

	// Check database (critical for readiness)
	dbHealth, err := s.CheckDatabase(ctx)
	if err != nil || !dbHealth.Healthy {
		ready = false
		message = "Database is not available"
		s.logger.Error("Database readiness check failed")
	}
	components["database"] = *dbHealth

	// Check Redis (important but not critical)
	redisHealth, err := s.CheckRedis(ctx)
	if err != nil || !redisHealth.Healthy {
		s.logger.Warn("Redis readiness check failed, but service can still operate")
	}
	components["redis"] = *redisHealth

	readiness := &ReadinessStatus{
		Ready:      ready,
		Timestamp:  time.Now().UTC(),
		Service:    "customer-service",
		Components: components,
		Message:    message,
	}

	s.logger.WithField("ready", ready).Info("Readiness check completed")
	return readiness, nil
}

// LivenessCheck checks if the service is alive
func (s *healthService) LivenessCheck(ctx context.Context) (*LivenessStatus, error) {
	s.logger.Debug("Performing liveness check")
	
	// Simple liveness check - if we can respond, we're alive
	uptime := time.Since(startTime).String()

	liveness := &LivenessStatus{
		Alive:     true,
		Timestamp: time.Now().UTC(),
		Service:   "customer-service",
		Uptime:    uptime,
	}

	return liveness, nil
}

// CheckDatabase checks the database connection and performance
func (s *healthService) CheckDatabase(ctx context.Context) (*ComponentHealth, error) {
	start := time.Now()
	
	// Check database connectivity
	err := repository.HealthCheck(s.db)
	responseTime := time.Since(start)

	if err != nil {
		return &ComponentHealth{
			Status:       "unhealthy",
			Healthy:      false,
			ResponseTime: responseTime.String(),
			Message:      fmt.Sprintf("Database connection failed: %v", err),
			LastChecked:  time.Now().UTC(),
		}, err
	}

	// Get database stats
	sqlDB, err := s.db.DB()
	if err != nil {
		return &ComponentHealth{
			Status:       "unhealthy",
			Healthy:      false,
			ResponseTime: responseTime.String(),
			Message:      fmt.Sprintf("Failed to get database stats: %v", err),
			LastChecked:  time.Now().UTC(),
		}, err
	}

	stats := sqlDB.Stats()
	details := map[string]string{
		"open_connections":     fmt.Sprintf("%d", stats.OpenConnections),
		"in_use_connections":   fmt.Sprintf("%d", stats.InUse),
		"idle_connections":     fmt.Sprintf("%d", stats.Idle),
		"max_open_connections": fmt.Sprintf("%d", stats.MaxOpenConnections),
		"wait_count":          fmt.Sprintf("%d", stats.WaitCount),
		"wait_duration":       stats.WaitDuration.String(),
	}

	// Check if response time is acceptable (< 1 second)
	status := "healthy"
	message := "Database is healthy"
	if responseTime > time.Second {
		status = "degraded"
		message = "Database response time is slow"
	}

	return &ComponentHealth{
		Status:       status,
		Healthy:      true,
		ResponseTime: responseTime.String(),
		Message:      message,
		Details:      details,
		LastChecked:  time.Now().UTC(),
	}, nil
}

// CheckRedis checks the Redis connection and performance
func (s *healthService) CheckRedis(ctx context.Context) (*ComponentHealth, error) {
	start := time.Now()
	
	// Check Redis connectivity
	err := repository.RedisHealthCheck(s.redis)
	responseTime := time.Since(start)

	if err != nil {
		return &ComponentHealth{
			Status:       "unhealthy",
			Healthy:      false,
			ResponseTime: responseTime.String(),
			Message:      fmt.Sprintf("Redis connection failed: %v", err),
			LastChecked:  time.Now().UTC(),
		}, err
	}

	// Get Redis info
	info, err := s.redis.Info(ctx, "memory", "stats", "clients").Result()
	if err != nil {
		s.logger.WithError(err).Warn("Failed to get Redis info")
	}

	// Parse basic Redis stats
	details := map[string]string{
		"redis_version": "unknown",
		"used_memory":   "unknown",
		"connected_clients": "unknown",
	}

	if info != "" {
		// Simple parsing of Redis INFO output
		// In production, you might want to use a proper Redis info parser
		details["info_available"] = "true"
	}

	// Check if response time is acceptable (< 100ms)
	status := "healthy"
	message := "Redis is healthy"
	if responseTime > 100*time.Millisecond {
		status = "degraded"
		message = "Redis response time is slow"
	}

	return &ComponentHealth{
		Status:       status,
		Healthy:      true,
		ResponseTime: responseTime.String(),
		Message:      message,
		Details:      details,
		LastChecked:  time.Now().UTC(),
	}, nil
}

// CheckExternalServices checks the health of external service dependencies
func (s *healthService) CheckExternalServices(ctx context.Context) (*ComponentHealth, error) {
	start := time.Now()
	
	// In a real implementation, you would check external services like:
	// - Kafka brokers
	// - Temporal server
	// - Other microservices
	// - Third-party APIs
	
	responseTime := time.Since(start)

	// For now, we'll simulate a basic check
	// This would be replaced with actual external service health checks
	details := map[string]string{
		"kafka":    "not_checked",
		"temporal": "not_checked",
		"dapr":     "not_checked",
	}

	return &ComponentHealth{
		Status:       "healthy",
		Healthy:      true,
		ResponseTime: responseTime.String(),
		Message:      "External services check not implemented",
		Details:      details,
		LastChecked:  time.Now().UTC(),
	}, nil
}

// Additional utility methods for health monitoring

// GetServiceMetrics returns basic service metrics
func (s *healthService) GetServiceMetrics(ctx context.Context) map[string]interface{} {
	uptime := time.Since(startTime)
	
	metrics := map[string]interface{}{
		"uptime_seconds":    uptime.Seconds(),
		"uptime_string":     uptime.String(),
		"start_time":        startTime.UTC(),
		"current_time":      time.Now().UTC(),
		"service_name":      "customer-service",
		"service_version":   "1.0.0",
		"go_version":        "1.21", // This could be injected from build info
	}

	// Add database connection pool metrics if available
	if s.db != nil {
		if sqlDB, err := s.db.DB(); err == nil {
			stats := sqlDB.Stats()
			metrics["db_open_connections"] = stats.OpenConnections
			metrics["db_in_use_connections"] = stats.InUse
			metrics["db_idle_connections"] = stats.Idle
			metrics["db_wait_count"] = stats.WaitCount
			metrics["db_wait_duration_ms"] = stats.WaitDuration.Milliseconds()
		}
	}

	return metrics
}

// IsHealthy performs a quick health check and returns a boolean
func (s *healthService) IsHealthy(ctx context.Context) bool {
	// Quick database check
	if err := repository.HealthCheck(s.db); err != nil {
		return false
	}

	// Quick Redis check (non-critical)
	if err := repository.RedisHealthCheck(s.redis); err != nil {
		s.logger.WithError(err).Warn("Redis is not healthy, but service can continue")
	}

	return true
}

