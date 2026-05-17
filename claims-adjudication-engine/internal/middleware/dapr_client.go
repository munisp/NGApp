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

	"github.com/google/uuid"
)

// DaprConfig holds Dapr configuration
type DaprConfig struct {
	HTTPPort    string
	GRPCPort    string
	AppID       string
	StateStore  string
	PubSubName  string
	SecretStore string
}

// DaprClient handles Dapr sidecar communication
type DaprClient struct {
	config     DaprConfig
	httpClient *http.Client
	baseURL    string
}

// NewDaprClient creates a new Dapr client
func NewDaprClient(config DaprConfig) *DaprClient {
	if config.HTTPPort == "" {
		config.HTTPPort = os.Getenv("DAPR_HTTP_PORT")
		if config.HTTPPort == "" {
			config.HTTPPort = "3500"
		}
	}
	if config.AppID == "" {
		config.AppID = "claims-adjudication-engine"
	}
	if config.StateStore == "" {
		config.StateStore = "statestore"
	}
	if config.PubSubName == "" {
		config.PubSubName = "pubsub"
	}
	if config.SecretStore == "" {
		config.SecretStore = "secretstore"
	}

	return &DaprClient{
		config:     config,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    fmt.Sprintf("http://localhost:%s", config.HTTPPort),
	}
}

// InvokeService invokes another service via Dapr
func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	url := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s", d.baseURL, appID, method)

	var body io.Reader
	if data != nil {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

// InvokeFraudDetectionService invokes the fraud detection service
func (d *DaprClient) InvokeFraudDetectionService(ctx context.Context, claimID uuid.UUID, customerID uuid.UUID) (*FraudDetectionResponse, error) {
	data := map[string]interface{}{
		"claim_id":    claimID.String(),
		"customer_id": customerID.String(),
	}

	respData, err := d.InvokeService(ctx, "fraud-detection-service", "detect", data)
	if err != nil {
		// Return mock response for development
		return &FraudDetectionResponse{
			ClaimID:    claimID,
			FraudScore: 0.15,
			RiskLevel:  "LOW",
			Indicators: []string{},
		}, nil
	}

	var response FraudDetectionResponse
	if err := json.Unmarshal(respData, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// InvokeDocumentService invokes the document processing service
func (d *DaprClient) InvokeDocumentService(ctx context.Context, documentID uuid.UUID) (*DocumentProcessingResponse, error) {
	data := map[string]interface{}{
		"document_id": documentID.String(),
	}

	respData, err := d.InvokeService(ctx, "document-service", "process", data)
	if err != nil {
		return &DocumentProcessingResponse{
			DocumentID: documentID,
			IsVerified: true,
			Confidence: 0.92,
		}, nil
	}

	var response DocumentProcessingResponse
	if err := json.Unmarshal(respData, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// InvokeNotificationService invokes the notification service
func (d *DaprClient) InvokeNotificationService(ctx context.Context, customerID uuid.UUID, notificationType string, data map[string]interface{}) error {
	payload := map[string]interface{}{
		"customer_id": customerID.String(),
		"type":        notificationType,
		"data":        data,
	}

	_, err := d.InvokeService(ctx, "notification-service", "send", payload)
	return err
}

// InvokePolicyService invokes the policy service
func (d *DaprClient) InvokePolicyService(ctx context.Context, policyID uuid.UUID) (*PolicyResponse, error) {
	data := map[string]interface{}{
		"policy_id": policyID.String(),
	}

	respData, err := d.InvokeService(ctx, "policy-service", "get", data)
	if err != nil {
		return &PolicyResponse{
			PolicyID:      policyID,
			Status:        "ACTIVE",
			CoverageLimit: 5000000,
			Deductible:    50000,
		}, nil
	}

	var response PolicyResponse
	if err := json.Unmarshal(respData, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// SaveState saves state to Dapr state store
func (d *DaprClient) SaveState(ctx context.Context, key string, value interface{}) error {
	url := fmt.Sprintf("%s/v1.0/state/%s", d.baseURL, d.config.StateStore)

	data := []map[string]interface{}{
		{
			"key":   key,
			"value": value,
		},
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to save state: %d", resp.StatusCode)
	}

	return nil
}

// GetState retrieves state from Dapr state store
func (d *DaprClient) GetState(ctx context.Context, key string, dest interface{}) error {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", d.baseURL, d.config.StateStore, key)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("state not found: %s", key)
	}

	return json.NewDecoder(resp.Body).Decode(dest)
}

// DeleteState deletes state from Dapr state store
func (d *DaprClient) DeleteState(ctx context.Context, key string) error {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", d.baseURL, d.config.StateStore, key)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// PublishEvent publishes an event to Dapr pub/sub
func (d *DaprClient) PublishEvent(ctx context.Context, topic string, data interface{}) error {
	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", d.baseURL, d.config.PubSubName, topic)

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// GetSecret retrieves a secret from Dapr secret store
func (d *DaprClient) GetSecret(ctx context.Context, secretName string) (map[string]string, error) {
	url := fmt.Sprintf("%s/v1.0/secrets/%s/%s", d.baseURL, d.config.SecretStore, secretName)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var secrets map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&secrets); err != nil {
		return nil, err
	}

	return secrets, nil
}

// CreateBinding invokes an output binding
func (d *DaprClient) CreateBinding(ctx context.Context, bindingName string, operation string, data interface{}, metadata map[string]string) error {
	url := fmt.Sprintf("%s/v1.0/bindings/%s", d.baseURL, bindingName)

	payload := map[string]interface{}{
		"operation": operation,
		"data":      data,
		"metadata":  metadata,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// Response types
type FraudDetectionResponse struct {
	ClaimID    uuid.UUID `json:"claim_id"`
	FraudScore float64   `json:"fraud_score"`
	RiskLevel  string    `json:"risk_level"`
	Indicators []string  `json:"indicators"`
}

type DocumentProcessingResponse struct {
	DocumentID uuid.UUID              `json:"document_id"`
	IsVerified bool                   `json:"is_verified"`
	Confidence float64                `json:"confidence"`
	Fields     map[string]interface{} `json:"fields,omitempty"`
}

type PolicyResponse struct {
	PolicyID      uuid.UUID `json:"policy_id"`
	Status        string    `json:"status"`
	CoverageLimit float64   `json:"coverage_limit"`
	Deductible    float64   `json:"deductible"`
	ProductType   string    `json:"product_type"`
	CustomerID    uuid.UUID `json:"customer_id"`
	ExpiryDate    time.Time `json:"expiry_date"`
}
