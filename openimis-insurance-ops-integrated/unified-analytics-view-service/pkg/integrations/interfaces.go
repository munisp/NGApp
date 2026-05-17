package integrations

import (
	"context"
	"unified-analytics-view-service/pkg/models"
)

// OpenIMISClient defines the interface for interacting with OpenIMIS data sources.
type OpenIMISClient interface {
	// FetchPolicyData retrieves raw policy data from OpenIMIS.
	FetchPolicyData(ctx context.Context, policyID string) (*models.PolicyWithActuarialMetrics, error)
	// FetchClaimData retrieves raw claim data from OpenIMIS.
	FetchClaimData(ctx context.Context, claimID string) (*models.ClaimsWithReservesAndLossRatios, error)
	// FetchUnderwritingData retrieves raw underwriting data from OpenIMIS.
	FetchUnderwritingData(ctx context.Context, underwritingID string) (*models.UnderwritingWithRiskScores, error)
}

// KafkaProducer defines the interface for publishing events to Kafka.
type KafkaProducer interface {
	// ProduceView publishes a unified view to a Kafka topic.
	ProduceView(ctx context.Context, topic string, key string, view interface{}) error
}

// DataLakeClient defines the interface for interacting with the data lake (e.g., Spark SQL for BI).
type DataLakeClient interface {
	// ExecuteSparkSQL runs a Spark SQL query against the unified views.
	ExecuteSparkSQL(ctx context.Context, query string) (interface{}, error)
	// ExportDataForRegulatoryReporting retrieves data for regulatory purposes.
	ExportDataForRegulatoryReporting(ctx context.Context, period string) (*models.RegulatoryReportData, error)
}

// TemporalClient defines the interface for interacting with the Temporal workflow engine.
type TemporalClient interface {
	// StartScheduledReportWorkflow starts the workflow for generating scheduled reports.
	StartScheduledReportWorkflow(ctx context.Context, workflowID string, schedule string) (string, error)
}
