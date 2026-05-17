package temporal

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"unified-analytics-view-service/pkg/models"
	"unified-analytics-view-service/pkg/service"
)

// TaskQueue is the Temporal Task Queue name for this service.
const TaskQueue = "UNIFIED_ANALYTICS_TASK_QUEUE"

// Activities struct holds dependencies for activities.
type Activities struct {
	AnalyticsService service.AnalyticsService
	Logger           *logrus.Entry
}

// GenerateReportActivity is the activity implementation.
func (a *Activities) GenerateReportActivity(ctx context.Context, period string) (*models.RegulatoryReportData, error) {
	a.Logger.WithField("period", period).Info("Starting GenerateReportActivity")

	// Simulate a long-running data processing task
	activity.RecordHeartbeat(ctx, "Generating report...")
	time.Sleep(5 * time.Second)

	report, err := a.AnalyticsService.GenerateRegulatoryReport(ctx, period)
	if err != nil {
		a.Logger.WithError(err).Error("Failed to generate regulatory report")
		return nil, err
	}

	a.Logger.WithField("report_id", report.ReportID).Info("GenerateReportActivity completed")
	return report, nil
}

// DeliverReportActivity is the activity implementation for report delivery.
func (a *Activities) DeliverReportActivity(ctx context.Context, report *models.RegulatoryReportData, email string) error {
	a.Logger.WithField("email", email).Info("Starting DeliverReportActivity")

	// Simulate email delivery or file transfer
	activity.RecordHeartbeat(ctx, "Delivering report...")
	time.Sleep(2 * time.Second)

	// In a real scenario, this would involve an email client or file storage client.
	a.Logger.Infof("Successfully delivered report %s to %s (Simulated)", report.ReportID, email)
	return nil
}

// StartWorker starts the Temporal worker process.
func StartWorker(c client.Client, analyticsService service.AnalyticsService, logger *logrus.Entry) {
	w := worker.New(c, TaskQueue, worker.Options{})

	activities := &Activities{
		AnalyticsService: analyticsService,
		Logger:           logger,
	}

	w.RegisterWorkflow(ReportGenerationWorkflow)
	w.RegisterActivity(activities)

	logger.Info("Starting Temporal Worker...")
	err := w.Run(worker.InterruptCh())
	if err != nil {
		logger.WithError(err).Fatal("Temporal Worker failed to start")
	}
}

// StartScheduledReportWorkflow starts the workflow for generating scheduled reports.
func StartScheduledReportWorkflow(c client.Client, scheduleID string, cronSchedule string, input ReportGenerationWorkflowInput) (string, error) {
	// Use the Temporal Schedule API for cron-based scheduling
	scheduleHandle, err := c.ScheduleClient().Create(context.Background(), client.ScheduleOptions{
		ID: scheduleID,
		Spec: client.ScheduleSpec{
			CronExpressions: []string{cronSchedule},
		},
		Action: &client.ScheduleWorkflowAction{
			ID:        fmt.Sprintf("%s-run", scheduleID),
			Workflow:  ReportGenerationWorkflow,
			TaskQueue: TaskQueue,
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
