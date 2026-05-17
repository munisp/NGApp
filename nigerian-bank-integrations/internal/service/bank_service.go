package service

import (
	"context"
	"fmt"
	"nigerian-bank-integrations/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BankService struct {
	db *gorm.DB
}

func NewBankService(db *gorm.DB) *BankService {
	return &BankService{db: db}
}

func (s *BankService) GetBanks(ctx context.Context) ([]models.Bank, error) {
	var banks []models.Bank
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&banks).Error
	return banks, err
}

func (s *BankService) VerifyAccount(ctx context.Context, accountNumber, bankCode string) (*models.AccountVerification, error) {
	verification := &models.AccountVerification{
		ID:            uuid.New(),
		AccountNumber: accountNumber,
		BankCode:      bankCode,
		AccountName:   "Verified Account Holder",
		IsVerified:    true,
	}
	now := time.Now()
	verification.VerifiedAt = &now

	if err := s.db.WithContext(ctx).Create(verification).Error; err != nil {
		return nil, err
	}
	return verification, nil
}

func (s *BankService) InitiateTransfer(ctx context.Context, tx *models.BankTransaction) error {
	tx.ID = uuid.New()
	tx.TransactionRef = fmt.Sprintf("TXN-%d", time.Now().UnixNano())
	tx.Status = models.TransactionStatusPending
	return s.db.WithContext(ctx).Create(tx).Error
}

func (s *BankService) ProcessTransfer(ctx context.Context, transactionRef string) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.BankTransaction{}).Where("transaction_ref = ?", transactionRef).Updates(map[string]interface{}{
		"status":       models.TransactionStatusCompleted,
		"processed_at": now,
		"response_code": "00",
		"response_message": "Transaction successful",
	}).Error
}

func (s *BankService) GetTransaction(ctx context.Context, transactionRef string) (*models.BankTransaction, error) {
	var tx models.BankTransaction
	err := s.db.WithContext(ctx).First(&tx, "transaction_ref = ?", transactionRef).Error
	return &tx, err
}

func (s *BankService) GetTransactions(ctx context.Context, entityType string, entityID uuid.UUID) ([]models.BankTransaction, error) {
	var transactions []models.BankTransaction
	query := s.db.WithContext(ctx)
	if entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}
	if entityID != uuid.Nil {
		query = query.Where("entity_id = ?", entityID)
	}
	err := query.Order("created_at DESC").Find(&transactions).Error
	return transactions, err
}

func (s *BankService) AddBankAccount(ctx context.Context, account *models.BankAccount) error {
	account.ID = uuid.New()
	return s.db.WithContext(ctx).Create(account).Error
}

func (s *BankService) GetCustomerAccounts(ctx context.Context, customerID uuid.UUID) ([]models.BankAccount, error) {
	var accounts []models.BankAccount
	err := s.db.WithContext(ctx).Where("customer_id = ?", customerID).Find(&accounts).Error
	return accounts, err
}

func (s *BankService) CreateDirectDebitMandate(ctx context.Context, mandate *models.DirectDebitMandate) error {
	mandate.ID = uuid.New()
	mandate.MandateRef = fmt.Sprintf("DDM-%d", time.Now().UnixNano())
	mandate.Status = "ACTIVE"
	return s.db.WithContext(ctx).Create(mandate).Error
}

func (s *BankService) GetMandates(ctx context.Context, customerID uuid.UUID) ([]models.DirectDebitMandate, error) {
	var mandates []models.DirectDebitMandate
	err := s.db.WithContext(ctx).Where("customer_id = ? AND is_active = ?", customerID, true).Find(&mandates).Error
	return mandates, err
}

func (s *BankService) CancelMandate(ctx context.Context, mandateRef string) error {
	return s.db.WithContext(ctx).Model(&models.DirectDebitMandate{}).Where("mandate_ref = ?", mandateRef).Updates(map[string]interface{}{
		"is_active": false,
		"status":    "CANCELLED",
	}).Error
}

func (s *BankService) GetBankStats(ctx context.Context) (map[string]interface{}, error) {
	var totalTransactions, successfulTransactions, failedTransactions int64
	var totalVolume float64

	s.db.Model(&models.BankTransaction{}).Count(&totalTransactions)
	s.db.Model(&models.BankTransaction{}).Where("status = ?", models.TransactionStatusCompleted).Count(&successfulTransactions)
	s.db.Model(&models.BankTransaction{}).Where("status = ?", models.TransactionStatusFailed).Count(&failedTransactions)
	s.db.Model(&models.BankTransaction{}).Where("status = ?", models.TransactionStatusCompleted).Select("COALESCE(SUM(amount), 0)").Scan(&totalVolume)

	return map[string]interface{}{
		"total_transactions":      totalTransactions,
		"successful_transactions": successfulTransactions,
		"failed_transactions":     failedTransactions,
		"total_volume":            totalVolume,
		"success_rate":            float64(successfulTransactions) / float64(totalTransactions) * 100,
	}, nil
}
