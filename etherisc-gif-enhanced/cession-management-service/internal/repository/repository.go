package repository

import (
	"cession-management-service/internal/model"
	"context"
	"time"

	"github.com/google/uuid"
)

// Repository defines the interface for data access operations
type Repository interface {
	// Cession operations
	CreateCession(ctx context.Context, cession *model.Cession) error
	GetCessionByID(ctx context.Context, id uuid.UUID) (*model.Cession, error)
	ListCessionsByPolicy(ctx context.Context, policyID uuid.UUID) ([]model.Cession, error)

	// CessionCalculation operations
	CreateCessionCalculation(ctx context.Context, calc *model.CessionCalculation) error

	// ReinsurerBalance operations
	GetBalance(ctx context.Context, reinsurerID uuid.UUID, month time.Time) (*model.ReinsurerBalance, error)
	UpdateBalance(ctx context.Context, balance *model.ReinsurerBalance) error

	// Bordereau operations
	CreateBordereau(ctx context.Context, bordereau *model.Bordereau) error
	GetBordereauByID(ctx context.Context, id uuid.UUID) (*model.Bordereau, error)
	ListBordereauxByReinsurer(ctx context.Context, reinsurerID uuid.UUID) ([]model.Bordereau, error)
	UpdateBordereauStatus(ctx context.Context, id uuid.UUID, status model.BordereauStatus) error

	// SettlementWorkflow operations
	CreateSettlement(ctx context.Context, settlement *model.SettlementWorkflow) error
}
