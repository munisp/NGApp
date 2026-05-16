package core

import (
	"time"
)

// Reinsurer represents a counterparty in a reinsurance contract.
type Reinsurer struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
	// TigerBeetle Account IDs for this reinsurer
	CededPremiumAccountID uint64 `json:"ceded_premium_account_id"` // Liability/Revenue account for premiums ceded
	ClaimRecoveryAccountID uint64 `json:"claim_recovery_account_id"` // Asset/Expense account for claims recovered
	SettlementAccountID    uint64 `json:"settlement_account_id"`     // Settlement/Clearing account
}

// ReinsuranceContract represents the terms of a reinsurance agreement.
type ReinsuranceContract struct {
	ID          uint64    `json:"id"`
	ReinsurerID uint64    `json:"reinsurer_id"`
	PolicyID    uint64    `json:"policy_id"`
	CessionRate float64 `json:"cession_rate"` // e.g., 0.5 for 50%
	EffectiveDate time.Time `json:"effective_date"`
}

// ReinsuranceTransactionType defines the type of financial transaction.
type ReinsuranceTransactionType string

const (
	TransactionTypeCededPremium ReinsuranceTransactionType = "CEDED_PREMIUM"
	TransactionTypeClaimRecovery ReinsuranceTransactionType = "CLAIM_RECOVERY"
	TransactionTypeSettlement ReinsuranceTransactionType = "SETTLEMENT"
)

// ReinsuranceTransaction represents a single financial event to be recorded.
type ReinsuranceTransaction struct {
	ID            uint64                     `json:"id"`
	ContractID    uint64                     `json:"contract_id"`
	PolicyID      uint64                     `json:"policy_id"`
	Type          ReinsuranceTransactionType `json:"type"`
	Amount        uint64                     `json:"amount"` // Amount in smallest currency unit
	Currency      uint16                     `json:"currency"` // TigerBeetle currency code
	SourceEventID uint64                     `json:"source_event_id"` // ID of the original event (e.g., Premium or Claim)
	Timestamp     time.Time                  `json:"timestamp"`
	// TigerBeetle Transfer IDs associated with this transaction
	TransferIDs []uint64 `json:"transfer_ids"`
}

// ReconciliationReport represents the state of a reinsurer's accounts for a period.
type ReconciliationReport struct {
	ReinsurerID uint64    `json:"reinsurer_id"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	// Summary of transactions
	TotalCededPremium uint64 `json:"total_ceded_premium"`
	TotalClaimRecovery uint64 `json:"total_claim_recovery"`
	// Current balance in the settlement account (from TigerBeetle)
	SettlementAccountBalance uint64 `json:"settlement_account_balance"`
	// List of unsettled transactions
	UnsettledTransactions []ReinsuranceTransaction `json:"unsettled_transactions"`
}
