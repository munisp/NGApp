package core

// CurrencyNGN is the ISO 4217 numeric code for Nigerian Naira (NGN = 566).
// TigerBeetle uses uint16 currency codes aligned with ISO 4217.
const CurrencyNGN uint16 = 566

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/etherisc/reinsurance-accounting-service/internal/tigerbeetle"
)

// Repository defines the interface for data persistence (non-TigerBeetle data).
type Repository interface {
	CreateReinsurer(ctx context.Context, reinsurer *Reinsurer) error
	GetReinsurerByID(ctx context.Context, id uint64) (*Reinsurer, error)
	CreateContract(ctx context.Context, contract *ReinsuranceContract) error
	GetContractByPolicyID(ctx context.Context, policyID uint64) (*ReinsuranceContract, error)
	RecordTransaction(ctx context.Context, transaction *ReinsuranceTransaction) error
	GetTransactionsByReinsurerID(ctx context.Context, reinsurerID uint64) ([]ReinsuranceTransaction, error)
	GetUnsettledTransactionsByReinsurerID(ctx context.Context, reinsurerID uint64) ([]ReinsuranceTransaction, error)
}

// TigerBeetleClient defines the interface for TigerBeetle operations.
type TigerBeetleClient interface {
	CreateReinsurerAccounts(ctx context.Context, reinsurerID uint64) (cededID, recoveryID, settlementID uint64, err error)
	PostTransfer(ctx context.Context, id uint64, debitAccountID, creditAccountID uint64, amount uint64, currency uint16, ledger uint32, code uint16) (uint64, error)
	GetAccountBalance(ctx context.Context, accountID uint64) (uint64, error)
	Close()
}

// TemporalClient defines the interface for Temporal operations.
type TemporalClient interface {
	StartSettlementWorkflow(ctx context.Context, reinsurerID uint64) (string, error)
}

// Service implements the core business logic for reinsurance accounting.
type Service struct {
	repo Repository
	tbClient TigerBeetleClient
	temporalClient TemporalClient
	logger *slog.Logger
}

// NewService creates a new core service instance.
func NewService(repo Repository, tbClient TigerBeetleClient, temporalClient TemporalClient, logger *slog.Logger) *Service {
	return &Service{
		repo: repo,
		tbClient: tbClient,
		temporalClient: temporalClient,
		logger: logger,
	}
}

// CreateReinsurer registers a new reinsurer and creates their TigerBeetle accounts.
func (s *Service) CreateReinsurer(ctx context.Context, name string) (*Reinsurer, error) {
	// 1. Create a temporary Reinsurer object to get an ID from the repository
	tempReinsurer := &Reinsurer{Name: name}
	if err := s.repo.CreateReinsurer(ctx, tempReinsurer); err != nil {
		return nil, fmt.Errorf("failed to create temporary reinsurer in repo: %w", err)
	}

	// 2. Create TigerBeetle accounts
	cededID, recoveryID, settlementID, err := s.tbClient.CreateReinsurerAccounts(ctx, tempReinsurer.ID)
	if err != nil {
		// In a real system, we'd need to clean up the temporary repo entry if TB fails.
		return nil, fmt.Errorf("failed to create TigerBeetle accounts for reinsurer %d: %w", tempReinsurer.ID, err)
	}

	// 3. Update the Reinsurer object with the new account IDs and save
	reinsurer := &Reinsurer{
		ID: tempReinsurer.ID,
		Name: name,
		CededPremiumAccountID: cededID,
		ClaimRecoveryAccountID: recoveryID,
		SettlementAccountID: settlementID,
	}

	if err := s.repo.CreateReinsurer(ctx, reinsurer); err != nil {
		return nil, fmt.Errorf("failed to update reinsurer with account IDs: %w", err)
	}

	s.logger.Info("Successfully created new reinsurer", "id", reinsurer.ID, "name", name)
	return reinsurer, nil
}

// RecordCededPremium calculates and records the ceded premium for a policy.
func (s *Service) RecordCededPremium(ctx context.Context, policyID uint64, totalPremium uint64, currency uint16, sourceEventID uint64) (*ReinsuranceTransaction, error) {
	contract, err := s.repo.GetContractByPolicyID(ctx, policyID)
	if err != nil {
		return nil, fmt.Errorf("no reinsurance contract found for policy %d: %w", policyID, err)
	}

	reinsurer, err := s.repo.GetReinsurerByID(ctx, contract.ReinsurerID)
	if err != nil {
		return nil, fmt.Errorf("reinsurer %d not found: %w", contract.ReinsurerID, err)
	}

	// Calculate ceded amount: totalPremium * cessionRate
	cededAmountFloat := float64(totalPremium) * contract.CessionRate
	cededAmount := uint64(math.Round(cededAmountFloat))

	// The transfer: GIF's Premium Revenue Account (Credit) -> Reinsurer Ceded Premium Account (Debit)
	// For simplicity, we'll assume a generic GIF Internal Account (ID 1, Ledger 100) for the other side of the transfer.
	// In a real system, this would be the actual GIF Policy/Premium account.
	const gifInternalAccountID uint64 = 1
	const reinsuranceLedger uint32 = 100
	const transferCode uint16 = 10

	// 1. Post the transfer to TigerBeetle
	transferID, err := s.tbClient.PostTransfer(
		ctx,
		sourceEventID, // Use source event ID as transfer ID for simplicity
		reinsurer.CededPremiumAccountID, // Debit: Reinsurer's Ceded Premium Account (GIF's Liability)
		gifInternalAccountID,            // Credit: GIF's Internal Premium Account (GIF's Revenue)
		cededAmount,
		currency,
		reinsuranceLedger,
		transferCode,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to post ceded premium transfer: %w", err)
	}

	// 2. Record the transaction in the repository
	transaction := &ReinsuranceTransaction{
		ContractID: contract.ID,
		PolicyID: policyID,
		Type: TransactionTypeCededPremium,
		Amount: cededAmount,
		Currency: currency,
		SourceEventID: sourceEventID,
		TransferIDs: []uint64{transferID},
	}

	if err := s.repo.RecordTransaction(ctx, transaction); err != nil {
		return nil, fmt.Errorf("failed to record ceded premium transaction: %w", err)
	}

	s.logger.Info("Ceded premium recorded", "policy_id", policyID, "amount", cededAmount)
	return transaction, nil
}

// RecordClaimRecovery calculates and records the claim recovery from the reinsurer.
func (s *Service) RecordClaimRecovery(ctx context.Context, policyID uint64, totalClaimAmount uint64, currency uint16, sourceEventID uint64) (*ReinsuranceTransaction, error) {
	contract, err := s.repo.GetContractByPolicyID(ctx, policyID)
	if err != nil {
		return nil, fmt.Errorf("no reinsurance contract found for policy %d: %w", policyID, err)
	}

	reinsurer, err := s.repo.GetReinsurerByID(ctx, contract.ReinsurerID)
	if err != nil {
		return nil, fmt.Errorf("reinsurer %d not found: %w", contract.ReinsurerID, err)
	}

	// Calculate recovery amount: totalClaimAmount * cessionRate
	recoveryAmountFloat := float64(totalClaimAmount) * contract.CessionRate
	recoveryAmount := uint64(math.Round(recoveryAmountFloat))

	// The transfer: Reinsurer Claim Recovery Account (Debit) -> GIF's Claim Expense Account (Credit)
	// For simplicity, we'll assume a generic GIF Internal Account (ID 1, Ledger 100) for the other side of the transfer.
	const gifInternalAccountID uint64 = 1
	const reinsuranceLedger uint32 = 100
	const transferCode uint16 = 20

	// 1. Post the transfer to TigerBeetle
	transferID, err := s.tbClient.PostTransfer(
		ctx,
		sourceEventID, // Use source event ID as transfer ID for simplicity
		reinsurer.ClaimRecoveryAccountID, // Debit: Reinsurer's Claim Recovery Account (GIF's Asset)
		gifInternalAccountID,             // Credit: GIF's Internal Claim Account (GIF's Expense)
		recoveryAmount,
		currency,
		reinsuranceLedger,
		transferCode,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to post claim recovery transfer: %w", err)
	}

	// 2. Record the transaction in the repository
	transaction := &ReinsuranceTransaction{
		ContractID: contract.ID,
		PolicyID: policyID,
		Type: TransactionTypeClaimRecovery,
		Amount: recoveryAmount,
		Currency: currency,
		SourceEventID: sourceEventID,
		TransferIDs: []uint64{transferID},
	}

	if err := s.repo.RecordTransaction(ctx, transaction); err != nil {
		return nil, fmt.Errorf("failed to record claim recovery transaction: %w", err)
	}

	s.logger.Info("Claim recovery recorded", "policy_id", policyID, "amount", recoveryAmount)
	return transaction, nil
}

// CreateReinsuranceContract creates a new reinsurance contract.
func (s *Service) CreateReinsuranceContract(ctx context.Context, reinsurerID, policyID uint64, cessionRate float64) (*ReinsuranceContract, error) {
	// Basic validation
	if cessionRate <= 0 || cessionRate > 1.0 {
		return nil, fmt.Errorf("cession rate must be between 0 and 1, got %f", cessionRate)
	}

	// Check if reinsurer exists
	if _, err := s.repo.GetReinsurerByID(ctx, reinsurerID); err != nil {
		return nil, fmt.Errorf("reinsurer with ID %d not found: %w", reinsurerID, err)
	}

	contract := &ReinsuranceContract{
		ReinsurerID: reinsurerID,
		PolicyID: policyID,
		CessionRate: cessionRate,
		EffectiveDate: time.Now().UTC(),
	}

	if err := s.repo.CreateContract(ctx, contract); err != nil {
		return nil, fmt.Errorf("failed to create reinsurance contract: %w", err)
	}

	s.logger.Info("Reinsurance contract created", "contract_id", contract.ID, "policy_id", policyID)
	return contract, nil
}

// GenerateReconciliationReport generates a report for a given reinsurer.
func (s *Service) GenerateReconciliationReport(ctx context.Context, reinsurerID uint64) (*ReconciliationReport, error) {
	reinsurer, err := s.repo.GetReinsurerByID(ctx, reinsurerID)
	if err != nil {
		return nil, fmt.Errorf("reinsurer %d not found: %w", reinsurerID, err)
	}

	// 1. Get all unsettled transactions from the repository
	unsettled, err := s.repo.GetUnsettledTransactionsByReinsurerID(ctx, reinsurerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get unsettled transactions: %w", err)
	}

	// 2. Calculate summary totals
	var totalCededPremium uint64
	var totalClaimRecovery uint64
	for _, tx := range unsettled {
		switch tx.Type {
		case TransactionTypeCededPremium:
			totalCededPremium += tx.Amount
		case TransactionTypeClaimRecovery:
			totalClaimRecovery += tx.Amount
		}
	}

	// 3. Get the current balance of the settlement account from TigerBeetle
	settlementBalance, err := s.tbClient.GetAccountBalance(ctx, reinsurer.SettlementAccountID)
	if err != nil {
		return nil, fmt.Errorf("failed to get settlement account balance: %w", err)
	}

	// 4. Construct the report
	report := &ReconciliationReport{
		ReinsurerID: reinsurerID,
		PeriodStart: time.Time{}, // In a real system, this would be the last settlement date
		PeriodEnd: time.Now().UTC(),
		TotalCededPremium: totalCededPremium,
		TotalClaimRecovery: totalClaimRecovery,
		SettlementAccountBalance: settlementBalance,
		UnsettledTransactions: unsettled,
	}

	s.logger.Info("Reconciliation report generated", "reinsurer_id", reinsurerID)
	return report, nil
}

// InitiateSettlement initiates the settlement process for a reinsurer.
// This is a simplified version of the settlement workflow.
func (s *Service) InitiateSettlement(ctx context.Context, reinsurerID uint64) (*ReinsuranceTransaction, error) {
	reinsurer, err := s.repo.GetReinsurerByID(ctx, reinsurerID)
	if err != nil {
		return nil, fmt.Errorf("reinsurer %d not found: %w", reinsurerID, err)
	}

	// 1. Get the current balance of the settlement account from TigerBeetle
	// The balance represents the net amount owed to/from the reinsurer.
	settlementAmount, err := s.tbClient.GetAccountBalance(ctx, reinsurer.SettlementAccountID)
	if err != nil {
		return nil, fmt.Errorf("failed to get settlement account balance: %w", err)
	}

	if settlementAmount == 0 {
		s.logger.Info("No settlement required", "reinsurer_id", reinsurerID)
		return nil, nil
	}

	// 2. Post the settlement transfer to clear the settlement account via TigerBeetle.
	// The GIF Payment Account (ID 2, Ledger 100) is the contra account for the settlement.
	const gifPaymentAccountID uint64 = 2
	const reinsuranceLedger uint32 = 100
	const transferCode uint16 = 30
	// Use a unique ID for the settlement event
	settlementEventID := uint64(time.Now().UnixNano())

	// Transfer: GIF Payment Account (Debit) -> Reinsurer Settlement Account (Credit)
	// Positive balance = reinsurer owes GIF; negative = GIF owes reinsurer.
	transferID, err := s.tbClient.PostTransfer(
		ctx,
		settlementEventID,
		gifPaymentAccountID,             // Debit: GIF Payment Account (Asset)
		reinsurer.SettlementAccountID, // Credit: Reinsurer's Settlement Account (Clearing)
		settlementAmount,
		CurrencyNGN,
		reinsuranceLedger,
		transferCode,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to post settlement transfer: %w", err)
	}

	// 3. Record the settlement transaction
	transaction := &ReinsuranceTransaction{
		ContractID: 0, // Settlement is not tied to a single contract
		PolicyID:   0,
		Type:       TransactionTypeSettlement,
		Amount:     settlementAmount,
		Currency:      CurrencyNGN,
		SourceEventID: settlementEventID,
		TransferIDs: []uint64{transferID},
	}

	if err := s.repo.RecordTransaction(ctx, transaction); err != nil {
		return nil, fmt.Errorf("failed to record settlement transaction: %w", err)
	}

	s.logger.Info("Settlement initiated", "reinsurer_id", reinsurerID, "amount", settlementAmount)
	return transaction, nil
}

// StartSettlementWorkflow starts the asynchronous settlement workflow.
func (s *Service) StartSettlementWorkflow(ctx context.Context, reinsurerID uint64) (string, error) {
	if s.temporalClient == nil {
		return "", fmt.Errorf("temporal client is not initialized")
	}
	return s.temporalClient.StartSettlementWorkflow(ctx, reinsurerID)
}
