package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"claim-service/internal/models"
	"claim-service/internal/repository"
)

type ClaimService struct {
	repo *repository.ClaimRepository
}

func NewClaimService(repo *repository.ClaimRepository) *ClaimService {
	return &ClaimService{repo: repo}
}

func (s *ClaimService) FileClaim(ctx context.Context, claim *models.Claim) error {
	if claim.Amount <= 0 { return fmt.Errorf("claim amount must be positive") }
	if claim.PolicyID == "" { return fmt.Errorf("policy_id is required") }
	if claim.CustomerID == "" { return fmt.Errorf("customer_id is required") }
	claim.Priority = s.assessPriority(claim.Amount, claim.ClaimType)
	return s.repo.Create(ctx, claim)
}

func (s *ClaimService) GetClaim(ctx context.Context, id string) (*models.Claim, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ClaimService) ListClaims(ctx context.Context, filter models.ClaimFilter) ([]models.Claim, error) {
	return s.repo.List(ctx, filter)
}

func (s *ClaimService) UpdateClaim(ctx context.Context, claim *models.Claim) error {
	existing, err := s.repo.GetByID(ctx, claim.ID)
	if err != nil { return err }
	if existing.Status == models.StatusPaid || existing.Status == models.StatusClosed {
		return fmt.Errorf("cannot update a %s claim", existing.Status)
	}
	return s.repo.Update(ctx, claim)
}

func (s *ClaimService) DeleteClaim(ctx context.Context, id string) error {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil { return err }
	if existing.Status != models.StatusPending {
		return fmt.Errorf("can only delete pending claims, current status: %s", existing.Status)
	}
	return s.repo.Delete(ctx, id)
}

func (s *ClaimService) ApproveClaim(ctx context.Context, id string, approvedAmount float64) error {
	claim, err := s.repo.GetByID(ctx, id)
	if err != nil { return err }
	if !s.canTransition(claim.Status, models.StatusApproved) {
		return fmt.Errorf("cannot approve claim with status %s", claim.Status)
	}
	if approvedAmount <= 0 { approvedAmount = claim.Amount }
	if approvedAmount > claim.Amount*1.1 { return fmt.Errorf("approved amount cannot exceed 110%% of claimed amount") }
	claim.ApprovedAmount = approvedAmount
	claim.Status = models.StatusApproved
	now := time.Now(); claim.ResolvedDate = &now
	return s.repo.Update(ctx, claim)
}

func (s *ClaimService) RejectClaim(ctx context.Context, id, reason string) error {
	claim, err := s.repo.GetByID(ctx, id)
	if err != nil { return err }
	if !s.canTransition(claim.Status, models.StatusRejected) {
		return fmt.Errorf("cannot reject claim with status %s", claim.Status)
	}
	if reason == "" { return fmt.Errorf("rejection reason is required") }
	claim.Status = models.StatusRejected
	claim.RejectionReason = reason
	now := time.Now(); claim.ResolvedDate = &now
	return s.repo.Update(ctx, claim)
}

func (s *ClaimService) StartReview(ctx context.Context, id, assignee string) error {
	claim, err := s.repo.GetByID(ctx, id)
	if err != nil { return err }
	if !s.canTransition(claim.Status, models.StatusUnderReview) {
		return fmt.Errorf("cannot start review for claim with status %s", claim.Status)
	}
	claim.Status = models.StatusUnderReview
	claim.AssignedTo = assignee
	return s.repo.Update(ctx, claim)
}

func (s *ClaimService) UploadDocument(ctx context.Context, doc *models.ClaimDocument) error {
	if _, err := s.repo.GetByID(ctx, doc.ClaimID); err != nil { return fmt.Errorf("claim not found: %s", doc.ClaimID) }
	return s.repo.CreateDocument(ctx, doc)
}

func (s *ClaimService) ListDocuments(ctx context.Context, claimID string) ([]models.ClaimDocument, error) {
	return s.repo.ListDocuments(ctx, claimID)
}

func (s *ClaimService) AddNote(ctx context.Context, note *models.ClaimNote) error {
	if _, err := s.repo.GetByID(ctx, note.ClaimID); err != nil { return fmt.Errorf("claim not found: %s", note.ClaimID) }
	return s.repo.CreateNote(ctx, note)
}

func (s *ClaimService) ListNotes(ctx context.Context, claimID string) ([]models.ClaimNote, error) {
	return s.repo.ListNotes(ctx, claimID)
}

func (s *ClaimService) canTransition(from, to string) bool {
	allowed, ok := models.ValidTransitions[from]
	if !ok { return false }
	for _, st := range allowed { if st == to { return true } }
	return false
}

func (s *ClaimService) assessPriority(amount float64, claimType string) string {
	if amount > 5000000 || claimType == "death" || claimType == "total_loss" { return models.PriorityCritical }
	if amount > 1000000 || claimType == "disability" || claimType == "fire" { return models.PriorityHigh }
	if amount > 100000 { return models.PriorityMedium }
	return models.PriorityLow
}

func (s *ClaimService) CalculateSettlement(claim *models.Claim) float64 {
	base := claim.Amount
	switch claim.ClaimType {
	case "health": return math.Min(base, base*0.80)
	case "auto": return base * 0.85
	case "property": return base * 0.90
	default: return base
	}
}
