package resilience

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// HTTPClientConfig configures a resilient HTTP client.
type HTTPClientConfig struct {
	BaseURL        string
	ServiceName    string
	Timeout        time.Duration
	Headers        map[string]string
	Retry          RetryConfig
	CircuitBreaker CircuitBreakerConfig
}

// HTTPClient wraps http.Client with circuit breaker + retry.
type HTTPClient struct {
	baseURL string
	name    string
	client  *http.Client
	headers map[string]string
	cb      *CircuitBreaker
	retry   RetryConfig
}

// NewHTTPClient creates a resilient HTTP client for inter-service calls.
func NewHTTPClient(cfg HTTPClientConfig) *HTTPClient {
	if cfg.Timeout == 0 {
		cfg.Timeout = 10 * time.Second
	}
	return &HTTPClient{
		baseURL: cfg.BaseURL,
		name:    cfg.ServiceName,
		client:  &http.Client{Timeout: cfg.Timeout},
		headers: cfg.Headers,
		cb:      NewCircuitBreaker(cfg.ServiceName, cfg.CircuitBreaker),
		retry:   cfg.Retry,
	}
}

// Get performs a resilient GET request.
func (c *HTTPClient) Get(ctx context.Context, path string, result any) error {
	return c.doJSON(ctx, http.MethodGet, path, nil, result)
}

// Post performs a resilient POST request.
func (c *HTTPClient) Post(ctx context.Context, path string, body any, result any) error {
	return c.doJSON(ctx, http.MethodPost, path, body, result)
}

// Put performs a resilient PUT request.
func (c *HTTPClient) Put(ctx context.Context, path string, body any, result any) error {
	return c.doJSON(ctx, http.MethodPut, path, body, result)
}

// Delete performs a resilient DELETE request.
func (c *HTTPClient) Delete(ctx context.Context, path string, result any) error {
	return c.doJSON(ctx, http.MethodDelete, path, nil, result)
}

// HealthCheck performs a simple /health check.
func (c *HTTPClient) HealthCheck(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return false
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// CircuitState returns the current circuit breaker state.
func (c *HTTPClient) CircuitState() State {
	return c.cb.State()
}

func (c *HTTPClient) doJSON(ctx context.Context, method, path string, body any, result any) error {
	return c.cb.Execute(ctx, func(ctx context.Context) error {
		return WithRetry(ctx, c.retry, func(ctx context.Context) error {
			var bodyReader io.Reader
			if body != nil {
				data, err := json.Marshal(body)
				if err != nil {
					return fmt.Errorf("marshal body: %w", err)
				}
				bodyReader = bytes.NewReader(data)
			}

			req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
			if err != nil {
				return fmt.Errorf("create request: %w", err)
			}
			req.Header.Set("Content-Type", "application/json")
			for k, v := range c.headers {
				req.Header.Set(k, v)
			}

			resp, err := c.client.Do(req)
			if err != nil {
				return fmt.Errorf("%s %s: %w", c.name, path, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode >= 400 {
				respBody, _ := io.ReadAll(resp.Body)
				err := fmt.Errorf("%s %s %s: HTTP %d — %s", c.name, method, path, resp.StatusCode, respBody)
				if !IsRetryableHTTPStatus(resp.StatusCode) {
					return &nonRetryableError{err}
				}
				return err
			}

			if result != nil {
				return json.NewDecoder(resp.Body).Decode(result)
			}
			return nil
		})
	})
}

type nonRetryableError struct {
	err error
}

func (e *nonRetryableError) Error() string { return e.err.Error() }
func (e *nonRetryableError) Unwrap() error { return e.err }
