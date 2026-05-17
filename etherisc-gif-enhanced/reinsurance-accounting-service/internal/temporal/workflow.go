package temporal

import (
	"time"

	"github.com/etherisc/reinsurance-accounting-service/internal/core"
	"go.temporal.io/sdk/workflow"
)

// ReinsuranceSettlementWorkflowName is the name of the workflow.
const ReinsuranceSettlementWorkflowName = "ReinsuranceSettlementWorkflow"

// ReinsuranceSettlementWorkflow orchestrates the settlement process.
func ReinsuranceSettlementWorkflow(ctx workflow.Context, reinsurerID uint64) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("Reinsurance settlement workflow started", "reinsurerID", reinsurerID)

	// Define activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var a *Activities

	// 1. Generate Reconciliation Report
	logger.Info("Generating reconciliation report...")
	var report core.ReconciliationReport
	err := workflow.ExecuteActivity(ctx, a.GenerateReportActivity, reinsurerID).Get(ctx, &report)
	if err != nil {
		logger.Error("Failed to generate report", "error", err)
		return err
	}
	logger.Info("Reconciliation report generated", "total_ceded_premium", report.TotalCededPremium, "total_claim_recovery", report.TotalClaimRecovery)

	// 2. Check if settlement is required
	if report.SettlementAccountBalance == 0 {
		logger.Info("No settlement required. Workflow finished.")
		return nil
	}

	// 3. Initiate Settlement (Post Transfer to TigerBeetle)
	logger.Info("Initiating settlement...")
	var settlementTx core.ReinsuranceTransaction
	err = workflow.ExecuteActivity(ctx, a.InitiateSettlementActivity, reinsurerID).Get(ctx, &settlementTx)
	if err != nil {
		logger.Error("Failed to initiate settlement", "error", err)
		return err
	}
	logger.Info("Settlement initiated", "amount", settlementTx.Amount)

	// 4. Notify External Payment System
	logger.Info("Notifying external payment system...")
	err = workflow.ExecuteActivity(ctx, a.NotifyPaymentSystemActivity, reinsurerID, settlementTx.Amount).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to notify payment system", "error", err)
		// Depending on the error, we might want to compensate or retry.
		// For simplicity, we'll just log and continue/fail.
		return err
	}

	logger.Info("Reinsurance settlement workflow completed successfully", "reinsurerID", reinsurerID)
	return nil
}
