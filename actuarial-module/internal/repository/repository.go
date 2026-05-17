package repository

import (
	"actuarial-module/internal/models"
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ActuarialRepository struct {
	db *gorm.DB
}

func NewActuarialRepository(db *gorm.DB) *ActuarialRepository {
	return &ActuarialRepository{db: db}
}

func (r *ActuarialRepository) AutoMigrate() error {
	return r.db.AutoMigrate(
		&models.MortalityTable{},
		&models.ProductPricingConfig{},
		&models.ReserveCalculation{},
		&models.PremiumCalculation{},
		&models.IBNRCalculation{},
		&models.RiskBasedCapital{},
		&models.SolvencyAnalysis{},
		&models.LossRatioAnalysis{},
		&models.ExperienceStudy{},
		&models.NAICOMReport{},
	)
}

// Mortality Table operations
func (r *ActuarialRepository) CreateMortalityTable(ctx context.Context, table *models.MortalityTable) error {
	table.ID = uuid.New()
	table.CreatedAt = time.Now()
	table.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(table).Error
}

func (r *ActuarialRepository) GetMortalityTable(ctx context.Context, id uuid.UUID) (*models.MortalityTable, error) {
	var table models.MortalityTable
	err := r.db.WithContext(ctx).First(&table, "id = ?", id).Error
	return &table, err
}

func (r *ActuarialRepository) GetActiveMortalityTable(ctx context.Context, name string) (*models.MortalityTable, error) {
	var table models.MortalityTable
	err := r.db.WithContext(ctx).Where("name = ? AND is_active = ?", name, true).First(&table).Error
	return &table, err
}

func (r *ActuarialRepository) ListMortalityTables(ctx context.Context) ([]models.MortalityTable, error) {
	var tables []models.MortalityTable
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("name").Find(&tables).Error
	return tables, err
}

// Product Pricing Config operations
func (r *ActuarialRepository) CreatePricingConfig(ctx context.Context, config *models.ProductPricingConfig) error {
	config.ID = uuid.New()
	config.CreatedAt = time.Now()
	config.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(config).Error
}

func (r *ActuarialRepository) GetPricingConfig(ctx context.Context, productCode string) (*models.ProductPricingConfig, error) {
	var config models.ProductPricingConfig
	err := r.db.WithContext(ctx).Where("product_code = ? AND is_active = ?", productCode, true).First(&config).Error
	return &config, err
}

func (r *ActuarialRepository) ListPricingConfigs(ctx context.Context) ([]models.ProductPricingConfig, error) {
	var configs []models.ProductPricingConfig
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("product_code").Find(&configs).Error
	return configs, err
}

func (r *ActuarialRepository) UpdatePricingConfig(ctx context.Context, config *models.ProductPricingConfig) error {
	config.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(config).Error
}

// Reserve Calculation operations
func (r *ActuarialRepository) SaveReserveCalculation(ctx context.Context, calc *models.ReserveCalculation) error {
	calc.ID = uuid.New()
	calc.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(calc).Error
}

func (r *ActuarialRepository) GetReservesByPolicy(ctx context.Context, policyID string) ([]models.ReserveCalculation, error) {
	var calcs []models.ReserveCalculation
	err := r.db.WithContext(ctx).Where("policy_id = ?", policyID).Order("valuation_date DESC").Find(&calcs).Error
	return calcs, err
}

func (r *ActuarialRepository) GetReservesByDate(ctx context.Context, date time.Time) ([]models.ReserveCalculation, error) {
	var calcs []models.ReserveCalculation
	err := r.db.WithContext(ctx).Where("valuation_date = ?", date).Find(&calcs).Error
	return calcs, err
}

func (r *ActuarialRepository) ApproveReserve(ctx context.Context, id, approverID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.ReserveCalculation{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":      "approved",
		"approved_by": approverID,
		"approved_at": now,
	}).Error
}

// Premium Calculation operations
func (r *ActuarialRepository) SavePremiumCalculation(ctx context.Context, calc *models.PremiumCalculation) error {
	calc.ID = uuid.New()
	calc.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(calc).Error
}

func (r *ActuarialRepository) GetPremiumHistory(ctx context.Context, quoteID string) ([]models.PremiumCalculation, error) {
	var calcs []models.PremiumCalculation
	err := r.db.WithContext(ctx).Where("quote_id = ?", quoteID).Order("created_at DESC").Find(&calcs).Error
	return calcs, err
}

// IBNR operations
func (r *ActuarialRepository) SaveIBNRCalculation(ctx context.Context, calc *models.IBNRCalculation) error {
	calc.ID = uuid.New()
	calc.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(calc).Error
}

func (r *ActuarialRepository) GetLatestIBNR(ctx context.Context, lineOfBusiness string) (*models.IBNRCalculation, error) {
	var calc models.IBNRCalculation
	err := r.db.WithContext(ctx).Where("line_of_business = ?", lineOfBusiness).Order("valuation_date DESC").First(&calc).Error
	return &calc, err
}

// RBC operations
func (r *ActuarialRepository) SaveRBC(ctx context.Context, rbc *models.RiskBasedCapital) error {
	rbc.ID = uuid.New()
	rbc.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(rbc).Error
}

func (r *ActuarialRepository) GetLatestRBC(ctx context.Context) (*models.RiskBasedCapital, error) {
	var rbc models.RiskBasedCapital
	err := r.db.WithContext(ctx).Order("valuation_date DESC").First(&rbc).Error
	return &rbc, err
}

// Solvency operations
func (r *ActuarialRepository) SaveSolvency(ctx context.Context, sa *models.SolvencyAnalysis) error {
	sa.ID = uuid.New()
	sa.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(sa).Error
}

// Loss Ratio operations
func (r *ActuarialRepository) SaveLossRatio(ctx context.Context, lr *models.LossRatioAnalysis) error {
	lr.ID = uuid.New()
	lr.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(lr).Error
}

func (r *ActuarialRepository) GetLossRatioTrend(ctx context.Context, productLine string, periods int) ([]models.LossRatioAnalysis, error) {
	var analyses []models.LossRatioAnalysis
	err := r.db.WithContext(ctx).Where("product_line = ?", productLine).Order("period DESC").Limit(periods).Find(&analyses).Error
	return analyses, err
}

// Experience Study operations
func (r *ActuarialRepository) CreateExperienceStudy(ctx context.Context, study *models.ExperienceStudy) error {
	study.ID = uuid.New()
	study.CreatedAt = time.Now()
	study.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(study).Error
}

func (r *ActuarialRepository) GetExperienceStudy(ctx context.Context, id uuid.UUID) (*models.ExperienceStudy, error) {
	var study models.ExperienceStudy
	err := r.db.WithContext(ctx).First(&study, "id = ?", id).Error
	return &study, err
}

func (r *ActuarialRepository) ListExperienceStudies(ctx context.Context, studyType string) ([]models.ExperienceStudy, error) {
	var studies []models.ExperienceStudy
	query := r.db.WithContext(ctx)
	if studyType != "" {
		query = query.Where("study_type = ?", studyType)
	}
	err := query.Order("created_at DESC").Find(&studies).Error
	return studies, err
}

// NAICOM Report operations
func (r *ActuarialRepository) CreateNAICOMReport(ctx context.Context, report *models.NAICOMReport) error {
	report.ID = uuid.New()
	report.CreatedAt = time.Now()
	report.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(report).Error
}

func (r *ActuarialRepository) GetNAICOMReport(ctx context.Context, id uuid.UUID) (*models.NAICOMReport, error) {
	var report models.NAICOMReport
	err := r.db.WithContext(ctx).First(&report, "id = ?", id).Error
	return &report, err
}

func (r *ActuarialRepository) ListNAICOMReports(ctx context.Context, reportType, period string) ([]models.NAICOMReport, error) {
	var reports []models.NAICOMReport
	query := r.db.WithContext(ctx)
	if reportType != "" {
		query = query.Where("report_type = ?", reportType)
	}
	if period != "" {
		query = query.Where("period = ?", period)
	}
	err := query.Order("created_at DESC").Find(&reports).Error
	return reports, err
}

func (r *ActuarialRepository) SubmitNAICOMReport(ctx context.Context, id, submitterID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.NAICOMReport{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       "submitted",
		"submitted_at": now,
		"submitted_by": submitterID,
		"updated_at":   now,
	}).Error
}

// Aggregation queries
func (r *ActuarialRepository) GetTotalReservesByDate(ctx context.Context, date time.Time) (float64, error) {
	var total float64
	err := r.db.WithContext(ctx).Model(&models.ReserveCalculation{}).
		Where("valuation_date = ? AND status = ?", date, "approved").
		Select("COALESCE(SUM(gross_reserve), 0)").Scan(&total).Error
	return total, err
}

func (r *ActuarialRepository) GetPremiumSummaryByProduct(ctx context.Context, startDate, endDate time.Time) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	err := r.db.WithContext(ctx).Model(&models.PremiumCalculation{}).
		Select("product_type, COUNT(*) as count, SUM(gross_premium) as total_premium, AVG(gross_premium) as avg_premium").
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Group("product_type").
		Scan(&results).Error
	return results, err
}
