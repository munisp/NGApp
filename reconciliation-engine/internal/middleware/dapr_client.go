package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type DaprClient struct {
	httpClient *http.Client
	daprPort   int
	appID      string
}

type DaprStateItem struct {
	Key      string            `json:"key"`
	Value    interface{}       `json:"value"`
	Etag     string            `json:"etag,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

type DaprPubSubMessage struct {
	Data        interface{}       `json:"data"`
	DataContentType string        `json:"datacontenttype,omitempty"`
	Topic       string            `json:"topic"`
	PubsubName  string            `json:"pubsubname"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type ServiceInvocationRequest struct {
	AppID      string            `json:"app_id"`
	MethodName string            `json:"method_name"`
	Data       interface{}       `json:"data"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

const (
	StateStoreReconciliation = "reconciliation-statestore"
	PubSubReconciliation     = "reconciliation-pubsub"
	
	ServicePolicyEngine      = "policy-engine"
	ServiceClaimsEngine      = "claims-adjudication-engine"
	ServicePaymentGateway    = "payment-gateway"
	ServiceNotification      = "notification-service"
	ServiceAudit             = "audit-service"
)

func NewDaprClient(daprPort int, appID string) (*DaprClient, error) {
	return &DaprClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		daprPort: daprPort,
		appID:    appID,
	}, nil
}

func (d *DaprClient) baseURL() string {
	return fmt.Sprintf("http://localhost:%d", d.daprPort)
}

func (d *DaprClient) SaveState(ctx context.Context, storeName string, items []DaprStateItem) error {
	url := fmt.Sprintf("%s/v1.0/state/%s", d.baseURL(), storeName)

	data, err := json.Marshal(items)
	if err != nil {
		return fmt.Errorf("failed to marshal state items: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to save state: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to save state: %s", string(body))
	}

	return nil
}

func (d *DaprClient) GetState(ctx context.Context, storeName, key string) ([]byte, error) {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", d.baseURL(), storeName, key)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get state: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get state: %s", string(body))
	}

	return io.ReadAll(resp.Body)
}

func (d *DaprClient) DeleteState(ctx context.Context, storeName, key string) error {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", d.baseURL(), storeName, key)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete state: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (d *DaprClient) PublishEvent(ctx context.Context, pubsubName, topic string, data interface{}) error {
	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", d.baseURL(), pubsubName, topic)

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to publish event: %s", string(body))
	}

	return nil
}

func (d *DaprClient) InvokeService(ctx context.Context, appID, methodName string, data interface{}) ([]byte, error) {
	url := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s", d.baseURL(), appID, methodName)

	var body io.Reader
	if data != nil {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request data: %w", err)
		}
		body = bytes.NewReader(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to invoke service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("service invocation failed: %s", string(respBody))
	}

	return io.ReadAll(resp.Body)
}

func (d *DaprClient) SaveReconciliationJob(ctx context.Context, jobID string, jobData interface{}) error {
	items := []DaprStateItem{
		{
			Key:   fmt.Sprintf("job:%s", jobID),
			Value: jobData,
		},
	}
	return d.SaveState(ctx, StateStoreReconciliation, items)
}

func (d *DaprClient) GetReconciliationJob(ctx context.Context, jobID string) (map[string]interface{}, error) {
	data, err := d.GetState(ctx, StateStoreReconciliation, fmt.Sprintf("job:%s", jobID))
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, nil
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job data: %w", err)
	}

	return result, nil
}

func (d *DaprClient) PublishReconciliationEvent(ctx context.Context, eventType string, eventData interface{}) error {
	return d.PublishEvent(ctx, PubSubReconciliation, eventType, eventData)
}

func (d *DaprClient) GetPolicyDetails(ctx context.Context, policyID string) (map[string]interface{}, error) {
	data, err := d.InvokeService(ctx, ServicePolicyEngine, fmt.Sprintf("policies/%s", policyID), nil)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal policy data: %w", err)
	}

	return result, nil
}

func (d *DaprClient) GetClaimDetails(ctx context.Context, claimID string) (map[string]interface{}, error) {
	data, err := d.InvokeService(ctx, ServiceClaimsEngine, fmt.Sprintf("claims/%s", claimID), nil)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal claim data: %w", err)
	}

	return result, nil
}

func (d *DaprClient) GetPaymentDetails(ctx context.Context, paymentRef string) (map[string]interface{}, error) {
	data, err := d.InvokeService(ctx, ServicePaymentGateway, fmt.Sprintf("payments/%s", paymentRef), nil)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payment data: %w", err)
	}

	return result, nil
}

func (d *DaprClient) SendNotification(ctx context.Context, notificationType string, recipient string, data map[string]interface{}) error {
	payload := map[string]interface{}{
		"type":      notificationType,
		"recipient": recipient,
		"data":      data,
		"timestamp": time.Now(),
	}

	_, err := d.InvokeService(ctx, ServiceNotification, "send", payload)
	return err
}

func (d *DaprClient) LogAuditEvent(ctx context.Context, action string, entityType string, entityID string, details map[string]interface{}) error {
	payload := map[string]interface{}{
		"action":      action,
		"entity_type": entityType,
		"entity_id":   entityID,
		"details":     details,
		"timestamp":   time.Now(),
		"app_id":      d.appID,
	}

	_, err := d.InvokeService(ctx, ServiceAudit, "log", payload)
	return err
}

func (d *DaprClient) GetSecret(ctx context.Context, storeName, secretName string) (map[string]string, error) {
	url := fmt.Sprintf("%s/v1.0/secrets/%s/%s", d.baseURL(), storeName, secretName)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get secret: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get secret: %s", string(body))
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode secret: %w", err)
	}

	return result, nil
}

func (d *DaprClient) Close() error {
	return nil
}
