// Package integrations provides production-ready external system integrations
// This file implements a unified health check system for all external services
package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// ServiceHealth represents the health status of a service
type ServiceHealth struct {
	Name        string            `json:"name"`
	Status      HealthStatus      `json:"status"`
	Message     string            `json:"message,omitempty"`
	LastCheck   time.Time         `json:"last_check"`
	LastSuccess time.Time         `json:"last_success,omitempty"`
	Latency     time.Duration     `json:"latency_ms"`
	Details     map[string]string `json:"details,omitempty"`
	Consecutive int               `json:"consecutive_failures,omitempty"`
}

// HealthStatus represents the health status
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusDegraded  HealthStatus = "degraded"
	HealthStatusUnknown   HealthStatus = "unknown"
)

// HealthChecker performs health checks on external services
type HealthChecker interface {
	HealthCheck(ctx context.Context) error
}

// ProductionHealthChecker is a unified health checker for all production services
type ProductionHealthChecker struct {
	tigerbeetle *ProductionTigerBeetleClient
	mojaloop    *ProductionMojaloopClient
	keycloak    *ProductionKeycloakClient
	apisix      *ProductionAPISIXClient

	healthCache map[string]*ServiceHealth
	cacheMu     sync.RWMutex

	checkInterval time.Duration
	timeout       time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
}

// HealthCheckerConfig holds configuration for the health checker
type HealthCheckerConfig struct {
	CheckInterval time.Duration
	Timeout       time.Duration
}

// DefaultHealthCheckerConfig returns sensible defaults
func DefaultHealthCheckerConfig() *HealthCheckerConfig {
	return &HealthCheckerConfig{
		CheckInterval: 30 * time.Second,
		Timeout:       10 * time.Second,
	}
}

// NewProductionHealthChecker creates a new production health checker
func NewProductionHealthChecker(
	tigerbeetle *ProductionTigerBeetleClient,
	mojaloop *ProductionMojaloopClient,
	keycloak *ProductionKeycloakClient,
	apisix *ProductionAPISIXClient,
	config *HealthCheckerConfig,
) *ProductionHealthChecker {
	if config == nil {
		config = DefaultHealthCheckerConfig()
	}

	return &ProductionHealthChecker{
		tigerbeetle:   tigerbeetle,
		mojaloop:      mojaloop,
		keycloak:      keycloak,
		apisix:        apisix,
		healthCache:   make(map[string]*ServiceHealth),
		checkInterval: config.CheckInterval,
		timeout:       config.Timeout,
		stopCh:        make(chan struct{}),
	}
}

// Start starts the background health checking
func (h *ProductionHealthChecker) Start() {
	h.wg.Add(1)
	go func() {
		defer h.wg.Done()
		h.runHealthChecks()
	}()
}

// Stop stops the background health checking
func (h *ProductionHealthChecker) Stop() {
	close(h.stopCh)
	h.wg.Wait()
}

// runHealthChecks runs periodic health checks
func (h *ProductionHealthChecker) runHealthChecks() {
	// Run initial check
	h.checkAllServices()

	ticker := time.NewTicker(h.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.checkAllServices()
		case <-h.stopCh:
			return
		}
	}
}

// checkAllServices checks all services concurrently
func (h *ProductionHealthChecker) checkAllServices() {
	var wg sync.WaitGroup

	services := []struct {
		name    string
		checker func(ctx context.Context) error
	}{
		{"tigerbeetle", h.checkTigerBeetle},
		{"mojaloop", h.checkMojaloop},
		{"keycloak", h.checkKeycloak},
		{"apisix", h.checkAPISIX},
	}

	for _, svc := range services {
		wg.Add(1)
		go func(name string, checker func(ctx context.Context) error) {
			defer wg.Done()
			h.checkService(name, checker)
		}(svc.name, svc.checker)
	}

	wg.Wait()
}

// checkService checks a single service and updates the cache
func (h *ProductionHealthChecker) checkService(name string, checker func(ctx context.Context) error) {
	ctx, cancel := context.WithTimeout(context.Background(), h.timeout)
	defer cancel()

	start := time.Now()
	err := checker(ctx)
	latency := time.Since(start)

	h.cacheMu.Lock()
	defer h.cacheMu.Unlock()

	existing := h.healthCache[name]
	if existing == nil {
		existing = &ServiceHealth{Name: name}
	}

	existing.LastCheck = time.Now()
	existing.Latency = latency

	if err != nil {
		existing.Status = HealthStatusUnhealthy
		existing.Message = err.Error()
		existing.Consecutive++
	} else {
		existing.Status = HealthStatusHealthy
		existing.Message = ""
		existing.LastSuccess = time.Now()
		existing.Consecutive = 0
	}

	h.healthCache[name] = existing
}

// checkTigerBeetle checks TigerBeetle health
func (h *ProductionHealthChecker) checkTigerBeetle(ctx context.Context) error {
	if h.tigerbeetle == nil {
		return fmt.Errorf("TigerBeetle client not configured")
	}
	return h.tigerbeetle.HealthCheck(ctx)
}

// checkMojaloop checks Mojaloop health
func (h *ProductionHealthChecker) checkMojaloop(ctx context.Context) error {
	if h.mojaloop == nil {
		return fmt.Errorf("Mojaloop client not configured")
	}
	return h.mojaloop.HealthCheck(ctx)
}

// checkKeycloak checks Keycloak health
func (h *ProductionHealthChecker) checkKeycloak(ctx context.Context) error {
	if h.keycloak == nil {
		return fmt.Errorf("Keycloak client not configured")
	}
	return h.keycloak.HealthCheck(ctx)
}

// checkAPISIX checks APISIX health
func (h *ProductionHealthChecker) checkAPISIX(ctx context.Context) error {
	if h.apisix == nil {
		return fmt.Errorf("APISIX client not configured")
	}
	return h.apisix.HealthCheck(ctx)
}

// GetHealth returns the current health status of a service
func (h *ProductionHealthChecker) GetHealth(serviceName string) *ServiceHealth {
	h.cacheMu.RLock()
	defer h.cacheMu.RUnlock()

	if health, ok := h.healthCache[serviceName]; ok {
		return health
	}

	return &ServiceHealth{
		Name:    serviceName,
		Status:  HealthStatusUnknown,
		Message: "No health check performed yet",
	}
}

// GetAllHealth returns the health status of all services
func (h *ProductionHealthChecker) GetAllHealth() map[string]*ServiceHealth {
	h.cacheMu.RLock()
	defer h.cacheMu.RUnlock()

	result := make(map[string]*ServiceHealth)
	for k, v := range h.healthCache {
		result[k] = v
	}

	return result
}

// GetOverallHealth returns the overall system health
func (h *ProductionHealthChecker) GetOverallHealth() *OverallHealth {
	h.cacheMu.RLock()
	defer h.cacheMu.RUnlock()

	overall := &OverallHealth{
		Status:   HealthStatusHealthy,
		Services: make(map[string]*ServiceHealth),
	}

	healthyCount := 0
	unhealthyCount := 0
	degradedCount := 0

	for name, health := range h.healthCache {
		overall.Services[name] = health

		switch health.Status {
		case HealthStatusHealthy:
			healthyCount++
		case HealthStatusUnhealthy:
			unhealthyCount++
		case HealthStatusDegraded:
			degradedCount++
		}
	}

	overall.HealthyCount = healthyCount
	overall.UnhealthyCount = unhealthyCount
	overall.DegradedCount = degradedCount
	overall.TotalCount = len(h.healthCache)

	// Determine overall status
	if unhealthyCount > 0 {
		// If any critical service is unhealthy, overall is unhealthy
		if h.isCriticalServiceUnhealthy() {
			overall.Status = HealthStatusUnhealthy
			overall.Message = fmt.Sprintf("%d critical service(s) unhealthy", unhealthyCount)
		} else {
			overall.Status = HealthStatusDegraded
			overall.Message = fmt.Sprintf("%d service(s) unhealthy", unhealthyCount)
		}
	} else if degradedCount > 0 {
		overall.Status = HealthStatusDegraded
		overall.Message = fmt.Sprintf("%d service(s) degraded", degradedCount)
	} else if healthyCount == 0 {
		overall.Status = HealthStatusUnknown
		overall.Message = "No health checks performed yet"
	} else {
		overall.Message = "All services healthy"
	}

	return overall
}

// isCriticalServiceUnhealthy checks if any critical service is unhealthy
func (h *ProductionHealthChecker) isCriticalServiceUnhealthy() bool {
	criticalServices := []string{"tigerbeetle", "keycloak"}

	for _, name := range criticalServices {
		if health, ok := h.healthCache[name]; ok {
			if health.Status == HealthStatusUnhealthy {
				return true
			}
		}
	}

	return false
}

// OverallHealth represents the overall system health
type OverallHealth struct {
	Status         HealthStatus              `json:"status"`
	Message        string                    `json:"message"`
	Services       map[string]*ServiceHealth `json:"services"`
	HealthyCount   int                       `json:"healthy_count"`
	UnhealthyCount int                       `json:"unhealthy_count"`
	DegradedCount  int                       `json:"degraded_count"`
	TotalCount     int                       `json:"total_count"`
}

// ToJSON returns the overall health as JSON
func (o *OverallHealth) ToJSON() ([]byte, error) {
	return json.Marshal(o)
}

// ForceCheck forces an immediate health check of all services
func (h *ProductionHealthChecker) ForceCheck() {
	h.checkAllServices()
}

// ForceCheckService forces an immediate health check of a specific service
func (h *ProductionHealthChecker) ForceCheckService(serviceName string) error {
	var checker func(ctx context.Context) error

	switch serviceName {
	case "tigerbeetle":
		checker = h.checkTigerBeetle
	case "mojaloop":
		checker = h.checkMojaloop
	case "keycloak":
		checker = h.checkKeycloak
	case "apisix":
		checker = h.checkAPISIX
	default:
		return fmt.Errorf("unknown service: %s", serviceName)
	}

	h.checkService(serviceName, checker)
	return nil
}

// WaitForHealthy waits for all services to become healthy
func (h *ProductionHealthChecker) WaitForHealthy(ctx context.Context) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			h.ForceCheck()
			overall := h.GetOverallHealth()
			if overall.Status == HealthStatusHealthy {
				return nil
			}
		}
	}
}

// WaitForService waits for a specific service to become healthy
func (h *ProductionHealthChecker) WaitForService(ctx context.Context, serviceName string) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := h.ForceCheckService(serviceName); err != nil {
				return err
			}
			health := h.GetHealth(serviceName)
			if health.Status == HealthStatusHealthy {
				return nil
			}
		}
	}
}
