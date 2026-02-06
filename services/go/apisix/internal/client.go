package internal

import (
	"fmt"
	"sync"
	"time"
)

type Route struct {
	ID          string                 `json:"id"`
	URI         string                 `json:"uri"`
	Methods     []string               `json:"methods"`
	UpstreamID  string                 `json:"upstream_id,omitempty"`
	Plugins     map[string]interface{} `json:"plugins,omitempty"`
	Name        string                 `json:"name"`
	Desc        string                 `json:"desc,omitempty"`
	Priority    int                    `json:"priority"`
	Status      int                    `json:"status"`
	CreateTime  int64                  `json:"create_time"`
}

type Upstream struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        string            `json:"type"`
	Nodes       map[string]int    `json:"nodes"`
	Retries     int               `json:"retries"`
	Timeout     *UpstreamTimeout  `json:"timeout,omitempty"`
	Checks      *HealthCheck      `json:"checks,omitempty"`
}

type UpstreamTimeout struct {
	Connect int `json:"connect"`
	Send    int `json:"send"`
	Read    int `json:"read"`
}

type HealthCheck struct {
	Active  *ActiveCheck  `json:"active,omitempty"`
	Passive *PassiveCheck `json:"passive,omitempty"`
}

type ActiveCheck struct {
	HTTPPath string `json:"http_path"`
	Healthy  struct {
		Interval  int   `json:"interval"`
		Successes int   `json:"successes"`
	} `json:"healthy"`
	Unhealthy struct {
		Interval     int   `json:"interval"`
		HTTPFailures int   `json:"http_failures"`
	} `json:"unhealthy"`
}

type PassiveCheck struct {
	Healthy struct {
		Successes int `json:"successes"`
	} `json:"healthy"`
	Unhealthy struct {
		HTTPFailures int `json:"http_failures"`
	} `json:"unhealthy"`
}

type SSLCert struct {
	ID    string   `json:"id"`
	Cert  string   `json:"cert"`
	Key   string   `json:"key"`
	SNIs  []string `json:"snis"`
}

type GatewayMetrics struct {
	TotalRequests   int64              `json:"total_requests"`
	ActiveRoutes    int                `json:"active_routes"`
	ActiveUpstreams int                `json:"active_upstreams"`
	SSLCerts        int                `json:"ssl_certs"`
	PluginsEnabled  int                `json:"plugins_enabled"`
	RequestsByRoute map[string]int64   `json:"requests_by_route"`
	ErrorsByRoute   map[string]int64   `json:"errors_by_route"`
	AvgLatencyMs    float64            `json:"avg_latency_ms"`
}

type HealthStatus struct {
	Connected bool   `json:"connected"`
	AdminURL  string `json:"admin_url"`
	Routes    int    `json:"routes"`
	Upstreams int    `json:"upstreams"`
}

type APISIXClient struct {
	config    *Config
	connected bool
	mu        sync.RWMutex
	routes    map[string]*Route
	upstreams map[string]*Upstream
	sslCerts  map[string]*SSLCert
	metrics   *gatewayMetrics
}

type gatewayMetrics struct {
	mu              sync.Mutex
	totalRequests   int64
	requestsByRoute map[string]int64
	errorsByRoute   map[string]int64
	latencies       []float64
}

func NewAPISIXClient(cfg *Config) (*APISIXClient, error) {
	client := &APISIXClient{
		config:    cfg,
		connected: true,
		routes:    make(map[string]*Route),
		upstreams: make(map[string]*Upstream),
		sslCerts:  make(map[string]*SSLCert),
		metrics: &gatewayMetrics{
			requestsByRoute: make(map[string]int64),
			errorsByRoute:   make(map[string]int64),
		},
	}

	client.registerDefaultRoutes()
	client.registerDefaultUpstreams()

	fmt.Printf("[APISIX] Connected to %s\n", cfg.AdminURL)
	return client, nil
}

func (c *APISIXClient) registerDefaultRoutes() {
	defaults := []*Route{
		{ID: "auth-login", URI: "/api/auth/login", Methods: []string{"POST"}, Name: "Auth Login", Priority: 10,
			Plugins: map[string]interface{}{
				"limit-req": map[string]interface{}{"rate": 15, "burst": 5, "key": "remote_addr"},
				"cors": map[string]interface{}{"allow_origins": "*"},
			}},
		{ID: "auth-register", URI: "/api/auth/register", Methods: []string{"POST"}, Name: "Auth Register", Priority: 10,
			Plugins: map[string]interface{}{
				"limit-req": map[string]interface{}{"rate": 10, "burst": 3, "key": "remote_addr"},
			}},
		{ID: "payments", URI: "/api/payments/*", Methods: []string{"GET", "POST", "PUT"}, Name: "Payments API", Priority: 5,
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 30, "burst": 10, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{},
				"request-id":   map[string]interface{}{},
			}},
		{ID: "transactions", URI: "/api/transactions/*", Methods: []string{"GET", "POST"}, Name: "Transactions API", Priority: 5,
			Plugins: map[string]interface{}{
				"jwt-auth":   map[string]interface{}{},
				"limit-req":  map[string]interface{}{"rate": 50, "burst": 20, "key": "consumer_name"},
			}},
		{ID: "accounts", URI: "/api/accounts/*", Methods: []string{"GET", "PUT"}, Name: "Accounts API", Priority: 5,
			Plugins: map[string]interface{}{
				"jwt-auth": map[string]interface{}{},
			}},
		{ID: "kyc", URI: "/api/kyc/*", Methods: []string{"GET", "POST", "PUT"}, Name: "KYC API", Priority: 5,
			Plugins: map[string]interface{}{
				"jwt-auth":  map[string]interface{}{},
				"limit-req": map[string]interface{}{"rate": 10, "burst": 3, "key": "consumer_name"},
			}},
		{ID: "budgets", URI: "/api/budgets/*", Methods: []string{"GET", "POST", "PUT", "DELETE"}, Name: "Budgets API", Priority: 3},
		{ID: "savings", URI: "/api/savings/*", Methods: []string{"GET", "POST", "PUT"}, Name: "Savings API", Priority: 3},
		{ID: "bnpl", URI: "/api/bnpl/*", Methods: []string{"GET", "POST"}, Name: "BNPL API", Priority: 3},
		{ID: "bills", URI: "/api/bills/*", Methods: []string{"GET", "POST", "PUT"}, Name: "Bills API", Priority: 3},
		{ID: "health", URI: "/api/health", Methods: []string{"GET"}, Name: "Health Check", Priority: 100},
	}

	for _, route := range defaults {
		route.Status = 1
		route.CreateTime = time.Now().Unix()
		c.routes[route.ID] = route
	}
	fmt.Printf("[APISIX] Registered %d default routes\n", len(defaults))
}

func (c *APISIXClient) registerDefaultUpstreams() {
	defaults := []*Upstream{
		{ID: "backend-api", Name: "Backend API", Type: "roundrobin",
			Nodes:   map[string]int{"backend:3000": 1},
			Retries: 3,
			Timeout: &UpstreamTimeout{Connect: 5, Send: 10, Read: 10},
			Checks: &HealthCheck{
				Active: &ActiveCheck{HTTPPath: "/api/health"},
			}},
		{ID: "kafka-service", Name: "Kafka Service", Type: "roundrobin",
			Nodes:   map[string]int{"kafka-service:8081": 1},
			Retries: 2,
			Timeout: &UpstreamTimeout{Connect: 3, Send: 5, Read: 5}},
		{ID: "temporal-service", Name: "Temporal Service", Type: "roundrobin",
			Nodes:   map[string]int{"temporal-service:8085": 1},
			Retries: 2},
		{ID: "tigerbeetle-service", Name: "TigerBeetle Service", Type: "roundrobin",
			Nodes:   map[string]int{"tigerbeetle-service:8083": 1},
			Retries: 3},
	}

	for _, upstream := range defaults {
		c.upstreams[upstream.ID] = upstream
	}
	fmt.Printf("[APISIX] Registered %d default upstreams\n", len(defaults))
}

func (c *APISIXClient) CreateRoute(route *Route) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if route.ID == "" {
		return fmt.Errorf("route ID required")
	}
	route.Status = 1
	route.CreateTime = time.Now().Unix()
	c.routes[route.ID] = route
	return nil
}

func (c *APISIXClient) DeleteRoute(id string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.routes[id]; !exists {
		return fmt.Errorf("route %s not found", id)
	}
	delete(c.routes, id)
	return nil
}

func (c *APISIXClient) ListRoutes() []*Route {
	c.mu.RLock()
	defer c.mu.RUnlock()
	routes := make([]*Route, 0, len(c.routes))
	for _, r := range c.routes {
		routes = append(routes, r)
	}
	return routes
}

func (c *APISIXClient) CreateUpstream(upstream *Upstream) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if upstream.ID == "" {
		return fmt.Errorf("upstream ID required")
	}
	c.upstreams[upstream.ID] = upstream
	return nil
}

func (c *APISIXClient) ListUpstreams() []*Upstream {
	c.mu.RLock()
	defer c.mu.RUnlock()
	upstreams := make([]*Upstream, 0, len(c.upstreams))
	for _, u := range c.upstreams {
		upstreams = append(upstreams, u)
	}
	return upstreams
}

func (c *APISIXClient) CreateSSL(cert *SSLCert) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sslCerts[cert.ID] = cert
	return nil
}

func (c *APISIXClient) ListPlugins() []string {
	return []string{
		"limit-req", "limit-count", "limit-conn",
		"jwt-auth", "key-auth", "basic-auth", "openid-connect",
		"cors", "ip-restriction", "ua-restriction",
		"request-id", "proxy-rewrite", "response-rewrite",
		"prometheus", "zipkin", "skywalking",
		"traffic-split", "fault-injection",
		"grpc-transcode", "grpc-web",
	}
}

func (c *APISIXClient) GetMetrics() *GatewayMetrics {
	c.metrics.mu.Lock()
	defer c.metrics.mu.Unlock()

	var avgLatency float64
	if len(c.metrics.latencies) > 0 {
		var sum float64
		for _, l := range c.metrics.latencies {
			sum += l
		}
		avgLatency = sum / float64(len(c.metrics.latencies))
	}

	reqCopy := make(map[string]int64)
	for k, v := range c.metrics.requestsByRoute {
		reqCopy[k] = v
	}
	errCopy := make(map[string]int64)
	for k, v := range c.metrics.errorsByRoute {
		errCopy[k] = v
	}

	return &GatewayMetrics{
		TotalRequests:   c.metrics.totalRequests,
		ActiveRoutes:    len(c.routes),
		ActiveUpstreams: len(c.upstreams),
		SSLCerts:        len(c.sslCerts),
		PluginsEnabled:  20,
		RequestsByRoute: reqCopy,
		ErrorsByRoute:   errCopy,
		AvgLatencyMs:    avgLatency,
	}
}

func (c *APISIXClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return &HealthStatus{
		Connected: c.connected,
		AdminURL:  c.config.AdminURL,
		Routes:    len(c.routes),
		Upstreams: len(c.upstreams),
	}
}
