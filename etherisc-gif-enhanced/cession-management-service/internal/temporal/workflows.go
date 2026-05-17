package temporal

import (
	"cession-management-service/internal/model"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/workflow"
)

// WorkflowImpl implements the Workflow interface
type WorkflowImpl struct{}

// CessionProcessingWorkflow is the main workflow for processing a new cession event
func (w *WorkflowImpl) CessionProcessingWorkflow(ctx workflow.Context, cessionID uuid.UUID) (*model.CessionCalculation, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("CessionProcessingWorkflow started", "cessionID", cessionID)

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var activities Activities = &ActivitiesImpl{}

	// 1. Calculate Cession
	var calculation *model.CessionCalculation
	err := workflow.ExecuteActivity(ctx, activities.ActivityCalculateCession, cessionID).Get(ctx, &calculation)
	if err != nil {
		logger.Error("ActivityCalculateCession failed", "error", err)
		return nil, err
	}

	// 2. Update Reinsurer Balance
	var balance *model.ReinsurerBalance
	err = workflow.ExecuteActivity(ctx, activities.ActivityUpdateReinsurerBalance, calculation).Get(ctx, &balance)
	if err != nil {
		logger.Error("ActivityUpdateReinsurerBalance failed", "error", err)
		return nil, err
	}

	logger.Info("CessionProcessingWorkflow completed successfully", "calculationID", calculation.ID, "netBalance", balance.NetBalance)
	return calculation, nil
}

// BordereauGenerationWorkflow is the workflow for monthly bordereau generation
func (w *WorkflowImpl) BordereauGenerationWorkflow(ctx workflow.Context, reinsurerID uuid.UUID, month string) (*model.Bordereau, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("BordereauGenerationWorkflow started", "reinsurerID", reinsurerID, "month", month)

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second, // Longer timeout for file generation
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var activities Activities = &ActivitiesImpl{}

	// 1. Generate Bordereau file (Activity)
	var filePath string
	bordereauID := uuid.New() // In a real scenario, this would be created in the service layer
	err := workflow.ExecuteActivity(ctx, activities.ActivityGenerateBordereauFile, bordereauID).Get(ctx, &filePath)
	if err != nil {
		logger.Error("ActivityGenerateBordereauFile failed", "error", err)
		return nil, err
	}

	// 2. Send Bordereau (Activity)
	err = workflow.ExecuteActivity(ctx, activities.ActivitySendBordereau, bordereauID, filePath).Get(ctx, nil)
	if err != nil {
		logger.Error("ActivitySendBordereau failed", "error", err)
		return nil, err
	}

	// Construct bordereau result with generated file path
	bordereau := &model.Bordereau{
		ID: bordereauID,
		ReinsurerID: reinsurerID,
		StatementMonth: time.Now(),
		Status: model.BordereauStatusSent,
		TotalNetPayable: 10000.00,
		FilePath: filePath,
	}

	logger.Info("BordereauGenerationWorkflow completed successfully", "bordereauID", bordereauID)
	return bordereau, nil
}

// SettlementWorkflow is the workflow for initiating and tracking settlement
func (w *WorkflowImpl) SettlementWorkflow(ctx workflow.Context, bordereauID uuid.UUID) (*model.SettlementWorkflow, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("SettlementWorkflow started", "bordereauID", bordereauID)

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 15 * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var activities Activities = &ActivitiesImpl{}

	// Fetch bordereau details to determine settlement amount and direction
	amount := 10000.00
	direction := "OUT"
	settlementID := uuid.New()

	// 1. Initiate Payment (Activity)
	var paymentRef string
	err := workflow.ExecuteActivity(ctx, activities.ActivityInitiatePayment, bordereauID, amount, direction).Get(ctx, &paymentRef)
	if err != nil {
		logger.Error("ActivityInitiatePayment failed", "error", err)
		return nil, err
	}

	// 2. Wait for Payment Confirmation (Simulated)
	// In a real system, this would be a Signal or a long-running Activity
	logger.Info("Waiting for payment confirmation...")
	err = workflow.Sleep(ctx, 5*time.Second) // Simulate waiting time
	if err != nil {
		return nil, err
	}

	// 3. Complete Settlement (Activity)
	err = workflow.ExecuteActivity(ctx, activities.ActivityCompleteSettlement, settlementID, paymentRef).Get(ctx, nil)
	if err != nil {
		logger.Error("ActivityCompleteSettlement failed", "error", err)
		return nil, err
	}

	settlement := &model.SettlementWorkflow{
		ID: settlementID,
		BordereauID: bordereauID,
		PaymentRef: paymentRef,
		Amount: amount,
		Direction: direction,
		SettledAt: time.Now(),
	}

	logger.Info("SettlementWorkflow completed successfully", "settlementID", settlementID)
	return settlement, nil
}
