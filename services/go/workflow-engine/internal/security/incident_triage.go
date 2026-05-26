// Package security implements the IEC 62443 §21.2 IncidentTriageWorkflow.
//
// The workflow executes 4 sequential activities:
//
//  1. FetchOpenCTIData     — Query OpenCTI for threat indicators matching the source IP.
//     Determines severity score (0-100) and TLP classification.
//
//  2. AssessSeverity       — Apply OT-specific severity rules:
//     - Score ≥ 80 → CRITICAL (immediate isolation, IEC 62443 Zone 3/4 breach)
//     - Score ≥ 60 → HIGH     (isolate + alert SOC)
//     - Score ≥ 40 → MEDIUM   (alert SOC, increase monitoring)
//     - Score < 40 → LOW      (log and monitor)
//
//  3. IsolateNodeActivity  — For CRITICAL/HIGH: apply Kubernetes NetworkPolicy quarantine
//     and disable the device in the platform DB. Skipped for MEDIUM/LOW.
//
//  4. CreateIncidentAlert  — Send Alertmanager-format alert to Grafana OnCall.
//     OnCall routes to the on-call security engineer via escalation policy.
//
// Re-admission: A separate ReAdmitNodeWorkflow reverses isolation after the
// security team confirms clearance via the Cybersecurity dashboard.
package security

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"

	"github.com/og-rmm/workflow-engine/internal/isolation"
	"github.com/og-rmm/workflow-engine/internal/opencti"
	oncall "github.com/og-rmm/workflow-engine/internal/pagerduty"
)

// ─── Constants ────────────────────────────────────────────────────────────────

const (
	TaskQueue                    = "og-rmm-security-task-queue"
	IncidentTriageWorkflowType   = "IncidentTriageWorkflow"
	ReAdmitNodeWorkflowType      = "ReAdmitNodeWorkflow"
)

// ─── Input/Output types ───────────────────────────────────────────────────────

// IncidentTriageInput is the input to the IncidentTriageWorkflow.
type IncidentTriageInput struct {
	EventID     string `json:"event_id"`
	EventType   string `json:"event_type"`   // e.g. "INTRUSION_ATTEMPT", "MALWARE_DETECTED"
	Severity    string `json:"severity"`     // Initial severity from the security event
	SourceIP    string `json:"source_ip"`
	TargetNode  string `json:"target_node"`  // Kubernetes node name or device ID
	Namespace   string `json:"namespace"`    // Kubernetes namespace of the affected node
	Description string `json:"description"`
	IEC62443Zone string `json:"iec62443_zone"` // e.g. "Zone 3", "Zone 4"
}

// IncidentTriageResult is the output of the IncidentTriageWorkflow.
type IncidentTriageResult struct {
	EventID         string    `json:"event_id"`
	FinalSeverity   string    `json:"final_severity"`
	OpenCTIScore    int       `json:"opencti_score"`
	TLPClassification string  `json:"tlp_classification"`
	NodeIsolated    bool      `json:"node_isolated"`
	NetworkPolicyID string    `json:"network_policy_id,omitempty"`
	AlertGroupID    string    `json:"alert_group_id"`
	RecommendedAction string  `json:"recommended_action"`
	CompletedAt     time.Time `json:"completed_at"`
}

// ReAdmitInput is the input to the ReAdmitNodeWorkflow.
type ReAdmitInput struct {
	EventID   string `json:"event_id"`
	NodeID    string `json:"node_id"`
	Namespace string `json:"namespace"`
	ClearedBy string `json:"cleared_by"` // user ID who approved re-admission
}

// ─── Activities ───────────────────────────────────────────────────────────────

// Activities holds the dependencies for all security workflow activities.
type Activities struct {
	openCTI  *opencti.Client
	oncall   *oncall.Client
	isolator *isolation.Isolator
}

// NewActivities creates a new Activities instance with all dependencies injected.
func NewActivities(openCTI *opencti.Client, onCall *oncall.Client, iso *isolation.Isolator) *Activities {
	return &Activities{
		openCTI:  openCTI,
		oncall:   onCall,
		isolator: iso,
	}
}

// FetchOpenCTIData queries OpenCTI for threat intelligence about the source IP.
// Returns the IncidentContext with severity score, TLP, and matched indicators.
func (a *Activities) FetchOpenCTIData(ctx context.Context, input IncidentTriageInput) (*opencti.IncidentContext, error) {
	_ = activity.RecordHeartbeat(ctx, "fetching-opencti-data")
	slog.Info("[activity:FetchOpenCTIData] Querying OpenCTI", "sourceIP", input.SourceIP, "eventId", input.EventID)

	ctx2, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	ctx2 = activity.GetWorkerStopChannel(ctx2) // propagate worker stop

	incidentCtx, err := a.openCTI.BuildIncidentContext(ctx2, input.SourceIP, input.EventType)
	if err != nil {
		// Non-fatal: if OpenCTI is unreachable, continue with zero score
		slog.Warn("[activity:FetchOpenCTIData] OpenCTI unreachable, using zero score", "err", err)
		return &opencti.IncidentContext{
			SeverityScore:     0,
			TLPID:             "TLP:WHITE",
			RecommendedAction: "Monitor and log (OpenCTI unavailable)",
		}, nil
	}

	slog.Info("[activity:FetchOpenCTIData] OpenCTI context built",
		"score", incidentCtx.SeverityScore,
		"tlp", incidentCtx.TLPID,
		"indicators", len(incidentCtx.MatchedIndicators),
	)
	return incidentCtx, nil
}

// IsolateNodeActivity applies network and device isolation to a compromised node.
// Only called for CRITICAL and HIGH severity incidents.
func (a *Activities) IsolateNodeActivity(ctx context.Context, input IncidentTriageInput, score int) (*isolation.IsolationResult, error) {
	_ = activity.RecordHeartbeat(ctx, "isolating-node")
	slog.Info("[activity:IsolateNode] Applying isolation", "nodeId", input.TargetNode, "score", score)

	mode := isolation.ModeFull
	if score < 80 {
		mode = isolation.ModeNetwork // For HIGH (60-79), network isolation only
	}

	result, err := a.isolator.IsolateNode(ctx, isolation.IsolationRequest{
		EventID:     input.EventID,
		NodeID:      input.TargetNode,
		Namespace:   input.Namespace,
		IPAddress:   input.SourceIP,
		Mode:        mode,
		Reason:      fmt.Sprintf("IEC 62443 §21.2 automated triage: %s (score=%d)", input.EventType, score),
		TriggeredBy: "og-rmm-workflow-engine",
	})
	if err != nil {
		return nil, fmt.Errorf("node isolation failed: %w", err)
	}

	slog.Info("[activity:IsolateNode] Node isolated",
		"nodeId", input.TargetNode,
		"policyId", result.NetworkPolicyID,
		"deviceDisabled", result.DeviceDisabled,
	)
	return result, nil
}

// CreateIncidentAlert sends an alert to Grafana OnCall for the security incident.
// Returns the OnCall alert group ID for tracking.
func (a *Activities) CreateIncidentAlert(ctx context.Context, input IncidentTriageInput, incidentCtx *opencti.IncidentContext, isolated bool) (string, error) {
	_ = activity.RecordHeartbeat(ctx, "creating-incident-alert")
	slog.Info("[activity:CreateIncidentAlert] Sending alert to Grafana OnCall", "eventId", input.EventID)

	severity := oncall.MapSeverityFromScore(incidentCtx.SeverityScore)

	summary := fmt.Sprintf("[%s] %s — %s (IEC 62443 %s)",
		input.IEC62443Zone, input.EventType, input.TargetNode, input.Severity)

	details := map[string]string{
		"event_id":           input.EventID,
		"event_type":         input.EventType,
		"source_ip":          input.SourceIP,
		"target_node":        input.TargetNode,
		"iec62443_zone":      input.IEC62443Zone,
		"opencti_score":      fmt.Sprintf("%d", incidentCtx.SeverityScore),
		"tlp":                incidentCtx.TLPID,
		"node_isolated":      fmt.Sprintf("%v", isolated),
		"recommended_action": incidentCtx.RecommendedAction,
		"indicators_matched": fmt.Sprintf("%d", len(incidentCtx.MatchedIndicators)),
	}

	alertGroupID, err := a.oncall.TriggerIncident(ctx, input.EventID, summary, input.SourceIP, severity, details)
	if err != nil {
		slog.Warn("[activity:CreateIncidentAlert] Grafana OnCall alert failed (non-fatal)", "err", err)
		return fmt.Sprintf("og-rmm-security-%s", input.EventID), nil
	}

	slog.Info("[activity:CreateIncidentAlert] Alert sent", "alertGroupId", alertGroupID)
	return alertGroupID, nil
}

// ReAdmitNodeActivity reverses node isolation after security clearance.
func (a *Activities) ReAdmitNodeActivity(ctx context.Context, input ReAdmitInput) error {
	_ = activity.RecordHeartbeat(ctx, "readmitting-node")
	slog.Info("[activity:ReAdmitNode] Reversing isolation", "nodeId", input.NodeID, "clearedBy", input.ClearedBy)

	if err := a.isolator.ReAdmitNode(ctx, input.NodeID, input.Namespace, input.EventID); err != nil {
		return fmt.Errorf("re-admit node: %w", err)
	}

	// Resolve the OnCall alert
	if err := a.oncall.ResolveIncident(ctx, input.EventID, input.NodeID); err != nil {
		slog.Warn("[activity:ReAdmitNode] OnCall resolve failed (non-fatal)", "err", err)
	}

	slog.Info("[activity:ReAdmitNode] Node re-admitted", "nodeId", input.NodeID)
	return nil
}

// ─── Workflows ────────────────────────────────────────────────────────────────

// IncidentTriageWorkflow is the main security incident triage workflow.
// It orchestrates the 4 activities in sequence with retry and timeout policies.
func IncidentTriageWorkflow(ctx workflow.Context, input IncidentTriageInput) (*IncidentTriageResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("IncidentTriageWorkflow started", "eventId", input.EventID, "eventType", input.EventType)

	// Activity options: 3 retries, 30s timeout per activity
	activityOpts := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts:    3,
			BackoffCoefficient: 2.0,
			InitialInterval:    2 * time.Second,
			MaximumInterval:    30 * time.Second,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOpts)

	result := &IncidentTriageResult{
		EventID:     input.EventID,
		CompletedAt: workflow.Now(ctx),
	}

	// ── Step 1: Fetch OpenCTI threat intelligence ─────────────────────────────
	var incidentCtx opencti.IncidentContext
	if err := workflow.ExecuteActivity(ctx, "FetchOpenCTIData", input).Get(ctx, &incidentCtx); err != nil {
		logger.Error("FetchOpenCTIData failed", "err", err)
		// Non-fatal: continue with zero score
		incidentCtx = opencti.IncidentContext{
			SeverityScore:     0,
			TLPID:             "TLP:WHITE",
			RecommendedAction: "Monitor and log",
		}
	}

	result.OpenCTIScore = incidentCtx.SeverityScore
	result.TLPClassification = incidentCtx.TLPID
	result.RecommendedAction = incidentCtx.RecommendedAction

	// ── Step 2: Assess severity ───────────────────────────────────────────────
	finalSeverity := assessSeverity(input.Severity, incidentCtx.SeverityScore)
	result.FinalSeverity = finalSeverity
	logger.Info("Severity assessed", "initial", input.Severity, "final", finalSeverity, "score", incidentCtx.SeverityScore)

	// ── Step 3: Isolate node (CRITICAL and HIGH only) ─────────────────────────
	if finalSeverity == "CRITICAL" || finalSeverity == "HIGH" {
		var isoResult isolation.IsolationResult
		if err := workflow.ExecuteActivity(ctx, "IsolateNodeActivity", input, incidentCtx.SeverityScore).Get(ctx, &isoResult); err != nil {
			logger.Error("IsolateNodeActivity failed", "err", err)
			// Non-fatal: continue to alerting even if isolation fails
		} else {
			result.NodeIsolated = true
			result.NetworkPolicyID = isoResult.NetworkPolicyID
		}
	}

	// ── Step 4: Create Grafana OnCall alert ───────────────────────────────────
	var alertGroupID string
	if err := workflow.ExecuteActivity(ctx, "CreateIncidentAlert", input, incidentCtx, result.NodeIsolated).Get(ctx, &alertGroupID); err != nil {
		logger.Error("CreateIncidentAlert failed", "err", err)
		alertGroupID = fmt.Sprintf("og-rmm-security-%s", input.EventID)
	}
	result.AlertGroupID = alertGroupID
	result.CompletedAt = workflow.Now(ctx)

	logger.Info("IncidentTriageWorkflow completed",
		"eventId", input.EventID,
		"finalSeverity", result.FinalSeverity,
		"nodeIsolated", result.NodeIsolated,
		"alertGroupId", result.AlertGroupID,
	)
	return result, nil
}

// ReAdmitNodeWorkflow reverses node isolation after security team clearance.
// Triggered manually from the Cybersecurity dashboard by an admin user.
func ReAdmitNodeWorkflow(ctx workflow.Context, input ReAdmitInput) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("ReAdmitNodeWorkflow started", "eventId", input.EventID, "nodeId", input.NodeID)

	activityOpts := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts: 3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOpts)

	if err := workflow.ExecuteActivity(ctx, "ReAdmitNodeActivity", input).Get(ctx, nil); err != nil {
		return fmt.Errorf("re-admit node activity: %w", err)
	}

	logger.Info("ReAdmitNodeWorkflow completed", "eventId", input.EventID, "nodeId", input.NodeID)
	return nil
}

// ─── Worker registration ──────────────────────────────────────────────────────

// RegisterSecurityWorker registers the security workflows and activities with a Temporal worker.
func RegisterSecurityWorker(w worker.Worker, acts *Activities) {
	w.RegisterWorkflowWithOptions(IncidentTriageWorkflow, workflow.RegisterOptions{Name: IncidentTriageWorkflowType})
	w.RegisterWorkflowWithOptions(ReAdmitNodeWorkflow, workflow.RegisterOptions{Name: ReAdmitNodeWorkflowType})

	w.RegisterActivityWithOptions(acts.FetchOpenCTIData, activity.RegisterOptions{Name: "FetchOpenCTIData"})
	w.RegisterActivityWithOptions(acts.IsolateNodeActivity, activity.RegisterOptions{Name: "IsolateNodeActivity"})
	w.RegisterActivityWithOptions(acts.CreateIncidentAlert, activity.RegisterOptions{Name: "CreateIncidentAlert"})
	w.RegisterActivityWithOptions(acts.ReAdmitNodeActivity, activity.RegisterOptions{Name: "ReAdmitNodeActivity"})
}

// ─── Worker factory ───────────────────────────────────────────────────────────

// NewSecurityWorker creates and starts the security workflow worker.
// Returns a started worker and a client for triggering workflows.
func NewSecurityWorker(temporalHostPort, openCTIURL, openCTIKey, onCallURL, onCallIntegrationID, onCallToken, k8sAPIURL, k8sToken, platformAPIURL, platformAPIKey string) (worker.Worker, client.Client, error) {
	c, err := client.Dial(client.Options{HostPort: temporalHostPort})
	if err != nil {
		return nil, nil, fmt.Errorf("temporal dial: %w", err)
	}

	w := worker.New(c, TaskQueue, worker.Options{})

	openCTIClient := opencti.NewClient(openCTIURL, openCTIKey)
	onCallClient := oncall.NewClient(onCallURL, onCallIntegrationID, onCallToken)
	isolator := isolation.NewIsolator(k8sAPIURL, k8sToken, platformAPIURL, platformAPIKey)
	acts := NewActivities(openCTIClient, onCallClient, isolator)

	RegisterSecurityWorker(w, acts)

	return w, c, nil
}

// ─── Helper functions ─────────────────────────────────────────────────────────

// assessSeverity computes the final severity by combining the initial event severity
// with the OpenCTI threat intelligence score.
func assessSeverity(initialSeverity string, openCTIScore int) string {
	// OpenCTI score takes precedence for high-confidence matches
	if openCTIScore >= 80 {
		return "CRITICAL"
	}
	if openCTIScore >= 60 {
		return "HIGH"
	}
	if openCTIScore >= 40 {
		return "MEDIUM"
	}

	// Fall back to the initial severity from the security event
	switch initialSeverity {
	case "CRITICAL", "HIGH", "MEDIUM", "LOW":
		return initialSeverity
	default:
		return "LOW"
	}
}
