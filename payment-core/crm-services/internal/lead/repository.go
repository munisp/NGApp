package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/enterprise-crm/crm-core-service/internal/models"
)

// LeadRepository interface defines lead data access operations
type LeadRepository interface {
	Create(ctx context.Context, lead *models.Lead) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Lead, error)
	GetByEmail(ctx context.Context, email string) (*models.Lead, error)
	GetByLeadNumber(ctx context.Context, leadNumber string) (*models.Lead, error)
	Update(ctx context.Context, lead *models.Lead) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, filters LeadFilters, pagination Pagination) ([]*models.Lead, int64, error)
	Search(ctx context.Context, query string, filters LeadFilters, pagination Pagination) ([]*models.Lead, int64, error)
	GetByOwner(ctx context.Context, ownerID uuid.UUID, pagination Pagination) ([]*models.Lead, int64, error)
	GetBySource(ctx context.Context, source string, pagination Pagination) ([]*models.Lead, int64, error)
	GetByStatus(ctx context.Context, status models.LeadStatus, pagination Pagination) ([]*models.Lead, int64, error)
	GetByGrade(ctx context.Context, grade models.LeadGrade, pagination Pagination) ([]*models.Lead, int64, error)
	GetConversionCandidates(ctx context.Context, pagination Pagination) ([]*models.Lead, int64, error)
	BulkCreate(ctx context.Context, leads []*models.Lead) error
	BulkUpdate(ctx context.Context, leads []*models.Lead) error
	BulkDelete(ctx context.Context, ids []uuid.UUID) error
	GetStatistics(ctx context.Context, filters LeadFilters) (*LeadStatistics, error)
	GetConversionFunnel(ctx context.Context, filters LeadFilters) (*ConversionFunnel, error)
}

// leadRepository implements LeadRepository interface
type leadRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewLeadRepository creates a new lead repository
func NewLeadRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) LeadRepository {
	return &leadRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// LeadFilters represents filters for lead queries
type LeadFilters struct {
	Status       []models.LeadStatus `json:"status"`
	Grade        []models.LeadGrade  `json:"grade"`
	Source       []string            `json:"source"`
	OwnerIDs     []uuid.UUID         `json:"owner_ids"`
	ScoreMin     *int                `json:"score_min"`
	ScoreMax     *int                `json:"score_max"`
	CreatedAfter *time.Time          `json:"created_after"`
	CreatedBefore *time.Time         `json:"created_before"`
	Industry     []string            `json:"industry"`
	CompanySize  []string            `json:"company_size"`
	Tags         []string            `json:"tags"`
}

// Pagination represents pagination parameters
type Pagination struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	SortBy   string `json:"sort_by"`
	SortDesc bool   `json:"sort_desc"`
}

// LeadStatistics represents lead statistics
type LeadStatistics struct {
	TotalLeads       int64                    `json:"total_leads"`
	LeadsByStatus    map[string]int64         `json:"leads_by_status"`
	LeadsByGrade     map[string]int64         `json:"leads_by_grade"`
	LeadsBySource    map[string]int64         `json:"leads_by_source"`
	LeadsByOwner     []map[string]interface{} `json:"leads_by_owner"`
	AverageScore     float64                  `json:"average_score"`
	ConversionRate   float64                  `json:"conversion_rate"`
	QualificationRate float64                 `json:"qualification_rate"`
	TopSources       []map[string]interface{} `json:"top_sources"`
	ScoreDistribution map[string]int64        `json:"score_distribution"`
}

// ConversionFunnel represents lead conversion funnel data
type ConversionFunnel struct {
	TotalLeads      int64   `json:"total_leads"`
	QualifiedLeads  int64   `json:"qualified_leads"`
	ConvertedLeads  int64   `json:"converted_leads"`
	QualificationRate float64 `json:"qualification_rate"`
	ConversionRate  float64 `json:"conversion_rate"`
	StageBreakdown  []FunnelStage `json:"stage_breakdown"`
}

// FunnelStage represents a stage in the conversion funnel
type FunnelStage struct {
	Stage       string  `json:"stage"`
	Count       int64   `json:"count"`
	Percentage  float64 `json:"percentage"`
	DropoffRate float64 `json:"dropoff_rate"`
}

// Cache keys
const (
	leadCachePrefix        = "lead:"
	leadEmailCachePrefix   = "lead:email:"
	leadNumberCachePrefix  = "lead:number:"
	leadOwnerCachePrefix   = "lead:owner:"
	leadStatsCachePrefix   = "lead:stats:"
	leadCacheTTL           = 1 * time.Hour
	leadStatsCacheTTL      = 15 * time.Minute
)

// Create creates a new lead
func (r *leadRepository) Create(ctx context.Context, lead *models.Lead) error {
	if err := r.db.WithContext(ctx).Create(lead).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create lead")
		return err
	}

	// Cache the lead
	r.cacheLeadAsync(ctx, lead)

	r.logger.WithField("lead_id", lead.ID).Info("Lead created successfully")
	return nil
}

// GetByID retrieves a lead by ID
func (r *leadRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Lead, error) {
	// Try cache first
	if lead, err := r.getLeadFromCache(ctx, id); err == nil && lead != nil {
		return lead, nil
	}

	var lead models.Lead
	err := r.db.WithContext(ctx).
		Preload("Activities").
		Preload("Interactions").
		First(&lead, "id = ? AND deleted_at IS NULL", id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("lead not found")
		}
		r.logger.WithError(err).WithField("lead_id", id).Error("Failed to get lead by ID")
		return nil, err
	}

	// Cache the lead
	r.cacheLeadAsync(ctx, &lead)

	return &lead, nil
}

// GetByEmail retrieves a lead by email
func (r *leadRepository) GetByEmail(ctx context.Context, email string) (*models.Lead, error) {
	// Try cache first
	cacheKey := leadEmailCachePrefix + email
	if leadID, err := r.redis.Get(ctx, cacheKey).Result(); err == nil {
		if id, err := uuid.Parse(leadID); err == nil {
			return r.GetByID(ctx, id)
		}
	}

	var lead models.Lead
	err := r.db.WithContext(ctx).
		First(&lead, "email = ? AND deleted_at IS NULL", email).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("lead not found")
		}
		r.logger.WithError(err).WithField("email", email).Error("Failed to get lead by email")
		return nil, err
	}

	// Cache the email to ID mapping
	r.redis.Set(ctx, cacheKey, lead.ID.String(), leadCacheTTL)

	return &lead, nil
}

// GetByLeadNumber retrieves a lead by lead number
func (r *leadRepository) GetByLeadNumber(ctx context.Context, leadNumber string) (*models.Lead, error) {
	// Try cache first
	cacheKey := leadNumberCachePrefix + leadNumber
	if leadID, err := r.redis.Get(ctx, cacheKey).Result(); err == nil {
		if id, err := uuid.Parse(leadID); err == nil {
			return r.GetByID(ctx, id)
		}
	}

	var lead models.Lead
	err := r.db.WithContext(ctx).
		First(&lead, "lead_number = ? AND deleted_at IS NULL", leadNumber).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("lead not found")
		}
		r.logger.WithError(err).WithField("lead_number", leadNumber).Error("Failed to get lead by number")
		return nil, err
	}

	// Cache the number to ID mapping
	r.redis.Set(ctx, cacheKey, lead.ID.String(), leadCacheTTL)

	return &lead, nil
}

// Update updates a lead
func (r *leadRepository) Update(ctx context.Context, lead *models.Lead) error {
	if err := r.db.WithContext(ctx).Save(lead).Error; err != nil {
		r.logger.WithError(err).WithField("lead_id", lead.ID).Error("Failed to update lead")
		return err
	}

	// Update cache
	r.cacheLeadAsync(ctx, lead)

	// Invalidate related caches
	r.invalidateLeadCaches(ctx, lead.ID, lead.Email, lead.LeadNumber)

	r.logger.WithField("lead_id", lead.ID).Info("Lead updated successfully")
	return nil
}

// Delete soft deletes a lead
func (r *leadRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Lead{}, "id = ?", id).Error; err != nil {
		r.logger.WithError(err).WithField("lead_id", id).Error("Failed to delete lead")
		return err
	}

	// Remove from cache
	r.invalidateLeadCaches(ctx, id, "", "")

	r.logger.WithField("lead_id", id).Info("Lead deleted successfully")
	return nil
}

// List retrieves leads with filters and pagination
func (r *leadRepository) List(ctx context.Context, filters LeadFilters, pagination Pagination) ([]*models.Lead, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Lead{}).Where("deleted_at IS NULL")

	// Apply filters
	query = r.applyLeadFilters(query, filters)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count leads")
		return nil, 0, err
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	var leads []*models.Lead
	if err := query.Find(&leads).Error; err != nil {
		r.logger.WithError(err).Error("Failed to list leads")
		return nil, 0, err
	}

	return leads, total, nil
}

// Search performs full-text search on leads
func (r *leadRepository) Search(ctx context.Context, query string, filters LeadFilters, pagination Pagination) ([]*models.Lead, int64, error) {
	dbQuery := r.db.WithContext(ctx).Model(&models.Lead{}).Where("deleted_at IS NULL")

	// Apply full-text search
	if query != "" {
		searchQuery := strings.ReplaceAll(query, " ", " & ")
		dbQuery = dbQuery.Where(
			"to_tsvector('english', first_name || ' ' || last_name || ' ' || company || ' ' || email) @@ to_tsquery('english', ?)",
			searchQuery,
		)
	}

	// Apply filters
	dbQuery = r.applyLeadFilters(dbQuery, filters)

	// Count total records
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count search results")
		return nil, 0, err
	}

	// Apply pagination and sorting
	dbQuery = r.applyPagination(dbQuery, pagination)

	var leads []*models.Lead
	if err := dbQuery.Find(&leads).Error; err != nil {
		r.logger.WithError(err).Error("Failed to search leads")
		return nil, 0, err
	}

	return leads, total, nil
}

// GetByOwner retrieves leads by owner ID
func (r *leadRepository) GetByOwner(ctx context.Context, ownerID uuid.UUID, pagination Pagination) ([]*models.Lead, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Lead{}).
		Where("owner_id = ? AND deleted_at IS NULL", ownerID)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count leads by owner")
		return nil, 0, err
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	var leads []*models.Lead
	if err := query.Find(&leads).Error; err != nil {
		r.logger.WithError(err).Error("Failed to get leads by owner")
		return nil, 0, err
	}

	return leads, total, nil
}

// GetBySource retrieves leads by source
func (r *leadRepository) GetBySource(ctx context.Context, source string, pagination Pagination) ([]*models.Lead, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Lead{}).
		Where("source = ? AND deleted_at IS NULL", source)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count leads by source")
		return nil, 0, err
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	var leads []*models.Lead
	if err := query.Find(&leads).Error; err != nil {
		r.logger.WithError(err).Error("Failed to get leads by source")
		return nil, 0, err
	}

	return leads, total, nil
}

// GetByStatus retrieves leads by status
func (r *leadRepository) GetByStatus(ctx context.Context, status models.LeadStatus, pagination Pagination) ([]*models.Lead, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Lead{}).
		Where("status = ? AND deleted_at IS NULL", status)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count leads by status")
		return nil, 0, err
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	var leads []*models.Lead
	if err := query.Find(&leads).Error; err != nil {
		r.logger.WithError(err).Error("Failed to get leads by status")
		return nil, 0, err
	}

	return leads, total, nil
}

// GetByGrade retrieves leads by grade
func (r *leadRepository) GetByGrade(ctx context.Context, grade models.LeadGrade, pagination Pagination) ([]*models.Lead, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Lead{}).
		Where("grade = ? AND deleted_at IS NULL", grade)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count leads by grade")
		return nil, 0, err
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	var leads []*models.Lead
	if err := query.Find(&leads).Error; err != nil {
		r.logger.WithError(err).Error("Failed to get leads by grade")
		return nil, 0, err
	}

	return leads, total, nil
}

// GetConversionCandidates retrieves leads that are candidates for conversion
func (r *leadRepository) GetConversionCandidates(ctx context.Context, pagination Pagination) ([]*models.Lead, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Lead{}).
		Where("status = ? AND grade IN (?, ?) AND score >= ? AND deleted_at IS NULL",
			models.LeadStatusQualified, models.LeadGradeA, models.LeadGradeB, 70)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count conversion candidates")
		return nil, 0, err
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	var leads []*models.Lead
	if err := query.Find(&leads).Error; err != nil {
		r.logger.WithError(err).Error("Failed to get conversion candidates")
		return nil, 0, err
	}

	return leads, total, nil
}

// BulkCreate creates multiple leads
func (r *leadRepository) BulkCreate(ctx context.Context, leads []*models.Lead) error {
	if err := r.db.WithContext(ctx).CreateInBatches(leads, 100).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk create leads")
		return err
	}

	r.logger.WithField("count", len(leads)).Info("Leads bulk created successfully")
	return nil
}

// BulkUpdate updates multiple leads
func (r *leadRepository) BulkUpdate(ctx context.Context, leads []*models.Lead) error {
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, lead := range leads {
		if err := tx.Save(lead).Error; err != nil {
			tx.Rollback()
			r.logger.WithError(err).Error("Failed to bulk update leads")
			return err
		}
	}

	if err := tx.Commit().Error; err != nil {
		r.logger.WithError(err).Error("Failed to commit bulk update transaction")
		return err
	}

	r.logger.WithField("count", len(leads)).Info("Leads bulk updated successfully")
	return nil
}

// BulkDelete deletes multiple leads
func (r *leadRepository) BulkDelete(ctx context.Context, ids []uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Lead{}, "id IN ?", ids).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk delete leads")
		return err
	}

	r.logger.WithField("count", len(ids)).Info("Leads bulk deleted successfully")
	return nil
}

// GetStatistics retrieves lead statistics
func (r *leadRepository) GetStatistics(ctx context.Context, filters LeadFilters) (*LeadStatistics, error) {
	// Try cache first
	cacheKey := leadStatsCachePrefix + r.getFilterHash(filters)
	if cached, err := r.redis.Get(ctx, cacheKey).Result(); err == nil {
		var stats LeadStatistics
		if err := json.Unmarshal([]byte(cached), &stats); err == nil {
			return &stats, nil
		}
	}

	query := r.db.WithContext(ctx).Model(&models.Lead{}).Where("deleted_at IS NULL")
	query = r.applyLeadFilters(query, filters)

	stats := &LeadStatistics{
		LeadsByStatus: make(map[string]int64),
		LeadsByGrade:  make(map[string]int64),
		LeadsBySource: make(map[string]int64),
		ScoreDistribution: make(map[string]int64),
	}

	// Total leads
	query.Count(&stats.TotalLeads)

	// Leads by status
	var statusResults []struct {
		Status string
		Count  int64
	}
	r.db.WithContext(ctx).Model(&models.Lead{}).
		Select("status, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Group("status").
		Scan(&statusResults)

	for _, result := range statusResults {
		stats.LeadsByStatus[result.Status] = result.Count
	}

	// Leads by grade
	var gradeResults []struct {
		Grade string
		Count int64
	}
	r.db.WithContext(ctx).Model(&models.Lead{}).
		Select("grade, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Group("grade").
		Scan(&gradeResults)

	for _, result := range gradeResults {
		stats.LeadsByGrade[result.Grade] = result.Count
	}

	// Leads by source
	var sourceResults []struct {
		Source string
		Count  int64
	}
	r.db.WithContext(ctx).Model(&models.Lead{}).
		Select("source, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Group("source").
		Order("count DESC").
		Limit(10).
		Scan(&sourceResults)

	for _, result := range sourceResults {
		stats.LeadsBySource[result.Source] = result.Count
	}

	// Average score
	r.db.WithContext(ctx).Model(&models.Lead{}).
		Select("AVG(score)").
		Where("deleted_at IS NULL").
		Scan(&stats.AverageScore)

	// Conversion rate
	var totalLeads, convertedLeads int64
	r.db.WithContext(ctx).Model(&models.Lead{}).Where("deleted_at IS NULL").Count(&totalLeads)
	r.db.WithContext(ctx).Model(&models.Lead{}).Where("status = ? AND deleted_at IS NULL", models.LeadStatusConverted).Count(&convertedLeads)
	
	if totalLeads > 0 {
		stats.ConversionRate = float64(convertedLeads) / float64(totalLeads) * 100
	}

	// Qualification rate
	var qualifiedLeads int64
	r.db.WithContext(ctx).Model(&models.Lead{}).Where("status = ? AND deleted_at IS NULL", models.LeadStatusQualified).Count(&qualifiedLeads)
	
	if totalLeads > 0 {
		stats.QualificationRate = float64(qualifiedLeads) / float64(totalLeads) * 100
	}

	// Cache the results
	if statsJSON, err := json.Marshal(stats); err == nil {
		r.redis.Set(ctx, cacheKey, statsJSON, leadStatsCacheTTL)
	}

	return stats, nil
}

// GetConversionFunnel retrieves lead conversion funnel data
func (r *leadRepository) GetConversionFunnel(ctx context.Context, filters LeadFilters) (*ConversionFunnel, error) {
	query := r.db.WithContext(ctx).Model(&models.Lead{}).Where("deleted_at IS NULL")
	query = r.applyLeadFilters(query, filters)

	funnel := &ConversionFunnel{}

	// Total leads
	query.Count(&funnel.TotalLeads)

	// Qualified leads
	r.db.WithContext(ctx).Model(&models.Lead{}).
		Where("status = ? AND deleted_at IS NULL", models.LeadStatusQualified).
		Count(&funnel.QualifiedLeads)

	// Converted leads
	r.db.WithContext(ctx).Model(&models.Lead{}).
		Where("status = ? AND deleted_at IS NULL", models.LeadStatusConverted).
		Count(&funnel.ConvertedLeads)

	// Calculate rates
	if funnel.TotalLeads > 0 {
		funnel.QualificationRate = float64(funnel.QualifiedLeads) / float64(funnel.TotalLeads) * 100
		funnel.ConversionRate = float64(funnel.ConvertedLeads) / float64(funnel.TotalLeads) * 100
	}

	// Stage breakdown
	var stageResults []struct {
		Status string
		Count  int64
	}
	r.db.WithContext(ctx).Model(&models.Lead{}).
		Select("status, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Group("status").
		Order("count DESC").
		Scan(&stageResults)

	for _, result := range stageResults {
		percentage := float64(0)
		if funnel.TotalLeads > 0 {
			percentage = float64(result.Count) / float64(funnel.TotalLeads) * 100
		}

		funnel.StageBreakdown = append(funnel.StageBreakdown, FunnelStage{
			Stage:      result.Status,
			Count:      result.Count,
			Percentage: percentage,
		})
	}

	return funnel, nil
}

// Helper methods

// applyLeadFilters applies filters to the query
func (r *leadRepository) applyLeadFilters(query *gorm.DB, filters LeadFilters) *gorm.DB {
	if len(filters.Status) > 0 {
		query = query.Where("status IN ?", filters.Status)
	}

	if len(filters.Grade) > 0 {
		query = query.Where("grade IN ?", filters.Grade)
	}

	if len(filters.Source) > 0 {
		query = query.Where("source IN ?", filters.Source)
	}

	if len(filters.OwnerIDs) > 0 {
		query = query.Where("owner_id IN ?", filters.OwnerIDs)
	}

	if filters.ScoreMin != nil {
		query = query.Where("score >= ?", *filters.ScoreMin)
	}

	if filters.ScoreMax != nil {
		query = query.Where("score <= ?", *filters.ScoreMax)
	}

	if filters.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filters.CreatedAfter)
	}

	if filters.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filters.CreatedBefore)
	}

	if len(filters.Industry) > 0 {
		query = query.Where("industry IN ?", filters.Industry)
	}

	if len(filters.CompanySize) > 0 {
		query = query.Where("company_size IN ?", filters.CompanySize)
	}

	if len(filters.Tags) > 0 {
		query = query.Where("tags && ?", filters.Tags)
	}

	return query
}

// applyPagination applies pagination and sorting to the query
func (r *leadRepository) applyPagination(query *gorm.DB, pagination Pagination) *gorm.DB {
	if pagination.PageSize <= 0 {
		pagination.PageSize = 20
	}
	if pagination.Page <= 0 {
		pagination.Page = 1
	}

	offset := (pagination.Page - 1) * pagination.PageSize
	query = query.Offset(offset).Limit(pagination.PageSize)

	if pagination.SortBy != "" {
		order := pagination.SortBy
		if pagination.SortDesc {
			order += " DESC"
		}
		query = query.Order(order)
	} else {
		query = query.Order("created_at DESC")
	}

	return query
}

// Cache operations

// cacheLeadAsync caches a lead asynchronously
func (r *leadRepository) cacheLeadAsync(ctx context.Context, lead *models.Lead) {
	go func() {
		r.cacheLead(context.Background(), lead)
	}()
}

// cacheLead caches a lead
func (r *leadRepository) cacheLead(ctx context.Context, lead *models.Lead) {
	leadJSON, err := json.Marshal(lead)
	if err != nil {
		r.logger.WithError(err).Error("Failed to marshal lead for caching")
		return
	}

	cacheKey := leadCachePrefix + lead.ID.String()
	if err := r.redis.Set(ctx, cacheKey, leadJSON, leadCacheTTL).Err(); err != nil {
		r.logger.WithError(err).Error("Failed to cache lead")
	}

	// Cache email and number mappings
	if lead.Email != "" {
		emailKey := leadEmailCachePrefix + lead.Email
		r.redis.Set(ctx, emailKey, lead.ID.String(), leadCacheTTL)
	}

	if lead.LeadNumber != "" {
		numberKey := leadNumberCachePrefix + lead.LeadNumber
		r.redis.Set(ctx, numberKey, lead.ID.String(), leadCacheTTL)
	}
}

// getLeadFromCache retrieves a lead from cache
func (r *leadRepository) getLeadFromCache(ctx context.Context, id uuid.UUID) (*models.Lead, error) {
	cacheKey := leadCachePrefix + id.String()
	leadJSON, err := r.redis.Get(ctx, cacheKey).Result()
	if err != nil {
		return nil, err
	}

	var lead models.Lead
	if err := json.Unmarshal([]byte(leadJSON), &lead); err != nil {
		return nil, err
	}

	return &lead, nil
}

// invalidateLeadCaches invalidates lead-related caches
func (r *leadRepository) invalidateLeadCaches(ctx context.Context, id uuid.UUID, email, leadNumber string) {
	keys := []string{leadCachePrefix + id.String()}

	if email != "" {
		keys = append(keys, leadEmailCachePrefix+email)
	}

	if leadNumber != "" {
		keys = append(keys, leadNumberCachePrefix+leadNumber)
	}

	for _, key := range keys {
		r.redis.Del(ctx, key)
	}
}

// getFilterHash generates a hash for filter caching
func (r *leadRepository) getFilterHash(filters LeadFilters) string {
	filterJSON, _ := json.Marshal(filters)
	return fmt.Sprintf("%x", filterJSON)
}

