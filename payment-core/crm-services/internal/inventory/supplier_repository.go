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

	"github.com/enterprise-crm/inventory-service/internal/models"
)

// SupplierRepository handles supplier data operations
type SupplierRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewSupplierRepository creates a new supplier repository
func NewSupplierRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) *SupplierRepository {
	return &SupplierRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// SupplierFilter represents supplier filtering options
type SupplierFilter struct {
	Type               string     `json:"type"`
	Status             string     `json:"status"`
	CertificationLevel string     `json:"certification_level"`
	MinRating          *float64   `json:"min_rating"`
	MaxRating          *float64   `json:"max_rating"`
	MinOnTimeDelivery  *float64   `json:"min_on_time_delivery"`
	MinQualityScore    *float64   `json:"min_quality_score"`
	Search             string     `json:"search"`
	Country            string     `json:"country"`
	State              string     `json:"state"`
	City               string     `json:"city"`
	Tags               []string   `json:"tags"`
	IsActive           *bool      `json:"is_active"`
	HasProducts        *bool      `json:"has_products"`
	CreatedAfter       *time.Time `json:"created_after"`
	CreatedBefore      *time.Time `json:"created_before"`
}

// SupplierStats represents supplier statistics
type SupplierStats struct {
	TotalSuppliers       int64   `json:"total_suppliers"`
	ActiveSuppliers      int64   `json:"active_suppliers"`
	InactiveSuppliers    int64   `json:"inactive_suppliers"`
	SuspendedSuppliers   int64   `json:"suspended_suppliers"`
	AverageRating        float64 `json:"average_rating"`
	AverageOnTimeDelivery float64 `json:"average_on_time_delivery"`
	AverageQualityScore  float64 `json:"average_quality_score"`
	TopSuppliers         []SupplierPerformance `json:"top_suppliers"`
	SuppliersByType      []SupplierTypeCount   `json:"suppliers_by_type"`
	SuppliersByCountry   []SupplierCountryCount `json:"suppliers_by_country"`
}

// SupplierPerformance represents supplier performance metrics
type SupplierPerformance struct {
	SupplierID        uuid.UUID `json:"supplier_id"`
	SupplierName      string    `json:"supplier_name"`
	Rating            float64   `json:"rating"`
	OnTimeDelivery    float64   `json:"on_time_delivery"`
	QualityScore      float64   `json:"quality_score"`
	ProductCount      int64     `json:"product_count"`
	AverageCostPrice  float64   `json:"average_cost_price"`
	AverageLeadTime   float64   `json:"average_lead_time"`
}

// SupplierTypeCount represents supplier count by type
type SupplierTypeCount struct {
	Type         string `json:"type"`
	SupplierCount int64  `json:"supplier_count"`
}

// SupplierCountryCount represents supplier count by country
type SupplierCountryCount struct {
	Country       string `json:"country"`
	SupplierCount int64  `json:"supplier_count"`
}

// Create creates a new supplier
func (r *SupplierRepository) Create(ctx context.Context, supplier *models.Supplier) error {
	if err := r.db.WithContext(ctx).Create(supplier).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create supplier")
		return fmt.Errorf("failed to create supplier: %w", err)
	}

	// Cache the supplier
	if r.redis != nil {
		r.cacheSupplier(ctx, supplier)
	}

	r.logger.WithField("supplier_id", supplier.ID).Info("Supplier created successfully")
	return nil
}

// GetByID retrieves a supplier by ID
func (r *SupplierRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Supplier, error) {
	// Try cache first
	if r.redis != nil {
		if supplier, err := r.getSupplierFromCache(ctx, id.String()); err == nil && supplier != nil {
			return supplier, nil
		}
	}

	var supplier models.Supplier
	err := r.db.WithContext(ctx).
		Preload("ContactPersons").
		Preload("Products.Product").
		First(&supplier, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("supplier_id", id).Error("Failed to get supplier")
		return nil, fmt.Errorf("failed to get supplier: %w", err)
	}

	// Cache the supplier
	if r.redis != nil {
		r.cacheSupplier(ctx, &supplier)
	}

	return &supplier, nil
}

// GetBySupplierNumber retrieves a supplier by supplier number
func (r *SupplierRepository) GetBySupplierNumber(ctx context.Context, supplierNumber string) (*models.Supplier, error) {
	var supplier models.Supplier
	err := r.db.WithContext(ctx).
		Preload("ContactPersons").
		Where("supplier_number = ?", supplierNumber).
		First(&supplier).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("supplier_number", supplierNumber).Error("Failed to get supplier by number")
		return nil, fmt.Errorf("failed to get supplier by number: %w", err)
	}

	return &supplier, nil
}

// Update updates a supplier
func (r *SupplierRepository) Update(ctx context.Context, supplier *models.Supplier) error {
	if err := r.db.WithContext(ctx).Save(supplier).Error; err != nil {
		r.logger.WithError(err).WithField("supplier_id", supplier.ID).Error("Failed to update supplier")
		return fmt.Errorf("failed to update supplier: %w", err)
	}

	// Update cache
	if r.redis != nil {
		r.cacheSupplier(ctx, supplier)
	}

	r.logger.WithField("supplier_id", supplier.ID).Info("Supplier updated successfully")
	return nil
}

// Delete soft deletes a supplier
func (r *SupplierRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Supplier{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("supplier_id", id).Error("Failed to delete supplier")
		return fmt.Errorf("failed to delete supplier: %w", err)
	}

	// Remove from cache
	if r.redis != nil {
		r.redis.Del(ctx, SupplierCacheKey(id.String()))
	}

	r.logger.WithField("supplier_id", id).Info("Supplier deleted successfully")
	return nil
}

// List retrieves suppliers with filtering and pagination
func (r *SupplierRepository) List(ctx context.Context, filter SupplierFilter, pagination Pagination) ([]*models.Supplier, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Supplier{})

	// Apply filters
	query = r.applySupplierFilters(query, filter)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count suppliers")
		return nil, 0, fmt.Errorf("failed to count suppliers: %w", err)
	}

	// Apply pagination and preloading
	var suppliers []*models.Supplier
	err := query.
		Preload("ContactPersons").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&suppliers).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list suppliers")
		return nil, 0, fmt.Errorf("failed to list suppliers: %w", err)
	}

	return suppliers, total, nil
}

// Search performs full-text search on suppliers
func (r *SupplierRepository) Search(ctx context.Context, query string, pagination Pagination) ([]*models.Supplier, int64, error) {
	searchQuery := r.db.WithContext(ctx).Model(&models.Supplier{}).
		Where("to_tsvector('english', name || ' ' || legal_name || ' ' || supplier_number) @@ plainto_tsquery('english', ?)", query)

	// Get total count
	var total int64
	if err := searchQuery.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count search results")
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Get results
	var suppliers []*models.Supplier
	err := searchQuery.
		Preload("ContactPersons").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&suppliers).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to search suppliers")
		return nil, 0, fmt.Errorf("failed to search suppliers: %w", err)
	}

	return suppliers, total, nil
}

// GetTopPerformers retrieves top performing suppliers
func (r *SupplierRepository) GetTopPerformers(ctx context.Context, limit int) ([]*models.Supplier, error) {
	var suppliers []*models.Supplier
	err := r.db.WithContext(ctx).
		Where("status = ?", "active").
		Order("rating DESC, on_time_delivery DESC, quality_score DESC").
		Limit(limit).
		Preload("ContactPersons").
		Find(&suppliers).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get top performing suppliers")
		return nil, fmt.Errorf("failed to get top performing suppliers: %w", err)
	}

	return suppliers, nil
}

// GetByType retrieves suppliers by type
func (r *SupplierRepository) GetByType(ctx context.Context, supplierType string, pagination Pagination) ([]*models.Supplier, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Supplier{}).
		Where("type = ?", supplierType)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count suppliers by type")
		return nil, 0, fmt.Errorf("failed to count suppliers by type: %w", err)
	}

	// Get results
	var suppliers []*models.Supplier
	err := query.
		Preload("ContactPersons").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&suppliers).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get suppliers by type")
		return nil, 0, fmt.Errorf("failed to get suppliers by type: %w", err)
	}

	return suppliers, total, nil
}

// GetByLocation retrieves suppliers by location
func (r *SupplierRepository) GetByLocation(ctx context.Context, country, state, city string, pagination Pagination) ([]*models.Supplier, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Supplier{})

	if country != "" {
		query = query.Where("billing_country = ?", country)
	}
	if state != "" {
		query = query.Where("billing_state = ?", state)
	}
	if city != "" {
		query = query.Where("billing_city = ?", city)
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count suppliers by location")
		return nil, 0, fmt.Errorf("failed to count suppliers by location: %w", err)
	}

	// Get results
	var suppliers []*models.Supplier
	err := query.
		Preload("ContactPersons").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&suppliers).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get suppliers by location")
		return nil, 0, fmt.Errorf("failed to get suppliers by location: %w", err)
	}

	return suppliers, total, nil
}

// GetStats retrieves supplier statistics
func (r *SupplierRepository) GetStats(ctx context.Context) (*SupplierStats, error) {
	stats := &SupplierStats{}

	// Total suppliers
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).Count(&stats.TotalSuppliers).Error; err != nil {
		return nil, fmt.Errorf("failed to count total suppliers: %w", err)
	}

	// Active suppliers
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).Where("status = ?", "active").Count(&stats.ActiveSuppliers).Error; err != nil {
		return nil, fmt.Errorf("failed to count active suppliers: %w", err)
	}

	// Inactive suppliers
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).Where("status = ?", "inactive").Count(&stats.InactiveSuppliers).Error; err != nil {
		return nil, fmt.Errorf("failed to count inactive suppliers: %w", err)
	}

	// Suspended suppliers
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).Where("status = ?", "suspended").Count(&stats.SuspendedSuppliers).Error; err != nil {
		return nil, fmt.Errorf("failed to count suspended suppliers: %w", err)
	}

	// Average rating
	var avgRating *float64
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).Select("AVG(rating)").Scan(&avgRating).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate average rating: %w", err)
	}
	if avgRating != nil {
		stats.AverageRating = *avgRating
	}

	// Average on-time delivery
	var avgOnTime *float64
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).Select("AVG(on_time_delivery)").Scan(&avgOnTime).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate average on-time delivery: %w", err)
	}
	if avgOnTime != nil {
		stats.AverageOnTimeDelivery = *avgOnTime
	}

	// Average quality score
	var avgQuality *float64
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).Select("AVG(quality_score)").Scan(&avgQuality).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate average quality score: %w", err)
	}
	if avgQuality != nil {
		stats.AverageQualityScore = *avgQuality
	}

	// Top suppliers
	if err := r.db.WithContext(ctx).
		Table("supplier_performance").
		Order("rating DESC, on_time_delivery DESC, quality_score DESC").
		Limit(10).
		Scan(&stats.TopSuppliers).Error; err != nil {
		return nil, fmt.Errorf("failed to get top suppliers: %w", err)
	}

	// Suppliers by type
	if err := r.db.WithContext(ctx).
		Model(&models.Supplier{}).
		Select("type, COUNT(*) as supplier_count").
		Group("type").
		Order("supplier_count DESC").
		Scan(&stats.SuppliersByType).Error; err != nil {
		return nil, fmt.Errorf("failed to get suppliers by type: %w", err)
	}

	// Suppliers by country
	if err := r.db.WithContext(ctx).
		Model(&models.Supplier{}).
		Select("billing_country as country, COUNT(*) as supplier_count").
		Where("billing_country != ''").
		Group("billing_country").
		Order("supplier_count DESC").
		Limit(10).
		Scan(&stats.SuppliersByCountry).Error; err != nil {
		return nil, fmt.Errorf("failed to get suppliers by country: %w", err)
	}

	return stats, nil
}

// UpdatePerformanceMetrics updates supplier performance metrics
func (r *SupplierRepository) UpdatePerformanceMetrics(ctx context.Context, supplierID uuid.UUID, rating, onTimeDelivery, qualityScore float64) error {
	if err := r.db.WithContext(ctx).Model(&models.Supplier{}).
		Where("id = ?", supplierID).
		Updates(map[string]interface{}{
			"rating":           rating,
			"on_time_delivery": onTimeDelivery,
			"quality_score":    qualityScore,
		}).Error; err != nil {
		r.logger.WithError(err).WithField("supplier_id", supplierID).Error("Failed to update supplier performance metrics")
		return fmt.Errorf("failed to update supplier performance metrics: %w", err)
	}

	// Invalidate cache
	if r.redis != nil {
		r.redis.Del(ctx, SupplierCacheKey(supplierID.String()))
	}

	r.logger.WithField("supplier_id", supplierID).Info("Supplier performance metrics updated successfully")
	return nil
}

// BulkCreate creates multiple suppliers
func (r *SupplierRepository) BulkCreate(ctx context.Context, suppliers []*models.Supplier) error {
	if err := r.db.WithContext(ctx).CreateInBatches(suppliers, 100).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk create suppliers")
		return fmt.Errorf("failed to bulk create suppliers: %w", err)
	}

	r.logger.WithField("count", len(suppliers)).Info("Suppliers bulk created successfully")
	return nil
}

// BulkUpdate updates multiple suppliers
func (r *SupplierRepository) BulkUpdate(ctx context.Context, suppliers []*models.Supplier) error {
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, supplier := range suppliers {
		if err := tx.Save(supplier).Error; err != nil {
			tx.Rollback()
			r.logger.WithError(err).Error("Failed to bulk update suppliers")
			return fmt.Errorf("failed to bulk update suppliers: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		r.logger.WithError(err).Error("Failed to commit bulk update")
		return fmt.Errorf("failed to commit bulk update: %w", err)
	}

	r.logger.WithField("count", len(suppliers)).Info("Suppliers bulk updated successfully")
	return nil
}

// BulkDelete deletes multiple suppliers
func (r *SupplierRepository) BulkDelete(ctx context.Context, ids []uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Supplier{}, ids).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk delete suppliers")
		return fmt.Errorf("failed to bulk delete suppliers: %w", err)
	}

	// Remove from cache
	if r.redis != nil {
		for _, id := range ids {
			r.redis.Del(ctx, SupplierCacheKey(id.String()))
		}
	}

	r.logger.WithField("count", len(ids)).Info("Suppliers bulk deleted successfully")
	return nil
}

// applySupplierFilters applies filters to the query
func (r *SupplierRepository) applySupplierFilters(query *gorm.DB, filter SupplierFilter) *gorm.DB {
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	if filter.CertificationLevel != "" {
		query = query.Where("certification_level = ?", filter.CertificationLevel)
	}

	if filter.MinRating != nil {
		query = query.Where("rating >= ?", *filter.MinRating)
	}

	if filter.MaxRating != nil {
		query = query.Where("rating <= ?", *filter.MaxRating)
	}

	if filter.MinOnTimeDelivery != nil {
		query = query.Where("on_time_delivery >= ?", *filter.MinOnTimeDelivery)
	}

	if filter.MinQualityScore != nil {
		query = query.Where("quality_score >= ?", *filter.MinQualityScore)
	}

	if filter.Search != "" {
		searchTerm := "%" + strings.ToLower(filter.Search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(legal_name) LIKE ? OR LOWER(supplier_number) LIKE ?", 
			searchTerm, searchTerm, searchTerm)
	}

	if filter.Country != "" {
		query = query.Where("billing_country = ?", filter.Country)
	}

	if filter.State != "" {
		query = query.Where("billing_state = ?", filter.State)
	}

	if filter.City != "" {
		query = query.Where("billing_city = ?", filter.City)
	}

	if len(filter.Tags) > 0 {
		query = query.Where("tags && ?", filter.Tags)
	}

	if filter.IsActive != nil {
		if *filter.IsActive {
			query = query.Where("status = ?", "active")
		} else {
			query = query.Where("status != ?", "active")
		}
	}

	if filter.HasProducts != nil && *filter.HasProducts {
		query = query.Joins("JOIN supplier_products sp ON suppliers.id = sp.supplier_id").
			Where("sp.deleted_at IS NULL")
	}

	if filter.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filter.CreatedAfter)
	}

	if filter.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filter.CreatedBefore)
	}

	return query
}

// cacheSupplier caches a supplier
func (r *SupplierRepository) cacheSupplier(ctx context.Context, supplier *models.Supplier) {
	if r.redis == nil {
		return
	}

	data, err := json.Marshal(supplier)
	if err != nil {
		r.logger.WithError(err).Warn("Failed to marshal supplier for cache")
		return
	}

	if err := r.redis.Set(ctx, SupplierCacheKey(supplier.ID.String()), data, time.Hour).Err(); err != nil {
		r.logger.WithError(err).Warn("Failed to cache supplier")
	}
}

// getSupplierFromCache retrieves a supplier from cache
func (r *SupplierRepository) getSupplierFromCache(ctx context.Context, id string) (*models.Supplier, error) {
	if r.redis == nil {
		return nil, fmt.Errorf("redis not available")
	}

	data, err := r.redis.Get(ctx, SupplierCacheKey(id)).Result()
	if err != nil {
		return nil, err
	}

	var supplier models.Supplier
	if err := json.Unmarshal([]byte(data), &supplier); err != nil {
		return nil, err
	}

	return &supplier, nil
}

// SupplierContactRepository handles supplier contact operations
type SupplierContactRepository struct {
	db     *gorm.DB
	logger *logrus.Logger
}

// NewSupplierContactRepository creates a new supplier contact repository
func NewSupplierContactRepository(db *gorm.DB, logger *logrus.Logger) *SupplierContactRepository {
	return &SupplierContactRepository{
		db:     db,
		logger: logger,
	}
}

// CreateContact creates a new supplier contact
func (r *SupplierContactRepository) CreateContact(ctx context.Context, contact *models.SupplierContact) error {
	if err := r.db.WithContext(ctx).Create(contact).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create supplier contact")
		return fmt.Errorf("failed to create supplier contact: %w", err)
	}

	r.logger.WithField("contact_id", contact.ID).Info("Supplier contact created successfully")
	return nil
}

// GetContactByID retrieves a supplier contact by ID
func (r *SupplierContactRepository) GetContactByID(ctx context.Context, id uuid.UUID) (*models.SupplierContact, error) {
	var contact models.SupplierContact
	err := r.db.WithContext(ctx).First(&contact, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("contact_id", id).Error("Failed to get supplier contact")
		return nil, fmt.Errorf("failed to get supplier contact: %w", err)
	}

	return &contact, nil
}

// GetContactsBySupplier retrieves contacts for a supplier
func (r *SupplierContactRepository) GetContactsBySupplier(ctx context.Context, supplierID uuid.UUID) ([]*models.SupplierContact, error) {
	var contacts []*models.SupplierContact
	err := r.db.WithContext(ctx).
		Where("supplier_id = ?", supplierID).
		Order("is_primary DESC, first_name ASC").
		Find(&contacts).Error

	if err != nil {
		r.logger.WithError(err).WithField("supplier_id", supplierID).Error("Failed to get supplier contacts")
		return nil, fmt.Errorf("failed to get supplier contacts: %w", err)
	}

	return contacts, nil
}

// UpdateContact updates a supplier contact
func (r *SupplierContactRepository) UpdateContact(ctx context.Context, contact *models.SupplierContact) error {
	if err := r.db.WithContext(ctx).Save(contact).Error; err != nil {
		r.logger.WithError(err).WithField("contact_id", contact.ID).Error("Failed to update supplier contact")
		return fmt.Errorf("failed to update supplier contact: %w", err)
	}

	r.logger.WithField("contact_id", contact.ID).Info("Supplier contact updated successfully")
	return nil
}

// DeleteContact soft deletes a supplier contact
func (r *SupplierContactRepository) DeleteContact(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.SupplierContact{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("contact_id", id).Error("Failed to delete supplier contact")
		return fmt.Errorf("failed to delete supplier contact: %w", err)
	}

	r.logger.WithField("contact_id", id).Info("Supplier contact deleted successfully")
	return nil
}

