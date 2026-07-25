package workflows

// ChangeManagementWorkflow defines the Temporal workflow for change management.
// Each change request goes through: Assessment → CAB Review → Approval → Implementation → Verification.

import (
	"time"
)

// ChangeWorkflowInput is the input for the change management Temporal workflow.
type ChangeWorkflowInput struct {
	ChangeID     string `json:"change_id"`
	Title        string `json:"title"`
	Type         string `json:"type"`
	RiskLevel    string `json:"risk_level"`
	CABRequired  bool   `json:"cab_required"`
	ScheduledAt  *time.Time `json:"scheduled_at,omitempty"`
}

// ChangeWorkflowResult is the output of the workflow.
type ChangeWorkflowResult struct {
	ChangeID    string `json:"change_id"`
	Status      string `json:"status"`
	CompletedAt string `json:"completed_at,omitempty"`
	Error       string `json:"error,omitempty"`
}

// Steps in the change management workflow (Temporal activities):
// 1. ValidateChangeRequest - check all required fields and risk assessment
// 2. AssessImpact - analyze affected systems and dependencies
// 3. ScheduleCABReview - if CAB required, schedule review meeting
// 4. AwaitApproval - wait for approval (human-in-the-loop signal)
// 5. ExecuteChange - run implementation runbook
// 6. VerifyChange - run smoke tests and health checks
// 7. NotifyStakeholders - send completion notifications via Kafka
// 8. UpdateCMDB - update configuration items in asset database

// IncidentWorkflowInput for automated incident response.
type IncidentWorkflowInput struct {
	IncidentID   string   `json:"incident_id"`
	Priority     string   `json:"priority"`
	Category     string   `json:"category"`
	AffectedCI   []string `json:"affected_ci"`
}

// Steps in incident management workflow:
// 1. ClassifyIncident - auto-classify based on category and affected CI
// 2. AssignToTeam - route to appropriate team based on category
// 3. NotifyOnCall - page on-call engineer for P1/P2
// 4. StartDiagnostics - run automated diagnostics for known patterns
// 5. EscalateIfNeeded - escalate based on SLA proximity
// 6. RecordResolution - capture resolution for knowledge base
// 7. UpdateProblemDB - link to existing problems if related
