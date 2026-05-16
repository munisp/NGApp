package repository

import (
	"agent-commission-management/internal/models"
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CommissionRepository struct{ db *gorm.DB }

func NewCommissionRepository(db *gorm.DB) *CommissionRepository {
	return &CommissionRepository{db: db}
}

func (r *CommissionRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&models.Agent{}, &models.CommissionStructure{}, &models.CommissionTransaction{}, &models.CommissionPayment{}, &models.AgentPerformance{}, &models.ClawbackRecord{})
}

func (r *CommissionRepository) CreateAgent(ctx context.Context, a *models.Agent) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now(); a.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *CommissionRepository) GetAgent(ctx context.Context, id uuid.UUID) (*models.Agent, error) {
	var a models.Agent; return &a, r.db.WithContext(ctx).First(&a, "id = ?", id).Error
}

func (r *CommissionRepository) GetAgentByCode(ctx context.Context, code string) (*models.Agent, error) {
	var a models.Agent; return &a, r.db.WithContext(ctx).Where("agent_code = ?", code).First(&a).Error
}

func (r *CommissionRepository) ListAgents(ctx context.Context, status string) ([]models.Agent, error) {
	var agents []models.Agent; q := r.db.WithContext(ctx)
	if status != "" { q = q.Where("status = ?", status) }
	return agents, q.Order("full_name").Find(&agents).Error
}

func (r *CommissionRepository) UpdateAgent(ctx context.Context, a *models.Agent) error {
	a.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(a).Error
}

func (r *CommissionRepository) CreateStructure(ctx context.Context, s *models.CommissionStructure) error {
	s.ID = uuid.New(); s.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *CommissionRepository) GetStructure(ctx context.Context, productType, agentType, tier string) (*models.CommissionStructure, error) {
	var s models.CommissionStructure
	return &s, r.db.WithContext(ctx).Where("product_type = ? AND agent_type = ? AND tier_level = ? AND status = ?", productType, agentType, tier, "active").First(&s).Error
}

func (r *CommissionRepository) ListStructures(ctx context.Context) ([]models.CommissionStructure, error) {
	var structures []models.CommissionStructure
	return structures, r.db.WithContext(ctx).Where("status = ?", "active").Find(&structures).Error
}

func (r *CommissionRepository) CreateTransaction(ctx context.Context, t *models.CommissionTransaction) error {
	t.ID = uuid.New(); t.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(t).Error
}

func (r *CommissionRepository) GetTransactionsByAgent(ctx context.Context, agentID uuid.UUID, period string) ([]models.CommissionTransaction, error) {
	var txns []models.CommissionTransaction; q := r.db.WithContext(ctx).Where("agent_id = ?", agentID)
	if period != "" { q = q.Where("period = ?", period) }
	return txns, q.Order("created_at DESC").Find(&txns).Error
}

func (r *CommissionRepository) GetPendingTransactions(ctx context.Context, agentID uuid.UUID) ([]models.CommissionTransaction, error) {
	var txns []models.CommissionTransaction
	return txns, r.db.WithContext(ctx).Where("agent_id = ? AND status = ?", agentID, "pending").Find(&txns).Error
}

func (r *CommissionRepository) UpdateTransaction(ctx context.Context, t *models.CommissionTransaction) error {
	return r.db.WithContext(ctx).Save(t).Error
}

func (r *CommissionRepository) CreatePayment(ctx context.Context, p *models.CommissionPayment) error {
	p.ID = uuid.New(); p.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *CommissionRepository) GetPaymentsByAgent(ctx context.Context, agentID uuid.UUID) ([]models.CommissionPayment, error) {
	var payments []models.CommissionPayment
	return payments, r.db.WithContext(ctx).Where("agent_id = ?", agentID).Order("created_at DESC").Find(&payments).Error
}

func (r *CommissionRepository) CreatePerformance(ctx context.Context, p *models.AgentPerformance) error {
	p.ID = uuid.New(); p.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *CommissionRepository) GetPerformance(ctx context.Context, agentID uuid.UUID) ([]models.AgentPerformance, error) {
	var perf []models.AgentPerformance
	return perf, r.db.WithContext(ctx).Where("agent_id = ?", agentID).Order("period DESC").Find(&perf).Error
}

func (r *CommissionRepository) CreateClawback(ctx context.Context, c *models.ClawbackRecord) error {
	c.ID = uuid.New(); c.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *CommissionRepository) GetClawbacks(ctx context.Context, agentID uuid.UUID) ([]models.ClawbackRecord, error) {
	var clawbacks []models.ClawbackRecord
	return clawbacks, r.db.WithContext(ctx).Where("agent_id = ?", agentID).Find(&clawbacks).Error
}

func (r *CommissionRepository) GetAgentTotalCommission(ctx context.Context, agentID uuid.UUID, period string) (float64, error) {
	var total float64
	return total, r.db.WithContext(ctx).Model(&models.CommissionTransaction{}).Where("agent_id = ? AND period = ? AND status IN ?", agentID, period, []string{"approved", "paid"}).Select("COALESCE(SUM(net_commission), 0)").Scan(&total).Error
}

func (r *CommissionRepository) GetAgentPolicySold(ctx context.Context, agentID uuid.UUID, period string) (int64, error) {
	var count int64
	return count, r.db.WithContext(ctx).Model(&models.CommissionTransaction{}).Where("agent_id = ? AND period = ? AND transaction_type = ?", agentID, period, "initial").Count(&count).Error
}
