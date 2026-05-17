package repository

import (
	"cession-management-service/internal/model"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type GormRepository struct {
	DB *gorm.DB
}

func NewGormRepository(dsn string) (*GormRepository, error) {
	if dsn == "" {
		return nil, errors.New("database DSN is required")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	if err := db.AutoMigrate(
		&model.Cession{},
		&model.CessionCalculation{},
		&model.ReinsurerBalance{},
		&model.Bordereau{},
		&model.SettlementWorkflow{},
	); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &GormRepository{DB: db}, nil
}

func (r *GormRepository) CreateCession(ctx context.Context, cession *model.Cession) error {
	if cession.ID == uuid.Nil {
		cession.ID = uuid.New()
	}
	return r.DB.WithContext(ctx).Create(cession).Error
}

func (r *GormRepository) GetCessionByID(ctx context.Context, id uuid.UUID) (*model.Cession, error) {
	var cession model.Cession
	result := r.DB.WithContext(ctx).First(&cession, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("cession not found")
		}
		return nil, result.Error
	}
	return &cession, nil
}

func (r *GormRepository) ListCessionsByPolicy(ctx context.Context, policyID uuid.UUID) ([]model.Cession, error) {
	var cessions []model.Cession
	result := r.DB.WithContext(ctx).Where("policy_id = ?", policyID).Order("created_at DESC").Find(&cessions)
	if result.Error != nil {
		return nil, result.Error
	}
	return cessions, nil
}

func (r *GormRepository) CreateCessionCalculation(ctx context.Context, calc *model.CessionCalculation) error {
	if calc.ID == uuid.Nil {
		calc.ID = uuid.New()
	}
	return r.DB.WithContext(ctx).Create(calc).Error
}

func (r *GormRepository) GetBalance(ctx context.Context, reinsurerID uuid.UUID, month time.Time) (*model.ReinsurerBalance, error) {
	var balance model.ReinsurerBalance
	startOfMonth := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	result := r.DB.WithContext(ctx).Where("reinsurer_id = ? AND month = ?", reinsurerID, startOfMonth).First(&balance)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return &model.ReinsurerBalance{
				ID:          uuid.New(),
				ReinsurerID: reinsurerID,
				Month:       startOfMonth,
				NetBalance:  0,
			}, nil
		}
		return nil, result.Error
	}
	return &balance, nil
}

func (r *GormRepository) UpdateBalance(ctx context.Context, balance *model.ReinsurerBalance) error {
	return r.DB.WithContext(ctx).Save(balance).Error
}

func (r *GormRepository) CreateBordereau(ctx context.Context, bordereau *model.Bordereau) error {
	if bordereau.ID == uuid.Nil {
		bordereau.ID = uuid.New()
	}
	return r.DB.WithContext(ctx).Create(bordereau).Error
}

func (r *GormRepository) GetBordereauByID(ctx context.Context, id uuid.UUID) (*model.Bordereau, error) {
	var bordereau model.Bordereau
	result := r.DB.WithContext(ctx).First(&bordereau, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("bordereau not found")
		}
		return nil, result.Error
	}
	return &bordereau, nil
}

func (r *GormRepository) ListBordereauxByReinsurer(ctx context.Context, reinsurerID uuid.UUID) ([]model.Bordereau, error) {
	var bordereauxList []model.Bordereau
	result := r.DB.WithContext(ctx).Where("reinsurer_id = ?", reinsurerID).Order("created_at DESC").Find(&bordereauxList)
	if result.Error != nil {
		return nil, result.Error
	}
	return bordereauxList, nil
}

func (r *GormRepository) UpdateBordereauStatus(ctx context.Context, id uuid.UUID, status model.BordereauStatus) error {
	return r.DB.WithContext(ctx).Model(&model.Bordereau{}).Where("id = ?", id).Update("status", status).Error
}

func (r *GormRepository) CreateSettlement(ctx context.Context, settlement *model.SettlementWorkflow) error {
	if settlement.ID == uuid.Nil {
		settlement.ID = uuid.New()
	}
	return r.DB.WithContext(ctx).Create(settlement).Error
}

func (r *GormRepository) GetSettlementByID(ctx context.Context, id uuid.UUID) (*model.SettlementWorkflow, error) {
	var settlement model.SettlementWorkflow
	result := r.DB.WithContext(ctx).First(&settlement, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("settlement not found")
		}
		return nil, result.Error
	}
	return &settlement, nil
}

func (r *GormRepository) UpdateSettlementStatus(ctx context.Context, id uuid.UUID, status string) error {
	return r.DB.WithContext(ctx).Model(&model.SettlementWorkflow{}).Where("id = ?", id).Update("status", status).Error
}

func (r *GormRepository) ListSettlementsByReinsurer(ctx context.Context, reinsurerID uuid.UUID) ([]model.SettlementWorkflow, error) {
	var settlements []model.SettlementWorkflow
	result := r.DB.WithContext(ctx).Where("reinsurer_id = ?", reinsurerID).Order("created_at DESC").Find(&settlements)
	if result.Error != nil {
		return nil, result.Error
	}
	return settlements, nil
}
