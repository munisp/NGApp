package repository

import (
"context"
"claims-service/internal/models"
"github.com/google/uuid"
"gorm.io/gorm"
)

type Repository struct {
db *gorm.DB
}

func New(db *gorm.DB) *Repository {
return &Repository{db: db}
}

func (r *Repository) CreateClaim(ctx context.Context, claim *models.Claim) error {
return r.db.WithContext(ctx).Create(claim).Error
}

func (r *Repository) GetClaimByID(ctx context.Context, id uuid.UUID) (*models.Claim, error) {
var claim models.Claim
err := r.db.WithContext(ctx).Preload("Documents").Preload("Activities").Preload("Payments").First(&claim, "id = ?", id).Error
return &claim, err
}

func (r *Repository) UpdateClaim(ctx context.Context, claim *models.Claim) error {
return r.db.WithContext(ctx).Save(claim).Error
}

func (r *Repository) ListClaims(ctx context.Context, limit, offset int) ([]models.Claim, int64, error) {
var claims []models.Claim
var total int64

if err := r.db.WithContext(ctx).Model(&models.Claim{}).Count(&total).Error; err != nil {
return nil, 0, err
}

err := r.db.WithContext(ctx).Limit(limit).Offset(offset).Order("created_at DESC").Find(&claims).Error
return claims, total, err
}

func (r *Repository) CreateDocument(ctx context.Context, doc *models.ClaimDocument) error {
return r.db.WithContext(ctx).Create(doc).Error
}

func (r *Repository) CreateActivity(ctx context.Context, activity *models.ClaimActivity) error {
return r.db.WithContext(ctx).Create(activity).Error
}

func (r *Repository) CreatePayment(ctx context.Context, payment *models.ClaimPayment) error {
return r.db.WithContext(ctx).Create(payment).Error
}

func (r *Repository) CreateReserve(ctx context.Context, reserve *models.ClaimReserve) error {
return r.db.WithContext(ctx).Create(reserve).Error
}

func (r *Repository) CreateAppeal(ctx context.Context, appeal *models.ClaimAppeal) error {
return r.db.WithContext(ctx).Create(appeal).Error
}

func (r *Repository) CreateSubrogation(ctx context.Context, subrogation *models.SubrogationCase) error {
return r.db.WithContext(ctx).Create(subrogation).Error
}

func (r *Repository) CreateMedicalBill(ctx context.Context, bill *models.MedicalBill) error {
return r.db.WithContext(ctx).Create(bill).Error
}

func AutoMigrate(db *gorm.DB) error {
return db.AutoMigrate(
&models.Claim{},
&models.ClaimDocument{},
&models.ClaimActivity{},
&models.ClaimPayment{},
&models.ClaimReserve{},
&models.ClaimAppeal{},
&models.SubrogationCase{},
&models.MedicalBill{},
)
}
