// Package integration provides infrastructure integration components
package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

// MiddlewareHealth provides unified health checking for all middleware services
type MiddlewareHealth struct {
	checks  []HealthCheck
	timeout time.Duration
	mu      sync.RWMutex
	results map[string]*HealthResult
}

// HealthCheck defines a single middleware health check
type HealthCheck struct {
	Name     string
	Type     string // "tcp", "http", "custom"
	Endpoint string
	CheckFn  func(ctx context.Context) error
}

// HealthResult stores the result of a health check
type HealthResult struct {
	Name      string        `json:"name"`
	Status    string        `json:"status"` // "healthy", "degraded", "unhealthy"
	Latency   time.Duration `json:"latency_ms"`
	LastCheck time.Time     `json:"last_check"`
	Error     string        `json:"error,omitempty"`
	Details   string        `json:"details,omitempty"`
}

// MiddlewareHealthConfig holds configuration for all middleware endpoints
type MiddlewareHealthConfig struct {
	KafkaBrokers    string `json:"kafka_brokers"`
	RedisAddr       string `json:"redis_addr"`
	PostgresAddr    string `json:"postgres_addr"`
	TemporalAddr    string `json:"temporal_addr"`
	KeycloakAddr    string `json:"keycloak_addr"`
	PermifyAddr     string `json:"permify_addr"`
	OpenSearchAddr  string `json:"opensearch_addr"`
	APISIXAdminAddr string `json:"apisix_admin_addr"`
	TigerBeetleAddr string `json:"tigerbeetle_addr"`
	MojaLoopAddr    string `json:"mojaloop_addr"`
	FluvioAddr      string `json:"fluvio_addr"`
	DaprAddr        string `json:"dapr_addr"`
	OpenAppSecAddr  string `json:"openappsec_addr"`
	JaegerAddr      string `json:"jaeger_addr"`
	PrometheusAddr  string `json:"prometheus_addr"`
	GrafanaAddr     string `json:"grafana_addr"`
}

// DefaultMiddlewareHealthConfig returns default addresses for local/docker development
func DefaultMiddlewareHealthConfig() *MiddlewareHealthConfig {
	return &MiddlewareHealthConfig{
		KafkaBrokers:    "localhost:9092",
		RedisAddr:       "localhost:6379",
		PostgresAddr:    "localhost:5432",
		TemporalAddr:    "localhost:7233",
		KeycloakAddr:    "http://localhost:8180",
		PermifyAddr:     "localhost:3476",
		OpenSearchAddr:  "http://localhost:9200",
		APISIXAdminAddr: "http://localhost:9180",
		TigerBeetleAddr: "localhost:3000",
		MojaLoopAddr:    "http://localhost:4001",
		FluvioAddr:      "localhost:9003",
		DaprAddr:        "localhost:3500",
		OpenAppSecAddr:  "http://localhost:4000",
		JaegerAddr:      "http://localhost:16686",
		PrometheusAddr:  "http://localhost:9090",
		GrafanaAddr:     "http://localhost:3100",
	}
}

// NewMiddlewareHealth creates a new health checker with all middleware checks
func NewMiddlewareHealth(cfg *MiddlewareHealthConfig) *MiddlewareHealth {
	if cfg == nil {
		cfg = DefaultMiddlewareHealthConfig()
	}

	mh := &MiddlewareHealth{
		timeout: 5 * time.Second,
		results: make(map[string]*HealthResult),
	}

	mh.checks = []HealthCheck{
		{Name: "kafka", Type: "tcp", Endpoint: cfg.KafkaBrokers},
		{Name: "redis", Type: "tcp", Endpoint: cfg.RedisAddr},
		{Name: "postgres", Type: "tcp", Endpoint: cfg.PostgresAddr},
		{Name: "temporal", Type: "tcp", Endpoint: cfg.TemporalAddr},
		{Name: "keycloak", Type: "http", Endpoint: cfg.KeycloakAddr + "/health"},
		{Name: "permify", Type: "tcp", Endpoint: cfg.PermifyAddr},
		{Name: "opensearch", Type: "http", Endpoint: cfg.OpenSearchAddr + "/_cluster/health"},
		{Name: "apisix", Type: "http", Endpoint: cfg.APISIXAdminAddr + "/apisix/admin/routes"},
		{Name: "tigerbeetle", Type: "tcp", Endpoint: cfg.TigerBeetleAddr},
		{Name: "mojaloop", Type: "http", Endpoint: cfg.MojaLoopAddr + "/health"},
		{Name: "fluvio", Type: "tcp", Endpoint: cfg.FluvioAddr},
		{Name: "dapr", Type: "http", Endpoint: "http://" + cfg.DaprAddr + "/v1.0/healthz"},
		{Name: "openappsec", Type: "http", Endpoint: cfg.OpenAppSecAddr + "/health"},
		{Name: "jaeger", Type: "http", Endpoint: cfg.JaegerAddr + "/api/services"},
		{Name: "prometheus", Type: "http", Endpoint: cfg.PrometheusAddr + "/-/healthy"},
		{Name: "grafana", Type: "http", Endpoint: cfg.GrafanaAddr + "/api/health"},
	}

	return mh
}

// CheckAll runs all health checks concurrently and returns results
func (mh *MiddlewareHealth) CheckAll(ctx context.Context) map[string]*HealthResult {
	var wg sync.WaitGroup
	resultsCh := make(chan *HealthResult, len(mh.checks))

	for _, check := range mh.checks {
		wg.Add(1)
		go func(c HealthCheck) {
			defer wg.Done()
			result := mh.runCheck(ctx, c)
			resultsCh <- result
		}(check)
	}

	wg.Wait()
	close(resultsCh)

	mh.mu.Lock()
	for result := range resultsCh {
		mh.results[result.Name] = result
	}
	mh.mu.Unlock()

	mh.mu.RLock()
	defer mh.mu.RUnlock()
	results := make(map[string]*HealthResult, len(mh.results))
	for k, v := range mh.results {
		results[k] = v
	}
	return results
}

// runCheck executes a single health check
func (mh *MiddlewareHealth) runCheck(ctx context.Context, check HealthCheck) *HealthResult {
	start := time.Now()
	result := &HealthResult{
		Name:      check.Name,
		LastCheck: start,
	}

	checkCtx, cancel := context.WithTimeout(ctx, mh.timeout)
	defer cancel()

	var err error
	switch check.Type {
	case "tcp":
		err = mh.checkTCP(checkCtx, check.Endpoint)
	case "http":
		err = mh.checkHTTP(checkCtx, check.Endpoint)
	case "custom":
		if check.CheckFn != nil {
			err = check.CheckFn(checkCtx)
		}
	}

	result.Latency = time.Since(start)
	if err != nil {
		result.Status = "unhealthy"
		result.Error = err.Error()
	} else {
		if result.Latency > 2*time.Second {
			result.Status = "degraded"
		} else {
			result.Status = "healthy"
		}
	}

	return result
}

// checkTCP performs a TCP connection check
func (mh *MiddlewareHealth) checkTCP(ctx context.Context, addr string) error {
	d := net.Dialer{Timeout: mh.timeout}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("tcp dial failed: %w", err)
	}
	conn.Close()
	return nil
}

// checkHTTP performs an HTTP health check
func (mh *MiddlewareHealth) checkHTTP(ctx context.Context, url string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	client := &http.Client{Timeout: mh.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("unhealthy status: %d", resp.StatusCode)
	}
	return nil
}

// GetOverallStatus returns aggregate health status
func (mh *MiddlewareHealth) GetOverallStatus() string {
	mh.mu.RLock()
	defer mh.mu.RUnlock()

	unhealthy := 0
	degraded := 0
	for _, r := range mh.results {
		switch r.Status {
		case "unhealthy":
			unhealthy++
		case "degraded":
			degraded++
		}
	}

	if unhealthy > 3 {
		return "critical"
	}
	if unhealthy > 0 {
		return "degraded"
	}
	if degraded > 0 {
		return "warning"
	}
	return "healthy"
}

// ToJSON serializes health results
func (mh *MiddlewareHealth) ToJSON() ([]byte, error) {
	mh.mu.RLock()
	defer mh.mu.RUnlock()

	report := struct {
		Overall   string                   `json:"overall_status"`
		Timestamp time.Time                `json:"timestamp"`
		Services  map[string]*HealthResult `json:"services"`
	}{
		Overall:   mh.GetOverallStatus(),
		Timestamp: time.Now(),
		Services:  mh.results,
	}

	return json.MarshalIndent(report, "", "  ")
}

// HTTPHandler returns an HTTP handler for the health endpoint
func (mh *MiddlewareHealth) HTTPHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		results := mh.CheckAll(r.Context())
		_ = results

		data, err := mh.ToJSON()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		overall := mh.GetOverallStatus()
		if overall == "critical" {
			w.WriteHeader(http.StatusServiceUnavailable)
		} else if overall == "degraded" || overall == "warning" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusOK)
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	}
}
