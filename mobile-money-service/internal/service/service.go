package service

import (
	"fmt"
	"math"
	"mobile-money-service/internal/models"
	"mobile-money-service/internal/repository"
	"time"
)

type MoMoService struct { repo *repository.MoMoRepository }
func NewMoMoService(repo *repository.MoMoRepository) *MoMoService { return &MoMoService{repo: repo} }

type PayRequest struct {
	ProviderCode string  `json:"provider_code"`
	Phone        string  `json:"phone"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	PolicyID     string  `json:"policy_id,omitempty"`
	Reference    string  `json:"reference,omitempty"`
}

func (s *MoMoService) InitiatePayment(req PayRequest) (*models.MoMoTransaction, error) {
	provider, err := s.repo.GetProvider(req.ProviderCode)
	if err != nil { return nil, err }
	if !provider.IsActive { return nil, fmt.Errorf("provider %s is not active", req.ProviderCode) }
	if req.Amount < provider.MinAmount { return nil, fmt.Errorf("amount below minimum %.2f", provider.MinAmount) }
	if req.Amount > provider.MaxAmount { return nil, fmt.Errorf("amount exceeds maximum %.2f", provider.MaxAmount) }
	if req.Phone == "" { return nil, fmt.Errorf("phone number is required") }

	fee := math.Round((req.Amount*provider.FeePercent/100+provider.FeeFlat)*100) / 100

	tx := &models.MoMoTransaction{
		ID: fmt.Sprintf("MOMO-%d", time.Now().UnixNano()%10000000),
		Type: "collection", ProviderCode: req.ProviderCode,
		Phone: req.Phone, Amount: req.Amount, Fee: fee,
		NetAmount: req.Amount - fee, Currency: provider.Currency,
		Reference: req.Reference, PolicyID: req.PolicyID,
		Status: "pending", CreatedAt: time.Now(),
	}
	s.repo.CreateTransaction(tx)

	go s.processAsync(tx.ID)

	return tx, nil
}

func (s *MoMoService) processAsync(id string) {
	time.Sleep(2 * time.Second)
	tx, _ := s.repo.GetTransaction(id)
	if tx != nil {
		now := time.Now()
		tx.Status = "completed"
		tx.CompletedAt = &now
		tx.ProviderRef = fmt.Sprintf("REF-%d", time.Now().UnixNano()%1000000)
		s.repo.UpdateTransaction(tx)
	}
}

type DisbursementRequest struct {
	ProviderCode string  `json:"provider_code"`
	Phone        string  `json:"phone"`
	Amount       float64 `json:"amount"`
	ClaimID      string  `json:"claim_id,omitempty"`
	Reference    string  `json:"reference,omitempty"`
}

func (s *MoMoService) Disburse(req DisbursementRequest) (*models.MoMoTransaction, error) {
	provider, err := s.repo.GetProvider(req.ProviderCode)
	if err != nil { return nil, err }
	if req.Amount <= 0 { return nil, fmt.Errorf("amount must be positive") }
	if req.Phone == "" { return nil, fmt.Errorf("phone number is required") }

	fee := math.Round((req.Amount*provider.FeePercent/100+provider.FeeFlat)*100) / 100

	tx := &models.MoMoTransaction{
		ID: fmt.Sprintf("MOMO-%d", time.Now().UnixNano()%10000000),
		Type: "disbursement", ProviderCode: req.ProviderCode,
		Phone: req.Phone, Amount: req.Amount, Fee: fee,
		NetAmount: req.Amount - fee, Currency: provider.Currency,
		Reference: req.Reference, ClaimID: req.ClaimID,
		Status: "pending", CreatedAt: time.Now(),
	}
	s.repo.CreateTransaction(tx)
	go s.processAsync(tx.ID)
	return tx, nil
}

func (s *MoMoService) GetTransaction(id string) (*models.MoMoTransaction, error) { return s.repo.GetTransaction(id) }
func (s *MoMoService) ListTransactions(phone string) []models.MoMoTransaction { return s.repo.ListTransactions(phone) }
func (s *MoMoService) GetProviders(country string) []models.Provider { return s.repo.GetProviders(country) }
func (s *MoMoService) GetStats() map[string]interface{} { return s.repo.GetStats() }
