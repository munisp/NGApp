package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/service"
)

// HealthHandler handles HTTP requests for health check operations
type HealthHandler struct {
	healthService service.HealthService
	logger        *logrus.Logger
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(healthService service.HealthService, logger *logrus.Logger) *HealthHandler {
	return &HealthHandler{
		healthService: healthService,
		logger:        logger,
	}
}

// HealthCheck godoc
// @Summary Health check endpoint
// @Description Get the overall health status of the service and its dependencies
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} service.HealthStatus
// @Success 503 {object} service.HealthStatus
// @Router /health [get]
func (h *HealthHandler) HealthCheck(c *gin.Context) {
	ctx := c.Request.Context()
	
	health, err := h.healthService.HealthCheck(ctx)
	if err != nil {
		h.logger.WithError(err).Error("Health check failed")
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "health_check_failed",
			Message: "Failed to perform health check",
			Details: err.Error(),
		})
		return
	}

	// Determine HTTP status code based on health status
	statusCode := http.StatusOK
	switch health.Status {
	case "unhealthy":
		statusCode = http.StatusServiceUnavailable
	case "degraded":
		statusCode = http.StatusOK // Service is still operational
	case "healthy":
		statusCode = http.StatusOK
	default:
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, health)
}

// ReadinessCheck godoc
// @Summary Readiness check endpoint
// @Description Check if the service is ready to accept requests
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} service.ReadinessStatus
// @Success 503 {object} service.ReadinessStatus
// @Router /ready [get]
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	ctx := c.Request.Context()
	
	readiness, err := h.healthService.ReadinessCheck(ctx)
	if err != nil {
		h.logger.WithError(err).Error("Readiness check failed")
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "readiness_check_failed",
			Message: "Failed to perform readiness check",
			Details: err.Error(),
		})
		return
	}

	// Return 503 if not ready, 200 if ready
	statusCode := http.StatusOK
	if !readiness.Ready {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, readiness)
}

// LivenessCheck godoc
// @Summary Liveness check endpoint
// @Description Check if the service is alive and responding
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} service.LivenessStatus
// @Router /live [get]
func (h *HealthHandler) LivenessCheck(c *gin.Context) {
	ctx := c.Request.Context()
	
	liveness, err := h.healthService.LivenessCheck(ctx)
	if err != nil {
		h.logger.WithError(err).Error("Liveness check failed")
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "liveness_check_failed",
			Message: "Failed to perform liveness check",
			Details: err.Error(),
		})
		return
	}

	// Return 503 if not alive, 200 if alive
	statusCode := http.StatusOK
	if !liveness.Alive {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, liveness)
}

// DatabaseHealthCheck godoc
// @Summary Database health check endpoint
// @Description Check the health of the database connection
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} service.ComponentHealth
// @Success 503 {object} service.ComponentHealth
// @Router /health/database [get]
func (h *HealthHandler) DatabaseHealthCheck(c *gin.Context) {
	ctx := c.Request.Context()
	
	dbHealth, err := h.healthService.CheckDatabase(ctx)
	if err != nil {
		h.logger.WithError(err).Error("Database health check failed")
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "database_health_check_failed",
			Message: "Database health check failed",
			Details: err.Error(),
		})
		return
	}

	statusCode := http.StatusOK
	if !dbHealth.Healthy {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, dbHealth)
}

// RedisHealthCheck godoc
// @Summary Redis health check endpoint
// @Description Check the health of the Redis connection
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} service.ComponentHealth
// @Success 503 {object} service.ComponentHealth
// @Router /health/redis [get]
func (h *HealthHandler) RedisHealthCheck(c *gin.Context) {
	ctx := c.Request.Context()
	
	redisHealth, err := h.healthService.CheckRedis(ctx)
	if err != nil {
		h.logger.WithError(err).Error("Redis health check failed")
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "redis_health_check_failed",
			Message: "Redis health check failed",
			Details: err.Error(),
		})
		return
	}

	statusCode := http.StatusOK
	if !redisHealth.Healthy {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, redisHealth)
}

// ServiceInfo godoc
// @Summary Service information endpoint
// @Description Get basic information about the service
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /info [get]
func (h *HealthHandler) ServiceInfo(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Get service metrics from health service
	metrics := h.healthService.GetServiceMetrics(ctx)
	
	// Add additional service information
	info := map[string]interface{}{
		"service": map[string]interface{}{
			"name":        "Customer Management Service",
			"description": "Enterprise CRM Customer Management Microservice",
			"version":     "1.0.0",
			"environment": "development", // This could be injected from config
		},
		"build": map[string]interface{}{
			"version":    "1.0.0",
			"commit":     "unknown", // This could be injected from build info
			"build_time": "unknown", // This could be injected from build info
		},
		"runtime": metrics,
		"endpoints": map[string]interface{}{
			"health":    "/health",
			"readiness": "/ready",
			"liveness":  "/live",
			"metrics":   "/metrics",
			"swagger":   "/swagger/index.html",
		},
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    info,
	})
}

// ServiceStatus godoc
// @Summary Service status endpoint
// @Description Get a quick status of the service
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /status [get]
func (h *HealthHandler) ServiceStatus(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Perform a quick health check
	isHealthy := h.healthService.IsHealthy(ctx)
	
	status := map[string]interface{}{
		"status":    "ok",
		"healthy":   isHealthy,
		"service":   "customer-service",
		"timestamp": c.Request.Header.Get("X-Request-Time"),
	}

	if !isHealthy {
		status["status"] = "degraded"
	}

	statusCode := http.StatusOK
	if !isHealthy {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, status)
}

// Ping godoc
// @Summary Ping endpoint
// @Description Simple ping endpoint to check if service is responding
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /ping [get]
func (h *HealthHandler) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, map[string]interface{}{
		"message":   "pong",
		"service":   "customer-service",
		"timestamp": c.Request.Header.Get("X-Request-Time"),
	})
}

// Version godoc
// @Summary Version endpoint
// @Description Get the service version information
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /version [get]
func (h *HealthHandler) Version(c *gin.Context) {
	version := map[string]interface{}{
		"service":     "customer-service",
		"version":     "1.0.0",
		"api_version": "v1",
		"build": map[string]interface{}{
			"version":    "1.0.0",
			"commit":     "unknown", // This could be injected from build info
			"build_time": "unknown", // This could be injected from build info
			"go_version": "1.21",    // This could be injected from build info
		},
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    version,
	})
}

