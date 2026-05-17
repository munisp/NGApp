package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"go.uber.org/zap"
)

// APISIXConfig holds APISIX configuration
type APISIXConfig struct {
	AdminURL   string
	AdminKey   string
	GatewayURL string
}

// APISIXClient handles API Gateway configuration with APISIX
type APISIXClient struct {
	config     APISIXConfig
	httpClient *http.Client
	logger     *zap.Logger
}

// NewAPISIXClient creates a new APISIX client
func NewAPISIXClient(config APISIXConfig, logger *zap.Logger) *APISIXClient {
	if config.AdminURL == "" {
		config.AdminURL = os.Getenv("APISIX_ADMIN_URL")
		if config.AdminURL == "" {
			config.AdminURL = "http://apisix:9180"
		}
	}
	if config.AdminKey == "" {
		config.AdminKey = os.Getenv("APISIX_ADMIN_KEY")
		if config.AdminKey == "" {
			config.AdminKey = "edd1c9f034335f136f87ad84b625c8f1"
		}
	}
	if config.GatewayURL == "" {
		config.GatewayURL = os.Getenv("APISIX_GATEWAY_URL")
		if config.GatewayURL == "" {
			config.GatewayURL = "http://apisix:9080"
		}
	}

	return &APISIXClient{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// Route represents an APISIX route
type Route struct {
	ID          string                 `json:"id"`
	URI         string                 `json:"uri"`
	URIs        []string               `json:"uris,omitempty"`
	Methods     []string               `json:"methods,omitempty"`
	Host        string                 `json:"host,omitempty"`
	Hosts       []string               `json:"hosts,omitempty"`
	UpstreamID  string                 `json:"upstream_id,omitempty"`
	Upstream    *Upstream              `json:"upstream,omitempty"`
	Plugins     map[string]interface{} `json:"plugins,omitempty"`
	Name        string                 `json:"name,omitempty"`
	Desc        string                 `json:"desc,omitempty"`
	Priority    int                    `json:"priority,omitempty"`
	Status      int                    `json:"status,omitempty"`
}

// Upstream represents an APISIX upstream
type Upstream struct {
	ID      string                 `json:"id,omitempty"`
	Type    string                 `json:"type"`
	Nodes   map[string]int         `json:"nodes"`
	Timeout map[string]int         `json:"timeout,omitempty"`
	Retries int                    `json:"retries,omitempty"`
	Checks  map[string]interface{} `json:"checks,omitempty"`
}

// CreateRoute creates a new route in APISIX
func (a *APISIXClient) CreateRoute(ctx context.Context, route Route) error {
	url := fmt.Sprintf("%s/apisix/admin/routes/%s", a.config.AdminURL, route.ID)

	jsonData, err := json.Marshal(route)
	if err != nil {
		return fmt.Errorf("failed to marshal route: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-KEY", a.config.AdminKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		a.logger.Error("Failed to create route", zap.String("route_id", route.ID), zap.Error(err))
		return fmt.Errorf("failed to create route: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("create route failed with status: %d", resp.StatusCode)
	}

	a.logger.Info("Route created", zap.String("route_id", route.ID))
	return nil
}

// CreateUpstream creates a new upstream in APISIX
func (a *APISIXClient) CreateUpstream(ctx context.Context, upstream Upstream) error {
	url := fmt.Sprintf("%s/apisix/admin/upstreams/%s", a.config.AdminURL, upstream.ID)

	jsonData, err := json.Marshal(upstream)
	if err != nil {
		return fmt.Errorf("failed to marshal upstream: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-KEY", a.config.AdminKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create upstream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("create upstream failed with status: %d", resp.StatusCode)
	}

	a.logger.Info("Upstream created", zap.String("upstream_id", upstream.ID))
	return nil
}

// SetupCommunicationRoutes sets up all communication service routes
func (a *APISIXClient) SetupCommunicationRoutes(ctx context.Context) error {
	// Create upstream for communication service
	upstream := Upstream{
		ID:   "communication-service",
		Type: "roundrobin",
		Nodes: map[string]int{
			"communication-service:8080": 1,
		},
		Timeout: map[string]int{
			"connect": 6,
			"send":    6,
			"read":    6,
		},
		Retries: 3,
	}

	if err := a.CreateUpstream(ctx, upstream); err != nil {
		return fmt.Errorf("failed to create upstream: %w", err)
	}

	// WhatsApp routes
	whatsappRoute := Route{
		ID:         "communication-whatsapp",
		URI:        "/api/v1/communication/whatsapp/*",
		Methods:    []string{"GET", "POST", "PUT", "DELETE"},
		UpstreamID: "communication-service",
		Plugins: map[string]interface{}{
			"authz-keycloak": map[string]interface{}{
				"token_endpoint":       "http://keycloak:8080/realms/insurance/protocol/openid-connect/token",
				"discovery":            "http://keycloak:8080/realms/insurance/.well-known/openid-configuration",
				"client_id":            "communication-service",
				"bearer_only":          true,
				"ssl_verify":           false,
			},
			"limit-req": map[string]interface{}{
				"rate":  100,
				"burst": 50,
				"key":   "consumer_name",
			},
			"prometheus": map[string]interface{}{},
		},
		Name: "WhatsApp Communication Routes",
		Desc: "Routes for WhatsApp messaging",
	}

	if err := a.CreateRoute(ctx, whatsappRoute); err != nil {
		return fmt.Errorf("failed to create whatsapp route: %w", err)
	}

	// SMS routes
	smsRoute := Route{
		ID:         "communication-sms",
		URI:        "/api/v1/communication/sms/*",
		Methods:    []string{"GET", "POST", "PUT", "DELETE"},
		UpstreamID: "communication-service",
		Plugins: map[string]interface{}{
			"authz-keycloak": map[string]interface{}{
				"token_endpoint": "http://keycloak:8080/realms/insurance/protocol/openid-connect/token",
				"discovery":      "http://keycloak:8080/realms/insurance/.well-known/openid-configuration",
				"client_id":      "communication-service",
				"bearer_only":    true,
			},
			"limit-req": map[string]interface{}{
				"rate":  200,
				"burst": 100,
				"key":   "consumer_name",
			},
			"prometheus": map[string]interface{}{},
		},
		Name: "SMS Communication Routes",
		Desc: "Routes for SMS messaging",
	}

	if err := a.CreateRoute(ctx, smsRoute); err != nil {
		return fmt.Errorf("failed to create sms route: %w", err)
	}

	// Telegram routes
	telegramRoute := Route{
		ID:         "communication-telegram",
		URI:        "/api/v1/communication/telegram/*",
		Methods:    []string{"GET", "POST", "PUT", "DELETE"},
		UpstreamID: "communication-service",
		Plugins: map[string]interface{}{
			"authz-keycloak": map[string]interface{}{
				"token_endpoint": "http://keycloak:8080/realms/insurance/protocol/openid-connect/token",
				"discovery":      "http://keycloak:8080/realms/insurance/.well-known/openid-configuration",
				"client_id":      "communication-service",
				"bearer_only":    true,
			},
			"limit-req": map[string]interface{}{
				"rate":  100,
				"burst": 50,
				"key":   "consumer_name",
			},
			"prometheus": map[string]interface{}{},
		},
		Name: "Telegram Communication Routes",
		Desc: "Routes for Telegram messaging",
	}

	if err := a.CreateRoute(ctx, telegramRoute); err != nil {
		return fmt.Errorf("failed to create telegram route: %w", err)
	}

	// USSD routes
	ussdRoute := Route{
		ID:         "communication-ussd",
		URI:        "/api/v1/communication/ussd/*",
		Methods:    []string{"GET", "POST"},
		UpstreamID: "communication-service",
		Plugins: map[string]interface{}{
			"ip-restriction": map[string]interface{}{
				"whitelist": []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"},
			},
			"limit-req": map[string]interface{}{
				"rate":  500,
				"burst": 200,
				"key":   "remote_addr",
			},
			"prometheus": map[string]interface{}{},
		},
		Name: "USSD Communication Routes",
		Desc: "Routes for USSD messaging",
	}

	if err := a.CreateRoute(ctx, ussdRoute); err != nil {
		return fmt.Errorf("failed to create ussd route: %w", err)
	}

	// Bulk messaging routes
	bulkRoute := Route{
		ID:         "communication-bulk",
		URI:        "/api/v1/communication/bulk/*",
		Methods:    []string{"POST"},
		UpstreamID: "communication-service",
		Plugins: map[string]interface{}{
			"authz-keycloak": map[string]interface{}{
				"token_endpoint": "http://keycloak:8080/realms/insurance/protocol/openid-connect/token",
				"discovery":      "http://keycloak:8080/realms/insurance/.well-known/openid-configuration",
				"client_id":      "communication-service",
				"bearer_only":    true,
			},
			"limit-req": map[string]interface{}{
				"rate":  10,
				"burst": 5,
				"key":   "consumer_name",
			},
			"prometheus": map[string]interface{}{},
		},
		Name: "Bulk Messaging Routes",
		Desc: "Routes for bulk messaging operations",
	}

	if err := a.CreateRoute(ctx, bulkRoute); err != nil {
		return fmt.Errorf("failed to create bulk route: %w", err)
	}

	// Webhook routes (for receiving delivery status updates)
	webhookRoute := Route{
		ID:      "communication-webhooks",
		URI:     "/api/v1/communication/webhooks/*",
		Methods: []string{"POST"},
		UpstreamID: "communication-service",
		Plugins: map[string]interface{}{
			"ip-restriction": map[string]interface{}{
				"whitelist": []string{
					"104.16.0.0/12",   // Twilio
					"52.0.0.0/8",      // AWS (WhatsApp)
					"149.154.160.0/20", // Telegram
				},
			},
			"prometheus": map[string]interface{}{},
		},
		Name: "Communication Webhooks",
		Desc: "Webhook endpoints for delivery status updates",
	}

	if err := a.CreateRoute(ctx, webhookRoute); err != nil {
		return fmt.Errorf("failed to create webhook route: %w", err)
	}

	a.logger.Info("All communication routes configured")
	return nil
}

// DeleteRoute deletes a route from APISIX
func (a *APISIXClient) DeleteRoute(ctx context.Context, routeID string) error {
	url := fmt.Sprintf("%s/apisix/admin/routes/%s", a.config.AdminURL, routeID)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("X-API-KEY", a.config.AdminKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete route: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// GetRouteMetrics gets metrics for a route
func (a *APISIXClient) GetRouteMetrics(ctx context.Context, routeID string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/apisix/prometheus/metrics", a.config.GatewayURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get metrics: %w", err)
	}
	defer resp.Body.Close()

	// Parse Prometheus metrics format
	// In production, this would parse the actual metrics
	return map[string]interface{}{
		"route_id":      routeID,
		"requests":      0,
		"latency_avg":   0,
		"error_rate":    0,
	}, nil
}
