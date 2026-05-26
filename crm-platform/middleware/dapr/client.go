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
	result, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("dapr invoke %s/%s status %d: %s", appID, method, resp.StatusCode, string(result))
	}
	return result, nil
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

// SaveStateBulk saves multiple key-values in a single call.
func (c *Client) SaveStateBulk(ctx context.Context, storeName string, items map[string]interface{}) error {
	var payload []map[string]interface{}
	for key, value := range items {
		data, _ := json.Marshal(value)
		payload = append(payload, map[string]interface{}{
			"key":   key,
			"value": json.RawMessage(data),
		})
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
		return fmt.Errorf("dapr bulk state save: status %d", resp.StatusCode)
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
	return io.ReadAll(resp.Body)
}

// DeleteState removes a key from a Dapr state store.
func (c *Client) DeleteState(ctx context.Context, storeName, key string) error {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", c.baseURL, storeName, key)
	req, _ := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("dapr state delete %s/%s: status %d", storeName, key, resp.StatusCode)
	}
	return nil
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

// Subscription represents a Dapr pub/sub subscription.
type Subscription struct {
	PubsubName string `json:"pubsubname"`
	Topic      string `json:"topic"`
	Route      string `json:"route"`
}

// SubscriptionHandler handles incoming Dapr pub/sub messages.
type SubscriptionHandler func(ctx context.Context, event map[string]interface{}) error

// RegisterSubscriptions returns subscription declarations for Dapr.
// Dapr calls GET /dapr/subscribe to discover subscriptions.
func RegisterSubscriptions(subs []Subscription) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(subs)
	}
}

// SubscriptionMiddleware creates an HTTP handler for a Dapr subscription topic.
func SubscriptionMiddleware(handler SubscriptionHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var event map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"status": "DROP"})
			return
		}
		if err := handler(r.Context(), event); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"status": "RETRY"})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "SUCCESS"})
	}
}

// GetSecret retrieves a secret from a Dapr secret store.
func (c *Client) GetSecret(ctx context.Context, storeName, key string) (map[string]string, error) {
	url := fmt.Sprintf("%s/v1.0/secrets/%s/%s", c.baseURL, storeName, key)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var secrets map[string]string
	json.NewDecoder(resp.Body).Decode(&secrets)
	return secrets, nil
}

// GetBulkSecret retrieves all secrets from a store.
func (c *Client) GetBulkSecret(ctx context.Context, storeName string) (map[string]map[string]string, error) {
	url := fmt.Sprintf("%s/v1.0/secrets/%s/bulk", c.baseURL, storeName)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var secrets map[string]map[string]string
	json.NewDecoder(resp.Body).Decode(&secrets)
	return secrets, nil
}

// InvokeBinding triggers a Dapr output binding.
func (c *Client) InvokeBinding(ctx context.Context, bindingName, operation string, data interface{}, metadata map[string]string) ([]byte, error) {
	payload := map[string]interface{}{
		"operation": operation,
		"metadata":  metadata,
	}
	if data != nil {
		d, _ := json.Marshal(data)
		payload["data"] = json.RawMessage(d)
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v1.0/bindings/%s", c.baseURL, bindingName)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	result, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("dapr binding %s: status %d", bindingName, resp.StatusCode)
	}
	return result, nil
}

// Health checks if the Dapr sidecar is healthy.
func (c *Client) Health(ctx context.Context) error {
	url := fmt.Sprintf("%s/v1.0/healthz", c.baseURL)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("dapr unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// Dapr component names for CRM platform
const (
	StateStoreCRM  = "crm-statestore"
	PubSubCRM      = "crm-pubsub"
	BindingEmail   = "crm-email"
	BindingSMS     = "crm-sms"
	SecretStoreCRM = "crm-secrets"
	CacheCRM       = "crm-cache"
)
