package temporal

import (
	"cession-management-service/internal/model"
	"context"

	"github.com/google/uuid"
)

// Workflow defines the main Temporal workflow interface
type Workflow interface {
	// CessionProcessingWorkflow is the main workflow for processing a new cession event
	CessionProcessingWorkflow(ctx context.Context, cessionID uuid.UUID) (*model.CessionCalculation, error)

	// BordereauGenerationWorkflow is the workflow for monthly bordereau generation
	BordereauGenerationWorkflow(ctx context.Context, reinsurerID uuid.UUID, month string) (*model.Bordereau, error)

	// SettlementWorkflow is the workflow for initiating and tracking settlement
	SettlementWorkflow(ctx context.Context, bordereauID uuid.UUID) (*model.SettlementWorkflow, error)
}

// Activities defines the interface for Temporal activities
type Activities interface {
	// Cession Activities
	ActivityCalculateCession(ctx context.Context, cessionID uuid.UUID) (*model.CessionCalculation, error)
	ActivityUpdateReinsurerBalance(ctx context.Context, calculation *model.CessionCalculation) (*model.ReinsurerBalance, error)

	// Bordereau Activities
	ActivityGenerateBordereauFile(ctx context.Context, bordereauID uuid.UUID) (string, error) // Returns file path
	ActivitySendBordereau(ctx context.Context, bordereauID uuid.UUID, filePath string) error

	// Settlement Activities
	ActivityInitiatePayment(ctx context.Context, bordereauID uuid.UUID, amount float64, direction string) (string, error) // Returns payment reference
	ActivityCompleteSettlement(ctx context.Context, settlementID uuid.UUID, paymentRef string) error
}
