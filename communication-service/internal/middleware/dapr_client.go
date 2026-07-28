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

// DaprConfig holds Dapr configuration
type DaprConfig struct {
	HTTPPort    string
	GRPCPort    string
	PubSubName  string
	StateStore  string
	SecretStore string
}

// DaprClient handles Dapr sidecar communication
type DaprClient struct {
	config     DaprConfig
	httpClient *http.Client
	logger     *zap.Logger
}

// NewDaprClient creates a new Dapr client
func NewDaprClient(config DaprConfig, logger *zap.Logger) *DaprClient {
	if config.HTTPPort == "" {
		config.HTTPPort = os.Getenv("DAPR_HTTP_PORT")
		if config.HTTPPort == "" {
			config.HTTPPort = "3500"
		}
	}
	if config.PubSubName == "" {
		config.PubSubName = os.Getenv("DAPR_PUBSUB_NAME")
		if config.PubSubName == "" {
			config.PubSubName = "pubsub"
		}
	}
	if config.StateStore == "" {
		config.StateStore = os.Getenv("DAPR_STATE_STORE")
		if config.StateStore == "" {
			config.StateStore = "statestore"
		}
	}

	return &DaprClient{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// PublishEvent publishes an event to a Dapr pub/sub topic
func (d *DaprClient) PublishEvent(ctx context.Context, topic string, data interface{}) error {
	url := fmt.Sprintf("http://localhost:%s/v1.0/publish/%s/%s", d.config.HTTPPort, d.config.PubSubName, topic)

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		d.logger.Error("Failed to publish event to Dapr", zap.String("topic", topic), zap.Error(err))
		return fmt.Errorf("failed to publish event: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("dapr publish failed with status: %d", resp.StatusCode)
	}

	d.logger.Info("Event published to Dapr", zap.String("topic", topic))
	return nil
}

// InvokeService invokes another service via Dapr
func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	url := fmt.Sprintf("http://localhost:%s/v1.0/invoke/%s/method/%s", d.config.HTTPPort, appID, method)

	var body *bytes.Buffer
	if data != nil {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request data: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	} else {
		body = bytes.NewBuffer(nil)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		d.logger.Error("Failed to invoke service via Dapr", zap.String("appID", appID), zap.String("method", method), zap.Error(err))
		return nil, fmt.Errorf("failed to invoke service: %w", err)
	}
	defer resp.Body.Close()

	var result bytes.Buffer
	_, err = result.ReadFrom(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return result.Bytes(), nil
}

// SaveState saves state to Dapr state store
func (d *DaprClient) SaveState(ctx context.Context, key string, value interface{}) error {
	url := fmt.Sprintf("http://localhost:%s/v1.0/state/%s", d.config.HTTPPort, d.config.StateStore)

	stateItem := []map[string]interface{}{
		{
			"key":   key,
			"value": value,
		},
	}

	jsonData, err := json.Marshal(stateItem)
	if err != nil {
		return fmt.Errorf("failed to marshal state data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to save state: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("dapr save state failed with status: %d", resp.StatusCode)
	}

	return nil
}

// GetState retrieves state from Dapr state store
func (d *DaprClient) GetState(ctx context.Context, key string) ([]byte, error) {
	url := fmt.Sprintf("http://localhost:%s/v1.0/state/%s/%s", d.config.HTTPPort, d.config.StateStore, key)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get state: %w", err)
	}
	defer resp.Body.Close()

	var result bytes.Buffer
	_, err = result.ReadFrom(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return result.Bytes(), nil
}

// GetSecret retrieves a secret from Dapr secret store
func (d *DaprClient) GetSecret(ctx context.Context, secretName string) (map[string]string, error) {
	url := fmt.Sprintf("http://localhost:%s/v1.0/secrets/%s/%s", d.config.HTTPPort, d.config.SecretStore, secretName)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get secret: %w", err)
	}
	defer resp.Body.Close()

	var secrets map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&secrets); err != nil {
		return nil, fmt.Errorf("failed to decode secrets: %w", err)
	}

	return secrets, nil
}

// Communication-specific event types
type MessageSentEvent struct {
	MessageID   string                 `json:"message_id"`
	Channel     string                 `json:"channel"`
	Recipient   string                 `json:"recipient"`
	MessageType string                 `json:"message_type"`
	Status      string                 `json:"status"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type MessageDeliveredEvent struct {
	MessageID   string    `json:"message_id"`
	Channel     string    `json:"channel"`
	Recipient   string    `json:"recipient"`
	DeliveredAt time.Time `json:"delivered_at"`
}

type MessageFailedEvent struct {
	MessageID string    `json:"message_id"`
	Channel   string    `json:"channel"`
	Recipient string    `json:"recipient"`
	Error     string    `json:"error"`
	Timestamp time.Time `json:"timestamp"`
	RetryCount int      `json:"retry_count"`
}

// PublishMessageSent publishes a message sent event
func (d *DaprClient) PublishMessageSent(ctx context.Context, event MessageSentEvent) error {
	return d.PublishEvent(ctx, "communication.message.sent", event)
}

// PublishMessageDelivered publishes a message delivered event
func (d *DaprClient) PublishMessageDelivered(ctx context.Context, event MessageDeliveredEvent) error {
	return d.PublishEvent(ctx, "communication.message.delivered", event)
}

// PublishMessageFailed publishes a message failed event
func (d *DaprClient) PublishMessageFailed(ctx context.Context, event MessageFailedEvent) error {
	return d.PublishEvent(ctx, "communication.message.failed", event)
}

// InvokePolicyService invokes the policy service
func (d *DaprClient) InvokePolicyService(ctx context.Context, method string, data interface{}) ([]byte, error) {
	return d.InvokeService(ctx, "policy-service", method, data)
}

// InvokeClaimsService invokes the claims service
func (d *DaprClient) InvokeClaimsService(ctx context.Context, method string, data interface{}) ([]byte, error) {
	return d.InvokeService(ctx, "claims-service", method, data)
}

// InvokeCustomerService invokes the customer service
func (d *DaprClient) InvokeCustomerService(ctx context.Context, method string, data interface{}) ([]byte, error) {
	return d.InvokeService(ctx, "customer-service", method, data)
}
