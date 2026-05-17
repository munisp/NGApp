package api

import (
	"time"

	"github.com/etherisc/reinsurance-accounting-service/internal/core"
)

// CreateReinsurerRequest is the request body for creating a new reinsurer.
type CreateReinsurerRequest struct {
	Name string `json:"name" validate:"required"`
}

// ReinsurerResponse is the response body for a reinsurer.
type ReinsurerResponse struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
	CededPremiumAccountID uint64 `json:"ceded_premium_account_id"`
	ClaimRecoveryAccountID uint64 `json:"claim_recovery_account_id"`
	SettlementAccountID    uint64 `json:"settlement_account_id"`
}

// CreateContractRequest is the request body for creating a new reinsurance contract.
type CreateContractRequest struct {
	ReinsurerID uint64  `json:"reinsurer_id" validate:"required"`
	PolicyID    uint64  `json:"policy_id" validate:"required"`
	CessionRate float64 `json:"cession_rate" validate:"required,gt=0,lte=1"`
}

// ContractResponse is the response body for a reinsurance contract.
type ContractResponse struct {
	ID          uint64    `json:"id"`
	ReinsurerID uint64    `json:"reinsurer_id"`
	PolicyID    uint64    `json:"policy_id"`
	CessionRate float64 `json:"cession_rate"`
	EffectiveDate time.Time `json:"effective_date"`
}

// RecordPremiumRequest is the request body for recording a ceded premium.
type RecordPremiumRequest struct {
	PolicyID      uint64 `json:"policy_id" validate:"required"`
	TotalPremium  uint64 `json:"total_premium" validate:"required,gt=0"`
	Currency      uint16 `json:"currency" validate:"required"`
	SourceEventID uint64 `json:"source_event_id" validate:"required"`
}

// RecordClaimRequest is the request body for recording a claim recovery.
type RecordClaimRequest struct {
	PolicyID      uint64 `json:"policy_id" validate:"required"`
	TotalClaimAmount uint64 `json:"total_claim_amount" validate:"required,gt=0"`
	Currency      uint16 `json:"currency" validate:"required"`
	SourceEventID uint64 `json:"source_event_id" validate:"required"`
}

// TransactionResponse is the response body for a reinsurance transaction.
type TransactionResponse struct {
	ID            uint64                     `json:"id"`
	ContractID    uint64                     `json:"contract_id"`
	PolicyID      uint64                     `json:"policy_id"`
	Type          core.ReinsuranceTransactionType `json:"type"`
	Amount        uint64                     `json:"amount"`
	Currency      uint16                     `json:"currency"`
	SourceEventID uint64                     `json:"source_event_id"`
	Timestamp     time.Time                  `json:"timestamp"`
}

// ReconciliationReportResponse is the response body for a reconciliation report.
type ReconciliationReportResponse struct {
	ReinsurerID uint64    `json:"reinsurer_id"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	TotalCededPremium uint64 `json:"total_ceded_premium"`
	TotalClaimRecovery uint64 `json:"total_claim_recovery"`
	SettlementAccountBalance uint64 `json:"settlement_account_balance"`
	UnsettledTransactions []TransactionResponse `json:"unsettled_transactions"`
}

// ToReinsurerResponse converts a core.Reinsurer to a ReinsurerResponse.
func ToReinsurerResponse(r *core.Reinsurer) ReinsurerResponse {
	return ReinsurerResponse{
		ID: r.ID,
		Name: r.Name,
		CededPremiumAccountID: r.CededPremiumAccountID,
		ClaimRecoveryAccountID: r.ClaimRecoveryAccountID,
		SettlementAccountID: r.SettlementAccountID,
	}
}

// ToContractResponse converts a core.ReinsuranceContract to a ContractResponse.
func ToContractResponse(c *core.ReinsuranceContract) ContractResponse {
	return ContractResponse{
		ID: c.ID,
		ReinsurerID: c.ReinsurerID,
		PolicyID: c.PolicyID,
		CessionRate: c.CessionRate,
		EffectiveDate: c.EffectiveDate,
	}
}

// ToTransactionResponse converts a core.ReinsuranceTransaction to a TransactionResponse.
func ToTransactionResponse(t *core.ReinsuranceTransaction) TransactionResponse {
	return TransactionResponse{
		ID: t.ID,
		ContractID: t.ContractID,
		PolicyID: t.PolicyID,
		Type: t.Type,
		Amount: t.Amount,
		Currency: t.Currency,
		SourceEventID: t.SourceEventID,
		Timestamp: t.Timestamp,
	}
}

// ToReconciliationReportResponse converts a core.ReconciliationReport to a ReconciliationReportResponse.
func ToReconciliationReportResponse(r *core.ReconciliationReport) ReconciliationReportResponse {
	transactions := make([]TransactionResponse, len(r.UnsettledTransactions))
	for i, t := range r.UnsettledTransactions {
		transactions[i] = ToTransactionResponse(&t)
	}
	return ReconciliationReportResponse{
		ReinsurerID: r.ReinsurerID,
		PeriodStart: r.PeriodStart,
		PeriodEnd: r.PeriodEnd,
		TotalCededPremium: r.TotalCededPremium,
		TotalClaimRecovery: r.TotalClaimRecovery,
		SettlementAccountBalance: r.SettlementAccountBalance,
		UnsettledTransactions: transactions,
	}
}
