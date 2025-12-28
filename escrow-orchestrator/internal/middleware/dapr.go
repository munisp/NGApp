package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/escrowprotect/orchestrator/internal/config"
	"github.com/rs/zerolog/log"
)

// DaprClient wraps Dapr sidecar functionality
type DaprClient struct {
	cfg        *config.Config
	httpClient *http.Client
	baseURL    string
	connected  bool
	mu         sync.RWMutex
}

// NewDaprClient creates a new Dapr client
func NewDaprClient(cfg *config.Config) *DaprClient {
	return &DaprClient{
		cfg:     cfg,
		baseURL: fmt.Sprintf("http://localhost:%d", cfg.DaprHTTPPort),
		httpClient: &http.Client{
			Timeout: cfg.HTTPClientTimeout,
		},
		connected: false,
	}
}

// Connect establishes connection to Dapr sidecar
func (d *DaprClient) Connect(ctx context.Context) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	log.Info().
		Int("http_port", d.cfg.DaprHTTPPort).
		Str("app_id", d.cfg.DaprAppID).
		Msg("Connecting to Dapr sidecar")

	// Check Dapr health
	resp, err := d.httpClient.Get(fmt.Sprintf("%s/v1.0/healthz", d.baseURL))
	if err != nil {
		log.Warn().Err(err).Msg("Dapr sidecar not available, using fallback mode")
		d.connected = false
		return nil // Don't fail, allow fallback
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		d.connected = true
		log.Info().Msg("Dapr sidecar connected")
	}

	return nil
}

// IsConnected returns connection status
func (d *DaprClient) IsConnected() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.connected
}

// InvokeService invokes another service via Dapr
func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	if !d.IsConnected() {
		return nil, fmt.Errorf("dapr not connected")
	}

	payload, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	url := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s", d.baseURL, appID, method)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("service invocation failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("service returned error: %s", string(body))
	}

	return body, nil
}

// PublishEvent publishes an event via Dapr pubsub
func (d *DaprClient) PublishEvent(ctx context.Context, pubsubName, topic string, data interface{}) error {
	if !d.IsConnected() {
		log.Warn().Msg("Dapr not connected, skipping pubsub publish")
		return nil
	}

	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", d.baseURL, pubsubName, topic)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("publish failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("publish returned error: %s", string(body))
	}

	log.Debug().
		Str("pubsub", pubsubName).
		Str("topic", topic).
		Msg("Event published via Dapr")

	return nil
}

// GetState retrieves state from Dapr state store
func (d *DaprClient) GetState(ctx context.Context, storeName, key string) ([]byte, error) {
	if !d.IsConnected() {
		return nil, fmt.Errorf("dapr not connected")
	}

	url := fmt.Sprintf("%s/v1.0/state/%s/%s", d.baseURL, storeName, key)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get state failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return body, nil
}

// SaveState saves state to Dapr state store
func (d *DaprClient) SaveState(ctx context.Context, storeName string, items []StateItem) error {
	if !d.IsConnected() {
		log.Warn().Msg("Dapr not connected, skipping state save")
		return nil
	}

	payload, err := json.Marshal(items)
	if err != nil {
		return fmt.Errorf("failed to marshal items: %w", err)
	}

	url := fmt.Sprintf("%s/v1.0/state/%s", d.baseURL, storeName)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("save state failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("save state returned error: %s", string(body))
	}

	return nil
}

// StateItem represents a Dapr state item
type StateItem struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

// GetSecret retrieves a secret from Dapr secrets store
func (d *DaprClient) GetSecret(ctx context.Context, storeName, secretName string) (map[string]string, error) {
	if !d.IsConnected() {
		return nil, fmt.Errorf("dapr not connected")
	}

	url := fmt.Sprintf("%s/v1.0/secrets/%s/%s", d.baseURL, storeName, secretName)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get secret failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get secret returned error: %s", string(body))
	}

	var secrets map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&secrets); err != nil {
		return nil, fmt.Errorf("failed to decode secrets: %w", err)
	}

	return secrets, nil
}

// InvokeBinding invokes an output binding
func (d *DaprClient) InvokeBinding(ctx context.Context, bindingName, operation string, data interface{}, metadata map[string]string) ([]byte, error) {
	if !d.IsConnected() {
		return nil, fmt.Errorf("dapr not connected")
	}

	request := struct {
		Data      interface{}       `json:"data"`
		Metadata  map[string]string `json:"metadata"`
		Operation string            `json:"operation"`
	}{
		Data:      data,
		Metadata:  metadata,
		Operation: operation,
	}

	payload, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/v1.0/bindings/%s", d.baseURL, bindingName)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("binding invocation failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return body, nil
}

// Close closes the Dapr client
func (d *DaprClient) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.connected = false
	log.Info().Msg("Dapr client closed")
	return nil
}

// HealthCheck returns Dapr health status
func (d *DaprClient) HealthCheck(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/v1.0/healthz", d.baseURL), nil)
	if err != nil {
		return false, err
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}
