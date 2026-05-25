package dapr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a Dapr sidecar HTTP client.
type Client struct {
	httpPort string
	http     *http.Client
}

// NewClient creates a Dapr client from environment.
func NewClient() *Client {
	return &Client{
		httpPort: envOr("DAPR_HTTP_PORT", "3500"),
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (c *Client) baseURL() string {
	return fmt.Sprintf("http://localhost:%s/v1.0", c.httpPort)
}

// HealthCheck verifies Dapr sidecar is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("http://localhost:%s/v1.0/healthz", c.httpPort), nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("dapr health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("dapr unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// Metadata represents Dapr sidecar metadata.
type Metadata struct {
	ID           string            `json:"id"`
	RuntimeVersion string         `json:"runtimeVersion"`
	Components   []ComponentInfo   `json:"components"`
	Subscriptions []SubscriptionInfo `json:"subscriptions"`
}

type ComponentInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Version string `json:"version"`
}

type SubscriptionInfo struct {
	PubsubName string `json:"pubsubname"`
	Topic      string `json:"topic"`
	Rules      interface{} `json:"rules"`
}

// GetMetadata returns Dapr sidecar metadata.
func (c *Client) GetMetadata(ctx context.Context) (*Metadata, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL()+"/metadata", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dapr metadata: %w", err)
	}
	defer resp.Body.Close()
	var meta Metadata
	if err := json.NewDecoder(resp.Body).Decode(&meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

// PublishEvent publishes an event to a Dapr pub/sub topic.
func (c *Client) PublishEvent(ctx context.Context, pubsubName, topic string, data interface{}) error {
	body, _ := json.Marshal(data)
	url := fmt.Sprintf("%s/publish/%s/%s", c.baseURL(), pubsubName, topic)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("publish: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// SaveState saves state to Dapr state store.
func (c *Client) SaveState(ctx context.Context, storeName, key string, value interface{}) error {
	data, _ := json.Marshal(value)
	state := []map[string]interface{}{
		{"key": key, "value": json.RawMessage(data)},
	}
	body, _ := json.Marshal(state)
	url := fmt.Sprintf("%s/state/%s", c.baseURL(), storeName)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("save state: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// GetState retrieves state from Dapr state store.
func (c *Client) GetState(ctx context.Context, storeName, key string) ([]byte, error) {
	url := fmt.Sprintf("%s/state/%s/%s", c.baseURL(), storeName, key)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get state: %w", err)
	}
	defer resp.Body.Close()
	var result json.RawMessage
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// InvokeService invokes a method on another Dapr service.
func (c *Client) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	body, _ := json.Marshal(data)
	url := fmt.Sprintf("%s/invoke/%s/method/%s", c.baseURL(), appID, method)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("invoke: %w", err)
	}
	defer resp.Body.Close()
	var result json.RawMessage
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// AcquireLock acquires a distributed lock.
func (c *Client) AcquireLock(ctx context.Context, storeName, resourceID, owner string, expirySec int) error {
	payload := map[string]interface{}{
		"resourceId":       resourceID,
		"lockOwner":        owner,
		"expiryInSeconds":  expirySec,
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/lock/%s", c.baseURL(), storeName)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("acquire lock: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("lock failed: status %d", resp.StatusCode)
	}
	return nil
}

// GetSecret retrieves a secret from Dapr secret store.
func (c *Client) GetSecret(ctx context.Context, storeName, secretName string) (map[string]string, error) {
	url := fmt.Sprintf("%s/secrets/%s/%s", c.baseURL(), storeName, secretName)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get secret: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// GetConfiguration reads config items from the Dapr config store.
func (c *Client) GetConfiguration(ctx context.Context, storeName string, keys []string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/configuration/%s", c.baseURL(), storeName)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	for _, k := range keys {
		q.Add("key", k)
	}
	req.URL.RawQuery = q.Encode()
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}
