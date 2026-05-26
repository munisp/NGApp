package middleware

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

// DaprConfig holds configuration for Dapr sidecar integration
type DaprConfig struct {
	HTTPPort       int
	GRPCPort       int
	AppID          string
	PubSubName     string
	StateStoreName string
	SecretStore    string
}

// DaprClient provides methods to interact with the Dapr sidecar
type DaprClient struct {
	config DaprConfig
	client *http.Client
}

func NewDaprClient(config DaprConfig) *DaprClient {
	if config.HTTPPort == 0 {
		config.HTTPPort = 3500
	}
	if config.PubSubName == "" {
		config.PubSubName = "payment-pubsub"
	}
	if config.StateStoreName == "" {
		config.StateStoreName = "payment-statestore"
	}
	if config.AppID == "" {
		config.AppID = os.Getenv("DAPR_APP_ID")
		if config.AppID == "" {
			config.AppID = "payment-switch"
		}
	}
	return &DaprClient{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (d *DaprClient) baseURL() string {
	return fmt.Sprintf("http://localhost:%d/v1.0", d.config.HTTPPort)
}

// PublishEvent publishes an event to a Dapr pub/sub topic
func (d *DaprClient) PublishEvent(ctx context.Context, topic string, data interface{}) error {
	body, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	url := fmt.Sprintf("%s/publish/%s/%s", d.baseURL(), d.config.PubSubName, topic)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("publish event: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("publish failed with status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// SaveState saves state to the Dapr state store
func (d *DaprClient) SaveState(ctx context.Context, key string, value interface{}) error {
	data, _ := json.Marshal(value)
	state := []map[string]interface{}{
		{"key": key, "value": json.RawMessage(data)},
	}
	body, _ := json.Marshal(state)
	url := fmt.Sprintf("%s/state/%s", d.baseURL(), d.config.StateStoreName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("save state: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("save state failed: %d", resp.StatusCode)
	}
	return nil
}

// GetState retrieves state from the Dapr state store
func (d *DaprClient) GetState(ctx context.Context, key string) ([]byte, error) {
	url := fmt.Sprintf("%s/state/%s/%s", d.baseURL(), d.config.StateStoreName, key)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get state: %w", err)
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// InvokeService invokes another Dapr service
func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	body, _ := json.Marshal(data)
	url := fmt.Sprintf("%s/invoke/%s/method/%s", d.baseURL(), appID, method)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("invoke service: %w", err)
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// GetSecret retrieves a secret from the Dapr secret store
func (d *DaprClient) GetSecret(ctx context.Context, secretName string) (map[string]string, error) {
	store := d.config.SecretStore
	if store == "" {
		store = "local-secret-store"
	}
	url := fmt.Sprintf("%s/secrets/%s/%s", d.baseURL(), store, secretName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get secret: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}
