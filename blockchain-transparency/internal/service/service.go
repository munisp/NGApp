package service

import (
	"blockchain-transparency/internal/models"
	"blockchain-transparency/internal/repository"
	"fmt"
	"time"
)

type BlockchainService struct {
	repo         *repository.BlockchainRepository
	autoMineSize int
}

func NewBlockchainService(repo *repository.BlockchainRepository) *BlockchainService {
	return &BlockchainService{repo: repo, autoMineSize: 5}
}

type RecordTxRequest struct {
	Type        string  `json:"type"`
	PolicyID    string  `json:"policy_id"`
	ClaimID     string  `json:"claim_id,omitempty"`
	FromAddress string  `json:"from_address"`
	ToAddress   string  `json:"to_address"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Data        string  `json:"data,omitempty"`
}

func (s *BlockchainService) RecordTransaction(req RecordTxRequest) (*models.Transaction, error) {
	if req.Amount < 0 {
		return nil, fmt.Errorf("amount cannot be negative")
	}
	if req.PolicyID == "" {
		return nil, fmt.Errorf("policy_id is required")
	}

	txType := models.TransactionType(req.Type)
	validTypes := map[models.TransactionType]bool{
		models.TxPremiumPayment: true, models.TxClaimPayout: true,
		models.TxPolicyCreation: true, models.TxPolicyRenewal: true,
		models.TxRefund: true, models.TxCommission: true,
	}
	if !validTypes[txType] {
		return nil, fmt.Errorf("invalid transaction type: %s", req.Type)
	}

	tx := &models.Transaction{
		ID:          fmt.Sprintf("TX-%d", time.Now().UnixNano()%100000000),
		Type:        txType,
		PolicyID:    req.PolicyID,
		ClaimID:     req.ClaimID,
		FromAddress: req.FromAddress,
		ToAddress:   req.ToAddress,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Data:        req.Data,
		CreatedAt:   time.Now(),
	}

	s.repo.AddTransaction(tx)

	s.repo.AddAuditRecord(&models.AuditRecord{
		ID:            fmt.Sprintf("AUD-%d", time.Now().UnixNano()%100000000),
		TransactionID: tx.ID,
		Action:        "transaction_recorded",
		Actor:         req.FromAddress,
		Details:       fmt.Sprintf("%s: %s %.2f for policy %s", req.Type, req.Currency, req.Amount, req.PolicyID),
		Timestamp:     time.Now(),
	})

	return tx, nil
}

func (s *BlockchainService) MineBlock() (*models.Block, error) {
	block := s.repo.MineBlock()
	if block == nil {
		return nil, fmt.Errorf("no pending transactions to mine")
	}
	return block, nil
}

func (s *BlockchainService) GetBlock(index int64) (*models.Block, error) {
	return s.repo.GetBlock(index)
}

func (s *BlockchainService) GetTransaction(id string) (*models.Transaction, error) {
	return s.repo.GetTransaction(id)
}

func (s *BlockchainService) GetChain() []models.Block {
	return s.repo.GetChain()
}

func (s *BlockchainService) ValidateChain() bool {
	return s.repo.ValidateChain()
}

func (s *BlockchainService) GetAuditLog(txID string) []models.AuditRecord {
	return s.repo.GetAuditLog(txID)
}

func (s *BlockchainService) GetStats() models.ChainStats {
	return s.repo.GetStats()
}
