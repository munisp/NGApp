package service

import (
	"agent-commission-management/internal/models"
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CommissionService struct {
	db *gorm.DB
}

func NewCommissionService(db *gorm.DB) *CommissionService {
	return &CommissionService{db: db}
}

func (s *CommissionService) CalculateCommission(ctx context.Context, agentID, policyID uuid.UUID, premiumAmount float64, productType string) (*models.Commission, error) {
	var agent models.Agent
	if err := s.db.WithContext(ctx).First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, err
	}

	var rate models.CommissionRate
	s.db.WithContext(ctx).Where("product_type = ? AND agent_tier = ? AND is_active = ?", productType, agent.Tier, true).First(&rate)

	commissionAmount := premiumAmount * (rate.BaseRate / 100)
	bonusAmount := premiumAmount * (rate.BonusRate / 100)

	commission := &models.Commission{
		ID:               uuid.New(),
		AgentID:          agentID,
		PolicyID:         policyID,
		ProductType:      productType,
		PremiumAmount:    premiumAmount,
		CommissionRate:   rate.BaseRate,
		CommissionAmount: commissionAmount,
		BonusAmount:      bonusAmount,
		TotalAmount:      commissionAmount + bonusAmount,
		Status:           models.CommissionStatusPending,
		TransactionDate:  time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(commission).Error; err != nil {
		return nil, err
	}
	return commission, nil
}

func (s *CommissionService) ApproveCommission(ctx context.Context, commissionID, approverID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.Commission{}).Where("id = ?", commissionID).Updates(map[string]interface{}{
		"status":      models.CommissionStatusApproved,
		"approved_at": now,
		"approved_by": approverID,
	}).Error
}

func (s *CommissionService) ProcessPayout(ctx context.Context, agentID uuid.UUID) (*models.CommissionPayout, error) {
	var agent models.Agent
	if err := s.db.WithContext(ctx).First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, err
	}

	var totalAmount float64
	s.db.WithContext(ctx).Model(&models.Commission{}).Where("agent_id = ? AND status = ?", agentID, models.CommissionStatusApproved).Select("COALESCE(SUM(total_amount), 0)").Scan(&totalAmount)

	payout := &models.CommissionPayout{
		ID:           uuid.New(),
		AgentID:      agentID,
		PayoutAmount: totalAmount,
		PayoutMethod: "BANK_TRANSFER",
		BankName:     agent.BankName,
		BankAccount:  agent.BankAccount,
		Status:       models.PayoutStatusPending,
	}

	if err := s.db.WithContext(ctx).Create(payout).Error; err != nil {
		return nil, err
	}

	s.db.WithContext(ctx).Model(&models.Commission{}).Where("agent_id = ? AND status = ?", agentID, models.CommissionStatusApproved).Update("status", models.CommissionStatusPaid)

	return payout, nil
}

func (s *CommissionService) GetAgentCommissions(ctx context.Context, agentID uuid.UUID) ([]models.Commission, error) {
	var commissions []models.Commission
	err := s.db.WithContext(ctx).Where("agent_id = ?", agentID).Order("created_at DESC").Find(&commissions).Error
	return commissions, err
}

func (s *CommissionService) GetAgentStats(ctx context.Context, agentID uuid.UUID) (map[string]interface{}, error) {
	var totalEarnings, pendingAmount, paidAmount float64
	var totalPolicies int64

	s.db.Model(&models.Commission{}).Where("agent_id = ?", agentID).Select("COALESCE(SUM(total_amount), 0)").Scan(&totalEarnings)
	s.db.Model(&models.Commission{}).Where("agent_id = ? AND status = ?", agentID, models.CommissionStatusPending).Select("COALESCE(SUM(total_amount), 0)").Scan(&pendingAmount)
	s.db.Model(&models.Commission{}).Where("agent_id = ? AND status = ?", agentID, models.CommissionStatusPaid).Select("COALESCE(SUM(total_amount), 0)").Scan(&paidAmount)
	s.db.Model(&models.Commission{}).Where("agent_id = ?", agentID).Count(&totalPolicies)

	return map[string]interface{}{
		"total_earnings":  totalEarnings,
		"pending_amount":  pendingAmount,
		"paid_amount":     paidAmount,
		"total_policies":  totalPolicies,
	}, nil
}

func (s *CommissionService) UpdateAgentTier(ctx context.Context, agentID uuid.UUID) error {
	var totalSales float64
	s.db.Model(&models.Commission{}).Where("agent_id = ?", agentID).Select("COALESCE(SUM(premium_amount), 0)").Scan(&totalSales)

	var tier models.IncentiveTier
	s.db.Where("min_sales_volume <= ? AND (max_sales_volume >= ? OR max_sales_volume IS NULL) AND is_active = ?", totalSales, totalSales, true).Order("min_sales_volume DESC").First(&tier)

	if tier.ID != uuid.Nil {
		return s.db.Model(&models.Agent{}).Where("id = ?", agentID).Update("tier", tier.TierName).Error
	}
	return nil
}

func (s *CommissionService) GetCommissionRates(ctx context.Context) ([]models.CommissionRate, error) {
	var rates []models.CommissionRate
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&rates).Error
	return rates, err
}

func (s *CommissionService) CreateCommissionRate(ctx context.Context, rate *models.CommissionRate) error {
	rate.ID = uuid.New()
	return s.db.WithContext(ctx).Create(rate).Error
}
