// Package apisix provides an Apache APISIX Admin API client for OG-RMM.
// APISIX serves as the production API gateway, handling:
//   - JWT authentication via the jwt-auth plugin
//   - Rate limiting via the limit-req plugin
//   - Observability via the prometheus and opentelemetry plugins
//   - mTLS termination and upstream TLS verification
//   - Traffic routing to all Go/Python microservices
package apisix

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Config holds APISIX Admin API configuration.
type Config struct {
	AdminURL string
	AdminKey string
}

// DefaultConfig returns Config from environment variables.
// SECURITY: APISIX_ADMIN_KEY must be set via environment; no hardcoded fallback.
func DefaultConfig() Config {
	url := os.Getenv("APISIX_ADMIN_URL")
	if url == "" {
		url = "http://apisix:9180"
	}
	key := os.Getenv("APISIX_ADMIN_KEY")
	if key == "" {
		panic("APISIX_ADMIN_KEY environment variable is required — do not use hardcoded keys in production")
	}
	return Config{AdminURL: url, AdminKey: key}
}

// Client wraps the APISIX Admin API.
type Client struct {
	cfg  Config
	http *http.Client
}

// NewClient creates a new APISIX Admin API client.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) do(ctx context.Context, method, path string, body any) ([]byte, error) {
	var r io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("apisix: marshal body: %w", err)
		}
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.cfg.AdminURL+path, r)
	if err != nil {
		return nil, fmt.Errorf("apisix: create request: %w", err)
	}
	req.Header.Set("X-API-KEY", c.cfg.AdminKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("apisix: request: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("apisix: status %d: %s", resp.StatusCode, respBody)
	}
	return respBody, nil
}

// Route represents an APISIX route configuration.
type Route struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	URI      string         `json:"uri"`
	Methods  []string       `json:"methods"`
	UpstreamID string       `json:"upstream_id,omitempty"`
	Plugins  map[string]any `json:"plugins,omitempty"`
	Status   int            `json:"status"` // 1=enabled, 0=disabled
}

// Upstream represents an APISIX upstream (load-balanced backend pool).
type Upstream struct {
	ID    string            `json:"id"`
	Name  string            `json:"name"`
	Type  string            `json:"type"` // roundrobin, chash, ewma
	Nodes map[string]int    `json:"nodes"` // host:port -> weight
	Scheme string           `json:"scheme"` // http, https, grpc, grpcs
	HealthCheck *HealthCheck `json:"checks,omitempty"`
}

// HealthCheck defines active/passive health check configuration.
type HealthCheck struct {
	Active *ActiveCheck `json:"active,omitempty"`
}

// ActiveCheck defines active health check parameters.
type ActiveCheck struct {
	Type     string `json:"type"` // http, https, tcp
	Timeout  int    `json:"timeout"`
	HTTPPath string `json:"http_path"`
	Healthy  struct {
		Interval  int `json:"interval"`
		Successes int `json:"successes"`
	} `json:"healthy"`
	Unhealthy struct {
		Interval     int `json:"interval"`
		HTTPFailures int `json:"http_failures"`
	} `json:"unhealthy"`
}

// UpsertRoute creates or updates an APISIX route.
func (c *Client) UpsertRoute(ctx context.Context, route Route) error {
	_, err := c.do(ctx, http.MethodPut, "/apisix/admin/routes/"+route.ID, route)
	return err
}

// UpsertUpstream creates or updates an APISIX upstream.
func (c *Client) UpsertUpstream(ctx context.Context, upstream Upstream) error {
	_, err := c.do(ctx, http.MethodPut, "/apisix/admin/upstreams/"+upstream.ID, upstream)
	return err
}

// DeleteRoute removes a route by ID.
func (c *Client) DeleteRoute(ctx context.Context, id string) error {
	_, err := c.do(ctx, http.MethodDelete, "/apisix/admin/routes/"+id, nil)
	return err
}

// ListRoutes returns all configured routes.
func (c *Client) ListRoutes(ctx context.Context) ([]Route, error) {
	data, err := c.do(ctx, http.MethodGet, "/apisix/admin/routes", nil)
	if err != nil {
		return nil, err
	}
	var result struct {
		List []struct {
			Value Route `json:"value"`
		} `json:"list"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("apisix: decode routes: %w", err)
	}
	routes := make([]Route, 0, len(result.List))
	for _, item := range result.List {
		routes = append(routes, item.Value)
	}
	return routes, nil
}

// OGRMMRoutes returns the standard APISIX route definitions for all OG-RMM services.
func OGRMMRoutes() []Route {
	return []Route{
		{
			ID: "og-rmm-trpc", Name: "tRPC API",
			URI: "/api/trpc/*", Methods: []string{"GET", "POST"},
			UpstreamID: "og-rmm-node",
			Plugins: map[string]any{
				"jwt-auth":  map[string]any{},
				"limit-req": map[string]any{"rate": 200, "burst": 50, "key": "consumer_name"},
				"opentelemetry": map[string]any{"sampler": map[string]any{"name": "always_on"}},
				"prometheus": map[string]any{},
			},
			Status: 1,
		},
		{
			ID: "og-rmm-telemetry", Name: "Telemetry Ingestion",
			URI: "/ingest/*", Methods: []string{"POST"},
			UpstreamID: "telemetry-ingestion",
			Plugins: map[string]any{
				"limit-req": map[string]any{"rate": 1000, "burst": 200, "key": "remote_addr"},
				"opentelemetry": map[string]any{"sampler": map[string]any{"name": "always_on"}},
			},
			Status: 1,
		},
		{
			ID: "og-rmm-ml", Name: "ML Service",
			URI: "/ml/*", Methods: []string{"GET", "POST"},
			UpstreamID: "ml-service",
			Plugins: map[string]any{
				"jwt-auth": map[string]any{},
				"limit-req": map[string]any{"rate": 50, "burst": 10, "key": "consumer_name"},
			},
			Status: 1,
		},
		{
			ID: "og-rmm-physics", Name: "Physics Engine",
			URI: "/physics/*", Methods: []string{"GET", "POST"},
			UpstreamID: "physics-engine",
			Plugins: map[string]any{
				"jwt-auth": map[string]any{},
				"limit-req": map[string]any{"rate": 30, "burst": 5, "key": "consumer_name"},
			},
			Status: 1,
		},
		{
			ID: "og-rmm-alarm", Name: "Alarm Manager",
			URI: "/alarms/*", Methods: []string{"GET", "POST", "PUT", "DELETE"},
			UpstreamID: "alarm-manager",
			Plugins: map[string]any{
				"jwt-auth": map[string]any{},
				"opentelemetry": map[string]any{"sampler": map[string]any{"name": "always_on"}},
			},
			Status: 1,
		},
		{
			ID: "og-rmm-workflow", Name: "Workflow Engine",
			URI: "/workflows/*", Methods: []string{"GET", "POST", "PUT"},
			UpstreamID: "workflow-engine",
			Plugins: map[string]any{
				"jwt-auth": map[string]any{},
			},
			Status: 1,
		},
	}
}

// OGRMMUpstreams returns the standard APISIX upstream definitions for all OG-RMM services.
func OGRMMUpstreams() []Upstream {
	healthCheck := &HealthCheck{
		Active: &ActiveCheck{
			Type: "http", Timeout: 5, HTTPPath: "/health",
			Healthy:   struct{ Interval int `json:"interval"`; Successes int `json:"successes"` }{Interval: 10, Successes: 2},
			Unhealthy: struct{ Interval int `json:"interval"`; HTTPFailures int `json:"http_failures"` }{Interval: 5, HTTPFailures: 3},
		},
	}
	return []Upstream{
		{ID: "og-rmm-node", Name: "Node.js App", Type: "roundrobin", Scheme: "http",
			Nodes: map[string]int{"og-rmm-app:3000": 1}, HealthCheck: healthCheck},
		{ID: "telemetry-ingestion", Name: "Telemetry Ingestion", Type: "roundrobin", Scheme: "http",
			Nodes: map[string]int{"telemetry-ingestion:8080": 1}, HealthCheck: healthCheck},
		{ID: "ml-service", Name: "ML Service", Type: "roundrobin", Scheme: "http",
			Nodes: map[string]int{"ml-service:8000": 1}, HealthCheck: healthCheck},
		{ID: "physics-engine", Name: "Physics Engine", Type: "roundrobin", Scheme: "http",
			Nodes: map[string]int{"physics-engine:8090": 1}, HealthCheck: healthCheck},
		{ID: "alarm-manager", Name: "Alarm Manager", Type: "roundrobin", Scheme: "http",
			Nodes: map[string]int{"alarm-manager:8081": 1}, HealthCheck: healthCheck},
		{ID: "workflow-engine", Name: "Workflow Engine", Type: "roundrobin", Scheme: "http",
			Nodes: map[string]int{"workflow-engine:8082": 1}, HealthCheck: healthCheck},
	}
}

// SyncRoutes provisions all OG-RMM routes and upstreams in APISIX.
func (c *Client) SyncRoutes(ctx context.Context) error {
	for _, upstream := range OGRMMUpstreams() {
		if err := c.UpsertUpstream(ctx, upstream); err != nil {
			return fmt.Errorf("apisix: sync upstream %s: %w", upstream.ID, err)
		}
	}
	for _, route := range OGRMMRoutes() {
		if err := c.UpsertRoute(ctx, route); err != nil {
			return fmt.Errorf("apisix: sync route %s: %w", route.ID, err)
		}
	}
	return nil
}
