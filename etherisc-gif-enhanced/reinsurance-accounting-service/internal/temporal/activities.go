package temporal

import (
	"context"
	"fmt"
	"log/slog"

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

// NotifyPaymentSystemActivity is a placeholder for calling an external payment service.
func (a *Activities) NotifyPaymentSystemActivity(ctx context.Context, reinsurerID uint64, amount uint64) error {
	a.Logger.Info("Executing NotifyPaymentSystemActivity (Placeholder)", "reinsurerID", reinsurerID, "amount", amount)
	// In a real implementation, this would involve a call to a payment gateway API.
	// For now, we simulate success.
	return nil
}
