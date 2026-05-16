package repository

import (
	"context"
	"strategic-implementations/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StrategyRepository struct{ db *gorm.DB }
func NewStrategyRepository(db *gorm.DB) *StrategyRepository { return &StrategyRepository{db: db} }

func (r *StrategyRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&models.StrategicInitiative{}, &models.Milestone{}, &models.KPI{}, &models.RiskRegister{}, &models.StrategicReport{})
}

func (r *StrategyRepository) CreateInitiative(ctx context.Context, i *models.StrategicInitiative) error {
	i.ID = uuid.New(); i.CreatedAt = time.Now(); i.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(i).Error
}
func (r *StrategyRepository) GetInitiative(ctx context.Context, ref string) (*models.StrategicInitiative, error) {
	var i models.StrategicInitiative; return &i, r.db.WithContext(ctx).First(&i, "initiative_ref = ?", ref).Error
}
func (r *StrategyRepository) UpdateInitiative(ctx context.Context, i *models.StrategicInitiative) error {
	i.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(i).Error
}
func (r *StrategyRepository) ListInitiatives(ctx context.Context, status, category string) ([]models.StrategicInitiative, error) {
	var inits []models.StrategicInitiative; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("status = ?", status) }
	if category != "" { q = q.Where("category = ?", category) }
	return inits, q.Order("priority, created_at DESC").Find(&inits).Error
}
func (r *StrategyRepository) CreateMilestone(ctx context.Context, m *models.Milestone) error {
	m.ID = uuid.New(); m.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(m).Error
}
func (r *StrategyRepository) GetMilestones(ctx context.Context, ref string) ([]models.Milestone, error) {
	var ms []models.Milestone
	return ms, r.db.WithContext(ctx).Where("initiative_ref = ?", ref).Order("due_date").Find(&ms).Error
}
func (r *StrategyRepository) UpdateMilestone(ctx context.Context, m *models.Milestone) error {
	return r.db.WithContext(ctx).Save(m).Error
}
func (r *StrategyRepository) CreateKPI(ctx context.Context, k *models.KPI) error {
	k.ID = uuid.New(); k.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(k).Error
}
func (r *StrategyRepository) GetKPIs(ctx context.Context, ref string) ([]models.KPI, error) {
	var kpis []models.KPI; q := r.db.WithContext(ctx)
	if ref != "" { q = q.Where("initiative_ref = ?", ref) }
	return kpis, q.Find(&kpis).Error
}
func (r *StrategyRepository) UpdateKPI(ctx context.Context, k *models.KPI) error {
	return r.db.WithContext(ctx).Save(k).Error
}
func (r *StrategyRepository) CreateRisk(ctx context.Context, rr *models.RiskRegister) error {
	rr.ID = uuid.New(); rr.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(rr).Error
}
func (r *StrategyRepository) GetRisks(ctx context.Context, ref string) ([]models.RiskRegister, error) {
	var risks []models.RiskRegister; q := r.db.WithContext(ctx)
	if ref != "" { q = q.Where("initiative_ref = ?", ref) }
	return risks, q.Order("risk_score DESC").Find(&risks).Error
}
func (r *StrategyRepository) CreateReport(ctx context.Context, sr *models.StrategicReport) error {
	sr.ID = uuid.New(); sr.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(sr).Error
}
func (r *StrategyRepository) GetReports(ctx context.Context, reportType string) ([]models.StrategicReport, error) {
	var reports []models.StrategicReport; q := r.db.WithContext(ctx)
	if reportType != "" { q = q.Where("report_type = ?", reportType) }
	return reports, q.Order("created_at DESC").Limit(20).Find(&reports).Error
}
