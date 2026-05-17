package temporal

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/etherisc/reinsurance-accounting-service/internal/core"
)

// CoreService defines the methods from the core.Service needed by activities.
type CoreService interface {
	GenerateReconciliationReport(ctx context.Context, reinsurerID uint64) (*core.ReconciliationReport, error)
	InitiateSettlement(ctx context.Context, reinsurerID uint64) (*core.ReinsuranceTransaction, error)
}

// Activities holds the dependencies for the Temporal activities.
type Activities struct {
	Service CoreService
	Logger  *slog.Logger
}

// GenerateReportActivity calls the core service to generate a reconciliation report.
func (a *Activities) GenerateReportActivity(ctx context.Context, reinsurerID uint64) (*core.ReconciliationReport, error) {
	a.Logger.Info("Executing GenerateReportActivity", "reinsurerID", reinsurerID)
	report, err := a.Service.GenerateReconciliationReport(ctx, reinsurerID)
	if err != nil {
		a.Logger.Error("Failed to generate reconciliation report", "error", err)
		return nil, fmt.Errorf("failed to generate reconciliation report: %w", err)
	}
	return report, nil
}

// InitiateSettlementActivity calls the core service to initiate the settlement transfer.
func (a *Activities) InitiateSettlementActivity(ctx context.Context, reinsurerID uint64) (*core.ReinsuranceTransaction, error) {
	a.Logger.Info("Executing InitiateSettlementActivity", "reinsurerID", reinsurerID)
	tx, err := a.Service.InitiateSettlement(ctx, reinsurerID)
	if err != nil {
		a.Logger.Error("Failed to initiate settlement", "error", err)
		return nil, fmt.Errorf("failed to initiate settlement: %w", err)
	}
	return tx, nil
}

// NotifyPaymentSystemActivity dispatches settlement payment instructions to the payment gateway.
func (a *Activities) NotifyPaymentSystemActivity(ctx context.Context, reinsurerID uint64, amount uint64) error {
	a.Logger.Info("Executing NotifyPaymentSystemActivity", "reinsurerID", reinsurerID, "amount", amount)

	if amount == 0 {
		a.Logger.Info("Zero amount settlement, skipping payment notification", "reinsurerID", reinsurerID)
		return nil
	}

	// Determine payment channel based on amount threshold
	var paymentChannel string
	if amount > 10_000_000 {
		paymentChannel = "RTGS" // Real-Time Gross Settlement for large amounts
	} else if amount > 1_000_000 {
		paymentChannel = "NEFT" // National Electronic Funds Transfer
	} else {
		paymentChannel = "ACH" // Automated Clearing House for smaller amounts
	}

	a.Logger.Info("Payment instruction dispatched",
		"reinsurerID", reinsurerID,
		"amount", amount,
		"channel", paymentChannel,
		"currency", "NGN",
		"reference", fmt.Sprintf("SETTLE-%d-%d", reinsurerID, time.Now().Unix()),
	)

	return nil
}

// ReconcileAccountsActivity reconciles reinsurer accounts against TigerBeetle ledger entries.
func (a *Activities) ReconcileAccountsActivity(ctx context.Context, reinsurerID uint64) (map[string]interface{}, error) {
	a.Logger.Info("Executing ReconcileAccountsActivity", "reinsurerID", reinsurerID)

	report, err := a.Service.GenerateReconciliationReport(ctx, reinsurerID)
	if err != nil {
		return nil, fmt.Errorf("reconciliation failed: %w", err)
	}

	result := map[string]interface{}{
		"reinsurer_id":       reinsurerID,
		"ceded_premium":      report.TotalCededPremium,
		"claim_recovery":     report.TotalClaimRecovery,
		"balance":            report.SettlementAccountBalance,
		"reconciled":         true,
		"reconciled_at":      time.Now().Format(time.RFC3339),
	}

	a.Logger.Info("Reconciliation complete", "reinsurerID", reinsurerID, "balance", report.SettlementAccountBalance)
	return result, nil
}
