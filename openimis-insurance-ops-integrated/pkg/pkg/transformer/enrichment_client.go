package transformer

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/openimis/actuarial-data-transformer/pkg/models"
)

// EnrichmentClient defines the interface for fetching operational context.
type EnrichmentClient interface {
	GetOperationalContext(ctx context.Context, insureeID string) (*models.OperationalContext, error)
}

// HTTPEnrichmentClient implements the EnrichmentClient using HTTP.
type HTTPEnrichmentClient struct {
	baseURL string
	client *http.Client
}

// NewHTTPEnrichmentClient creates a new HTTPEnrichmentClient.
func NewHTTPEnrichmentClient(baseURL string) *HTTPEnrichmentClient {
	return &HTTPEnrichmentClient{
		baseURL: baseURL,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

// GetOperationalContext simulates fetching operational context from an external service.
// In a real scenario, this would make an HTTP request to the configured URL.
func (c *HTTPEnrichmentClient) GetOperationalContext(ctx context.Context, insureeID string) (*models.OperationalContext, error) {
	// --- SIMULATION START ---
	// In a real application, we would make an HTTP request here:
	// resp, err := c.client.Get(fmt.Sprintf("%s/%s", c.baseURL, insureeID))
	// ... handle response ...

	// Mocking the response for simulation purposes
	rand.Seed(time.Now().UnixNano())
	riskScore := float64(rand.Intn(100)) / 100.0 // 0.0 to 1.0
	premium := float64(rand.Intn(500) + 50)     // 50 to 550
	startDate := time.Now().AddDate(0, -rand.Intn(12), -rand.Intn(30))

	context := &models.OperationalContext{
		InsureeRiskScore: riskScore,
		PolicyPremium:    premium,
		PolicyStartDate:  startDate,
	}

	// Simulate successful JSON response
	// We marshal and unmarshal to simulate the network latency and data transfer
	data, _ := json.Marshal(context)
	_ = json.Unmarshal(data, context)

	// Simulate a small delay
	time.Sleep(5 * time.Millisecond)

	// --- SIMULATION END ---
	return context, nil
}
