package integrations

import (
	"context"
	"fmt"
	"time"

	"go.temporal.io/sdk/client"
	"unified-analytics-view-service/pkg/temporal"
)

// TemporalClientImpl implements the TemporalClient interface.
type TemporalClientImpl struct {
	client client.Client
}

// NewTemporalClient creates a new instance of TemporalClientImpl.
func NewTemporalClient(c client.Client) TemporalClient {
	return &TemporalClientImpl{client: c}
}

// StartScheduledReportWorkflow starts the workflow for generating scheduled reports.
func (t *TemporalClientImpl) StartScheduledReportWorkflow(ctx context.Context, scheduleID string, cronSchedule string) (string, error) {
	// Use the Temporal Schedule API for cron-based scheduling
	// The actual workflow input will be passed when the schedule triggers.
	// For simplicity, we'll assume a fixed input for the scheduled report.
	input := temporal.ReportGenerationWorkflowInput{
		ReportPeriod: "monthly",
		RecipientEmail: "actuarial_team@example.com",
	}

	scheduleHandle, err := t.client.ScheduleClient().Create(ctx, client.ScheduleOptions{
		ID: scheduleID,
		Spec: client.ScheduleSpec{
			CronExpressions: []string{cronSchedule},
		},
		Action: &client.ScheduleWorkflowAction{
			ID:        fmt.Sprintf("%s-run", scheduleID),
			Workflow:  temporal.ReportGenerationWorkflow,
			TaskQueue: temporal.TaskQueue,
			Args:      []interface{}{input},
		},
		Policy: client.SchedulePolicy{
			CatchupWindow: 5 * time.Minute,
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to create Temporal schedule: %w", err)
	}

	return scheduleHandle.GetID(), nil
}
