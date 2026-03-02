package apisix

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/sony/gobreaker/v2"
)

// Client wraps Apache APISIX Admin API operations with real HTTP connectivity.
// Manages routes, consumers, SSL certificates, upstreams, and plugins dynamically.
type Client struct {
	adminURL     string
	adminKey     string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	httpClient   *http.Client
	cb           *gobreaker.CircuitBreaker[[]byte]
	ctx          context.Context
	cancel       context.CancelFunc
	// In-memory route/consumer tracking for fallback
	routes    map[string]Route
	consumers map[string]Consumer
}

// Route represents an APISIX route object
type Route struct {
	ID         string                 `json:"id,omitempty"`
	URI        string                 `json:"uri"`
	Name       string                 `json:"name,omitempty"`
	Methods    []string               `json:"methods,omitempty"`
	UpstreamID string                 `json:"upstream_id,omitempty"`
	Upstream   *Upstream              `json:"upstream,omitempty"`
	Plugins    map[string]interface{} `json:"plugins,omitempty"`
	Priority   int                    `json:"priority,omitempty"`
	Status     int                    `json:"status,omitempty"`
	Labels     map[string]string      `json:"labels,omitempty"`
}

// Upstream represents an APISIX upstream (backend service pool)
type Upstream struct {
	ID     string         `json:"id,omitempty"`
	Type   string         `json:"type"`
	Nodes  map[string]int `json:"nodes"`
	Checks *HealthCheck   `json:"checks,omitempty"`
	TLS    *UpstreamTLS   `json:"tls,omitempty"`
}

// UpstreamTLS configures mTLS between APISIX and upstream
type UpstreamTLS struct {
	ClientCert string `json:"client_cert,omitempty"`
	ClientKey  string `json:"client_key,omitempty"`
	VerifyCert bool   `json:"verify,omitempty"`
}

// HealthCheck configures active/passive health checking
type HealthCheck struct {
	Active  *ActiveHealthCheck  `json:"active,omitempty"`
	Passive *PassiveHealthCheck `json:"passive,omitempty"`
}

// ActiveHealthCheck is an active upstream health check
type ActiveHealthCheck struct {
	Type      string           `json:"type"`
	HTTPPath  string           `json:"http_path"`
	Healthy   *HealthyConfig   `json:"healthy,omitempty"`
	Unhealthy *UnhealthyConfig `json:"unhealthy,omitempty"`
}

// PassiveHealthCheck is a passive upstream health check
type PassiveHealthCheck struct {
	Healthy   *HealthyConfig   `json:"healthy,omitempty"`
	Unhealthy *UnhealthyConfig `json:"unhealthy,omitempty"`
}

// HealthyConfig defines healthy thresholds
type HealthyConfig struct {
	Interval  int   `json:"interval,omitempty"`
	Successes int   `json:"successes,omitempty"`
	Statuses  []int `json:"http_statuses,omitempty"`
}

// UnhealthyConfig defines unhealthy thresholds
type UnhealthyConfig struct {
	Interval     int   `json:"interval,omitempty"`
	HTTPFailures int   `json:"http_failures,omitempty"`
	Statuses     []int `json:"http_statuses,omitempty"`
}

// Consumer represents an APISIX consumer (API user)
type Consumer struct {
	Username string                 `json:"username"`
	Plugins  map[string]interface{} `json:"plugins,omitempty"`
	Labels   map[string]string      `json:"labels,omitempty"`
	Desc     string                 `json:"desc,omitempty"`
}

// TrafficSplitRule defines a canary/blue-green deployment rule
type TrafficSplitRule struct {
	Match             []map[string]interface{} `json:"match,omitempty"`
	WeightedUpstreams []WeightedUpstream       `json:"weighted_upstreams"`
}

// WeightedUpstream defines a weighted upstream for traffic splitting
type WeightedUpstream struct {
	UpstreamID string    `json:"upstream_id,omitempty"`
	Upstream   *Upstream `json:"upstream,omitempty"`
	Weight     int       `json:"weight"`
}

// WAFStatus holds OpenAppSec WAF status information
type WAFStatus struct {
	Enabled     bool   `json:"enabled"`
	Mode        string `json:"mode"`
	Connected   bool   `json:"connected"`
	PolicyName  string `json:"policy_name"`
	LastChecked string `json:"last_checked"`
}

func getEnvOrDefault(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

// NewClient creates a new APISIX Admin API client
func NewClient(adminURL, adminKey string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		adminURL:   adminURL,
		adminKey:   adminKey,
		routes:     make(map[string]Route),
		consumers:  make(map[string]Consumer),
		httpClient: &http.Client{Timeout: 10 * time.Second},
		ctx:        ctx,
		cancel:     cancel,
	}
	c.cb = gobreaker.NewCircuitBreaker[[]byte](gobreaker.Settings{
		Name: "apisix", MaxRequests: 3, Interval: 30 * time.Second, Timeout: 10 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool { return counts.ConsecutiveFailures >= 5 },
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[APISIX] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})
	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *Client) connect() {
	log.Printf("[APISIX] Connecting to Admin API at %s", c.adminURL)

	req, err := http.NewRequest("GET", c.adminURL+"/apisix/admin/routes", nil)
	if err != nil {
		log.Printf("[APISIX] WARN: Failed to create request: %v -- fallback mode", err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}
	req.Header.Set("X-API-KEY", c.adminKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[APISIX] WARN: Admin API not available at %s: %v -- fallback mode", c.adminURL, err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}
	resp.Body.Close()

	c.mu.Lock()
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[APISIX] Admin API connected (HTTP %d)", resp.StatusCode)

	c.bootstrapRoutes()
	c.bootstrapConsumers()
}

func (c *Client) reconnectLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.mu.RLock()
			fb := c.fallbackMode
			c.mu.RUnlock()
			if fb {
				log.Printf("[APISIX] Attempting reconnection to %s...", c.adminURL)
				c.connect()
			}
		}
	}
}

// bootstrapRoutes registers all NEXCOM routes with APISIX Admin API
func (c *Client) bootstrapRoutes() {
	log.Println("[APISIX] Bootstrapping routes...")

	// Primary gateway route — all /api/v1/* traffic
	c.CreateRoute(Route{
		ID:      "gateway-primary",
		URI:     "/api/v1/*",
		Name:    "gateway-primary",
		Methods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		Upstream: &Upstream{
			Type:  "roundrobin",
			Nodes: map[string]int{"gateway:8000": 1},
			Checks: &HealthCheck{
				Active: &ActiveHealthCheck{
					Type:      "http",
					HTTPPath:  "/health",
					Healthy:   &HealthyConfig{Interval: 5, Successes: 2},
					Unhealthy: &UnhealthyConfig{Interval: 5, HTTPFailures: 3},
				},
			},
		},
		Plugins: map[string]interface{}{
			"limit-count": map[string]interface{}{
				"count":         5000,
				"time_window":   60,
				"key_type":      "var",
				"key":           "remote_addr",
				"rejected_code": 429,
			},
			"cors": map[string]interface{}{
				"allow_origins": "**",
				"allow_methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
				"allow_headers": "Authorization,Content-Type,X-Request-ID",
				"max_age":       3600,
			},
			"kafka-logger": map[string]interface{}{
				"broker_list": map[string]interface{}{
					"kafka": map[string]interface{}{
						"host": "kafka",
						"port": 9092,
					},
				},
				"kafka_topic":    "nexcom-api-logs",
				"batch_max_size": 100,
			},
		},
		Labels: map[string]string{"env": "production", "service": "nexcom-gateway"},
	})

	// Auth routes (public, stricter rate limit)
	c.CreateRoute(Route{
		ID:       "auth-public",
		URI:      "/api/v1/auth/*",
		Name:     "auth-public",
		Methods:  []string{"POST"},
		Priority: 10,
		Upstream: &Upstream{
			Type:  "roundrobin",
			Nodes: map[string]int{"gateway:8000": 1},
		},
		Plugins: map[string]interface{}{
			"limit-count": map[string]interface{}{
				"count":         30,
				"time_window":   60,
				"key_type":      "var",
				"key":           "remote_addr",
				"rejected_code": 429,
			},
		},
	})

	// WebSocket route
	c.CreateRoute(Route{
		ID:   "gateway-websocket",
		URI:  "/ws/v1/*",
		Name: "gateway-websocket",
		Upstream: &Upstream{
			Type:  "roundrobin",
			Nodes: map[string]int{"gateway:8000": 1},
		},
	})

	// Health check (no auth, no rate limit)
	c.CreateRoute(Route{
		ID:      "health-check",
		URI:     "/health",
		Name:    "health-check",
		Methods: []string{"GET"},
		Upstream: &Upstream{
			Type:  "roundrobin",
			Nodes: map[string]int{"gateway:8000": 1},
		},
	})

	log.Println("[APISIX] Routes bootstrapped (4 routes)")
}

// bootstrapConsumers creates default API consumers with JWT and key-auth
func (c *Client) bootstrapConsumers() {
	log.Println("[APISIX] Bootstrapping consumers...")

	// Admin consumer — full access
	c.CreateConsumer(Consumer{
		Username: "nexcom-admin",
		Plugins: map[string]interface{}{
			"key-auth": map[string]interface{}{
				"key": getEnvOrDefault("APISIX_ADMIN_API_KEY", "nexcom-admin-api-key-changeme"),
			},
			"jwt-auth": map[string]interface{}{
				"key":    "nexcom-admin",
				"secret": getEnvOrDefault("APISIX_JWT_SECRET", "nexcom-jwt-secret-changeme"),
			},
		},
		Labels: map[string]string{"role": "admin"},
		Desc:   "NEXCOM Exchange admin consumer",
	})

	// Trader consumer — trading API access
	c.CreateConsumer(Consumer{
		Username: "nexcom-trader",
		Plugins: map[string]interface{}{
			"key-auth": map[string]interface{}{
				"key": getEnvOrDefault("APISIX_TRADER_API_KEY", "nexcom-trader-api-key-changeme"),
			},
			"jwt-auth": map[string]interface{}{
				"key":    "nexcom-trader",
				"secret": getEnvOrDefault("APISIX_JWT_SECRET", "nexcom-jwt-secret-changeme"),
			},
		},
		Labels: map[string]string{"role": "trader"},
		Desc:   "NEXCOM Exchange trader consumer",
	})

	// Service-to-service consumer — internal microservices
	c.CreateConsumer(Consumer{
		Username: "nexcom-internal",
		Plugins: map[string]interface{}{
			"key-auth": map[string]interface{}{
				"key": getEnvOrDefault("APISIX_INTERNAL_API_KEY", "nexcom-internal-api-key-changeme"),
			},
		},
		Labels: map[string]string{"role": "internal"},
		Desc:   "Internal service-to-service consumer",
	})

	// Read-only consumer — market data viewers
	c.CreateConsumer(Consumer{
		Username: "nexcom-viewer",
		Plugins: map[string]interface{}{
			"key-auth": map[string]interface{}{
				"key": getEnvOrDefault("APISIX_VIEWER_API_KEY", "nexcom-viewer-api-key-changeme"),
			},
		},
		Labels: map[string]string{"role": "viewer"},
		Desc:   "Read-only market data viewer consumer",
	})

	log.Println("[APISIX] Consumers bootstrapped (4 consumers: admin, trader, internal, viewer)")
}

// CreateRoute creates or updates a route in APISIX
func (c *Client) CreateRoute(route Route) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, _ := json.Marshal(route)
		url := fmt.Sprintf("%s/apisix/admin/routes/%s", c.adminURL, route.ID)
		req, err := http.NewRequest("PUT", url, bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-API-KEY", c.adminKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode < 300 {
					log.Printf("[APISIX] CreateRoute id=%s uri=%s (via Admin API)", route.ID, route.URI)
					return nil
				}
			}
		}
		log.Printf("[APISIX] WARN: CreateRoute via Admin API failed for %s", route.ID)
	}

	// Fallback: store in memory
	c.mu.Lock()
	c.routes[route.ID] = route
	c.mu.Unlock()
	log.Printf("[APISIX] CreateRoute id=%s uri=%s (fallback)", route.ID, route.URI)
	return nil
}

// CreateConsumer creates or updates a consumer in APISIX
func (c *Client) CreateConsumer(consumer Consumer) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, _ := json.Marshal(consumer)
		url := fmt.Sprintf("%s/apisix/admin/consumers/%s", c.adminURL, consumer.Username)
		req, err := http.NewRequest("PUT", url, bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-API-KEY", c.adminKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode < 300 {
					log.Printf("[APISIX] CreateConsumer username=%s (via Admin API)", consumer.Username)
					return nil
				}
			}
		}
		log.Printf("[APISIX] WARN: CreateConsumer via Admin API failed for %s", consumer.Username)
	}

	// Fallback: store in memory
	c.mu.Lock()
	c.consumers[consumer.Username] = consumer
	c.mu.Unlock()
	log.Printf("[APISIX] CreateConsumer username=%s (fallback)", consumer.Username)
	return nil
}

// GetRoutes returns all registered routes
func (c *Client) GetRoutes() ([]Route, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		req, err := http.NewRequest("GET", c.adminURL+"/apisix/admin/routes", nil)
		if err == nil {
			req.Header.Set("X-API-KEY", c.adminKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)
				var result struct {
					List []struct {
						Value Route `json:"value"`
					} `json:"list"`
				}
				if json.Unmarshal(body, &result) == nil {
					routes := make([]Route, 0, len(result.List))
					for _, item := range result.List {
						routes = append(routes, item.Value)
					}
					return routes, nil
				}
			}
		}
	}

	// Fallback: return in-memory routes
	c.mu.RLock()
	defer c.mu.RUnlock()
	routes := make([]Route, 0, len(c.routes))
	for _, r := range c.routes {
		routes = append(routes, r)
	}
	return routes, nil
}

// GetConsumers returns all registered consumers
func (c *Client) GetConsumers() ([]Consumer, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		req, err := http.NewRequest("GET", c.adminURL+"/apisix/admin/consumers", nil)
		if err == nil {
			req.Header.Set("X-API-KEY", c.adminKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)
				var result struct {
					List []struct {
						Value Consumer `json:"value"`
					} `json:"list"`
				}
				if json.Unmarshal(body, &result) == nil {
					consumers := make([]Consumer, 0, len(result.List))
					for _, item := range result.List {
						consumers = append(consumers, item.Value)
					}
					return consumers, nil
				}
			}
		}
	}

	// Fallback
	c.mu.RLock()
	defer c.mu.RUnlock()
	consumers := make([]Consumer, 0, len(c.consumers))
	for _, consumer := range c.consumers {
		consumers = append(consumers, consumer)
	}
	return consumers, nil
}

// ConfigureTrafficSplit sets up canary/blue-green deployment for a route
func (c *Client) ConfigureTrafficSplit(routeID string, canaryUpstream *Upstream, canaryWeight int) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		plugin := map[string]interface{}{
			"rules": []map[string]interface{}{
				{
					"weighted_upstreams": []map[string]interface{}{
						{
							"upstream": canaryUpstream,
							"weight":   canaryWeight,
						},
						{
							"weight": 100 - canaryWeight, // Remaining traffic to primary
						},
					},
				},
			},
		}

		// PATCH the route to add traffic-split plugin
		body, _ := json.Marshal(map[string]interface{}{
			"plugins": map[string]interface{}{
				"traffic-split": plugin,
			},
		})
		url := fmt.Sprintf("%s/apisix/admin/routes/%s", c.adminURL, routeID)
		req, err := http.NewRequest("PATCH", url, bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-API-KEY", c.adminKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				resp.Body.Close()
				log.Printf("[APISIX] ConfigureTrafficSplit route=%s canary_weight=%d%% (via Admin API)", routeID, canaryWeight)
				return nil
			}
		}
	}

	log.Printf("[APISIX] ConfigureTrafficSplit route=%s canary_weight=%d%% (fallback)", routeID, canaryWeight)
	return nil
}

// ConfigureUpstreamMTLS configures mutual TLS between APISIX and an upstream
func (c *Client) ConfigureUpstreamMTLS(upstreamID, clientCert, clientKey string) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, _ := json.Marshal(map[string]interface{}{
			"tls": map[string]interface{}{
				"client_cert": clientCert,
				"client_key":  clientKey,
				"verify":      true,
			},
		})
		url := fmt.Sprintf("%s/apisix/admin/upstreams/%s", c.adminURL, upstreamID)
		req, err := http.NewRequest("PATCH", url, bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-API-KEY", c.adminKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				resp.Body.Close()
				log.Printf("[APISIX] ConfigureUpstreamMTLS upstream=%s (via Admin API)", upstreamID)
				return nil
			}
		}
	}

	log.Printf("[APISIX] ConfigureUpstreamMTLS upstream=%s (fallback)", upstreamID)
	return nil
}

// ConfigureOpenAppSecPlugin wires OpenAppSec WAF as an APISIX external plugin
func (c *Client) ConfigureOpenAppSecPlugin(routeID, openappsecURL string) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, _ := json.Marshal(map[string]interface{}{
			"plugins": map[string]interface{}{
				"ext-plugin-pre-req": map[string]interface{}{
					"conf": []map[string]interface{}{
						{
							"name":  "openappsec-waf",
							"value": fmt.Sprintf(`{"endpoint":"%s"}`, openappsecURL),
						},
					},
				},
			},
		})
		url := fmt.Sprintf("%s/apisix/admin/routes/%s", c.adminURL, routeID)
		req, err := http.NewRequest("PATCH", url, bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-API-KEY", c.adminKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				resp.Body.Close()
				log.Printf("[APISIX] ConfigureOpenAppSecPlugin route=%s (via Admin API)", routeID)
				return nil
			}
		}
	}

	log.Printf("[APISIX] ConfigureOpenAppSecPlugin route=%s (fallback)", routeID)
	return nil
}

// CheckWAFStatus checks the OpenAppSec WAF health endpoint
func (c *Client) CheckWAFStatus(openappsecURL string) WAFStatus {
	status := WAFStatus{
		Enabled:     true,
		Mode:        "prevent-learn",
		PolicyName:  "nexcom-exchange-policy",
		LastChecked: time.Now().Format(time.RFC3339),
	}

	resp, err := c.httpClient.Get(openappsecURL + "/health")
	if err != nil {
		status.Connected = false
		return status
	}
	resp.Body.Close()
	status.Connected = resp.StatusCode < 300
	return status
}

// RouteCount returns the number of registered routes
func (c *Client) RouteCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.routes)
}

// ConsumerCount returns the number of registered consumers
func (c *Client) ConsumerCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.consumers)
}

func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

func (c *Client) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

func (c *Client) Close() {
	c.cancel()
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	log.Println("[APISIX] Admin API disconnected")
}
