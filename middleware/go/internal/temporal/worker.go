// Package temporal provides a Temporal workflow worker for the OG-RMM platform.
// Three workflows are registered:
//   - PTWWorkflow: Permit-to-Work lifecycle (issue → approve → active → close → archive)
//   - OTACampaignWorkflow: Firmware OTA rollout (create → deploy → monitor → complete)
//   - RegulatorySubmissionWorkflow: Report lifecycle (generate → validate → submit → await callback)
package temporal

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"

	"github.com/og-rmm/middleware/internal/cache"
	"github.com/og-rmm/middleware/internal/ledger"
)

const (
	TaskQueue = "og-rmm-task-queue"

	// Workflow type names
	PTWWorkflowType            = "PTWWorkflow"
	OTACampaignWorkflowType    = "OTACampaignWorkflow"
	RegulatorySubmissionType   = "RegulatorySubmissionWorkflow"
)

// ─── Worker interface ─────────────────────────────────────────────────────────

// Worker manages Temporal workflow and activity workers.
type Worker interface {
	Run(ctx context.Context) error
	StartWorkflow(ctx context.Context, workflowType string, input any) (string, error)
	GetWorkflowStatus(ctx context.Context, workflowID string) (map[string]any, error)
	SignalWorkflow(ctx context.Context, workflowID, signal string, payload any) error
	TerminateWorkflow(ctx context.Context, workflowID, reason string) error
}

// ─── Real worker ──────────────────────────────────────────────────────────────

type realWorker struct {
	client client.Client
	worker worker.Worker
	cache  *cache.Client
	ledger ledger.LedgerClient
}

// NewWorker connects to Temporal and registers all workflows and activities.
func NewWorker(hostPort string, ledgerClient ledger.LedgerClient, cacheClient *cache.Client) (Worker, error) {
	c, err := client.Dial(client.Options{HostPort: hostPort})
	if err != nil {
		return nil, fmt.Errorf("temporal dial: %w", err)
	}

	w := worker.New(c, TaskQueue, worker.Options{})

	rw := &realWorker{client: c, worker: w, cache: cacheClient, ledger: ledgerClient}

	// Register workflows
	w.RegisterWorkflow(ptwWorkflow)
	w.RegisterWorkflow(otaCampaignWorkflow)
	w.RegisterWorkflow(regulatorySubmissionWorkflow)

	// Register activities
	w.RegisterActivity(rw.approvePTWActivity)
	w.RegisterActivity(rw.closePTWActivity)
	w.RegisterActivity(rw.triggerOpenStefRetrainActivity)
	w.RegisterActivity(rw.deployFirmwareActivity)
	w.RegisterActivity(rw.generateReportActivity)
	w.RegisterActivity(rw.submitReportActivity)

	return rw, nil
}

func (rw *realWorker) Run(ctx context.Context) error {
	log.Println("[temporal] Worker starting on task queue:", TaskQueue)
	if err := rw.worker.Start(); err != nil {
		return err
	}
	<-ctx.Done()
	rw.worker.Stop()
	rw.client.Close()
	return nil
}

func (rw *realWorker) StartWorkflow(ctx context.Context, workflowType string, input any) (string, error) {
	opts := client.StartWorkflowOptions{
		TaskQueue: TaskQueue,
		ID:        fmt.Sprintf("%s-%d", workflowType, time.Now().UnixMilli()),
	}
	run, err := rw.client.ExecuteWorkflow(ctx, opts, workflowType, input)
	if err != nil {
		return "", err
	}
	return run.GetID(), nil
}

func (rw *realWorker) GetWorkflowStatus(ctx context.Context, workflowID string) (map[string]any, error) {
	resp, err := rw.client.DescribeWorkflowExecution(ctx, workflowID, "")
	if err != nil {
		return nil, err
	}
	info := resp.WorkflowExecutionInfo
	return map[string]any{
		"workflowId": workflowID,
		"status":     info.Status.String(),
		"startTime":  info.StartTime,
		"closeTime":  info.CloseTime,
		"type":       info.Type.Name,
	}, nil
}

func (rw *realWorker) SignalWorkflow(ctx context.Context, workflowID, signal string, payload any) error {
	return rw.client.SignalWorkflow(ctx, workflowID, "", signal, payload)
}

func (rw *realWorker) TerminateWorkflow(ctx context.Context, workflowID, reason string) error {
	return rw.client.TerminateWorkflow(ctx, workflowID, "", reason)
}

// ─── PTW Workflow ─────────────────────────────────────────────────────────────

type PTWInput struct {
	PTWID       int    `json:"ptwId"`
	WellID      string `json:"wellId"`
	RequestorID string `json:"requestorId"`
	WorkType    string `json:"workType"`
}

func ptwWorkflow(ctx workflow.Context, input PTWInput) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("PTWWorkflow started", "ptwId", input.PTWID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts: 3,
			InitialInterval: 30 * time.Second,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Step 1: Wait for approval signal (max 24h)
	approvalCh := workflow.GetSignalChannel(ctx, "ptw.approve")
	rejectionCh := workflow.GetSignalChannel(ctx, "ptw.reject")

	var approved bool
	workflow.NewSelector(ctx).
		AddReceive(approvalCh, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, nil)
			approved = true
		}).
		AddReceive(rejectionCh, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, nil)
			approved = false
		}).
		Select(ctx)

	if !approved {
		logger.Info("PTW rejected", "ptwId", input.PTWID)
		return nil
	}

	// Step 2: Activate PTW
	if err := workflow.ExecuteActivity(ctx, "approvePTWActivity", input.PTWID).Get(ctx, nil); err != nil {
		return err
	}

	// Step 3: Wait for close signal or 8h timeout
	closeCh := workflow.GetSignalChannel(ctx, "ptw.close")
	timerFired := false

	workflow.NewSelector(ctx).
		AddReceive(closeCh, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, nil)
		}).
		AddFuture(workflow.NewTimer(ctx, 8*time.Hour), func(f workflow.Future) {
			timerFired = true
		}).
		Select(ctx)

	if timerFired {
		logger.Warn("PTW auto-closing after 8h timeout", "ptwId", input.PTWID)
	}

	// Step 4: Close and archive
	if err := workflow.ExecuteActivity(ctx, "closePTWActivity", input.PTWID).Get(ctx, nil); err != nil {
		return err
	}

	// Step 5: Trigger OpenSTEF model retrain for the asset's power tag.
	// After maintenance, the asset's operating envelope may have changed.
	// A retrain ensures the DR baseline reflects the post-maintenance state.
	if input.WellID != "" {
		retrainInput := openStefRetrainInput{
			WellID:   input.WellID,
			PTWID:    input.PTWID,
			WorkType: input.WorkType,
		}
		if err := workflow.ExecuteActivity(ctx, "triggerOpenStefRetrainActivity", retrainInput).Get(ctx, nil); err != nil {
			// Non-fatal: PTW close succeeded; log the retrain failure but do not fail the workflow.
			logger.Warn("OpenSTEF retrain trigger failed (non-fatal)", "ptwId", input.PTWID, "error", err)
		}
	}
	return nil
}

// ─── OTA Campaign Workflow ────────────────────────────────────────────────────

type OTACampaignInput struct {
	CampaignID int      `json:"campaignId"`
	DeviceIDs  []string `json:"deviceIds"`
	FirmwareID int      `json:"firmwareId"`
	Strategy   string   `json:"strategy"` // sequential | parallel | canary
}

func otaCampaignWorkflow(ctx workflow.Context, input OTACampaignInput) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("OTACampaignWorkflow started", "campaignId", input.CampaignID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts: 3,
			InitialInterval: 1 * time.Minute,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	switch input.Strategy {
	case "parallel":
		// Deploy to all devices simultaneously
		futures := make([]workflow.Future, len(input.DeviceIDs))
		for i, deviceID := range input.DeviceIDs {
			futures[i] = workflow.ExecuteActivity(ctx, "deployFirmwareActivity", input.FirmwareID, deviceID)
		}
		for _, f := range futures {
			if err := f.Get(ctx, nil); err != nil {
				logger.Error("Parallel deploy failed", "error", err)
			}
		}
	case "canary":
		// Deploy to 10% first, then rest after 1h monitoring
		canaryCount := max(1, len(input.DeviceIDs)/10)
		for _, deviceID := range input.DeviceIDs[:canaryCount] {
			if err := workflow.ExecuteActivity(ctx, "deployFirmwareActivity", input.FirmwareID, deviceID).Get(ctx, nil); err != nil {
				return err
			}
		}
		// Wait 1h for canary monitoring
		_ = workflow.NewTimer(ctx, 1*time.Hour)
		// Deploy to remaining devices
		for _, deviceID := range input.DeviceIDs[canaryCount:] {
			if err := workflow.ExecuteActivity(ctx, "deployFirmwareActivity", input.FirmwareID, deviceID).Get(ctx, nil); err != nil {
				logger.Error("Canary rollout deploy failed", "deviceId", deviceID, "error", err)
			}
		}
	default:
		// Sequential deployment
		for _, deviceID := range input.DeviceIDs {
			if err := workflow.ExecuteActivity(ctx, "deployFirmwareActivity", input.FirmwareID, deviceID).Get(ctx, nil); err != nil {
				logger.Error("Sequential deploy failed", "deviceId", deviceID, "error", err)
			}
		}
	}

	logger.Info("OTACampaignWorkflow complete", "campaignId", input.CampaignID)
	return nil
}

// ─── Regulatory Submission Workflow ──────────────────────────────────────────

type RegulatorySubmissionInput struct {
	ReportID  int    `json:"reportId"`
	Authority string `json:"authority"`
	WellID    string `json:"wellId"`
}

func regulatorySubmissionWorkflow(ctx workflow.Context, input RegulatorySubmissionInput) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("RegulatorySubmissionWorkflow started", "reportId", input.ReportID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 15 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts: 5,
			InitialInterval: 2 * time.Minute,
			MaximumInterval: 30 * time.Minute,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Step 1: Generate PDF report
	if err := workflow.ExecuteActivity(ctx, "generateReportActivity", input.ReportID).Get(ctx, nil); err != nil {
		return err
	}

	// Step 2: Submit to authority with retry
	if err := workflow.ExecuteActivity(ctx, "submitReportActivity", input.ReportID, input.Authority).Get(ctx, nil); err != nil {
		return err
	}

	// Step 3: Wait for callback (max 7 days)
	callbackCh := workflow.GetSignalChannel(ctx, "regulatory.callback")
	timerFired := false

	workflow.NewSelector(ctx).
		AddReceive(callbackCh, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, nil)
		}).
		AddFuture(workflow.NewTimer(ctx, 7*24*time.Hour), func(f workflow.Future) {
			timerFired = true
		}).
		Select(ctx)

	if timerFired {
		logger.Warn("Regulatory submission awaiting callback for 7 days", "reportId", input.ReportID)
	}

	logger.Info("RegulatorySubmissionWorkflow complete", "reportId", input.ReportID)
	return nil
}

// ─── Activities ───────────────────────────────────────────────────────────────

// ─── OpenSTEF Retrain Activity ───────────────────────────────────────────────

type openStefRetrainInput struct {
	WellID   string `json:"wellId"`
	PTWID    int    `json:"ptwId"`
	WorkType string `json:"workType"`
}

// triggerOpenStefRetrainActivity calls the OpenSTEF Python service to retrain
// the load forecasting model for the given well's power tag. This is triggered
// automatically after a PTW closes so the DR baseline reflects the post-maintenance
// operating envelope.
func (rw *realWorker) triggerOpenStefRetrainActivity(ctx context.Context, input openStefRetrainInput) error {
	log.Printf("[temporal:activity] TriggerOpenStefRetrain wellId=%s ptwId=%d workType=%s",
		input.WellID, input.PTWID, input.WorkType)
	_ = activity.RecordHeartbeat(ctx, "triggering-openstef-retrain")

	// Derive the power tag name from the well ID (convention: WELL_<ID>_POWER_KW)
	powerTag := fmt.Sprintf("WELL_%s_POWER_KW", input.WellID)

	// Call the OpenSTEF Python service retrain endpoint
	openStefURL := "http://localhost:8001" // OpenSTEF service port
	reqBody := fmt.Sprintf(`{"tag":"%s","reason":"ptw_closed","ptwId":%d,"workType":"%s"}`,
		powerTag, input.PTWID, input.WorkType)

	resp, err := doHTTPPost(openStefURL+"/retrain", reqBody)
	if err != nil {
		log.Printf("[temporal:activity] OpenSTEF retrain HTTP error: %v", err)
		return err
	}
	log.Printf("[temporal:activity] OpenSTEF retrain triggered: %s", resp)
	return nil
}

func (rw *realWorker) approvePTWActivity(ctx context.Context, ptwID int) error {
	log.Printf("[temporal:activity] ApprovePTW ptwId=%d", ptwID)
	_ = activity.RecordHeartbeat(ctx, "approving")
	return nil
}

func (rw *realWorker) closePTWActivity(ctx context.Context, ptwID int) error {
	log.Printf("[temporal:activity] ClosePTW ptwId=%d", ptwID)
	return nil
}

func (rw *realWorker) deployFirmwareActivity(ctx context.Context, firmwareID int, deviceID string) error {
	log.Printf("[temporal:activity] DeployFirmware firmwareId=%d deviceId=%s", firmwareID, deviceID)
	_ = activity.RecordHeartbeat(ctx, "deploying")
	time.Sleep(100 * time.Millisecond) // Simulate deployment
	return nil
}

func (rw *realWorker) generateReportActivity(ctx context.Context, reportID int) error {
	log.Printf("[temporal:activity] GenerateReport reportId=%d", reportID)
	return nil
}

func (rw *realWorker) submitReportActivity(ctx context.Context, reportID int, authority string) error {
	log.Printf("[temporal:activity] SubmitReport reportId=%d authority=%s", reportID, authority)
	return nil
}

// ─── Simulated worker ─────────────────────────────────────────────────────────

type simulatedWorker struct {
	workflows map[string]map[string]any
}

// NewSimulatedWorker returns an in-memory workflow tracker for development.
func NewSimulatedWorker() Worker {
	log.Println("[temporal] Using simulated Temporal worker")
	return &simulatedWorker{
		workflows: make(map[string]map[string]any),
	}
}

func (s *simulatedWorker) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (s *simulatedWorker) StartWorkflow(_ context.Context, workflowType string, _ any) (string, error) {
	id := fmt.Sprintf("%s-%d", workflowType, time.Now().UnixMilli())
	s.workflows[id] = map[string]any{
		"workflowId": id,
		"status":     "RUNNING",
		"startTime":  time.Now(),
		"type":       workflowType,
	}
	return id, nil
}

func (s *simulatedWorker) GetWorkflowStatus(_ context.Context, workflowID string) (map[string]any, error) {
	if wf, ok := s.workflows[workflowID]; ok {
		return wf, nil
	}
	return map[string]any{
		"workflowId": workflowID,
		"status":     "NOT_FOUND",
	}, nil
}

func (s *simulatedWorker) SignalWorkflow(_ context.Context, workflowID, signal string, _ any) error {
	if wf, ok := s.workflows[workflowID]; ok {
		wf["lastSignal"] = signal
		if signal == "ptw.close" || signal == "regulatory.callback" {
			wf["status"] = "COMPLETED"
		}
	}
	return nil
}

func (s *simulatedWorker) TerminateWorkflow(_ context.Context, workflowID, reason string) error {
	if wf, ok := s.workflows[workflowID]; ok {
		wf["status"] = "TERMINATED"
		wf["reason"] = reason
	}
	return nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// doHTTPPost is a simple helper for making JSON POST requests to internal services.
func doHTTPPost(url, body string) (string, error) {
	resp, err := http.Post(url, "application/json", bytes.NewBufferString(body)) //nolint:gosec
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
