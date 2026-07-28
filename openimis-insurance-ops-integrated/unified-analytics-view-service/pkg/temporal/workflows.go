package temporal

import (
	"time"

	"go.temporal.io/sdk/workflow"
	"unified-analytics-view-service/pkg/models"
)

// ReportGenerationWorkflowName is the name of the workflow for scheduled report generation.
const ReportGenerationWorkflowName = "ScheduledReportGenerationWorkflow"

// ReportGenerationWorkflowInput defines the input for the workflow.
type ReportGenerationWorkflowInput struct {
	ReportPeriod string
	RecipientEmail string
}

// ReportGenerationWorkflow is the main workflow that orchestrates the report generation and delivery.
func ReportGenerationWorkflow(ctx workflow.Context, input ReportGenerationWorkflowInput) (*models.RegulatoryReportData, error) {
	// Define activity options
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	logger := workflow.GetLogger(ctx)
	logger.Info("ReportGenerationWorkflow started", "ReportPeriod", input.ReportPeriod)

	var report *models.RegulatoryReportData
	err := workflow.ExecuteActivity(ctx, GenerateReportActivity, input.ReportPeriod).Get(ctx, &report)
	if err != nil {
		logger.Error("GenerateReportActivity failed", "Error", err)
		return nil, err
	}

	err = workflow.ExecuteActivity(ctx, DeliverReportActivity, report, input.RecipientEmail).Get(ctx, nil)
	if err != nil {
		logger.Error("DeliverReportActivity failed", "Error", err)
		// We can choose to return the report even if delivery fails, or retry delivery
		// For now, we'll just log and return the report.
	}

	logger.Info("ReportGenerationWorkflow completed successfully")
	return report, nil
}

// GenerateReportActivity is the activity that calls the AnalyticsService to generate the report.
func GenerateReportActivity(ctx context.Context, period string) (*models.RegulatoryReportData, error) {
	// This function will be implemented in the worker with dependency injection.
	// The actual implementation will be in pkg/temporal/activities.go
	return nil, nil
}

// DeliverReportActivity is the activity that handles the delivery of the generated report.
func DeliverReportActivity(ctx context.Context, report *models.RegulatoryReportData, email string) error {
	// This function will be implemented in the worker with dependency injection.
	// The actual implementation will be in pkg/temporal/activities.go
	return nil
}
