// Package dapr provides Dapr sidecar integration for the OG-RMM platform.
// Dapr enables service-to-service invocation, pub/sub, state management,
// and secret management via a sidecar pattern without SDK dependencies.
package dapr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"og-rmm/middleware/internal/resilience"
)

// Config holds Dapr sidecar configuration.
type Config struct {
	// SidecarHost is the Dapr sidecar HTTP host (default: 127.0.0.1)
	SidecarHost string
	// SidecarPort is the Dapr sidecar HTTP port (default: 3500)
	SidecarPort int
	// AppID is the Dapr application ID for this service
	AppID string
}

// DefaultConfig returns a Config populated from environment variables.
func DefaultConfig() Config {
	host := os.Getenv("DAPR_HTTP_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := 3500
	if p := os.Getenv("DAPR_HTTP_PORT"); p != "" {
		fmt.Sscanf(p, "%d", &port)
	}
	appID := os.Getenv("DAPR_APP_ID")
	if appID == "" {
		appID = "og-rmm-middleware"
	}
	return Config{SidecarHost: host, SidecarPort: port, AppID: appID}
}

// Client wraps the Dapr HTTP API with retry and circuit breaker.
type Client struct {
	cfg    Config
	http   *http.Client
	baseURL string
	cb     *resilience.CircuitBreaker
	retry  resilience.RetryConfig
}

// NewClient creates a new Dapr HTTP client with resilience.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg:     cfg,
		http:    &http.Client{Timeout: 30 * time.Second},
		baseURL: fmt.Sprintf("http://%s:%d", cfg.SidecarHost, cfg.SidecarPort),
		cb:      resilience.NewCircuitBreaker(resilience.CircuitBreakerConfig{FailureThreshold: 5, ResetTimeout: 30 * time.Second, HalfOpenMaxProbes: 1}),
		retry:   resilience.RetryConfig{MaxRetries: 3, BaseDelay: 200 * time.Millisecond, MaxDelay: 5 * time.Second, Jitter: true, RetryableFn: resilience.DefaultRetryable},
	}
}

func (c *Client) doWithResilience(ctx context.Context, fn func(ctx context.Context) error) error {
	return c.cb.Execute(ctx, func(ctx context.Context) error {
		return resilience.WithRetry(ctx, c.retry, fn)
	})
}

// PublishEvent publishes an event to a Dapr pub/sub topic with retry.
func (c *Client) PublishEvent(ctx context.Context, pubsubName, topic string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("dapr: marshal event: %w", err)
	}
	return c.doWithResilience(ctx, func(ctx context.Context) error {
		url := fmt.Sprintf("%s/v1.0/publish/%s/%s", c.baseURL, pubsubName, topic)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
		if err != nil {
			return fmt.Errorf("dapr: create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := c.http.Do(req)
		if err != nil {
			return fmt.Errorf("dapr: publish event: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("dapr: publish event status %d: %s", resp.StatusCode, body)
		}
		return nil
	})
}

// InvokeService invokes a method on another Dapr-enabled service with retry.
func (c *Client) InvokeService(ctx context.Context, appID, method string, data any, result any) error {
	var payload []byte
	if data != nil {
		var err error
		payload, err = json.Marshal(data)
		if err != nil {
			return fmt.Errorf("dapr: marshal invoke data: %w", err)
		}
	}
	return c.doWithResilience(ctx, func(ctx context.Context) error {
		var body io.Reader
		if payload != nil {
			body = bytes.NewReader(payload)
		}
		url := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s", c.baseURL, appID, method)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
		if err != nil {
			return fmt.Errorf("dapr: create invoke request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := c.http.Do(req)
		if err != nil {
			return fmt.Errorf("dapr: invoke service: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			respBody, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("dapr: invoke service status %d: %s", resp.StatusCode, respBody)
		}
		if result != nil {
			return json.NewDecoder(resp.Body).Decode(result)
		}
		return nil
	})
}

// GetState retrieves a value from a Dapr state store.
func (c *Client) GetState(ctx context.Context, storeName, key string, result any) error {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", c.baseURL, storeName, key)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("dapr: create state request: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("dapr: get state: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNoContent {
		return nil // key not found
	}
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("dapr: get state status %d: %s", resp.StatusCode, body)
	}
	return json.NewDecoder(resp.Body).Decode(result)
}

// SetState saves a value to a Dapr state store.
func (c *Client) SetState(ctx context.Context, storeName, key string, value any) error {
	type stateItem struct {
		Key   string `json:"key"`
		Value any    `json:"value"`
	}
	payload, err := json.Marshal([]stateItem{{Key: key, Value: value}})
	if err != nil {
		return fmt.Errorf("dapr: marshal state: %w", err)
	}
	url := fmt.Sprintf("%s/v1.0/state/%s", c.baseURL, storeName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("dapr: create state request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("dapr: set state: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("dapr: set state status %d: %s", resp.StatusCode, body)
	}
	return nil
}

// GetSecret retrieves a secret from a Dapr secret store.
func (c *Client) GetSecret(ctx context.Context, storeName, secretName string) (map[string]string, error) {
	url := fmt.Sprintf("%s/v1.0/secrets/%s/%s", c.baseURL, storeName, secretName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("dapr: create secret request: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dapr: get secret: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dapr: get secret status %d: %s", resp.StatusCode, body)
	}
	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dapr: decode secret: %w", err)
	}
	return result, nil
}

// HealthCheck verifies the Dapr sidecar is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	url := fmt.Sprintf("%s/v1.0/healthz", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("dapr: health check request: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("dapr: health check: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("dapr: sidecar unhealthy: status %d", resp.StatusCode)
	}
	return nil
}
