package repository

import (
	"context"
	"fmt"
	"agent-mobile-app/internal/models"
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errNoDB = fmt.Errorf("database not available")

type AgentMobileRepository struct{ db *gorm.DB }
func NewAgentMobileRepository(db *gorm.DB) *AgentMobileRepository { return &AgentMobileRepository{db: db} }

func (r *AgentMobileRepository) AutoMigrate() error {
	if r.db == nil { return nil }
	return r.db.AutoMigrate(&models.AgentProfile{}, &models.AgentLead{}, &models.AgentQuote{}, &models.AgentActivity{})
}

func (r *AgentMobileRepository) GetAgent(ctx context.Context, code string) (*models.AgentProfile, error) {
	var a models.AgentProfile; return &a, r.db.WithContext(ctx).First(&a, "agent_code = ?", code).Error
}
func (r *AgentMobileRepository) UpdateAgent(ctx context.Context, a *models.AgentProfile) error {
	a.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(a).Error
}
func (r *AgentMobileRepository) CreateAgent(ctx context.Context, a *models.AgentProfile) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now(); a.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(a).Error
}
func (r *AgentMobileRepository) CreateLead(ctx context.Context, l *models.AgentLead) error {
	l.ID = uuid.New(); l.CreatedAt = time.Now(); l.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Create(l).Error
}
func (r *AgentMobileRepository) GetLeads(ctx context.Context, agentCode, status string) ([]models.AgentLead, error) {
	var leads []models.AgentLead; q := r.db.WithContext(ctx).Where("agent_code = ?", agentCode)
	if status != "" { q = q.Where("status = ?", status) }
	return leads, q.Order("created_at DESC").Limit(50).Find(&leads).Error
}
func (r *AgentMobileRepository) GetLead(ctx context.Context, id uuid.UUID) (*models.AgentLead, error) {
	var l models.AgentLead; return &l, r.db.WithContext(ctx).First(&l, "id = ?", id).Error
}
func (r *AgentMobileRepository) UpdateLead(ctx context.Context, l *models.AgentLead) error {
	l.UpdatedAt = time.Now(); return r.db.WithContext(ctx).Save(l).Error
}
func (r *AgentMobileRepository) CreateQuote(ctx context.Context, q *models.AgentQuote) error {
	q.ID = uuid.New(); q.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(q).Error
}
func (r *AgentMobileRepository) GetQuotes(ctx context.Context, agentCode string) ([]models.AgentQuote, error) {
	var quotes []models.AgentQuote
	return quotes, r.db.WithContext(ctx).Where("agent_code = ?", agentCode).Order("created_at DESC").Limit(50).Find(&quotes).Error
}
func (r *AgentMobileRepository) GetQuote(ctx context.Context, ref string) (*models.AgentQuote, error) {
	var q models.AgentQuote; return &q, r.db.WithContext(ctx).First(&q, "quote_ref = ?", ref).Error
}
func (r *AgentMobileRepository) LogActivity(ctx context.Context, a *models.AgentActivity) error {
	a.ID = uuid.New(); a.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(a).Error
}
func (r *AgentMobileRepository) GetActivities(ctx context.Context, agentCode string, limit int) ([]models.AgentActivity, error) {
	var acts []models.AgentActivity
	if limit <= 0 { limit = 20 }
	return acts, r.db.WithContext(ctx).Where("agent_code = ?", agentCode).Order("created_at DESC").Limit(limit).Find(&acts).Error
}
func (r *AgentMobileRepository) CountLeads(ctx context.Context, agentCode, status string) (int64, error) {
	var count int64; q := r.db.WithContext(ctx).Model(&models.AgentLead{}).Where("agent_code = ?", agentCode)
	if status != "" { q = q.Where("status = ?", status) }
	return count, q.Count(&count).Error
}
func (r *AgentMobileRepository) CountQuotes(ctx context.Context, agentCode, status string) (int64, error) {
	var count int64; q := r.db.WithContext(ctx).Model(&models.AgentQuote{}).Where("agent_code = ?", agentCode)
	if status != "" { q = q.Where("status = ?", status) }
	return count, q.Count(&count).Error
}
func (r *AgentMobileRepository) SumMonthlyPremium(ctx context.Context, agentCode string) (float64, error) {
	var total float64
	start := time.Now().AddDate(0, 0, -30)
	return total, r.db.WithContext(ctx).Model(&models.AgentQuote{}).Where("agent_code = ? AND status = ? AND created_at >= ?", agentCode, "accepted", start).Select("COALESCE(SUM(premium), 0)").Scan(&total).Error
}
func (r *AgentMobileRepository) SumMonthlyCommission(ctx context.Context, agentCode string) (float64, error) {
	var total float64
	start := time.Now().AddDate(0, 0, -30)
	return total, r.db.WithContext(ctx).Model(&models.AgentQuote{}).Where("agent_code = ? AND status = ? AND created_at >= ?", agentCode, "accepted", start).Select("COALESCE(SUM(commission), 0)").Scan(&total).Error
}
