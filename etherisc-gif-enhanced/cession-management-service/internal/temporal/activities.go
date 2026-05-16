package temporal

import (
	"cession-management-service/internal/model"
	"cession-management-service/internal/service"
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/activity"
)

// ActivitiesImpl implements the Activities interface
type ActivitiesImpl struct {
	Service service.Service
}

// ActivityCalculateCession implements Activities.ActivityCalculateCession
func (a *ActivitiesImpl) ActivityCalculateCession(ctx context.Context, cessionID uuid.UUID) (*model.CessionCalculation, error) {
	activity.GetLogger(ctx).Info("ActivityCalculateCession started", "cessionID", cessionID)
	calc, err := a.Service.CalculateCession(ctx, cessionID)
	if err != nil {
		activity.GetLogger(ctx).Error("Failed to calculate cession", "error", err)
		return nil, err
	}
	activity.GetLogger(ctx).Info("ActivityCalculateCession completed", "calculationID", calc.ID)
	return calc, nil
}

// ActivityUpdateReinsurerBalance implements Activities.ActivityUpdateReinsurerBalance
func (a *ActivitiesImpl) ActivityUpdateReinsurerBalance(ctx context.Context, calculation *model.CessionCalculation) (*model.ReinsurerBalance, error) {
	activity.GetLogger(ctx).Info("ActivityUpdateReinsurerBalance started", "calculationID", calculation.ID)
	balance, err := a.Service.UpdateReinsurerBalance(ctx, calculation)
	if err != nil {
		activity.GetLogger(ctx).Error("Failed to update reinsurer balance", "error", err)
		return nil, err
	}
	activity.GetLogger(ctx).Info("ActivityUpdateReinsurerBalance completed", "netBalance", balance.NetBalance)
	return balance, nil
}

// ActivityGenerateBordereauFile implements Activities.ActivityGenerateBordereauFile
func (a *ActivitiesImpl) ActivityGenerateBordereauFile(ctx context.Context, bordereauID uuid.UUID) (string, error) {
	activity.GetLogger(ctx).Info("ActivityGenerateBordereauFile started", "bordereauID", bordereauID)
	// Generate bordereau file by querying all cessions for the reporting period
	// and formatting them into a CSV file stored in S3-compatible storage
	filePath, err := a.Service.GenerateBordereauFile(ctx, bordereauID)
	if err != nil {
		activity.GetLogger(ctx).Error("Failed to generate bordereau file", "error", err)
		return "", err
	}
	activity.GetLogger(ctx).Info("Bordereau file generated", "filePath", filePath)
	return filePath, nil
}

// ActivitySendBordereau implements Activities.ActivitySendBordereau
func (a *ActivitiesImpl) ActivitySendBordereau(ctx context.Context, bordereauID uuid.UUID, filePath string) error {
	activity.GetLogger(ctx).Info("ActivitySendBordereau started", "bordereauID", bordereauID, "filePath", filePath)
	// Send bordereau file to reinsurer via configured delivery method (SFTP/Email/API)
	err := a.Service.SendBordereauToReinsurer(ctx, bordereauID, filePath)
	if err != nil {
		activity.GetLogger(ctx).Error("Failed to send bordereau to reinsurer", "error", err)
		return err
	}
	activity.GetLogger(ctx).Info("Bordereau sent successfully to reinsurer", "bordereauID", bordereauID)
	return nil
}

// ActivityInitiatePayment implements Activities.ActivityInitiatePayment
func (a *ActivitiesImpl) ActivityInitiatePayment(ctx context.Context, bordereauID uuid.UUID, amount float64, direction string) (string, error) {
	activity.GetLogger(ctx).Info("ActivityInitiatePayment started", "bordereauID", bordereauID, "amount", amount, "direction", direction)
	// Initiate payment via TigerBeetle for high-performance double-entry accounting
	paymentRef, err := a.Service.InitiatePayment(ctx, bordereauID, amount, direction)
	if err != nil {
		activity.GetLogger(ctx).Error("Failed to initiate payment", "error", err)
		return "", err
	}
	activity.GetLogger(ctx).Info("Payment initiated successfully", "paymentRef", paymentRef)
	return paymentRef, nil
}

// ActivityCompleteSettlement implements Activities.ActivityCompleteSettlement
func (a *ActivitiesImpl) ActivityCompleteSettlement(ctx context.Context, settlementID uuid.UUID, paymentRef string) error {
	activity.GetLogger(ctx).Info("ActivityCompleteSettlement started", "settlementID", settlementID, "paymentRef", paymentRef)
	// Final update to the settlement record and bordereau status in the database
	err := a.Service.CompleteSettlement(ctx, settlementID, paymentRef)
	if err != nil {
		activity.GetLogger(ctx).Error("Failed to complete settlement in service layer", "error", err)
		return err
	}
	activity.GetLogger(ctx).Info("Settlement completed successfully", "settlementID", settlementID)
	return nil
}
