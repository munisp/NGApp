package service

import (
	"agent-commission-management/internal/middleware"
	"agent-commission-management/internal/models"
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedCommissionService struct {
	db         *gorm.DB
	middleware *middleware.MiddlewareClients
}

func NewEnhancedCommissionService(db *gorm.DB, mw *middleware.MiddlewareClients) *EnhancedCommissionService {
	return &EnhancedCommissionService{db: db, middleware: mw}
}

func (s *EnhancedCommissionService) CalculateCommission(ctx context.Context, agentID, policyID uuid.UUID, premiumAmount float64, isNewBusiness bool) (*models.Commission, error) {
	var agent models.Agent
	if err := s.db.WithContext(ctx).First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, err
	}

	var rate models.CommissionRate
	s.db.WithContext(ctx).Where("agent_tier = ? AND is_new_business = ?", agent.Tier, isNewBusiness).First(&rate)

	commissionAmount := premiumAmount * (rate.Rate / 100)

	commission := &models.Commission{
		ID:               uuid.New(),
		AgentID:          agentID,
		PolicyID:         policyID,
		PremiumAmount:    premiumAmount,
		CommissionRate:   rate.Rate,
		CommissionAmount: commissionAmount,
		IsNewBusiness:    isNewBusiness,
		Status:           "PENDING",
		CreatedAt:        time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(commission).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.CommissionEvent{
			ID:               uuid.New(),
			EventType:        "COMMISSION_CALCULATED",
			AgentID:          agentID,
			PolicyID:         policyID,
			CommissionAmount: commissionAmount,
			Status:           "PENDING",
			Timestamp:        time.Now(),
		}
		go s.middleware.Kafka.PublishCommissionEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.TigerBeetle != nil {
		entry := &middleware.LedgerEntry{
			ID:            commission.ID,
			DebitAccount:  1000,
			CreditAccount: uint64(agent.LedgerAccountID),
			Amount:        uint64(commissionAmount * 100),
			Code:          1,
			Timestamp:     uint64(time.Now().Unix()),
		}
		go s.middleware.TigerBeetle.CreateCommissionLedgerEntry(context.Background(), entry)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.IncrementAgentSales(context.Background(), agentID, premiumAmount)
	}

	return commission, nil
}

func (s *EnhancedCommissionService) ApproveCommission(ctx context.Context, commissionID uuid.UUID, approverID uuid.UUID) error {
	result := s.db.WithContext(ctx).Model(&models.Commission{}).
		Where("id = ?", commissionID).
		Updates(map[string]interface{}{
			"status":      "APPROVED",
			"approved_by": approverID,
			"approved_at": time.Now(),
		})

	if s.middleware != nil && s.middleware.Kafka != nil {
		var commission models.Commission
		s.db.First(&commission, "id = ?", commissionID)
		event := &middleware.CommissionEvent{
			ID:               uuid.New(),
			EventType:        "COMMISSION_APPROVED",
			AgentID:          commission.AgentID,
			PolicyID:         commission.PolicyID,
			CommissionAmount: commission.CommissionAmount,
			Status:           "APPROVED",
			Timestamp:        time.Now(),
		}
		go s.middleware.Kafka.PublishCommissionEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedCommissionService) ProcessPayout(ctx context.Context, agentIDs []uuid.UUID) (*models.PayoutResult, error) {
	if s.middleware != nil && s.middleware.Temporal != nil {
		payoutID := uuid.New()
		runID, err := s.middleware.Temporal.StartPayoutWorkflow(ctx, payoutID, agentIDs)
		if err != nil {
			return nil, err
		}

		return &models.PayoutResult{
			PayoutID:   payoutID,
			WorkflowID: runID,
			Status:     "PROCESSING",
			StartedAt:  time.Now(),
		}, nil
	}

	result := &models.PayoutResult{
		PayoutID:  uuid.New(),
		StartedAt: time.Now(),
	}

	for _, agentID := range agentIDs {
		var totalPending float64
		s.db.Model(&models.Commission{}).
			Where("agent_id = ? AND status = ?", agentID, "APPROVED").
			Select("COALESCE(SUM(commission_amount), 0)").
			Scan(&totalPending)

		if totalPending > 0 {
			s.db.Model(&models.Commission{}).
				Where("agent_id = ? AND status = ?", agentID, "APPROVED").
				Update("status", "PAID")

			result.TotalAmount += totalPending
			result.AgentCount++

			if s.middleware != nil && s.middleware.TigerBeetle != nil {
				var agent models.Agent
				s.db.First(&agent, "id = ?", agentID)
				go s.middleware.TigerBeetle.ProcessPayout(context.Background(), uint64(agent.LedgerAccountID), 2000, uint64(totalPending*100))
			}

			if s.middleware != nil && s.middleware.Kafka != nil {
				event := &middleware.CommissionEvent{
					ID:               uuid.New(),
					EventType:        "COMMISSION_PAID",
					AgentID:          agentID,
					CommissionAmount: totalPending,
					Status:           "PAID",
					Timestamp:        time.Now(),
				}
				go s.middleware.Kafka.PublishCommissionEvent(context.Background(), event)
			}
		}
	}

	result.Status = "COMPLETED"
	result.CompletedAt = time.Now()
	return result, nil
}

func (s *EnhancedCommissionService) UpdateAgentTier(ctx context.Context, agentID uuid.UUID) error {
	if s.middleware != nil && s.middleware.Temporal != nil {
		s.middleware.Temporal.StartTierUpdateWorkflow(ctx, agentID)
	}

	var totalSales float64
	s.db.Model(&models.Commission{}).
		Where("agent_id = ? AND created_at >= ?", agentID, time.Now().AddDate(-1, 0, 0)).
		Select("COALESCE(SUM(premium_amount), 0)").
		Scan(&totalSales)

	var newTier string
	switch {
	case totalSales >= 50000000:
		newTier = "Platinum"
	case totalSales >= 20000000:
		newTier = "Gold"
	case totalSales >= 5000000:
		newTier = "Silver"
	default:
		newTier = "Bronze"
	}

	return s.db.WithContext(ctx).Model(&models.Agent{}).
		Where("id = ?", agentID).
		Update("tier", newTier).Error
}

func (s *EnhancedCommissionService) GetAgentCommissions(ctx context.Context, agentID uuid.UUID) ([]models.Commission, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedAgentCommission(ctx, agentID); err == nil {
			var commissions []models.Commission
			if json.Unmarshal(cached, &commissions) == nil {
				return commissions, nil
			}
		}
	}

	var commissions []models.Commission
	err := s.db.WithContext(ctx).Where("agent_id = ?", agentID).Order("created_at DESC").Find(&commissions).Error

	if s.middleware != nil && s.middleware.Redis != nil && err == nil {
		data, _ := json.Marshal(commissions)
		go s.middleware.Redis.CacheAgentCommission(context.Background(), agentID, data, 15*time.Minute)
	}

	return commissions, err
}

func (s *EnhancedCommissionService) GetAgentStats(ctx context.Context, agentID uuid.UUID) (map[string]interface{}, error) {
	var totalCommission, pendingCommission, paidCommission float64
	var policyCount int64

	s.db.Model(&models.Commission{}).Where("agent_id = ?", agentID).Select("COALESCE(SUM(commission_amount), 0)").Scan(&totalCommission)
	s.db.Model(&models.Commission{}).Where("agent_id = ? AND status = ?", agentID, "PENDING").Select("COALESCE(SUM(commission_amount), 0)").Scan(&pendingCommission)
	s.db.Model(&models.Commission{}).Where("agent_id = ? AND status = ?", agentID, "PAID").Select("COALESCE(SUM(commission_amount), 0)").Scan(&paidCommission)
	s.db.Model(&models.Commission{}).Where("agent_id = ?", agentID).Count(&policyCount)

	var agent models.Agent
	s.db.First(&agent, "id = ?", agentID)

	return map[string]interface{}{
		"agent_id":           agentID,
		"agent_name":         agent.Name,
		"tier":               agent.Tier,
		"total_commission":   totalCommission,
		"pending_commission": pendingCommission,
		"paid_commission":    paidCommission,
		"policy_count":       policyCount,
	}, nil
}

func (s *EnhancedCommissionService) GetCommissionRates(ctx context.Context) ([]models.CommissionRate, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedCommissionRates(ctx); err == nil {
			var rates []models.CommissionRate
			if json.Unmarshal(cached, &rates) == nil {
				return rates, nil
			}
		}
	}

	var rates []models.CommissionRate
	err := s.db.WithContext(ctx).Find(&rates).Error

	if s.middleware != nil && s.middleware.Redis != nil && err == nil {
		data, _ := json.Marshal(rates)
		go s.middleware.Redis.CacheCommissionRates(context.Background(), data, 1*time.Hour)
	}

	return rates, err
}

func (s *EnhancedCommissionService) GetMiddlewareStatus(ctx context.Context) *middleware.MiddlewareStatus {
	if s.middleware == nil {
		return nil
	}
	return s.middleware.GetStatus(ctx)
}
