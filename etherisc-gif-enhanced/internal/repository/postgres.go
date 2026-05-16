package repository

import (
	"context"
	"errors"
	"time"

	"github.com/etherisc/treaty-reinsurance-service/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// PostgresRepository implements the Repository interface for PostgreSQL
type PostgresRepository struct {
	DB *gorm.DB
}

// NewPostgresRepository creates a new instance of PostgresRepository
func NewPostgresRepository(dsn string) (*PostgresRepository, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	return &PostgresRepository{DB: db}, nil
}

// Migrate runs database migrations
func (r *PostgresRepository) Migrate(ctx context.Context) error {
	return r.DB.WithContext(ctx).AutoMigrate(&models.Treaty{}, &models.Utilization{}, &models.Cession{})
}

// CreateTreaty creates a new treaty record
func (r *PostgresRepository) CreateTreaty(ctx context.Context, treaty *models.Treaty) error {
	return r.DB.WithContext(ctx).Create(treaty).Error
}

// GetTreatyByID retrieves a treaty by its ID
func (r *PostgresRepository) GetTreatyByID(ctx context.Context, id uint) (*models.Treaty, error) {
	var treaty models.Treaty
	if err := r.DB.WithContext(ctx).First(&treaty, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &treaty, nil
}

// GetAllTreaties retrieves all treaties
func (r *PostgresRepository) GetAllTreaties(ctx context.Context) ([]models.Treaty, error) {
	var treaties []models.Treaty
	err := r.DB.WithContext(ctx).Find(&treaties).Error
	return treaties, err
}

// UpdateTreaty updates an existing treaty record
func (r *PostgresRepository) UpdateTreaty(ctx context.Context, treaty *models.Treaty) error {
	return r.DB.WithContext(ctx).Save(treaty).Error
}

// DeleteTreaty deletes a treaty by its ID
func (r *PostgresRepository) DeleteTreaty(ctx context.Context, id uint) error {
	return r.DB.WithContext(ctx).Delete(&models.Treaty{}, id).Error
}

// GetUtilizationByTreatyID retrieves utilization by treaty ID, creating a default if not found
func (r *PostgresRepository) GetUtilizationByTreatyID(ctx context.Context, treatyID uint) (*models.Utilization, error) {
	var utilization models.Utilization
	err := r.DB.WithContext(ctx).Where("treaty_id = ?", treatyID).First(&utilization).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create a default utilization record if not found
		utilization = models.Utilization{
			TreatyID: treatyID,
			CurrentLosses: 0,
			LastUpdated: time.Now(),
		}
		if createErr := r.DB.WithContext(ctx).Create(&utilization).Error; createErr != nil {
			return nil, createErr
		}
		return &utilization, nil
	}
	return &utilization, err
}

// UpdateUtilization updates an existing utilization record
func (r *PostgresRepository) UpdateUtilization(ctx context.Context, utilization *models.Utilization) error {
	utilization.LastUpdated = time.Now()
	return r.DB.WithContext(ctx).Save(utilization).Error
}

// CreateCession creates a new cession record
func (r *PostgresRepository) CreateCession(ctx context.Context, cession *models.Cession) error {
	return r.DB.WithContext(ctx).Create(cession).Error
}

// GetCessionsByExternalRefID retrieves all cessions for a given external reference ID
func (r *PostgresRepository) GetCessionsByExternalRefID(ctx context.Context, externalRefID string) ([]models.Cession, error) {
	var cessions []models.Cession
	err := r.DB.WithContext(ctx).Where("external_ref_id = ?", externalRefID).Find(&cessions).Error
	return cessions, err
}
