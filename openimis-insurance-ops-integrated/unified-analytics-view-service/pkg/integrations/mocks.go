//go:build testing
// +build testing

// This file contains mock implementations used exclusively in unit tests.
// It is excluded from production builds via the 'testing' build tag.
package integrations

import (
	"context"
	"fmt"
	"time"
	"unified-analytics-view-service/pkg/models"
)

// MockOpenIMISClient provides a mock implementation of the OpenIMISClient interface.
type MockOpenIMISClient struct{}

func (m *MockOpenIMISClient) FetchPolicyData(ctx context.Context, policyID string) (*models.PolicyWithActuarialMetrics, error) {
	if policyID == "error-policy" {
		return nil, fmt.Errorf("mock IMIS error for policy %s", policyID)
	}
	// Simulate fetching raw data
	return &models.PolicyWithActuarialMetrics{
		PolicyID: policyID,
		ClientID: "CLNT-123",
		EffectiveDate: time.Now().AddDate(0, -6, 0),
		ExpirationDate: time.Now().AddDate(0, 6, 0),
		PremiumAmount: 1000.00,
		CoverageType: "Health",
		ActuarialValue: 0.0, // To be calculated
		RiskScore: 0.0, // To be calculated
		UnderwriterID: "UW-001",
	}, nil
}

func (m *MockOpenIMISClient) FetchClaimData(ctx context.Context, claimID string) (*models.ClaimsWithReservesAndLossRatios, error) {
	if claimID == "error-claim" {
		return nil, fmt.Errorf("mock IMIS error for claim %s", claimID)
	}
	// Simulate fetching raw data
	return &models.ClaimsWithReservesAndLossRatios{
		ClaimID: claimID,
		PolicyID: "POL-456",
		DateOfLoss: time.Now().AddDate(0, 0, -30),
		ReportedDate: time.Now().AddDate(0, 0, -28),
		IncurredAmount: 500.00,
		PaidAmount: 300.00,
		CaseReserve: 200.00,
		IBNRReserve: 50.00,
		TotalReserve: 0.0, // To be calculated
		LossRatio: 0.0, // To be calculated
		ClaimStatus: "Open",
		PremiumAmount: 1000.00, // Added for loss ratio calculation
	}, nil
}

func (m *MockOpenIMISClient) FetchUnderwritingData(ctx context.Context, underwritingID string) (*models.UnderwritingWithRiskScores, error) {
	if underwritingID == "error-uw" {
		return nil, fmt.Errorf("mock IMIS error for underwriting %s", underwritingID)
	}
	// Simulate fetching raw data
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

// MockKafkaProducer provides a mock implementation of the KafkaProducer interface.
type MockKafkaProducer struct{}

func (m *MockKafkaProducer) ProduceView(ctx context.Context, topic string, key string, view interface{}) error {
	if topic == "error-topic" {
		return fmt.Errorf("mock Kafka error for topic %s", topic)
	}
	// Simulate successful production
	fmt.Printf("MockKafkaProducer: Successfully produced view to topic %s with key %s\n", topic, key)
	return nil
}

// MockDataLakeClient provides a mock implementation of the DataLakeClient interface.
type MockDataLakeClient struct{}

func (m *MockDataLakeClient) ExecuteSparkSQL(ctx context.Context, query string) (interface{}, error) {
	// Simulate Spark SQL execution
	fmt.Printf("MockDataLakeClient: Executing Spark SQL query: %s\n", query)
	return []map[string]interface{}{
		{"metric": "total_policies", "value": 50000},
		{"metric": "avg_loss_ratio", "value": 0.55},
	}, nil
}

func (m *MockDataLakeClient) ExportDataForRegulatoryReporting(ctx context.Context, period string) (*models.RegulatoryReportData, error) {
	if period == "error-period" {
		return nil, fmt.Errorf("mock DataLake error for period %s", period)
	}
	// Simulate data export
	return &models.RegulatoryReportData{
		ReportingPeriod: period,
		DataRows: []map[string]interface{}{
			{"policy_id": "POL-001", "premium": 1200.00, "claims_paid": 500.00},
			{"policy_id": "POL-002", "premium": 800.00, "claims_paid": 0.00},
		},
	}, nil
}

// MockTemporalClient provides a mock implementation of the TemporalClient interface.
type MockTemporalClient struct{}

func (m *MockTemporalClient) StartScheduledReportWorkflow(ctx context.Context, workflowID string, schedule string) (string, error) {
	// Simulate starting a Temporal workflow
	fmt.Printf("MockTemporalClient: Started workflow %s with schedule %s\n", workflowID, schedule)
	return fmt.Sprintf("run-id-%s", workflowID), nil
}
