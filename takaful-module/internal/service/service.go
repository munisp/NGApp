package service

import (
	"fmt"
	"math"
	"takaful-module/internal/models"
	"takaful-module/internal/repository"
	"time"
)

type TakafulService struct {
	repo *repository.TakafulRepository
}

func NewTakafulService(repo *repository.TakafulRepository) *TakafulService {
	return &TakafulService{repo: repo}
}

type JoinRequest struct {
	FundID          string  `json:"fund_id"`
	CustomerID      string  `json:"customer_id"`
	Name            string  `json:"name"`
	ContributionAmt float64 `json:"contribution_amount"`
}

func (s *TakafulService) JoinFund(req JoinRequest) (*models.TakafulParticipant, error) {
	fund, err := s.repo.GetFund(req.FundID)
	if err != nil {
		return nil, err
	}
	if !fund.IsActive {
		return nil, fmt.Errorf("fund %s is not active", req.FundID)
	}
	if req.ContributionAmt <= 0 {
		return nil, fmt.Errorf("contribution must be positive")
	}

	wakalaFee := math.Round(req.ContributionAmt*fund.WakalaFeeRate*100) / 100
	remaining := req.ContributionAmt - wakalaFee
	tabarruPortion := math.Round(remaining*0.30*100) / 100
	investPortion := remaining - tabarruPortion

	coverageMultiplier := 10.0
	if fund.FundType == "health" {
		coverageMultiplier = 5.0
	}

	participant := &models.TakafulParticipant{
		ID:              fmt.Sprintf("TP-%d", time.Now().UnixNano()%10000000),
		FundID:          req.FundID,
		CustomerID:      req.CustomerID,
		Name:            req.Name,
		ContributionAmt: req.ContributionAmt,
		TabarruPortion:  tabarruPortion,
		InvestPortion:   investPortion,
		WakalaFee:       wakalaFee,
		CoverageAmount:  req.ContributionAmt * coverageMultiplier,
		Status:          "active",
		JoinedAt:        time.Now(),
	}

	if err := s.repo.AddParticipant(participant); err != nil {
		return nil, err
	}

	fund.TotalContributions += req.ContributionAmt
	fund.TabarruPool += tabarruPortion
	fund.InvestmentPool += investPortion
	fund.ParticipantCount++
	s.repo.UpdateFund(fund)

	s.repo.AddContribution(models.TakafulContribution{
		ID:            fmt.Sprintf("TC-%d", time.Now().UnixNano()%10000000),
		ParticipantID: participant.ID,
		FundID:        req.FundID,
		Amount:        req.ContributionAmt,
		Type:          models.Tabarru,
		TabarruAmount: tabarruPortion,
		InvestAmount:  investPortion,
		WakalaAmount:  wakalaFee,
		Period:        time.Now().Format("2006-01"),
		CreatedAt:     time.Now(),
	})

	return participant, nil
}

func (s *TakafulService) DistributeSurplus(fundID, period string) (*models.SurplusDistribution, error) {
	fund, err := s.repo.GetFund(fundID)
	if err != nil {
		return nil, err
	}
	if fund.SurplusAmount <= 0 {
		return nil, fmt.Errorf("no surplus to distribute in fund %s", fundID)
	}

	participants := s.repo.ListParticipants(fundID)
	if len(participants) == 0 {
		return nil, fmt.Errorf("no participants in fund %s", fundID)
	}

	distributePct := 0.70
	distributeAmt := math.Round(fund.SurplusAmount*distributePct*100) / 100
	retainedAmt := fund.SurplusAmount - distributeAmt
	perCapita := math.Round(distributeAmt/float64(len(participants))*100) / 100

	for i := range participants {
		participants[i].SurplusShare += perCapita
	}

	dist := models.SurplusDistribution{
		ID:             fmt.Sprintf("SD-%d", time.Now().UnixNano()%10000000),
		FundID:         fundID,
		Period:         period,
		TotalSurplus:   fund.SurplusAmount,
		DistributedAmt: distributeAmt,
		RetainedAmt:    retainedAmt,
		ParticipantCnt: len(participants),
		PerCapitaShare: perCapita,
		DistributedAt:  time.Now(),
	}
	s.repo.AddDistribution(dist)

	fund.SurplusAmount = retainedAmt
	s.repo.UpdateFund(fund)

	return &dist, nil
}

func (s *TakafulService) RunComplianceCheck(fundID string) (*models.ShariaCompliance, error) {
	fund, err := s.repo.GetFund(fundID)
	if err != nil {
		return nil, err
	}

	status := "compliant"
	details := "All Sharia compliance checks passed"

	if fund.WakalaFeeRate > 0.15 {
		status = "warning"
		details = "Wakala fee rate exceeds recommended 15% threshold"
	}
	if fund.ClaimsPaid > fund.TabarruPool*0.9 {
		status = "attention"
		details = "Tabarru pool near depletion - claims paid exceed 90% of pool"
	}

	check := models.ShariaCompliance{
		ID:        fmt.Sprintf("SC-%d", time.Now().UnixNano()%10000000),
		FundID:    fundID,
		CheckType: "quarterly_audit",
		Status:    status,
		Details:   details,
		Auditor:   "Sharia Advisory Board",
		CheckedAt: time.Now(),
	}
	s.repo.AddCompliance(check)
	return &check, nil
}

func (s *TakafulService) GetFunds() []models.TakafulFund { return s.repo.GetFunds() }
func (s *TakafulService) GetFund(id string) (*models.TakafulFund, error) { return s.repo.GetFund(id) }
func (s *TakafulService) GetParticipant(id string) (*models.TakafulParticipant, error) { return s.repo.GetParticipant(id) }
func (s *TakafulService) ListParticipants(fundID string) []models.TakafulParticipant { return s.repo.ListParticipants(fundID) }
func (s *TakafulService) GetContributions(participantID string) []models.TakafulContribution { return s.repo.GetContributions(participantID) }
func (s *TakafulService) GetDistributions(fundID string) []models.SurplusDistribution { return s.repo.GetDistributions(fundID) }
func (s *TakafulService) GetCompliance(fundID string) []models.ShariaCompliance { return s.repo.GetCompliance(fundID) }
