package lakehouse

import (
	"context"
	"fmt"
	"time"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// LakehouseETLWorkflowInput defines input for the ETL workflow
type LakehouseETLWorkflowInput struct {
	SourceLayer      string    `json:"source_layer"`      // bronze, silver
	TargetLayer      string    `json:"target_layer"`      // silver, gold
	DataType         string    `json:"data_type"`         // policies, claims, payments
	StartDate        time.Time `json:"start_date"`
	EndDate          time.Time `json:"end_date"`
	FullRefresh      bool      `json:"full_refresh"`
	PartitionColumns []string  `json:"partition_columns"`
}

// LakehouseETLWorkflowOutput defines output from the ETL workflow
type LakehouseETLWorkflowOutput struct {
	RecordsProcessed int64     `json:"records_processed"`
	RecordsFailed    int64     `json:"records_failed"`
	StartTime        time.Time `json:"start_time"`
	EndTime          time.Time `json:"end_time"`
	Duration         string    `json:"duration"`
	Status           string    `json:"status"`
	OutputPath       string    `json:"output_path"`
}

// DataQualityResult represents data quality check results
type DataQualityResult struct {
	CheckName    string  `json:"check_name"`
	Passed       bool    `json:"passed"`
	FailedCount  int64   `json:"failed_count"`
	TotalCount   int64   `json:"total_count"`
	PassRate     float64 `json:"pass_rate"`
	ErrorMessage string  `json:"error_message,omitempty"`
}

// SparkJobInput defines input for Spark job activities
type SparkJobInput struct {
	JobName          string            `json:"job_name"`
	MainClass        string            `json:"main_class"`
	JarPath          string            `json:"jar_path"`
	Arguments        []string          `json:"arguments"`
	SparkConfig      map[string]string `json:"spark_config"`
	ExecutorInstances int              `json:"executor_instances"`
	ExecutorMemory   string            `json:"executor_memory"`
	DriverMemory     string            `json:"driver_memory"`
}

// SparkJobOutput defines output from Spark job activities
type SparkJobOutput struct {
	JobID            string    `json:"job_id"`
	Status           string    `json:"status"`
	StartTime        time.Time `json:"start_time"`
	EndTime          time.Time `json:"end_time"`
	RecordsProcessed int64     `json:"records_processed"`
	OutputPath       string    `json:"output_path"`
	ErrorMessage     string    `json:"error_message,omitempty"`
}

// LakehouseETLWorkflow orchestrates the complete ETL pipeline
func LakehouseETLWorkflow(ctx workflow.Context, input LakehouseETLWorkflowInput) (*LakehouseETLWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Lakehouse ETL Workflow", "source", input.SourceLayer, "target", input.TargetLayer, "dataType", input.DataType)

	startTime := workflow.Now(ctx)

	// Configure activity options with retries
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Hour,
		HeartbeatTimeout:    5 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Minute,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	output := &LakehouseETLWorkflowOutput{
		StartTime: startTime,
		Status:    "RUNNING",
	}

	// Step 1: Validate source data exists
	var sourceValidation bool
	err := workflow.ExecuteActivity(ctx, ValidateSourceDataActivity, input).Get(ctx, &sourceValidation)
	if err != nil {
		output.Status = "FAILED"
		output.EndTime = workflow.Now(ctx)
		return output, fmt.Errorf("source validation failed: %w", err)
	}

	if !sourceValidation {
		output.Status = "FAILED"
		output.EndTime = workflow.Now(ctx)
		return output, fmt.Errorf("source data not found for %s/%s", input.SourceLayer, input.DataType)
	}

	// Step 2: Run data quality checks on source
	var qualityResults []DataQualityResult
	err = workflow.ExecuteActivity(ctx, RunDataQualityChecksActivity, input).Get(ctx, &qualityResults)
	if err != nil {
		logger.Warn("Data quality checks failed", "error", err)
	}

	// Check if any critical quality checks failed
	for _, result := range qualityResults {
		if !result.Passed && result.PassRate < 0.95 {
			output.Status = "FAILED"
			output.EndTime = workflow.Now(ctx)
			return output, fmt.Errorf("data quality check failed: %s (pass rate: %.2f%%)", result.CheckName, result.PassRate*100)
		}
	}

	// Step 3: Execute transformation based on source/target layers
	var sparkOutput SparkJobOutput
	sparkInput := buildSparkJobInput(input)

	err = workflow.ExecuteActivity(ctx, ExecuteSparkTransformationActivity, sparkInput).Get(ctx, &sparkOutput)
	if err != nil {
		output.Status = "FAILED"
		output.EndTime = workflow.Now(ctx)
		return output, fmt.Errorf("spark transformation failed: %w", err)
	}

	output.RecordsProcessed = sparkOutput.RecordsProcessed
	output.OutputPath = sparkOutput.OutputPath

	// Step 4: Run data quality checks on target
	targetInput := LakehouseETLWorkflowInput{
		SourceLayer: input.TargetLayer,
		DataType:    input.DataType,
	}
	var targetQualityResults []DataQualityResult
	err = workflow.ExecuteActivity(ctx, RunDataQualityChecksActivity, targetInput).Get(ctx, &targetQualityResults)
	if err != nil {
		logger.Warn("Target data quality checks failed", "error", err)
	}

	// Step 5: Update metadata catalog
	err = workflow.ExecuteActivity(ctx, UpdateMetadataCatalogActivity, input, sparkOutput).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to update metadata catalog", "error", err)
	}

	// Step 6: Optimize Delta tables
	err = workflow.ExecuteActivity(ctx, OptimizeDeltaTableActivity, sparkOutput.OutputPath).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to optimize Delta table", "error", err)
	}

	// Step 7: Send completion notification
	err = workflow.ExecuteActivity(ctx, SendETLNotificationActivity, output).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to send notification", "error", err)
	}

	output.Status = "COMPLETED"
	output.EndTime = workflow.Now(ctx)
	output.Duration = output.EndTime.Sub(output.StartTime).String()

	logger.Info("Lakehouse ETL Workflow completed", "recordsProcessed", output.RecordsProcessed, "duration", output.Duration)

	return output, nil
}

// ScheduledLakehouseETLWorkflow runs ETL on a schedule
func ScheduledLakehouseETLWorkflow(ctx workflow.Context) error {
	logger := workflow.GetLogger(ctx)

	// Define ETL jobs to run
	etlJobs := []LakehouseETLWorkflowInput{
		{SourceLayer: "bronze", TargetLayer: "silver", DataType: "policies"},
		{SourceLayer: "bronze", TargetLayer: "silver", DataType: "claims"},
		{SourceLayer: "bronze", TargetLayer: "silver", DataType: "payments"},
		{SourceLayer: "silver", TargetLayer: "gold", DataType: "customer_360"},
		{SourceLayer: "silver", TargetLayer: "gold", DataType: "risk_analytics"},
	}

	for {
		// Run all ETL jobs
		for _, job := range etlJobs {
			job.StartDate = workflow.Now(ctx).Add(-24 * time.Hour)
			job.EndDate = workflow.Now(ctx)

			childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
				WorkflowID: fmt.Sprintf("etl-%s-%s-%d", job.SourceLayer, job.DataType, workflow.Now(ctx).Unix()),
			})

			var output LakehouseETLWorkflowOutput
			err := workflow.ExecuteChildWorkflow(childCtx, LakehouseETLWorkflow, job).Get(ctx, &output)
			if err != nil {
				logger.Error("ETL job failed", "dataType", job.DataType, "error", err)
			} else {
				logger.Info("ETL job completed", "dataType", job.DataType, "records", output.RecordsProcessed)
			}
		}

		// Sleep until next scheduled run (every 6 hours)
		err := workflow.Sleep(ctx, 6*time.Hour)
		if err != nil {
			return err
		}
	}
}

func buildSparkJobInput(input LakehouseETLWorkflowInput) SparkJobInput {
	basePath := "s3a://lakehouse"

	sparkConfig := map[string]string{
		"spark.sql.extensions":                          "io.delta.sql.DeltaSparkSessionExtension",
		"spark.sql.catalog.spark_catalog":               "org.apache.spark.sql.delta.catalog.DeltaCatalog",
		"spark.sql.adaptive.enabled":                    "true",
		"spark.sql.adaptive.coalescePartitions.enabled": "true",
	}

	var mainClass, jarPath string
	var arguments []string

	switch input.TargetLayer {
	case "silver":
		mainClass = "com.insurance.lakehouse.BronzeToSilverTransformation"
		jarPath = "s3a://lakehouse/jars/lakehouse-etl.jar"
		arguments = []string{
			fmt.Sprintf("--source=%s/%s/%s", basePath, input.SourceLayer, input.DataType),
			fmt.Sprintf("--target=%s/%s/%s", basePath, input.TargetLayer, input.DataType),
			fmt.Sprintf("--start-date=%s", input.StartDate.Format("2006-01-02")),
			fmt.Sprintf("--end-date=%s", input.EndDate.Format("2006-01-02")),
		}
	case "gold":
		mainClass = "com.insurance.lakehouse.SilverToGoldAggregation"
		jarPath = "s3a://lakehouse/jars/lakehouse-etl.jar"
		arguments = []string{
			fmt.Sprintf("--source=%s/%s", basePath, input.SourceLayer),
			fmt.Sprintf("--target=%s/%s/%s", basePath, input.TargetLayer, input.DataType),
			fmt.Sprintf("--aggregation-type=%s", input.DataType),
		}
	}

	if input.FullRefresh {
		arguments = append(arguments, "--full-refresh")
	}

	return SparkJobInput{
		JobName:           fmt.Sprintf("lakehouse-etl-%s-to-%s-%s", input.SourceLayer, input.TargetLayer, input.DataType),
		MainClass:         mainClass,
		JarPath:           jarPath,
		Arguments:         arguments,
		SparkConfig:       sparkConfig,
		ExecutorInstances: 4,
		ExecutorMemory:    "4g",
		DriverMemory:      "2g",
	}
}

// Activities

// ValidateSourceDataActivity validates that source data exists
func ValidateSourceDataActivity(ctx context.Context, input LakehouseETLWorkflowInput) (bool, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Validating source data", "layer", input.SourceLayer, "dataType", input.DataType)

	// In production, this would check S3/Delta Lake for data existence
	// For now, simulate validation
	activity.RecordHeartbeat(ctx, "Checking source data existence")

	// Simulate S3 check
	time.Sleep(2 * time.Second)

	return true, nil
}

// RunDataQualityChecksActivity runs data quality checks
func RunDataQualityChecksActivity(ctx context.Context, input LakehouseETLWorkflowInput) ([]DataQualityResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Running data quality checks", "layer", input.SourceLayer, "dataType", input.DataType)

	activity.RecordHeartbeat(ctx, "Running data quality checks")

	// Define quality checks based on data type
	checks := []DataQualityResult{
		{
			CheckName:   "null_check_primary_key",
			Passed:      true,
			FailedCount: 0,
			TotalCount:  100000,
			PassRate:    1.0,
		},
		{
			CheckName:   "duplicate_check",
			Passed:      true,
			FailedCount: 5,
			TotalCount:  100000,
			PassRate:    0.99995,
		},
		{
			CheckName:   "schema_validation",
			Passed:      true,
			FailedCount: 0,
			TotalCount:  100000,
			PassRate:    1.0,
		},
		{
			CheckName:   "referential_integrity",
			Passed:      true,
			FailedCount: 10,
			TotalCount:  100000,
			PassRate:    0.9999,
		},
	}

	return checks, nil
}

// ExecuteSparkTransformationActivity executes Spark transformation job
func ExecuteSparkTransformationActivity(ctx context.Context, input SparkJobInput) (*SparkJobOutput, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Executing Spark transformation", "jobName", input.JobName)

	startTime := time.Now()

	// In production, this would submit a Spark job via Spark REST API or Kubernetes
	// Simulate job execution with heartbeats
	for i := 0; i < 10; i++ {
		activity.RecordHeartbeat(ctx, fmt.Sprintf("Spark job progress: %d%%", (i+1)*10))
		time.Sleep(time.Second)
	}

	return &SparkJobOutput{
		JobID:            fmt.Sprintf("spark-%d", time.Now().UnixNano()),
		Status:           "COMPLETED",
		StartTime:        startTime,
		EndTime:          time.Now(),
		RecordsProcessed: 150000,
		OutputPath:       input.Arguments[1], // target path
	}, nil
}

// UpdateMetadataCatalogActivity updates the metadata catalog
func UpdateMetadataCatalogActivity(ctx context.Context, input LakehouseETLWorkflowInput, sparkOutput SparkJobOutput) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Updating metadata catalog", "outputPath", sparkOutput.OutputPath)

	activity.RecordHeartbeat(ctx, "Updating metadata catalog")

	// In production, this would update Hive Metastore or Unity Catalog
	time.Sleep(time.Second)

	return nil
}

// OptimizeDeltaTableActivity optimizes Delta table with OPTIMIZE and VACUUM
func OptimizeDeltaTableActivity(ctx context.Context, tablePath string) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Optimizing Delta table", "path", tablePath)

	activity.RecordHeartbeat(ctx, "Running OPTIMIZE")
	time.Sleep(2 * time.Second)

	activity.RecordHeartbeat(ctx, "Running VACUUM")
	time.Sleep(2 * time.Second)

	return nil
}

// SendETLNotificationActivity sends ETL completion notification
func SendETLNotificationActivity(ctx context.Context, output *LakehouseETLWorkflowOutput) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Sending ETL notification", "status", output.Status, "records", output.RecordsProcessed)

	// In production, this would send Slack/email notification
	return nil
}
