package service

import (
	"claims-adjudication-engine/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AdjudicationService struct {
	db *gorm.DB
}

func NewAdjudicationService(db *gorm.DB) *AdjudicationService {
	return &AdjudicationService{db: db}
}

func (s *AdjudicationService) ProcessClaim(ctx context.Context, claimID uuid.UUID) (*models.AdjudicationDecision, error) {
	var claim models.Claim
	if err := s.db.WithContext(ctx).First(&claim, "id = ?", claimID).Error; err != nil {
		return nil, fmt.Errorf("claim not found: %w", err)
	}

	var rules []models.AdjudicationRule
	s.db.WithContext(ctx).Where("is_active = ?", true).Order("priority ASC").Find(&rules)

	decision := s.evaluateRules(&claim, rules)
	decision.ID = uuid.New()
	decision.ClaimID = claimID

	if err := s.db.WithContext(ctx).Create(decision).Error; err != nil {
		return nil, fmt.Errorf("failed to save decision: %w", err)
	}

	s.updateClaimStatus(ctx, &claim, decision)
	return decision, nil
}

func (s *AdjudicationService) evaluateRules(claim *models.Claim, rules []models.AdjudicationRule) *models.AdjudicationDecision {
	appliedRules := []string{}
	reasoning := []string{}

	if claim.FraudScore > 0.7 {
		appliedRules = append(appliedRules, "FRAUD_HIGH_SCORE")
		reasoning = append(reasoning, "High fraud score detected")
		rulesJSON, _ := json.Marshal(appliedRules)
		return &models.AdjudicationDecision{
			DecisionType: models.DecisionTypeEscalate,
			RulesApplied: string(rulesJSON),
			Reasoning:    "Escalated due to high fraud score",
			DecidedBy:    "SYSTEM",
		}
	}

	if claim.ClaimAmount <= 50000 && claim.FraudScore < 0.3 {
		appliedRules = append(appliedRules, "AUTO_APPROVE_LOW_VALUE")
		reasoning = append(reasoning, "Low value claim with low fraud risk")
		rulesJSON, _ := json.Marshal(appliedRules)
		return &models.AdjudicationDecision{
			DecisionType: models.DecisionTypeAutoApprove,
			RulesApplied: string(rulesJSON),
			Reasoning:    "Auto-approved: Low value claim with low fraud risk",
			DecidedBy:    "SYSTEM",
		}
	}

	appliedRules = append(appliedRules, "MANUAL_REVIEW_DEFAULT")
	rulesJSON, _ := json.Marshal(appliedRules)
	return &models.AdjudicationDecision{
		DecisionType: models.DecisionTypeManualReview,
		RulesApplied: string(rulesJSON),
		Reasoning:    "Requires manual review based on claim characteristics",
		DecidedBy:    "SYSTEM",
	}
}

func (s *AdjudicationService) updateClaimStatus(ctx context.Context, claim *models.Claim, decision *models.AdjudicationDecision) {
	switch decision.DecisionType {
	case models.DecisionTypeAutoApprove:
		claim.Status = models.ClaimStatusApproved
		claim.ApprovedAmount = claim.ClaimAmount - claim.DeductibleAmount
	case models.DecisionTypeAutoReject:
		claim.Status = models.ClaimStatusRejected
	case models.DecisionTypeManualReview:
		claim.Status = models.ClaimStatusInReview
	case models.DecisionTypeEscalate:
		claim.Status = models.ClaimStatusEscalated
	}
	s.db.WithContext(ctx).Save(claim)
}

func (s *AdjudicationService) CreateRule(ctx context.Context, rule *models.AdjudicationRule) error {
	rule.ID = uuid.New()
	return s.db.WithContext(ctx).Create(rule).Error
}

func (s *AdjudicationService) GetRules(ctx context.Context) ([]models.AdjudicationRule, error) {
	var rules []models.AdjudicationRule
	err := s.db.WithContext(ctx).Order("priority ASC").Find(&rules).Error
	return rules, err
}

func (s *AdjudicationService) OverrideDecision(ctx context.Context, decisionID uuid.UUID, overriddenBy uuid.UUID, reason string, newDecision models.DecisionType) error {
	var decision models.AdjudicationDecision
	if err := s.db.WithContext(ctx).First(&decision, "id = ?", decisionID).Error; err != nil {
		return err
	}

	decision.IsOverridden = true
	decision.OverriddenBy = &overriddenBy
	decision.OverrideReason = reason

	newDec := &models.AdjudicationDecision{
		ID:           uuid.New(),
		ClaimID:      decision.ClaimID,
		DecisionType: newDecision,
		Reasoning:    fmt.Sprintf("Manual override: %s", reason),
		DecidedBy:    "MANUAL",
		DecidedAt:    time.Now(),
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&decision).Error; err != nil {
			return err
		}
		return tx.Create(newDec).Error
	})
}

func (s *AdjudicationService) GetClaimDecisions(ctx context.Context, claimID uuid.UUID) ([]models.AdjudicationDecision, error) {
	var decisions []models.AdjudicationDecision
	err := s.db.WithContext(ctx).Where("claim_id = ?", claimID).Order("decided_at DESC").Find(&decisions).Error
	return decisions, err
}

func (s *AdjudicationService) GetAdjudicationStats(ctx context.Context) (map[string]interface{}, error) {
	var totalClaims, approvedClaims, rejectedClaims, pendingClaims int64
	var avgProcessingTime float64

	s.db.Model(&models.Claim{}).Count(&totalClaims)
	s.db.Model(&models.Claim{}).Where("status = ?", models.ClaimStatusApproved).Count(&approvedClaims)
	s.db.Model(&models.Claim{}).Where("status = ?", models.ClaimStatusRejected).Count(&rejectedClaims)
	s.db.Model(&models.Claim{}).Where("status IN ?", []models.ClaimStatus{models.ClaimStatusPending, models.ClaimStatusInReview}).Count(&pendingClaims)

	return map[string]interface{}{
		"total_claims":         totalClaims,
		"approved_claims":      approvedClaims,
		"rejected_claims":      rejectedClaims,
		"pending_claims":       pendingClaims,
		"approval_rate":        float64(approvedClaims) / float64(totalClaims) * 100,
		"avg_processing_hours": avgProcessingTime,
	}, nil
}
