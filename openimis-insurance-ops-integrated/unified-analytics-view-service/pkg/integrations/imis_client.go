package integrations

import (
	"context"
	"fmt"
	"time"

	"unified-analytics-view-service/pkg/models"
)

// OpenIMISClientImpl implements the OpenIMISClient interface.
type OpenIMISClientImpl struct {
	// Add fields for HTTP client, base URL, etc.
}

// NewOpenIMISClient creates a new instance of OpenIMISClientImpl.
func NewOpenIMISClient() OpenIMISClient {
	return &OpenIMISClientImpl{}
}

// FetchPolicyData simulates fetching policy data from OpenIMIS via REST API.
func (c *OpenIMISClientImpl) FetchPolicyData(ctx context.Context, policyID string) (*models.PolicyWithActuarialMetrics, error) {
	// In a real scenario, this would be an HTTP GET request with retry logic and circuit breakers.
	// For now, we simulate the data fetch.
	if policyID == "error-policy" {
		return nil, fmt.Errorf("OpenIMIS API error for policy %s", policyID)
	}

	// Simulate data from OpenIMIS
	return &models.PolicyWithActuarialMetrics{
		PolicyID: policyID,
		ClientID: "CLNT-123",
		EffectiveDate: time.Now().AddDate(0, -6, 0),
		ExpirationDate: time.Now().AddDate(0, 6, 0),
		PremiumAmount: 1000.00,
		CoverageType: "Health",
		ActuarialValue: 0.0, // To be calculated by service
		RiskScore: 0.0, // To be calculated by service
		UnderwriterID: "UW-001",
	}, nil
}

// FetchClaimData simulates fetching claim data from OpenIMIS via REST API.
func (c *OpenIMISClientImpl) FetchClaimData(ctx context.Context, claimID string) (*models.ClaimsWithReservesAndLossRatios, error) {
	if claimID == "error-claim" {
		return nil, fmt.Errorf("OpenIMIS API error for claim %s", claimID)
	}

	// Simulate data from OpenIMIS
	return &models.ClaimsWithReservesAndLossRatios{
		ClaimID: claimID,
		PolicyID: "POL-456",
		DateOfLoss: time.Now().AddDate(0, 0, -30),
		ReportedDate: time.Now().AddDate(0, 0, -28),
		IncurredAmount: 500.00,
		PaidAmount: 300.00,
		CaseReserve: 200.00,
		IBNRReserve: 50.00,
		PremiumAmount: 1000.00, // Assuming this is fetched from a related policy
		ClaimStatus: "Open",
	}, nil
}

// FetchUnderwritingData simulates fetching underwriting data from OpenIMIS via REST API.
func (c *OpenIMISClientImpl) FetchUnderwritingData(ctx context.Context, underwritingID string) (*models.UnderwritingWithRiskScores, error) {
	if underwritingID == "error-uw" {
		return nil, fmt.Errorf("OpenIMIS API error for underwriting %s", underwritingID)
	}

	// Simulate data from OpenIMIS
	return &models.UnderwritingWithRiskScores{
		UnderwritingID: underwritingID,
		PolicyID: "POL-789",
		ApplicationDate: time.Now().AddDate(0, -1, 0),
		DecisionDate: time.Now().AddDate(0, -1, 5),
		DecisionStatus: "Approved",
		CalculatedRiskScore: 0.6,
		UnderwriterNotes: "Standard risk profile",
		ExternalDataScore: 0.8,
	}, nil
}
