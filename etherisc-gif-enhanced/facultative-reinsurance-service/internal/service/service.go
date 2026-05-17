package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/etherisc/facultative-reinsurance-service/internal/model"
	"github.com/etherisc/facultative-reinsurance-service/internal/repo"
	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
)

// Service defines the business logic interface for the reinsurance service.
type Service interface {
	// Policy-related
	GetPolicy(ctx context.Context, policyID string) (*model.Policy, error)
	SubmitPolicyForReinsurance(ctx context.Context, policyID string) (string, error) // Returns Temporal Workflow ID

	// Reinsurer Selection
	SelectReinsurer(ctx context.Context, policyID string) (*model.ReinsurerSelectionResult, error)

	// Quote Workflow
	RequestQuote(ctx context.Context, policyID string, reinsurerID string, cededShare float64) (*model.ReinsuranceQuote, error)
	AcceptQuote(ctx context.Context, quoteID string) (*model.CededReinsurance, error)
	RejectQuote(ctx context.Context, quoteID string) error

	// Ceded Reinsurance
	FinalizeContract(ctx context.Context, quote *model.ReinsuranceQuote) (*model.CededReinsurance, error)

	// Claim Cession
	SubmitClaimForCession(ctx context.Context, claimID string, contractID string, claimAmount float64) (string, error) // Returns Temporal Workflow ID
	ProcessClaimCession(ctx context.Context, claimID string, contractID string, claimAmount float64) (*model.ClaimCession, error)

	// Integration
	IntegrateWithGIF(ctx context.Context, req *model.GIFIntegrationRequest) (*model.GIFIntegrationResponse, error)
}

// ReinsuranceService is the concrete implementation of the Service interface.
type ReinsuranceService struct {
	repo repo.Repository
	temporalClient client.Client
}

// NewReinsuranceService creates a new instance of ReinsuranceService.
func NewReinsuranceService(r repo.Repository, tc client.Client) *ReinsuranceService {
	return &ReinsuranceService{
		repo: r,
		temporalClient: tc,
	}
}

// GetPolicy retrieves a policy by ID.
func (s *ReinsuranceService) GetPolicy(ctx context.Context, policyID string) (*model.Policy, error) {
	return s.repo.GetPolicyByID(ctx, policyID)
}

// SubmitPolicyForReinsurance starts the facultative reinsurance workflow.
func (s *ReinsuranceService) SubmitPolicyForReinsurance(ctx context.Context, policyID string) (string, error) {
	// This will be fully implemented in the API handler, here we just return a placeholder.
	// The actual Temporal client call will be made from the API layer.
	return fmt.Sprintf("workflow-%s", uuid.New().String()), nil
}

// SelectReinsurer implements the reinsurer selection algorithm.
func (s *ReinsuranceService) SelectReinsurer(ctx context.Context, policyID string) (*model.ReinsurerSelectionResult, error) {
	policy, err := s.repo.GetPolicyByID(ctx, policyID)
	if err != nil {
		return nil, err
	}
	if policy == nil {
		return nil, errors.New("policy not found")
	}

	reinsurers, err := s.repo.GetAllReinsurers(ctx)
	if err != nil {
		return nil, err
	}

	// Simple selection algorithm: Find the first reinsurer with enough capacity and a good rating.
	// In a real system, this would involve complex underwriting rules and pricing.
	for _, r := range reinsurers {
		if r.Capacity >= policy.SumInsured*0.5 && r.Rating == "A+" {
			return &model.ReinsurerSelectionResult{
				ReinsurerID: r.ID,
				CededShare:  0.5, // Cede 50% of the risk
			}, nil
		}
	}

	return nil, errors.New("no suitable reinsurer found")
}

// RequestQuote simulates sending a quote request and saves a pending quote.
func (s *ReinsuranceService) RequestQuote(ctx context.Context, policyID string, reinsurerID string, cededShare float64) (*model.ReinsuranceQuote, error) {
	policy, err := s.repo.GetPolicyByID(ctx, policyID)
	if err != nil {
		return nil, err
	}
	if policy == nil {
		return nil, errors.New("policy not found")
	}

	quote := &model.ReinsuranceQuote{
		QuoteID:      uuid.New().String(),
		ReinsurerID:  reinsurerID,
		PolicyID:     policyID,
		CededShare:   cededShare,
		CededPremium: policy.Premium * cededShare * 0.9, // Simple calculation: 90% of ceded premium
		Commission:   0.1,
		Status:       "PENDING",
		QuoteTime:    time.Now(),
	}

	if err := s.repo.SaveQuote(ctx, quote); err != nil {
		return nil, fmt.Errorf("failed to save quote: %w", err)
	}

	// In a real system, this would involve an external API call to the reinsurer.
	return quote, nil
}

// AcceptQuote updates the quote status and triggers contract finalization.
func (s *ReinsuranceService) AcceptQuote(ctx context.Context, quoteID string) (*model.CededReinsurance, error) {
	quote, err := s.repo.GetQuoteByID(ctx, quoteID)
	if err != nil {
		return nil, err
	}
	if quote == nil {
		return nil, errors.New("quote not found")
	}

	if quote.Status != "PENDING" {
		return nil, errors.New("quote is not in PENDING status")
	}

	quote.Status = "ACCEPTED"
	if err := s.repo.SaveQuote(ctx, quote); err != nil {
		return nil, fmt.Errorf("failed to update quote status: %w", err)
	}

	// Finalize the contract
	return s.FinalizeContract(ctx, quote)
}

// RejectQuote updates the quote status to REJECTED.
func (s *ReinsuranceService) RejectQuote(ctx context.Context, quoteID string) error {
	quote, err := s.repo.GetQuoteByID(ctx, quoteID)
	if err != nil {
		return err
	}
	if quote == nil {
		return errors.New("quote not found")
	}

	if quote.Status != "PENDING" {
		return errors.New("quote is not in PENDING status")
	}

	quote.Status = "REJECTED"
	return s.repo.SaveQuote(ctx, quote)
}

// FinalizeContract creates the final CededReinsurance contract and integrates with GIF.
func (s *ReinsuranceService) FinalizeContract(ctx context.Context, quote *model.ReinsuranceQuote) (*model.CededReinsurance, error) {
	// 1. Create CededReinsurance record
	cededRe := &model.CededReinsurance{
		ContractID:    uuid.New().String(),
		PolicyID:      quote.PolicyID,
		ReinsurerID:   quote.ReinsurerID,
		CededShare:    quote.CededShare,
		CededPremium:  quote.CededPremium,
		Commission:    quote.Commission,
		EffectiveDate: time.Now(),
		Status:        "ACTIVE",
	}

	// 2. Integrate with Etherisc GIF
	gifReq := &model.GIFIntegrationRequest{
		ContractType: "FacultativeReinsurance",
		Data: map[string]interface{}{
			"contract_id":   cededRe.ContractID,
			"policy_id":     cededRe.PolicyID,
			"reinsurer_id":  cededRe.ReinsurerID,
			"ceded_share":   cededRe.CededShare,
			"ceded_premium": cededRe.CededPremium,
		},
	}
	gifResp, err := s.IntegrateWithGIF(ctx, gifReq)
	if err != nil {
		return nil, fmt.Errorf("GIF integration failed: %w", err)
	}
	if !gifResp.Success {
		return nil, fmt.Errorf("GIF integration failed with error: %s", gifResp.Error)
	}

	cededRe.GIFContractID = gifResp.ContractID

	// 3. Save the final contract
	if err := s.repo.SaveCededReinsurance(ctx, cededRe); err != nil {
		return nil, fmt.Errorf("failed to save ceded reinsurance contract: %w", err)
	}

	// 4. Update the original policy as ceded
	policy, err := s.repo.GetPolicyByID(ctx, cededRe.PolicyID)
	if err != nil {
		// Log error but don't fail the contract finalization
		fmt.Printf("Warning: Could not retrieve policy %s to mark as ceded: %v\n", cededRe.PolicyID, err)
	} else if policy != nil {
		policy.IsCeded = true
		if err := s.repo.SavePolicy(ctx, policy); err != nil {
			fmt.Printf("Warning: Could not mark policy %s as ceded: %v\n", cededRe.PolicyID, err)
		}
	}

	return cededRe, nil
}

// SubmitClaimForCession starts the claim cession workflow.
func (s *ReinsuranceService) SubmitClaimForCession(ctx context.Context, claimID string, contractID string, claimAmount float64) (string, error) {
	// This will be fully implemented in the API handler, here we just return a placeholder.
	// The actual Temporal client call will be made from the API layer.
	return fmt.Sprintf("claim-workflow-%s", uuid.New().String()), nil
}

// ProcessClaimCession handles claim cession logic and updates the GIF contract.
func (s *ReinsuranceService) ProcessClaimCession(ctx context.Context, claimID string, contractID string, claimAmount float64) (*model.ClaimCession, error) {
	cededRe, err := s.repo.GetCededReinsuranceByPolicyID(ctx, contractID)
	if err != nil {
		return nil, err
	}
	if cededRe == nil {
		return nil, errors.New("ceded reinsurance contract not found")
	}

	reinsurerShare := claimAmount * cededRe.CededShare

	cession := &model.ClaimCession{
		CessionID:      uuid.New().String(),
		ContractID:     contractID,
		ClaimID:        claimID,
		ClaimAmount:    claimAmount,
		ReinsurerShare: reinsurerShare,
		Status:         "PENDING",
		CessionTime:    time.Now(),
	}

	// 1. Save the claim cession record
	if err := s.repo.SaveClaimCession(ctx, cession); err != nil {
		return nil, fmt.Errorf("failed to save claim cession: %w", err)
	}

	// 2. Integrate with Etherisc GIF to record the claim and trigger payment
	gifReq := &model.GIFIntegrationRequest{
		ContractType: "ClaimCession",
		Data: map[string]interface{}{
			"gif_contract_id": cededRe.GIFContractID,
			"claim_id":        cession.ClaimID,
			"cession_id":      cession.CessionID,
			"reinsurer_share": cession.ReinsurerShare,
		},
	}
	gifResp, err := s.IntegrateWithGIF(ctx, gifReq)
	if err != nil {
		return nil, fmt.Errorf("GIF claim cession integration failed: %w", err)
	}
	if !gifResp.Success {
		return nil, fmt.Errorf("GIF claim cession integration failed with error: %s", gifResp.Error)
	}

	// 3. Update status to PAID (assuming GIF integration handles the payment/ledger update)
	cession.Status = "PAID"
	if err := s.repo.SaveClaimCession(ctx, cession); err != nil {
		return nil, fmt.Errorf("failed to update claim cession status: %w", err)
	}

	// 4. Integration with TigerBeetle/Lakehouse for tracking (stubbed)
	fmt.Printf("Tracking ceded claim %s to TigerBeetle/Lakehouse\n", cession.CessionID)

	return cession, nil
}

// IntegrateWithGIF is a stub for interacting with the Etherisc GIF.
func (s *ReinsuranceService) IntegrateWithGIF(ctx context.Context, req *model.GIFIntegrationRequest) (*model.GIFIntegrationResponse, error) {
	// In a real system, this would be a gRPC or HTTP call to the GIF service.
	// For now, simulate success and generate a dummy contract ID.
	fmt.Printf("Integrating with GIF for contract type: %s\n", req.ContractType)

	if req.ContractType == "FacultativeReinsurance" {
		return &model.GIFIntegrationResponse{
			Success:         true,
			TransactionHash: fmt.Sprintf("0x%s", uuid.New().String()),
			ContractID:      fmt.Sprintf("gif-contract-%s", uuid.New().String()),
			Error:           "",
		}, nil
	}

	if req.ContractType == "ClaimCession" {
		return &model.GIFIntegrationResponse{
			Success:         true,
			TransactionHash: fmt.Sprintf("0x%s", uuid.New().String()),
			ContractID:      req.Data["gif_contract_id"].(string),
			Error:           "",
		}, nil
	}

	return &model.GIFIntegrationResponse{
		Success: false,
		Error:   "Unknown GIF contract type",
	}, nil
}
