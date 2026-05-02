// Package onboarding provides Temporal workflow integration for stakeholder onboarding
package onboarding

import (
	"context"
	"fmt"
	"time"
)

// OnboardingWorkflow represents the main onboarding workflow
// This is designed to work with Temporal workflow engine
type OnboardingWorkflow struct {
	service *OnboardingService
}

// NewOnboardingWorkflow creates a new onboarding workflow
func NewOnboardingWorkflow(service *OnboardingService) *OnboardingWorkflow {
	return &OnboardingWorkflow{service: service}
}

// WorkflowInput represents input to the onboarding workflow
type WorkflowInput struct {
	CaseID          string          `json:"case_id"`
	StakeholderType StakeholderType `json:"stakeholder_type"`
	OrganizationID  string          `json:"organization_id"`
}

// WorkflowOutput represents output from the onboarding workflow
type WorkflowOutput struct {
	CaseID          string           `json:"case_id"`
	FinalStatus     OnboardingStatus `json:"final_status"`
	CompletedAt     time.Time        `json:"completed_at"`
	ParticipantID   string           `json:"participant_id,omitempty"`
	CertificateID   string           `json:"certificate_id,omitempty"`
	Error           string           `json:"error,omitempty"`
}

// OnboardingWorkflowDefinition defines the workflow stages
// Each stage is an activity that can be executed by Temporal
type OnboardingWorkflowDefinition struct {
	Stages []WorkflowStage `json:"stages"`
}

// WorkflowStage represents a stage in the workflow
type WorkflowStage struct {
	Name           string        `json:"name"`
	Description    string        `json:"description"`
	ActivityName   string        `json:"activity_name"`
	Timeout        time.Duration `json:"timeout"`
	RetryPolicy    RetryPolicy   `json:"retry_policy"`
	RequiredStatus OnboardingStatus `json:"required_status"`
	NextStatus     OnboardingStatus `json:"next_status"`
}

// RetryPolicy defines retry behavior
type RetryPolicy struct {
	MaxAttempts     int           `json:"max_attempts"`
	InitialInterval time.Duration `json:"initial_interval"`
	MaxInterval     time.Duration `json:"max_interval"`
	BackoffCoeff    float64       `json:"backoff_coefficient"`
}

// GetWorkflowDefinition returns the workflow definition for a stakeholder type
func (w *OnboardingWorkflow) GetWorkflowDefinition(stakeholderType StakeholderType) *OnboardingWorkflowDefinition {
	// Base workflow stages that apply to most stakeholders
	baseStages := []WorkflowStage{
		{
			Name:           "Document Collection",
			Description:    "Collect and validate required documents",
			ActivityName:   "ValidateDocuments",
			Timeout:        7 * 24 * time.Hour, // 7 days
			RetryPolicy:    RetryPolicy{MaxAttempts: 3, InitialInterval: time.Hour, MaxInterval: 24 * time.Hour, BackoffCoeff: 2.0},
			RequiredStatus: StatusSubmitted,
			NextStatus:     StatusDueDiligence,
		},
		{
			Name:           "Due Diligence Review",
			Description:    "Compliance team reviews documents and performs KYB checks",
			ActivityName:   "PerformDueDiligence",
			Timeout:        5 * 24 * time.Hour,
			RetryPolicy:    RetryPolicy{MaxAttempts: 1},
			RequiredStatus: StatusDueDiligence,
			NextStatus:     StatusTechnicalSetup,
		},
		{
			Name:           "Technical Setup",
			Description:    "Configure API endpoints, certificates, and connectivity",
			ActivityName:   "ConfigureTechnicalIntegration",
			Timeout:        3 * 24 * time.Hour,
			RetryPolicy:    RetryPolicy{MaxAttempts: 3, InitialInterval: time.Hour, MaxInterval: 4 * time.Hour, BackoffCoeff: 2.0},
			RequiredStatus: StatusTechnicalSetup,
			NextStatus:     StatusSandboxCertified,
		},
		{
			Name:           "Sandbox Certification",
			Description:    "Run certification tests in sandbox environment",
			ActivityName:   "RunSandboxCertification",
			Timeout:        2 * 24 * time.Hour,
			RetryPolicy:    RetryPolicy{MaxAttempts: 5, InitialInterval: 30 * time.Minute, MaxInterval: 4 * time.Hour, BackoffCoeff: 2.0},
			RequiredStatus: StatusSandboxCertified,
			NextStatus:     StatusOperationalReady,
		},
		{
			Name:           "Operational Readiness",
			Description:    "Verify operational procedures, contacts, and runbooks",
			ActivityName:   "VerifyOperationalReadiness",
			Timeout:        2 * 24 * time.Hour,
			RetryPolicy:    RetryPolicy{MaxAttempts: 1},
			RequiredStatus: StatusOperationalReady,
			NextStatus:     StatusGovernanceApproval,
		},
		{
			Name:           "Governance Approval",
			Description:    "Final approval from governance committee",
			ActivityName:   "ObtainGovernanceApproval",
			Timeout:        5 * 24 * time.Hour,
			RetryPolicy:    RetryPolicy{MaxAttempts: 1},
			RequiredStatus: StatusGovernanceApproval,
			NextStatus:     StatusProdProvisioned,
		},
		{
			Name:           "Production Provisioning",
			Description:    "Provision production resources and credentials",
			ActivityName:   "ProvisionProductionResources",
			Timeout:        1 * 24 * time.Hour,
			RetryPolicy:    RetryPolicy{MaxAttempts: 3, InitialInterval: 15 * time.Minute, MaxInterval: 2 * time.Hour, BackoffCoeff: 2.0},
			RequiredStatus: StatusProdProvisioned,
			NextStatus:     StatusProdCertified,
		},
		{
			Name:           "Production Certification",
			Description:    "Run certification tests in production with limited traffic",
			ActivityName:   "RunProductionCertification",
			Timeout:        1 * 24 * time.Hour,
			RetryPolicy:    RetryPolicy{MaxAttempts: 3, InitialInterval: 30 * time.Minute, MaxInterval: 4 * time.Hour, BackoffCoeff: 2.0},
			RequiredStatus: StatusProdCertified,
			NextStatus:     StatusActive,
		},
	}

	// Customize based on stakeholder type
	switch stakeholderType {
	case StakeholderDeveloper:
		// Developers have a simplified workflow
		return &OnboardingWorkflowDefinition{
			Stages: []WorkflowStage{
				{
					Name:           "Terms Acceptance",
					Description:    "Accept API terms of service",
					ActivityName:   "ValidateTermsAcceptance",
					Timeout:        1 * time.Hour,
					RequiredStatus: StatusSubmitted,
					NextStatus:     StatusSandboxCertified,
				},
				{
					Name:           "Sandbox Provisioning",
					Description:    "Provision sandbox API keys",
					ActivityName:   "ProvisionSandboxResources",
					Timeout:        5 * time.Minute,
					RetryPolicy:    RetryPolicy{MaxAttempts: 3, InitialInterval: time.Minute},
					RequiredStatus: StatusSandboxCertified,
					NextStatus:     StatusActive,
				},
			},
		}

	case StakeholderMerchant:
		// Merchants have a simplified workflow
		return &OnboardingWorkflowDefinition{
			Stages: []WorkflowStage{
				{
					Name:           "Merchant Verification",
					Description:    "Verify merchant business registration and tax ID",
					ActivityName:   "VerifyMerchant",
					Timeout:        2 * 24 * time.Hour,
					RequiredStatus: StatusSubmitted,
					NextStatus:     StatusTechnicalSetup,
				},
				{
					Name:           "Integration Setup",
					Description:    "Configure POS/API integration",
					ActivityName:   "ConfigureMerchantIntegration",
					Timeout:        1 * 24 * time.Hour,
					RequiredStatus: StatusTechnicalSetup,
					NextStatus:     StatusActive,
				},
			},
		}

	case StakeholderRegulator:
		// Regulators have a governance-focused workflow
		return &OnboardingWorkflowDefinition{
			Stages: []WorkflowStage{
				{
					Name:           "Mandate Verification",
					Description:    "Verify regulatory mandate and authorization",
					ActivityName:   "VerifyRegulatoryMandate",
					Timeout:        1 * 24 * time.Hour,
					RequiredStatus: StatusSubmitted,
					NextStatus:     StatusGovernanceApproval,
				},
				{
					Name:           "Executive Approval",
					Description:    "Executive approval for regulator access",
					ActivityName:   "ObtainExecutiveApproval",
					Timeout:        2 * 24 * time.Hour,
					RequiredStatus: StatusGovernanceApproval,
					NextStatus:     StatusActive,
				},
			},
		}

	case StakeholderNOCOperator:
		// NOC operators have an internal workflow
		return &OnboardingWorkflowDefinition{
			Stages: []WorkflowStage{
				{
					Name:           "Employment Verification",
					Description:    "Verify employment and background check",
					ActivityName:   "VerifyEmployment",
					Timeout:        1 * 24 * time.Hour,
					RequiredStatus: StatusSubmitted,
					NextStatus:     StatusOperationalReady,
				},
				{
					Name:           "Training Completion",
					Description:    "Complete NOC training certification",
					ActivityName:   "VerifyTrainingCompletion",
					Timeout:        2 * 24 * time.Hour,
					RequiredStatus: StatusOperationalReady,
					NextStatus:     StatusActive,
				},
			},
		}

	case StakeholderGovernment:
		// Government agencies have a mandate-focused workflow
		return &OnboardingWorkflowDefinition{
			Stages: []WorkflowStage{
				{
					Name:           "Mandate Verification",
					Description:    "Verify government mandate and authorization",
					ActivityName:   "VerifyGovernmentMandate",
					Timeout:        3 * 24 * time.Hour,
					RequiredStatus: StatusSubmitted,
					NextStatus:     StatusTechnicalSetup,
				},
				{
					Name:           "Program Setup",
					Description:    "Configure payment program (G2P, tax, etc.)",
					ActivityName:   "ConfigureGovernmentProgram",
					Timeout:        2 * 24 * time.Hour,
					RequiredStatus: StatusTechnicalSetup,
					NextStatus:     StatusActive,
				},
			},
		}

	default:
		// Banks, MMOs, Fintechs, MFIs use the full workflow
		return &OnboardingWorkflowDefinition{Stages: baseStages}
	}
}

// Activities - These would be registered with Temporal

// ValidateDocumentsActivity validates submitted documents
type ValidateDocumentsActivity struct {
	service *OnboardingService
}

func (a *ValidateDocumentsActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	// Check all required documents are submitted
	for _, req := range c.Requirements {
		if req.Required && req.Category == "DOCUMENT" && len(req.EvidenceIDs) == 0 {
			return fmt.Errorf("required document missing: %s", req.Name)
		}
	}

	return nil
}

// PerformDueDiligenceActivity performs due diligence checks
type PerformDueDiligenceActivity struct {
	service *OnboardingService
}

func (a *PerformDueDiligenceActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	// Check all document requirements are approved
	for _, req := range c.Requirements {
		if req.Required && req.Category == "DOCUMENT" && req.Status != "APPROVED" {
			return fmt.Errorf("document not approved: %s", req.Name)
		}
	}

	// Check for compliance approval
	hasComplianceApproval := false
	for _, approval := range c.Approvals {
		if approval.Step == "DUE_DILIGENCE" && approval.Decision == "APPROVED" {
			hasComplianceApproval = true
			break
		}
	}

	if !hasComplianceApproval {
		return fmt.Errorf("awaiting compliance approval")
	}

	return nil
}

// ConfigureTechnicalIntegrationActivity configures technical integration
type ConfigureTechnicalIntegrationActivity struct {
	service *OnboardingService
}

func (a *ConfigureTechnicalIntegrationActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	if c.TechnicalProfile == nil {
		return fmt.Errorf("technical profile not configured")
	}

	// Validate technical profile
	if c.TechnicalProfile.BaseURL == "" {
		return fmt.Errorf("base URL not configured")
	}
	if c.TechnicalProfile.CallbackURL == "" {
		return fmt.Errorf("callback URL not configured")
	}

	// Check security approval
	hasSecurityApproval := false
	for _, approval := range c.Approvals {
		if approval.Step == "SECURITY" && approval.Decision == "APPROVED" {
			hasSecurityApproval = true
			break
		}
	}

	if !hasSecurityApproval {
		return fmt.Errorf("awaiting security approval")
	}

	return nil
}

// RunSandboxCertificationActivity runs sandbox certification tests
type RunSandboxCertificationActivity struct {
	service *OnboardingService
}

func (a *RunSandboxCertificationActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	// Check sandbox resources are provisioned
	if c.SandboxResources == nil {
		// Provision sandbox
		_, err := a.service.ProvisionSandbox(ctx, caseID)
		if err != nil {
			return fmt.Errorf("failed to provision sandbox: %w", err)
		}
	}

	// Check for passing certification run
	for _, run := range c.CertificationRuns {
		if run.Environment == "SANDBOX" && run.Status == "PASSED" {
			return nil
		}
	}

	return fmt.Errorf("sandbox certification not passed")
}

// VerifyOperationalReadinessActivity verifies operational readiness
type VerifyOperationalReadinessActivity struct {
	service *OnboardingService
}

func (a *VerifyOperationalReadinessActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	// Check operational requirements
	for _, req := range c.Requirements {
		if req.Required && req.Category == "OPERATIONAL" && req.Status != "APPROVED" {
			return fmt.Errorf("operational requirement not approved: %s", req.Name)
		}
	}

	// Check operations approval
	hasOpsApproval := false
	for _, approval := range c.Approvals {
		if approval.Step == "OPERATIONS" && approval.Decision == "APPROVED" {
			hasOpsApproval = true
			break
		}
	}

	if !hasOpsApproval {
		return fmt.Errorf("awaiting operations approval")
	}

	return nil
}

// ObtainGovernanceApprovalActivity obtains governance approval
type ObtainGovernanceApprovalActivity struct {
	service *OnboardingService
}

func (a *ObtainGovernanceApprovalActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	// Get template to check if dual approval is required
	template, err := a.service.GetTemplate(c.StakeholderType)
	if err != nil {
		return err
	}

	// Find governance step
	var govStep *ApprovalStep
	for _, step := range template.ApprovalSteps {
		if step.Step == "GOVERNANCE" {
			govStep = &step
			break
		}
	}

	if govStep == nil {
		// No governance step required
		return nil
	}

	// Count governance approvals
	govApprovals := 0
	for _, approval := range c.Approvals {
		if approval.Step == "GOVERNANCE" && approval.Decision == "APPROVED" {
			govApprovals++
		}
	}

	requiredApprovals := 1
	if govStep.DualApproval {
		requiredApprovals = 2
	}

	if govApprovals < requiredApprovals {
		return fmt.Errorf("awaiting governance approval (%d/%d)", govApprovals, requiredApprovals)
	}

	return nil
}

// ProvisionProductionResourcesActivity provisions production resources
type ProvisionProductionResourcesActivity struct {
	service *OnboardingService
}

func (a *ProvisionProductionResourcesActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	if c.ProductionResources != nil {
		return nil // Already provisioned
	}

	// Get default limits based on stakeholder type
	limits := getDefaultLimits(c.StakeholderType)

	_, err = a.service.ProvisionProduction(ctx, caseID, limits)
	if err != nil {
		return fmt.Errorf("failed to provision production: %w", err)
	}

	return nil
}

// RunProductionCertificationActivity runs production certification
type RunProductionCertificationActivity struct {
	service *OnboardingService
}

func (a *RunProductionCertificationActivity) Execute(ctx context.Context, caseID string) error {
	c, err := a.service.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	// Check for passing production certification run
	for _, run := range c.CertificationRuns {
		if run.Environment == "PRODUCTION" && run.Status == "PASSED" {
			return nil
		}
	}

	return fmt.Errorf("production certification not passed")
}

// Helper function to get default limits
func getDefaultLimits(stakeholderType StakeholderType) ResourceLimits {
	switch stakeholderType {
	case StakeholderBank:
		return ResourceLimits{
			MaxTPS:                 10000,
			DailyTransactionLimit:  100000000000, // 100B
			SingleTransactionLimit: 1000000000,   // 1B
			NetDebitCap:            10000000000,  // 10B
		}
	case StakeholderMobileMoneyOp:
		return ResourceLimits{
			MaxTPS:                 5000,
			DailyTransactionLimit:  50000000000,
			SingleTransactionLimit: 500000000,
			NetDebitCap:            5000000000,
		}
	case StakeholderFintech:
		return ResourceLimits{
			MaxTPS:                 1000,
			DailyTransactionLimit:  10000000000,
			SingleTransactionLimit: 100000000,
			NetDebitCap:            1000000000,
		}
	case StakeholderMFI:
		return ResourceLimits{
			MaxTPS:                 500,
			DailyTransactionLimit:  1000000000,
			SingleTransactionLimit: 10000000,
			NetDebitCap:            100000000,
		}
	case StakeholderMerchant:
		return ResourceLimits{
			MaxTPS:                 100,
			DailyTransactionLimit:  100000000,
			SingleTransactionLimit: 1000000,
			NetDebitCap:            10000000,
		}
	default:
		return ResourceLimits{
			MaxTPS:                 100,
			DailyTransactionLimit:  10000000,
			SingleTransactionLimit: 100000,
			NetDebitCap:            1000000,
		}
	}
}

// OnboardingWorkflowState represents the current state of a workflow execution
type OnboardingWorkflowState struct {
	CaseID          string           `json:"case_id"`
	CurrentStage    int              `json:"current_stage"`
	TotalStages     int              `json:"total_stages"`
	Status          string           `json:"status"` // RUNNING, COMPLETED, FAILED, WAITING
	StartedAt       time.Time        `json:"started_at"`
	LastActivityAt  time.Time        `json:"last_activity_at"`
	CompletedStages []CompletedStage `json:"completed_stages"`
	Error           string           `json:"error,omitempty"`
}

// CompletedStage represents a completed workflow stage
type CompletedStage struct {
	Name        string    `json:"name"`
	CompletedAt time.Time `json:"completed_at"`
	Duration    string    `json:"duration"`
}
