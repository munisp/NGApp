package service

import (
	"context"
	"fmt"
	"time"

	"go.temporal.io/sdk/client"
	"underwriting-risk-integrator/internal/temporal"
	"underwriting-risk-integrator/pkg/models"
)

const (
	TaskQueue = "UNDERWRITING_RISK_TASK_QUEUE"
)

// UnderwritingService handles the business logic for the underwriting process.
type UnderwritingService struct {
	TemporalClient client.Client
}

// NewUnderwritingService creates a new UnderwritingService.
func NewUnderwritingService(tc client.Client) *UnderwritingService {
	return &UnderwritingService{
		TemporalClient: tc,
	}
}

// StartRiskAssessmentWorkflow initiates the Temporal workflow for a given underwriting case.
func (s *UnderwritingService) StartRiskAssessmentWorkflow(ctx context.Context, uc models.UnderwritingCase) (*models.UnderwritingDecision, error) {
	// Generate a unique workflow ID
	workflowID := fmt.Sprintf("underwriting-risk-assessment-%s-%d", uc.CaseID, time.Now().UnixNano())

	options := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: TaskQueue,
	}

	// Start the workflow
	we, err := s.TemporalClient.ExecuteWorkflow(ctx, options, temporal.UnderwritingRiskAssessmentWorkflow, uc)
	if err != nil {
		return nil, fmt.Errorf("failed to start workflow: %w", err)
	}

	fmt.Printf("Started workflow: ID=%s, RunID=%s\n", we.GetID(), we.GetRunID())

	// Wait for the workflow to complete and get the result
	var result models.UnderwritingDecision
	err = we.Get(ctx, &result)
	if err != nil {
		return nil, fmt.Errorf("workflow failed: %w", err)
	}

	return &result, nil
}
