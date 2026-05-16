package repository

import (
	"context"

	"github.com/etherisc/treaty-reinsurance-service/internal/models"
)

// Repository defines the interface for data access operations
type Repository interface {
	// Treaty operations
	CreateTreaty(ctx context.Context, treaty *models.Treaty) error
	GetTreatyByID(ctx context.Context, id uint) (*models.Treaty, error)
	GetAllTreaties(ctx context.Context) ([]models.Treaty, error)
	UpdateTreaty(ctx context.Context, treaty *models.Treaty) error
	DeleteTreaty(ctx context.Context, id uint) error

	// Utilization operations
	GetUtilizationByTreatyID(ctx context.Context, treatyID uint) (*models.Utilization, error)
	UpdateUtilization(ctx context.Context, utilization *models.Utilization) error

	// Cession operations
	CreateCession(ctx context.Context, cession *models.Cession) error
	GetCessionsByExternalRefID(ctx context.Context, externalRefID string) ([]models.Cession, error)

	// Database migration
	Migrate(ctx context.Context) error
}
