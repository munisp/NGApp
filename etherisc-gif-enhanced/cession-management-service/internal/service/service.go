package service

import (
	"cession-management-service/internal/model"
	"context"

	"github.com/google/uuid"
)

// Service defines the interface for the Cession Management business logic
type Service interface {
	// Cession Tracking
	TrackPremiumCession(ctx context.Context, policyID, reinsurerID uuid.UUID, amount, cededShare float64, currency string) (*model.Cession, error)
	TrackClaimCession(ctx context.Context, policyID, reinsurerID uuid.UUID, amount, cededShare float64, currency string) (*model.Cession, error)

	// Cession Calculation Engine
	CalculateCession(ctx context.Context, cessionID uuid.UUID) (*model.CessionCalculation, error)

	// Reinsurer Balance Tracking
	UpdateReinsurerBalance(ctx context.Context, calculation *model.CessionCalculation) (*model.ReinsurerBalance, error)
	GetReinsurerBalance(ctx context.Context, reinsurerID uuid.UUID) (*model.ReinsurerBalance, error)

	// Bordereaux Generation
	GenerateBordereau(ctx context.Context, reinsurerID uuid.UUID, month string) (*model.Bordereau, error)
	GenerateBordereauFile(ctx context.Context, bordereauID uuid.UUID) (string, error)
	SendBordereau(ctx context.Context, bordereauID uuid.UUID) error
	SendBordereauToReinsurer(ctx context.Context, bordereauID uuid.UUID, filePath string) error

	// Settlement Workflow
	InitiateSettlement(ctx context.Context, bordereauID uuid.UUID) (*model.SettlementWorkflow, error)
	InitiatePayment(ctx context.Context, bordereauID uuid.UUID, amount float64, direction string) (string, error)
	CompleteSettlement(ctx context.Context, settlementID uuid.UUID, paymentRef string) error
}
