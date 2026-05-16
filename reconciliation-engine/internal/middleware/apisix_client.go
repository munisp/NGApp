package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type APISIXClient struct {
	adminURL   string
	apiKey     string
	httpClient *http.Client
}

type Route struct {
	ID          string                 `json:"id,omitempty"`
	Name        string                 `json:"name"`
	URI         string                 `json:"uri"`
	URIs        []string               `json:"uris,omitempty"`
	Methods     []string               `json:"methods,omitempty"`
	Host        string                 `json:"host,omitempty"`
	Hosts       []string               `json:"hosts,omitempty"`
	Upstream    *Upstream              `json:"upstream,omitempty"`
	UpstreamID  string                 `json:"upstream_id,omitempty"`
	Plugins     map[string]interface{} `json:"plugins,omitempty"`
	Priority    int                    `json:"priority,omitempty"`
	Status      int                    `json:"status,omitempty"`
	Labels      map[string]string      `json:"labels,omitempty"`
}

type Upstream struct {
	ID          string                 `json:"id,omitempty"`
	Name        string                 `json:"name,omitempty"`
	Type        string                 `json:"type"`
	Nodes       map[string]int         `json:"nodes"`
	Timeout     *UpstreamTimeout       `json:"timeout,omitempty"`
	Retries     int                    `json:"retries,omitempty"`
	HealthCheck *HealthCheck           `json:"checks,omitempty"`
}

type UpstreamTimeout struct {
	Connect int `json:"connect"`
	Send    int `json:"send"`
	Read    int `json:"read"`
}

type HealthCheck struct {
	Active  *ActiveHealthCheck  `json:"active,omitempty"`
	Passive *PassiveHealthCheck `json:"passive,omitempty"`
}

type ActiveHealthCheck struct {
	Type      string `json:"type"`
	HTTPPath  string `json:"http_path"`
	Timeout   int    `json:"timeout"`
	Interval  int    `json:"interval"`
	Healthy   *HealthyConfig   `json:"healthy,omitempty"`
	Unhealthy *UnhealthyConfig `json:"unhealthy,omitempty"`
}

type PassiveHealthCheck struct {
	Healthy   *HealthyConfig   `json:"healthy,omitempty"`
	Unhealthy *UnhealthyConfig `json:"unhealthy,omitempty"`
}

type HealthyConfig struct {
	Interval  int   `json:"interval,omitempty"`
	Successes int   `json:"successes,omitempty"`
	HTTPStatuses []int `json:"http_statuses,omitempty"`
}

type UnhealthyConfig struct {
	Interval    int   `json:"interval,omitempty"`
	HTTPFailures int  `json:"http_failures,omitempty"`
	TCPFailures  int  `json:"tcp_failures,omitempty"`
	Timeouts     int  `json:"timeouts,omitempty"`
	HTTPStatuses []int `json:"http_statuses,omitempty"`
}

func NewAPISIXClient(adminURL, apiKey string) (*APISIXClient, error) {
	return &APISIXClient{
		adminURL: adminURL,
		apiKey:   apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

func (a *APISIXClient) CreateRoute(ctx context.Context, route *Route) error {
	url := fmt.Sprintf("%s/apisix/admin/routes/%s", a.adminURL, route.ID)

	jsonData, err := json.Marshal(route)
	if err != nil {
		return fmt.Errorf("failed to marshal route: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-KEY", a.apiKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create route: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create route failed: %s", string(body))
	}

	return nil
}

func (a *APISIXClient) DeleteRoute(ctx context.Context, routeID string) error {
	url := fmt.Sprintf("%s/apisix/admin/routes/%s", a.adminURL, routeID)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("X-API-KEY", a.apiKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete route: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (a *APISIXClient) CreateUpstream(ctx context.Context, upstream *Upstream) error {
	url := fmt.Sprintf("%s/apisix/admin/upstreams/%s", a.adminURL, upstream.ID)

	jsonData, err := json.Marshal(upstream)
	if err != nil {
		return fmt.Errorf("failed to marshal upstream: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-KEY", a.apiKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create upstream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create upstream failed: %s", string(body))
	}

	return nil
}

func (a *APISIXClient) SetupReconciliationRoutes(ctx context.Context) error {
	upstream := &Upstream{
		ID:   "reconciliation-upstream",
		Name: "Reconciliation Engine Upstream",
		Type: "roundrobin",
		Nodes: map[string]int{
			"reconciliation-engine:8080": 1,
		},
		Timeout: &UpstreamTimeout{
			Connect: 6,
			Send:    6,
			Read:    6,
		},
		Retries: 3,
		HealthCheck: &HealthCheck{
			Active: &ActiveHealthCheck{
				Type:     "http",
				HTTPPath: "/health",
				Timeout:  5,
				Interval: 10,
				Healthy: &HealthyConfig{
					Successes:    2,
					HTTPStatuses: []int{200},
				},
				Unhealthy: &UnhealthyConfig{
					HTTPFailures: 3,
					Timeouts:     3,
					HTTPStatuses: []int{500, 502, 503},
				},
			},
		},
	}

	if err := a.CreateUpstream(ctx, upstream); err != nil {
		return fmt.Errorf("failed to create upstream: %w", err)
	}

	routes := []Route{
		{
			ID:         "reconciliation-jobs",
			Name:       "Reconciliation Jobs API",
			URI:        "/api/v1/reconciliation/jobs/*",
			Methods:    []string{"GET", "POST", "PUT", "DELETE"},
			UpstreamID: "reconciliation-upstream",
			Plugins: map[string]interface{}{
				"jwt-auth": map[string]interface{}{},
				"limit-req": map[string]interface{}{
					"rate":  100,
					"burst": 50,
					"key":   "consumer_name",
				},
				"proxy-cache": map[string]interface{}{
					"cache_method":  []string{"GET"},
					"cache_ttl":     300,
					"hide_cache_headers": false,
				},
			},
		},
		{
			ID:         "reconciliation-items",
			Name:       "Reconciliation Items API",
			URI:        "/api/v1/reconciliation/items/*",
			Methods:    []string{"GET", "POST", "PUT"},
			UpstreamID: "reconciliation-upstream",
			Plugins: map[string]interface{}{
				"jwt-auth": map[string]interface{}{},
				"limit-req": map[string]interface{}{
					"rate":  200,
					"burst": 100,
					"key":   "consumer_name",
				},
			},
		},
		{
			ID:         "reconciliation-statements",
			Name:       "Bank Statements API",
			URI:        "/api/v1/reconciliation/statements/*",
			Methods:    []string{"GET", "POST"},
			UpstreamID: "reconciliation-upstream",
			Plugins: map[string]interface{}{
				"jwt-auth": map[string]interface{}{},
				"limit-req": map[string]interface{}{
					"rate":  50,
					"burst": 25,
					"key":   "consumer_name",
				},
				"request-validation": map[string]interface{}{
					"body_schema": map[string]interface{}{
						"type": "object",
						"required": []string{"bank_code", "account_number"},
					},
				},
			},
		},
		{
			ID:         "reconciliation-reports",
			Name:       "Reconciliation Reports API",
			URI:        "/api/v1/reconciliation/reports/*",
			Methods:    []string{"GET", "POST"},
			UpstreamID: "reconciliation-upstream",
			Plugins: map[string]interface{}{
				"jwt-auth": map[string]interface{}{},
				"limit-req": map[string]interface{}{
					"rate":  20,
					"burst": 10,
					"key":   "consumer_name",
				},
			},
		},
		{
			ID:         "reconciliation-stats",
			Name:       "Reconciliation Statistics API",
			URI:        "/api/v1/reconciliation/stats",
			Methods:    []string{"GET"},
			UpstreamID: "reconciliation-upstream",
			Plugins: map[string]interface{}{
				"jwt-auth": map[string]interface{}{},
				"proxy-cache": map[string]interface{}{
					"cache_method":  []string{"GET"},
					"cache_ttl":     60,
				},
			},
		},
	}

	for _, route := range routes {
		if err := a.CreateRoute(ctx, &route); err != nil {
			return fmt.Errorf("failed to create route %s: %w", route.ID, err)
		}
	}

	return nil
}

func (a *APISIXClient) Close() error {
	return nil
}
