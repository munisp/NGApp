package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/workflow"
)

type TemporalClient struct {
	client    client.Client
	taskQueue string
}

type ReconciliationWorkflowInput struct {
	JobID              string                 `json:"job_id"`
	JobName            string                 `json:"job_name"`
	ReconciliationType string                 `json:"reconciliation_type"`
	SourceSystem       string                 `json:"source_system"`
	TargetSystem       string                 `json:"target_system"`
	PeriodStart        time.Time              `json:"period_start"`
	PeriodEnd          time.Time              `json:"period_end"`
	Config             map[string]interface{} `json:"config"`
}

type ReconciliationWorkflowOutput struct {
	JobID            string    `json:"job_id"`
	Status           string    `json:"status"`
	TotalRecords     int       `json:"total_records"`
	MatchedRecords   int       `json:"matched_records"`
	UnmatchedRecords int       `json:"unmatched_records"`
	TotalVariance    float64   `json:"total_variance"`
	MatchRate        float64   `json:"match_rate"`
	CompletedAt      time.Time `json:"completed_at"`
	ErrorMessage     string    `json:"error_message,omitempty"`
}

type StatementProcessingInput struct {
	StatementID   string `json:"statement_id"`
	BankCode      string `json:"bank_code"`
	AccountNumber string `json:"account_number"`
	FilePath      string `json:"file_path"`
	FileFormat    string `json:"file_format"`
}

type MatchingActivityInput struct {
	JobID        string  `json:"job_id"`
	SourceRef    string  `json:"source_ref"`
	SourceAmount float64 `json:"source_amount"`
	SourceData   string  `json:"source_data"`
}

type MatchingActivityOutput struct {
	ItemID          string  `json:"item_id"`
	MatchStatus     string  `json:"match_status"`
	MatchConfidence float64 `json:"match_confidence"`
	TargetRef       string  `json:"target_ref"`
	TargetAmount    float64 `json:"target_amount"`
	Variance        float64 `json:"variance"`
}

const (
	ReconciliationTaskQueue      = "reconciliation-task-queue"
	ReconciliationWorkflowType   = "ReconciliationWorkflow"
	StatementProcessingWorkflow  = "StatementProcessingWorkflow"
	ScheduledReconciliationWF    = "ScheduledReconciliationWorkflow"
)

func NewTemporalClient(hostPort string, namespace string) (*TemporalClient, error) {
	c, err := client.Dial(client.Options{
		HostPort:  hostPort,
		Namespace: namespace,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create temporal client: %w", err)
	}

	return &TemporalClient{
		client:    c,
		taskQueue: ReconciliationTaskQueue,
	}, nil
}

func (t *TemporalClient) StartReconciliationWorkflow(ctx context.Context, input *ReconciliationWorkflowInput) (string, error) {
	workflowID := fmt.Sprintf("reconciliation-%s-%s", input.JobID, uuid.New().String()[:8])

	options := client.StartWorkflowOptions{
		ID:                    workflowID,
		TaskQueue:             t.taskQueue,
		WorkflowRunTimeout:    24 * time.Hour,
		WorkflowTaskTimeout:   10 * time.Minute,
		RetryPolicy: &client.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}

	we, err := t.client.ExecuteWorkflow(ctx, options, ReconciliationWorkflowType, input)
	if err != nil {
		return "", fmt.Errorf("failed to start reconciliation workflow: %w", err)
	}

	return we.GetID(), nil
}

func (t *TemporalClient) StartStatementProcessingWorkflow(ctx context.Context, input *StatementProcessingInput) (string, error) {
	workflowID := fmt.Sprintf("statement-%s-%s", input.StatementID, uuid.New().String()[:8])

	options := client.StartWorkflowOptions{
		ID:                 workflowID,
		TaskQueue:          t.taskQueue,
		WorkflowRunTimeout: 1 * time.Hour,
	}

	we, err := t.client.ExecuteWorkflow(ctx, options, StatementProcessingWorkflow, input)
	if err != nil {
		return "", fmt.Errorf("failed to start statement processing workflow: %w", err)
	}

	return we.GetID(), nil
}

func (t *TemporalClient) ScheduleReconciliation(ctx context.Context, scheduleID string, cronSchedule string, input *ReconciliationWorkflowInput) error {
	_, err := t.client.ScheduleClient().Create(ctx, client.ScheduleOptions{
		ID: scheduleID,
		Spec: client.ScheduleSpec{
			CronExpressions: []string{cronSchedule},
		},
		Action: &client.ScheduleWorkflowAction{
			ID:        fmt.Sprintf("scheduled-reconciliation-%s", scheduleID),
			Workflow:  ScheduledReconciliationWF,
			TaskQueue: t.taskQueue,
			Args:      []interface{}{input},
		},
	})
	return err
}

func (t *TemporalClient) GetWorkflowStatus(ctx context.Context, workflowID string) (*ReconciliationWorkflowOutput, error) {
	desc, err := t.client.DescribeWorkflowExecution(ctx, workflowID, "")
	if err != nil {
		return nil, fmt.Errorf("failed to describe workflow: %w", err)
	}

	output := &ReconciliationWorkflowOutput{
		JobID:  workflowID,
		Status: desc.WorkflowExecutionInfo.Status.String(),
	}

	return output, nil
}

func (t *TemporalClient) CancelWorkflow(ctx context.Context, workflowID string) error {
	return t.client.CancelWorkflow(ctx, workflowID, "")
}

func (t *TemporalClient) SignalWorkflow(ctx context.Context, workflowID string, signalName string, signalArg interface{}) error {
	return t.client.SignalWorkflow(ctx, workflowID, "", signalName, signalArg)
}

func (t *TemporalClient) Close() {
	if t.client != nil {
		t.client.Close()
	}
}

func ReconciliationWorkflowDefinition(ctx workflow.Context, input *ReconciliationWorkflowInput) (*ReconciliationWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting reconciliation workflow", "jobID", input.JobID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var fetchSourceResult struct {
		Records []map[string]interface{} `json:"records"`
		Count   int                      `json:"count"`
	}
	err := workflow.ExecuteActivity(ctx, "FetchSourceRecords", input).Get(ctx, &fetchSourceResult)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch source records: %w", err)
	}

	var fetchTargetResult struct {
		Records []map[string]interface{} `json:"records"`
		Count   int                      `json:"count"`
	}
	err = workflow.ExecuteActivity(ctx, "FetchTargetRecords", input).Get(ctx, &fetchTargetResult)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch target records: %w", err)
	}

	var matchResult struct {
		MatchedCount   int     `json:"matched_count"`
		UnmatchedCount int     `json:"unmatched_count"`
		TotalVariance  float64 `json:"total_variance"`
	}
	err = workflow.ExecuteActivity(ctx, "PerformMatching", input.JobID, fetchSourceResult.Records, fetchTargetResult.Records).Get(ctx, &matchResult)
	if err != nil {
		return nil, fmt.Errorf("failed to perform matching: %w", err)
	}

	err = workflow.ExecuteActivity(ctx, "GenerateReconciliationReport", input.JobID).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to generate report", "error", err)
	}

	totalRecords := fetchSourceResult.Count
	matchRate := float64(0)
	if totalRecords > 0 {
		matchRate = float64(matchResult.MatchedCount) / float64(totalRecords) * 100
	}

	output := &ReconciliationWorkflowOutput{
		JobID:            input.JobID,
		Status:           "COMPLETED",
		TotalRecords:     totalRecords,
		MatchedRecords:   matchResult.MatchedCount,
		UnmatchedRecords: matchResult.UnmatchedCount,
		TotalVariance:    matchResult.TotalVariance,
		MatchRate:        matchRate,
		CompletedAt:      workflow.Now(ctx),
	}

	return output, nil
}
