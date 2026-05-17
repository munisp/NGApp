package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/client"

	"reinsurer-api/internal/model"
	"reinsurer-api/internal/repository"
	"reinsurer-api/pkg/temporal"
)

// ReinsurerService defines the business logic interface.
type ReinsurerService interface {
	SubmitQuote(ctx context.Context, quote model.QuoteSubmission) (model.QuoteResponse, error)
	NotifyClaim(ctx context.Context, claim model.ClaimNotification) (model.ClaimResponse, error)
}

// reinsurerService implements the ReinsurerService interface.
type reinsurerService struct {
	repo             repository.ReinsurerRepository
	temporalClient   client.Client
	policyServiceURL string
	claimsServiceURL string
}

// NewReinsurerService creates a new instance of reinsurerService.
func NewReinsurerService(
	repo repository.ReinsurerRepository,
	temporalClient client.Client,
	policyServiceURL string,
	claimsServiceURL string,
) ReinsurerService {
	return &reinsurerService{
		repo:             repo,
		temporalClient:   temporalClient,
		policyServiceURL: policyServiceURL,
		claimsServiceURL: claimsServiceURL,
	}
}

// SubmitQuote handles the business logic for a reinsurer quote submission.
func (s *reinsurerService) SubmitQuote(ctx context.Context, quote model.QuoteSubmission) (model.QuoteResponse, error) {
	// 1. Basic Validation
	if quote.PolicyID == "" || quote.ReinsurerID == "" || quote.QuoteAmount <= 0 {
		return model.QuoteResponse{}, fmt.Errorf("invalid quote submission data")
	}

	// 2. Generate Quote ID and set initial status
	quote.QuoteID = uuid.New().String()
	quote.Status = "PENDING"
	quote.ExpirationDate = time.Now().Add(48 * time.Hour) // Example expiration

	// 3. Save to Repository (Mocked DB)
	if err := s.repo.SaveQuote(quote); err != nil {
		log.Printf("Error saving quote to repository: %v", err)
		return model.QuoteResponse{}, fmt.Errorf("failed to save quote: %w", err)
	}

	// 4. Start Temporal Workflow for async processing
	workflowOptions := client.StartWorkflowOptions{
		ID:        "quote-submission-workflow-" + quote.QuoteID,
		TaskQueue: "reinsurer-api-task-queue", // Should be read from config
	}

	we, err := s.temporalClient.ExecuteWorkflow(ctx, workflowOptions, temporal.QuoteSubmissionWorkflow, quote)
	if err != nil {
		log.Printf("Error starting Temporal workflow: %v", err)
		return model.QuoteResponse{}, fmt.Errorf("failed to start quote processing: %w", err)
	}

	log.Printf("Started Quote Submission Workflow ID: %s, RunID: %s", we.GetID(), we.GetRunID())

	// 5. Return immediate response (async processing started)
	return model.QuoteResponse{
		QuoteID: quote.QuoteID,
		Status:  "PROCESSING",
		Message: "Quote submission received and processing started asynchronously.",
	}, nil
}

// NotifyClaim handles the business logic for a claim notification from the core system.
func (s *reinsurerService) NotifyClaim(ctx context.Context, claim model.ClaimNotification) (model.ClaimResponse, error) {
	// 1. Basic Validation
	if claim.ClaimID == "" || claim.PolicyID == "" || claim.ReinsurerID == "" {
		return model.ClaimResponse{}, fmt.Errorf("invalid claim notification data")
	}

	// 2. Set notification date and initial status
	claim.NotificationDate = time.Now()
	claim.Status = "OPEN"

	// 3. Save to Repository (Mocked DB)
	if err := s.repo.SaveClaim(claim); err != nil {
		log.Printf("Error saving claim to repository: %v", err)
		return model.ClaimResponse{}, fmt.Errorf("failed to save claim: %w", err)
	}

	// 4. Start Temporal Workflow for async notification
	workflowOptions := client.StartWorkflowOptions{
		ID:        "claim-notification-workflow-" + claim.ClaimID,
		TaskQueue: "reinsurer-api-task-queue", // Should be read from config
	}

	we, err := s.temporalClient.ExecuteWorkflow(ctx, workflowOptions, temporal.ClaimNotificationWorkflow, claim)
	if err != nil {
		log.Printf("Error starting Temporal workflow: %v", err)
		return model.ClaimResponse{}, fmt.Errorf("failed to start claim notification: %w", err)
	}

	log.Printf("Started Claim Notification Workflow ID: %s, RunID: %s", we.GetID(), we.GetRunID())

	// 5. Return immediate response (async notification started)
	return model.ClaimResponse{
		ClaimID: claim.ClaimID,
		Status:  "RECEIVED",
		Message: "Claim notification received and processing started asynchronously.",
	}, nil
}
