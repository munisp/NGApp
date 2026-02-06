package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	apisixReqTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "apisix_admin_requests_total",
		Help: "Total APISIX admin API requests",
	}, []string{"method", "resource"})
	apisixLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "apisix_admin_latency_seconds",
		Help:    "APISIX admin API latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"method"})
)

type Route struct {
	ID         string                 `json:"id"`
	URI        string                 `json:"uri"`
	Methods    []string               `json:"methods"`
	UpstreamID string                 `json:"upstream_id,omitempty"`
	Plugins    map[string]interface{} `json:"plugins,omitempty"`
	Name       string                 `json:"name"`
	Desc       string                 `json:"desc,omitempty"`
	Priority   int                    `json:"priority"`
	Status     int                    `json:"status"`
	CreateTime int64                  `json:"create_time"`
}

type Upstream struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Type    string         `json:"type"`
	Nodes   map[string]int `json:"nodes"`
	Retries int            `json:"retries"`
	Timeout *UpstreamTimeout `json:"timeout,omitempty"`
	Checks  *HealthCheck   `json:"checks,omitempty"`
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
		Interval  int `json:"interval"`
		Successes int `json:"successes"`
	} `json:"healthy"`
	Unhealthy struct {
		Interval     int `json:"interval"`
		HTTPFailures int `json:"http_failures"`
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
	ID   string   `json:"id"`
	Cert string   `json:"cert"`
	Key  string   `json:"key"`
	SNIs []string `json:"snis"`
}

type GatewayMetrics struct {
	TotalRequests   int64            `json:"total_requests"`
	ActiveRoutes    int              `json:"active_routes"`
	ActiveUpstreams int              `json:"active_upstreams"`
	SSLCerts        int              `json:"ssl_certs"`
	PluginsEnabled  int              `json:"plugins_enabled"`
	RequestsByRoute map[string]int64 `json:"requests_by_route"`
	ErrorsByRoute   map[string]int64 `json:"errors_by_route"`
	AvgLatencyMs    float64          `json:"avg_latency_ms"`
}

type HealthStatus struct {
	Connected bool   `json:"connected"`
	AdminURL  string `json:"admin_url"`
	Routes    int    `json:"routes"`
	Upstreams int    `json:"upstreams"`
}

type APISIXClient struct {
	config     *Config
	httpClient *http.Client
	connected  bool
	mu         sync.RWMutex
	routes     map[string]*Route
	upstreams  map[string]*Upstream
	sslCerts   map[string]*SSLCert
	metrics    *gatewayMetrics
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
		config: cfg,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		routes:    make(map[string]*Route),
		upstreams: make(map[string]*Upstream),
		sslCerts:  make(map[string]*SSLCert),
		metrics: &gatewayMetrics{
			requestsByRoute: make(map[string]int64),
			errorsByRoute:   make(map[string]int64),
		},
	}

	if err := client.checkConnection(); err != nil {
		fmt.Printf("[APISIX] Connection failed (will retry): %v\n", err)
		client.connected = false
	} else {
		client.connected = true
	}

	client.registerDefaultRoutes()
	client.registerDefaultUpstreams()
	client.syncRoutesToAdmin()

	fmt.Printf("[APISIX] Initialized with admin URL: %s\n", cfg.AdminURL)
	go client.healthCheckLoop()
	return client, nil
}

func (c *APISIXClient) checkConnection() error {
	req, _ := http.NewRequest("GET", c.config.AdminURL+"/apisix/admin/routes", nil)
	if c.config.AdminKey != "" {
		req.Header.Set("X-API-KEY", c.config.AdminKey)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (c *APISIXClient) healthCheckLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		err := c.checkConnection()
		c.mu.Lock()
		c.connected = (err == nil)
		c.mu.Unlock()
	}
}

func (c *APISIXClient) adminRequest(method, path string, body interface{}) ([]byte, error) {
	start := time.Now()
	defer func() {
		apisixLatency.WithLabelValues(method).Observe(time.Since(start).Seconds())
	}()

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}

	url := c.config.AdminURL + "/apisix/admin" + path
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.config.AdminKey != "" {
		req.Header.Set("X-API-KEY", c.config.AdminKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	apisixReqTotal.WithLabelValues(method, path).Inc()
	return io.ReadAll(resp.Body)
}

func (c *APISIXClient) syncRoutesToAdmin() {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if !c.connected {
		return
	}
	for id, route := range c.routes {
		_, err := c.adminRequest("PUT", "/routes/"+id, route)
		if err != nil {
			fmt.Printf("[APISIX] Failed to sync route %s: %v\n", id, err)
		}
	}
	for id, upstream := range c.upstreams {
		_, err := c.adminRequest("PUT", "/upstreams/"+id, upstream)
		if err != nil {
			fmt.Printf("[APISIX] Failed to sync upstream %s: %v\n", id, err)
		}
	}
}

func (c *APISIXClient) registerDefaultRoutes() {
	defaults := []*Route{
		{ID: "auth-login", URI: "/api/auth/login", Methods: []string{"POST"}, Name: "Auth Login", Priority: 10,
			Plugins: map[string]interface{}{"limit-req": map[string]interface{}{"rate": 15, "burst": 5, "key": "remote_addr"}, "cors": map[string]interface{}{"allow_origins": "*"}}},
		{ID: "auth-register", URI: "/api/auth/register", Methods: []string{"POST"}, Name: "Auth Register", Priority: 10,
			Plugins: map[string]interface{}{"limit-req": map[string]interface{}{"rate": 10, "burst": 3, "key": "remote_addr"}}},
		{ID: "payments", URI: "/api/payments/*", Methods: []string{"GET", "POST", "PUT"}, Name: "Payments API", Priority: 5,
			Plugins: map[string]interface{}{"limit-req": map[string]interface{}{"rate": 30, "burst": 10, "key": "consumer_name"}, "jwt-auth": map[string]interface{}{}, "request-id": map[string]interface{}{}}},
		{ID: "transactions", URI: "/api/transactions/*", Methods: []string{"GET", "POST"}, Name: "Transactions API", Priority: 5,
			Plugins: map[string]interface{}{"jwt-auth": map[string]interface{}{}, "limit-req": map[string]interface{}{"rate": 50, "burst": 20, "key": "consumer_name"}}},
		{ID: "accounts", URI: "/api/accounts/*", Methods: []string{"GET", "PUT"}, Name: "Accounts API", Priority: 5,
			Plugins: map[string]interface{}{"jwt-auth": map[string]interface{}{}}},
		{ID: "kyc", URI: "/api/kyc/*", Methods: []string{"GET", "POST", "PUT"}, Name: "KYC API", Priority: 5,
			Plugins: map[string]interface{}{"jwt-auth": map[string]interface{}{}, "limit-req": map[string]interface{}{"rate": 10, "burst": 3, "key": "consumer_name"}}},
		{ID: "budgets", URI: "/api/budgets/*", Methods: []string{"GET", "POST", "PUT", "DELETE"}, Name: "Budgets API", Priority: 3},
		{ID: "savings", URI: "/api/savings/*", Methods: []string{"GET", "POST", "PUT"}, Name: "Savings API", Priority: 3},
		{ID: "bnpl", URI: "/api/bnpl/*", Methods: []string{"GET", "POST"}, Name: "BNPL API", Priority: 3},
		{ID: "bills", URI: "/api/bills/*", Methods: []string{"GET", "POST", "PUT"}, Name: "Bills API", Priority: 3},
		{ID: "ml-gateway", URI: "/api/ml/*", Methods: []string{"GET", "POST"}, Name: "ML Gateway", Priority: 5,
			Plugins: map[string]interface{}{"jwt-auth": map[string]interface{}{}, "limit-req": map[string]interface{}{"rate": 20, "burst": 5, "key": "consumer_name"}}},
		{ID: "health", URI: "/api/health", Methods: []string{"GET"}, Name: "Health Check", Priority: 100},
	}
	for _, route := range defaults {
		route.Status = 1
		route.CreateTime = time.Now().Unix()
		c.routes[route.ID] = route
	}
}

func (c *APISIXClient) registerDefaultUpstreams() {
	defaults := []*Upstream{
		{ID: "backend-api", Name: "Backend API", Type: "roundrobin", Nodes: map[string]int{"backend:3000": 1}, Retries: 3,
			Timeout: &UpstreamTimeout{Connect: 5, Send: 10, Read: 10}, Checks: &HealthCheck{Active: &ActiveCheck{HTTPPath: "/api/health"}}},
		{ID: "kafka-service", Name: "Kafka Service", Type: "roundrobin", Nodes: map[string]int{"kafka-service:8081": 1}, Retries: 2,
			Timeout: &UpstreamTimeout{Connect: 3, Send: 5, Read: 5}},
		{ID: "ml-gateway", Name: "ML Gateway", Type: "roundrobin", Nodes: map[string]int{"ml-gateway:8107": 1}, Retries: 2,
			Timeout: &UpstreamTimeout{Connect: 5, Send: 30, Read: 30}},
		{ID: "tigerbeetle-service", Name: "TigerBeetle Service", Type: "roundrobin", Nodes: map[string]int{"tigerbeetle-service:8083": 1}, Retries: 3},
	}
	for _, upstream := range defaults {
		c.upstreams[upstream.ID] = upstream
	}
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
	if c.connected {
		_, err := c.adminRequest("PUT", "/routes/"+route.ID, route)
		return err
	}
	return nil
}

func (c *APISIXClient) DeleteRoute(id string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.routes[id]; !exists {
		return fmt.Errorf("route %s not found", id)
	}
	delete(c.routes, id)
	if c.connected {
		c.adminRequest("DELETE", "/routes/"+id, nil)
	}
	return nil
}

func (c *APISIXClient) ListRoutes() []*Route {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.connected {
		data, err := c.adminRequest("GET", "/routes", nil)
		if err == nil {
			var resp struct {
				List []struct{ Value *Route } `json:"list"`
			}
			if json.Unmarshal(data, &resp) == nil && len(resp.List) > 0 {
				routes := make([]*Route, len(resp.List))
				for i, item := range resp.List {
					routes[i] = item.Value
				}
				return routes
			}
		}
	}
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
	if c.connected {
		_, err := c.adminRequest("PUT", "/upstreams/"+upstream.ID, upstream)
		return err
	}
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
	if c.connected {
		_, err := c.adminRequest("PUT", "/ssls/"+cert.ID, cert)
		return err
	}
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
		TotalRequests: c.metrics.totalRequests, ActiveRoutes: len(c.routes),
		ActiveUpstreams: len(c.upstreams), SSLCerts: len(c.sslCerts),
		PluginsEnabled: 20, RequestsByRoute: reqCopy,
		ErrorsByRoute: errCopy, AvgLatencyMs: avgLatency,
	}
}

func (c *APISIXClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return &HealthStatus{
		Connected: c.connected, AdminURL: c.config.AdminURL,
		Routes: len(c.routes), Upstreams: len(c.upstreams),
	}
}
