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

// Client provides Dapr sidecar integration for CRM services.
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a Dapr client targeting the sidecar at DAPR_HTTP_PORT.
func NewClient() *Client {
	port := os.Getenv("DAPR_HTTP_PORT")
	if port == "" {
		port = "3500"
	}
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    fmt.Sprintf("http://localhost:%s", port),
	}
}

// InvokeService calls another service via Dapr service invocation.
func (c *Client) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s", c.baseURL, appID, method)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dapr invoke %s/%s: %w", appID, method, err)
	}
	defer resp.Body.Close()
	var result bytes.Buffer
	result.ReadFrom(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("dapr invoke %s/%s status %d: %s", appID, method, resp.StatusCode, result.String())
	}
	return result.Bytes(), nil
}

// SaveState saves key-value to a Dapr state store.
func (c *Client) SaveState(ctx context.Context, storeName, key string, value interface{}) error {
	data, _ := json.Marshal(value)
	payload := []map[string]interface{}{
		{"key": key, "value": json.RawMessage(data)},
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v1.0/state/%s", c.baseURL, storeName)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("dapr state save %s/%s: status %d", storeName, key, resp.StatusCode)
	}
	return nil
}

// GetState retrieves a value from a Dapr state store.
func (c *Client) GetState(ctx context.Context, storeName, key string) ([]byte, error) {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", c.baseURL, storeName, key)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var buf bytes.Buffer
	buf.ReadFrom(resp.Body)
	return buf.Bytes(), nil
}

// PublishEvent publishes an event to a Dapr pub/sub topic.
func (c *Client) PublishEvent(ctx context.Context, pubsubName, topic string, data interface{}) error {
	body, _ := json.Marshal(data)
	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", c.baseURL, pubsubName, topic)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("dapr publish %s/%s: status %d", pubsubName, topic, resp.StatusCode)
	}
	return nil
}

// Dapr component names for CRM platform
const (
	StateStoreCRM       = "crm-statestore"
	PubSubCRM           = "crm-pubsub"
	BindingEmail        = "crm-email"
	BindingSMS          = "crm-sms"
	SecretStoreCRM      = "crm-secrets"
)
