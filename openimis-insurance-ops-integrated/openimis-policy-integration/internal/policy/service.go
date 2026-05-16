package policy

import (
	"context"
	"fmt"
	"time"

	"go.temporal.io/sdk/client"
	"openimis-policy-integration/internal/metrics"
	"go.uber.org/zap"

	"openimis-policy-integration/internal/openimis"
	"openimis-policy-integration/internal/temporal"
)

// Policy represents a simplified policy structure for creation.
type Policy struct {
	PolicyID      string             `json:"policy_id"`
	EnrollmentDate string             `json:"enrollment_date"`
	SchemeID      string             `json:"scheme_id"`
	FamilyMembers []openimis.Member `json:"family_members"`
	Premium       float64            `json:"premium"`
	Currency      string             `json:"currency"`
	Status        string             `json:"status"`
}

// Service defines the policy service interface.
type Service interface {
	CreatePolicy(ctx context.Context, newPolicy *Policy) (*Policy, error)
	ValidatePolicy(policy *Policy) error
}

type service struct {
	temporalClient client.Client
	logger         *zap.Logger
}

// NewService creates a new policy service.
func NewService(temporalClient client.Client, logger *zap.Logger) Service {
	return &service{
		temporalClient: temporalClient,
		logger:         logger,
	}
}

// CreatePolicy handles the policy creation workflow, including premium calculation via Temporal.
func (s *service) CreatePolicy(ctx context.Context, newPolicy *Policy) (*Policy, error) {
	metrics.PolicyCreationTotal.WithLabelValues("attempt").Inc()
	s.logger.Info("Starting policy creation process", zap.String("policy_id", newPolicy.PolicyID))

	// 1. Start Temporal Workflow for Premium Calculation
	workflowInput := temporal.PremiumCalculationInput{
		PolicyID:      newPolicy.PolicyID,
		EnrollmentDate: newPolicy.EnrollmentDate,
		FamilyMembers: newPolicy.FamilyMembers,
		SchemeID:      newPolicy.SchemeID,
	}

	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("premium-calc-workflow-%s", newPolicy.PolicyID),
		TaskQueue: "openimis-task-queue", // Should be read from config
	}

	we, err := s.temporalClient.ExecuteWorkflow(ctx, workflowOptions, temporal.PolicyPremiumCalculationWorkflowName, workflowInput)
	if err != nil {
		s.logger.Error("Failed to start premium calculation workflow", zap.Error(err))
		return nil, fmt.Errorf("failed to start premium calculation: %w", err)
	}

	s.logger.Info("Premium calculation workflow started", zap.String("workflow_id", we.GetID()), zap.String("run_id", we.GetRunID()))

	// 2. Wait for the result (synchronous call for simplicity in this example)
	var result temporal.PremiumCalculationOutput
	err = we.Get(ctx, &result)
	if err != nil {
		s.logger.Error("Premium calculation workflow failed", zap.Error(err))
		metrics.PolicyCreationTotal.WithLabelValues("temporal_failure").Inc()
		return nil, fmt.Errorf("premium calculation failed: %w", err)
	}

	// 3. Add premium to policy and perform final validation
	newPolicy.Premium = result.CalculatedPremium
	newPolicy.Currency = result.Currency

	if err := s.ValidatePolicy(newPolicy); err != nil {
		s.logger.Error("Policy validation failed after premium calculation", zap.Error(err))
		metrics.PolicyCreationTotal.WithLabelValues("validation_failure").Inc()
		return nil, fmt.Errorf("policy validation failed: %w", err)
	}

	// 4. Finalize policy issuance (mocked)
	newPolicy.Status = "ISSUED"
	s.logger.Info("Policy successfully issued", zap.String("policy_id", newPolicy.PolicyID), zap.Float64("premium", newPolicy.Premium))
	metrics.PolicyCreationTotal.WithLabelValues("success").Inc()

	return newPolicy, nil
}

// ValidatePolicy performs premium validation before policy issuance.
func (s *service) ValidatePolicy(policy *Policy) error {
	// Mock validation logic: e.g., check if premium is non-zero and currency is set
	if policy.Premium <= 0 {
		return fmt.Errorf("calculated premium must be positive, got %.2f", policy.Premium)
	}
	if policy.Currency == "" {
		return fmt.Errorf("policy currency is not set")
	}
	// In a real system, this would involve more complex business rules.
	return nil
}
