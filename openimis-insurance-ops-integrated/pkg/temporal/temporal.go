package temporal

import (
	"context"
	"log"
	"time"

	"actuarial-lake-service/pkg/config"
	"actuarial-lake-service/pkg/iceberg"
	"actuarial-lake-service/pkg/metrics"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"
	"go.uber.org/zap"
)

// Client wraps the Temporal client and worker
type Client struct {
	cfg    config.TemporalConfig
	client client.Client
	worker worker.Worker
	logger *zap.Logger
}

// NewClient creates a new Temporal client
func NewClient(cfg config.TemporalConfig) (*Client, error) {
	logger, _ := zap.NewProduction() // Use a simple logger for Temporal init
	c, err := client.Dial(client.Options{
		HostPort:  cfg.HostPort,
		Namespace: cfg.Namespace,
		Logger:    logger.Sugar(),
	})
	if err != nil {
		return nil, err
	}

	return &Client{
		cfg:    cfg,
		client: c,
		logger: logger,
	}, nil
}

// StartWorker starts the Temporal worker
func (c *Client) StartWorker() {
	c.worker = worker.New(c.client, c.cfg.TaskQueue, worker.Options{})

	// Register Workflows and Activities
	c.worker.RegisterWorkflow(CalculateLossRatioWorkflow)
	c.worker.RegisterActivity(c.CalculateLossRatioActivity)
	c.worker.RegisterActivity(c.ExpireSnapshotsActivity)

	c.logger.Info("starting Temporal worker", zap.String("task_queue", c.cfg.TaskQueue))
	if err := c.worker.Run(worker.InterruptCh()); err != nil {
		c.logger.Error("temporal worker failed", zap.Error(err))
	}
}

// StopWorker stops the Temporal worker
func (c *Client) StopWorker() {
	if c.worker != nil {
		c.worker.Stop()
		c.logger.Info("temporal worker stopped")
	}
}

// StartLossRatioWorkflow starts the monthly loss ratio calculation workflow
func (c *Client) StartLossRatioWorkflow(ctx context.Context, workflowID string) (client.WorkflowRun, error) {
	metrics.TemporalWorkflowCounter.WithLabelValues("CalculateLossRatioWorkflow").Inc()
	workflowOptions := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: c.cfg.TaskQueue,
	}
	return c.client.ExecuteWorkflow(ctx, workflowOptions, CalculateLossRatioWorkflow, time.Now())
}

// --- Workflows ---

// CalculateLossRatioWorkflow orchestrates the monthly loss ratio calculation and data retention.
func CalculateLossRatioWorkflow(ctx workflow.Context, reportingMonth time.Time) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("CalculateLossRatioWorkflow started", "month", reportingMonth.Format("2006-01"))

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// 1. Calculate Loss Ratio Activity
	var lossRatio float64
	err := workflow.ExecuteActivity(ctx, CalculateLossRatioActivity, reportingMonth).Get(ctx, &lossRatio)
	if err != nil {
		logger.Error("CalculateLossRatioActivity failed", "error", err)
		return err
	}
	logger.Info("Loss Ratio calculated", "month", reportingMonth.Format("2006-01"), "ratio", lossRatio)

	// 2. Data Retention Activity (e.g., for fact_premium_calculations)
	retentionPeriod := 5 * 365 * 24 * time.Hour // 5 years
	err = workflow.ExecuteActivity(ctx, ExpireSnapshotsActivity, "fact_premium_calculations", retentionPeriod).Get(ctx, nil)
	if err != nil {
		logger.Error("ExpireSnapshotsActivity failed", "error", err)
		// This is a maintenance task, we might log and continue, but for now, we return the error.
		return err
	}
	logger.Info("Data retention executed successfully")

	return nil
}

// --- Activities ---

// CalculateLossRatioActivity simulates querying Iceberg tables, calculating the ratio, and writing the result.
func (c *Client) CalculateLossRatioActivity(ctx context.Context, reportingMonth time.Time) (float64, error) {
	// In a real scenario, this activity would:
	// 1. Initialize a new Iceberg client connection.
	// 2. Query 'fact_premium_calculations' and 'fact_claim_reserves' for the reportingMonth.
	// 3. Perform the calculation: Loss Ratio = Incurred Losses / Earned Premium.
	// 4. Write the result to 'fact_loss_ratios'.

	// Since we cannot connect to a real Iceberg catalog, we simulate the logic.
	log.Printf("Simulating loss ratio calculation for %s", reportingMonth.Format("2006-01"))
	time.Sleep(2 * time.Second) // Simulate work

	// Simulate successful write to fact_loss_ratios
	// c.icebergClient.WriteLossRatio(ctx, result)

	return 0.55, nil // Simulated loss ratio
}

// ExpireSnapshotsActivity simulates running Iceberg maintenance to enforce data retention.
func (c *Client) ExpireSnapshotsActivity(ctx context.Context, tableName string, retentionPeriod time.Duration) error {
	// In a real scenario, this activity would:
	// 1. Initialize a new Iceberg client connection.
	// 2. Load the table.
	// 3. Run the ExpireSnapshots action on the table, keeping snapshots newer than the retention period.

	// Since we cannot connect to a real Iceberg catalog, we simulate the logic.
	log.Printf("Simulating Iceberg snapshot expiration for table %s, retaining data for %s", tableName, retentionPeriod)
	time.Sleep(1 * time.Second) // Simulate work

	// Simulate success
	return nil
}
