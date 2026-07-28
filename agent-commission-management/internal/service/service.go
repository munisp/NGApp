package service

import (
	"agent-commission-management/internal/models"
	"agent-commission-management/internal/repository"
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

type CommissionService struct{ repo *repository.CommissionRepository }

func NewCommissionService(repo *repository.CommissionRepository) *CommissionService {
	return &CommissionService{repo: repo}
}

func (s *CommissionService) RegisterAgent(ctx context.Context, req RegisterAgentRequest) (*models.Agent, error) {
	agent := &models.Agent{
		AgentCode: req.AgentCode, FullName: req.FullName, Email: req.Email,
		Phone: req.Phone, AgentType: req.AgentType, LicenseNumber: req.LicenseNumber,
		TierLevel: "bronze", Region: req.Region, BankName: req.BankName,
		AccountNumber: req.AccountNumber, TaxID: req.TaxID, Status: "active",
	}
	if err := s.repo.CreateAgent(ctx, agent); err != nil {
		return nil, fmt.Errorf("failed to register agent: %w", err)
	}
	return agent, nil
}

func (s *CommissionService) CreateCommissionStructure(ctx context.Context, req CreateStructureRequest) (*models.CommissionStructure, error) {
	structure := &models.CommissionStructure{
		Name: req.Name, ProductType: req.ProductType, AgentType: req.AgentType,
		TierLevel: req.TierLevel, BaseRate: req.BaseRate, RenewalRate: req.RenewalRate,
		OverrideRate: req.OverrideRate, BonusThreshold: req.BonusThreshold,
		BonusRate: req.BonusRate, ClawbackPeriod: req.ClawbackPeriod,
		ClawbackRate: req.ClawbackRate, EffectiveFrom: req.EffectiveFrom, Status: "active",
	}
	if err := s.repo.CreateStructure(ctx, structure); err != nil {
		return nil, fmt.Errorf("failed to create structure: %w", err)
	}
	return structure, nil
}

func (s *CommissionService) CalculateCommission(ctx context.Context, req CalculateCommissionRequest) (*models.CommissionTransaction, error) {
	agent, err := s.repo.GetAgent(ctx, req.AgentID)
	if err != nil { return nil, fmt.Errorf("agent not found") }
	if agent.Status != "active" { return nil, fmt.Errorf("agent is not active") }

	structure, err := s.repo.GetStructure(ctx, req.ProductType, agent.AgentType, agent.TierLevel)
	if err != nil { return nil, fmt.Errorf("no commission structure found for product=%s agent=%s tier=%s", req.ProductType, agent.AgentType, agent.TierLevel) }

	rate := structure.BaseRate
	if req.IsRenewal { rate = structure.RenewalRate }
	grossCommission := req.GrossPremium * rate
	withholdingTax := grossCommission * 0.10 // 10% WHT in Nigeria
	netCommission := grossCommission - withholdingTax

	txn := &models.CommissionTransaction{
		AgentID: req.AgentID, PolicyID: req.PolicyID, PolicyNumber: req.PolicyNumber,
		ProductType: req.ProductType, GrossPremium: req.GrossPremium,
		CommissionRate: rate, GrossCommission: math.Round(grossCommission*100) / 100,
		WithholdingTax: math.Round(withholdingTax*100) / 100,
		NetCommission: math.Round(netCommission*100) / 100,
		Period: time.Now().Format("2006-01"), Status: "pending",
	}
	if req.IsRenewal { txn.TransactionType = "renewal" } else { txn.TransactionType = "initial" }

	if err := s.repo.CreateTransaction(ctx, txn); err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}
	return txn, nil
}

func (s *CommissionService) ApproveCommissions(ctx context.Context, agentID uuid.UUID, approvedBy string) (int, error) {
	pending, err := s.repo.GetPendingTransactions(ctx, agentID)
	if err != nil { return 0, fmt.Errorf("failed to get pending transactions: %w", err) }
	count := 0
	for _, txn := range pending {
		txn.Status = "approved"
		txn.ApprovedBy = approvedBy
		if err := s.repo.UpdateTransaction(ctx, &txn); err == nil { count++ }
	}
	return count, nil
}

func (s *CommissionService) ProcessPayment(ctx context.Context, agentID uuid.UUID) (*models.CommissionPayment, error) {
	agent, err := s.repo.GetAgent(ctx, agentID)
	if err != nil { return nil, fmt.Errorf("agent not found") }

	txns, _ := s.repo.GetTransactionsByAgent(ctx, agentID, "")
	totalGross, totalTax, totalNet := 0.0, 0.0, 0.0
	count := 0
	for i, txn := range txns {
		if txn.Status == "approved" {
			totalGross += txn.GrossCommission; totalTax += txn.WithholdingTax; totalNet += txn.NetCommission; count++
			now := time.Now()
			txns[i].Status = "paid"; txns[i].PaidAt = &now
			txns[i].PaymentRef = fmt.Sprintf("PAY-%d", time.Now().UnixNano()%1000000)
			s.repo.UpdateTransaction(ctx, &txns[i])
		}
	}
	if count == 0 { return nil, fmt.Errorf("no approved commissions to pay") }

	payment := &models.CommissionPayment{
		AgentID: agentID, PaymentRef: fmt.Sprintf("PAY-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%10000),
		Period: time.Now().Format("2006-01"), TotalGross: math.Round(totalGross*100) / 100,
		TotalTax: math.Round(totalTax*100) / 100, TotalNet: math.Round(totalNet*100) / 100,
		TransactionCount: count, BankName: agent.BankName, AccountNumber: agent.AccountNumber,
		Status: "completed",
	}
	now := time.Now(); payment.ProcessedAt = &now
	if err := s.repo.CreatePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}
	return payment, nil
}

func (s *CommissionService) ProcessClawback(ctx context.Context, req ClawbackRequest) (*models.ClawbackRecord, error) {
	clawback := &models.ClawbackRecord{
		OriginalTxnID: req.OriginalTxnID, AgentID: req.AgentID, PolicyID: req.PolicyID,
		OriginalCommission: req.OriginalCommission,
		ClawbackAmount: req.OriginalCommission * req.ClawbackRate,
		Reason: req.Reason, PolicyCancelDate: req.PolicyCancelDate, Status: "pending",
	}
	if err := s.repo.CreateClawback(ctx, clawback); err != nil {
		return nil, fmt.Errorf("failed to process clawback: %w", err)
	}

	reversalTxn := &models.CommissionTransaction{
		AgentID: req.AgentID, PolicyID: req.PolicyID, TransactionType: "clawback",
		GrossCommission: -clawback.ClawbackAmount, NetCommission: -clawback.ClawbackAmount,
		Period: time.Now().Format("2006-01"), Status: "approved",
	}
	s.repo.CreateTransaction(ctx, reversalTxn)
	return clawback, nil
}

func (s *CommissionService) CalculatePerformance(ctx context.Context, agentID uuid.UUID, period string) (*models.AgentPerformance, error) {
	totalComm, _ := s.repo.GetAgentTotalCommission(ctx, agentID, period)
	policiesSold, _ := s.repo.GetAgentPolicySold(ctx, agentID, period)
	totalPremium := totalComm * 10 // approximate

	tier := "bronze"
	if totalComm > 5000000 { tier = "platinum" } else if totalComm > 2000000 { tier = "gold" } else if totalComm > 500000 { tier = "silver" }

	perf := &models.AgentPerformance{
		AgentID: agentID, Period: period, PoliciesSold: int(policiesSold),
		TotalPremium: totalPremium, TotalCommission: totalComm,
		TierQualified: tier,
	}
	if err := s.repo.CreatePerformance(ctx, perf); err != nil {
		return nil, fmt.Errorf("failed to create performance: %w", err)
	}

	agent, _ := s.repo.GetAgent(ctx, agentID)
	if agent != nil && agent.TierLevel != tier {
		agent.TierLevel = tier
		s.repo.UpdateAgent(ctx, agent)
	}
	return perf, nil
}

func (s *CommissionService) GetAgents(ctx context.Context, status string) ([]models.Agent, error) {
	return s.repo.ListAgents(ctx, status)
}

func (s *CommissionService) GetAgent(ctx context.Context, id uuid.UUID) (*models.Agent, error) {
	return s.repo.GetAgent(ctx, id)
}

func (s *CommissionService) GetTransactions(ctx context.Context, agentID uuid.UUID, period string) ([]models.CommissionTransaction, error) {
	return s.repo.GetTransactionsByAgent(ctx, agentID, period)
}

func (s *CommissionService) GetPayments(ctx context.Context, agentID uuid.UUID) ([]models.CommissionPayment, error) {
	return s.repo.GetPaymentsByAgent(ctx, agentID)
}

func (s *CommissionService) GetPerformance(ctx context.Context, agentID uuid.UUID) ([]models.AgentPerformance, error) {
	return s.repo.GetPerformance(ctx, agentID)
}

func (s *CommissionService) GetStructures(ctx context.Context) ([]models.CommissionStructure, error) {
	return s.repo.ListStructures(ctx)
}

func (s *CommissionService) GetClawbacks(ctx context.Context, agentID uuid.UUID) ([]models.ClawbackRecord, error) {
	return s.repo.GetClawbacks(ctx, agentID)
}
