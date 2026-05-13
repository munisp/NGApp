package inventory

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

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// CategoryRepository handles category data operations
type CategoryRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewCategoryRepository creates a new category repository
func NewCategoryRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) *CategoryRepository {
	return &CategoryRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// CategoryFilter represents category filtering options
type CategoryFilter struct {
	ParentID      *uuid.UUID `json:"parent_id"`
	Level         *int       `json:"level"`
	IsActive      *bool      `json:"is_active"`
	HasProducts   *bool      `json:"has_products"`
	Search        string     `json:"search"`
	CreatedAfter  *time.Time `json:"created_after"`
	CreatedBefore *time.Time `json:"created_before"`
}

// CategoryStats represents category statistics
type CategoryStats struct {
	TotalCategories    int64 `json:"total_categories"`
	ActiveCategories   int64 `json:"active_categories"`
	InactiveCategories int64 `json:"inactive_categories"`
	RootCategories     int64 `json:"root_categories"`
	MaxDepth           int   `json:"max_depth"`
	AverageDepth       float64 `json:"average_depth"`
	CategoriesWithProducts int64 `json:"categories_with_products"`
	TopCategories      []CategoryProductCount `json:"top_categories"`
}

// CategoryProductCount represents category with product count
type CategoryProductCount struct {
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	ProductCount int64     `json:"product_count"`
	Level        int       `json:"level"`
}

// Create creates a new category
func (r *CategoryRepository) Create(ctx context.Context, category *models.Category) error {
	if err := r.db.WithContext(ctx).Create(category).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create category")
		return fmt.Errorf("failed to create category: %w", err)
	}

	// Cache the category
	if r.redis != nil {
		r.cacheCategory(ctx, category)
	}

	r.logger.WithField("category_id", category.ID).Info("Category created successfully")
	return nil
}

// GetByID retrieves a category by ID
func (r *CategoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	// Try cache first
	if r.redis != nil {
		if category, err := r.getCategoryFromCache(ctx, id.String()); err == nil && category != nil {
			return category, nil
		}
	}

	var category models.Category
	err := r.db.WithContext(ctx).
		Preload("Parent").
		Preload("Children").
		Preload("Products").
		First(&category, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("category_id", id).Error("Failed to get category")
		return nil, fmt.Errorf("failed to get category: %w", err)
	}

	// Cache the category
	if r.redis != nil {
		r.cacheCategory(ctx, &category)
	}

	return &category, nil
}

// GetBySlug retrieves a category by slug
func (r *CategoryRepository) GetBySlug(ctx context.Context, slug string) (*models.Category, error) {
	var category models.Category
	err := r.db.WithContext(ctx).
		Where("slug = ?", slug).
		Preload("Parent").
		Preload("Children").
		First(&category).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("slug", slug).Error("Failed to get category by slug")
		return nil, fmt.Errorf("failed to get category by slug: %w", err)
	}

	return &category, nil
}

// Update updates a category
func (r *CategoryRepository) Update(ctx context.Context, category *models.Category) error {
	if err := r.db.WithContext(ctx).Save(category).Error; err != nil {
		r.logger.WithError(err).WithField("category_id", category.ID).Error("Failed to update category")
		return fmt.Errorf("failed to update category: %w", err)
	}

	// Update cache
	if r.redis != nil {
		r.cacheCategory(ctx, category)
	}

	r.logger.WithField("category_id", category.ID).Info("Category updated successfully")
	return nil
}

// Delete soft deletes a category
func (r *CategoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Category{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("category_id", id).Error("Failed to delete category")
		return fmt.Errorf("failed to delete category: %w", err)
	}

	// Remove from cache
	if r.redis != nil {
		r.redis.Del(ctx, CategoryCacheKey(id.String()))
	}

	r.logger.WithField("category_id", id).Info("Category deleted successfully")
	return nil
}

// List retrieves categories with filtering and pagination
func (r *CategoryRepository) List(ctx context.Context, filter CategoryFilter, pagination Pagination) ([]*models.Category, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Category{})

	// Apply filters
	query = r.applyCategoryFilters(query, filter)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count categories")
		return nil, 0, fmt.Errorf("failed to count categories: %w", err)
	}

	// Apply pagination and preloading
	var categories []*models.Category
	err := query.
		Preload("Parent").
		Preload("Children").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&categories).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list categories")
		return nil, 0, fmt.Errorf("failed to list categories: %w", err)
	}

	return categories, total, nil
}

// GetRootCategories retrieves root categories (no parent)
func (r *CategoryRepository) GetRootCategories(ctx context.Context) ([]*models.Category, error) {
	var categories []*models.Category
	err := r.db.WithContext(ctx).
		Where("parent_id IS NULL").
		Order("sort_order ASC, name ASC").
		Preload("Children").
		Find(&categories).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get root categories")
		return nil, fmt.Errorf("failed to get root categories: %w", err)
	}

	return categories, nil
}

// GetCategoryTree retrieves the complete category tree
func (r *CategoryRepository) GetCategoryTree(ctx context.Context) ([]*models.Category, error) {
	var categories []*models.Category
	err := r.db.WithContext(ctx).
		Where("parent_id IS NULL").
		Order("sort_order ASC, name ASC").
		Preload("Children.Children.Children").
		Find(&categories).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get category tree")
		return nil, fmt.Errorf("failed to get category tree: %w", err)
	}

	return categories, nil
}

// GetByParent retrieves categories by parent ID
func (r *CategoryRepository) GetByParent(ctx context.Context, parentID uuid.UUID) ([]*models.Category, error) {
	var categories []*models.Category
	err := r.db.WithContext(ctx).
		Where("parent_id = ?", parentID).
		Order("sort_order ASC, name ASC").
		Preload("Children").
		Find(&categories).Error

	if err != nil {
		r.logger.WithError(err).WithField("parent_id", parentID).Error("Failed to get categories by parent")
		return nil, fmt.Errorf("failed to get categories by parent: %w", err)
	}

	return categories, nil
}

// GetByLevel retrieves categories by level
func (r *CategoryRepository) GetByLevel(ctx context.Context, level int) ([]*models.Category, error) {
	var categories []*models.Category
	err := r.db.WithContext(ctx).
		Where("level = ?", level).
		Order("sort_order ASC, name ASC").
		Find(&categories).Error

	if err != nil {
		r.logger.WithError(err).WithField("level", level).Error("Failed to get categories by level")
		return nil, fmt.Errorf("failed to get categories by level: %w", err)
	}

	return categories, nil
}

// Search performs full-text search on categories
func (r *CategoryRepository) Search(ctx context.Context, query string, pagination Pagination) ([]*models.Category, int64, error) {
	searchQuery := r.db.WithContext(ctx).Model(&models.Category{}).
		Where("to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ?)", query)

	// Get total count
	var total int64
	if err := searchQuery.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count search results")
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Get results
	var categories []*models.Category
	err := searchQuery.
		Preload("Parent").
		Preload("Children").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&categories).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to search categories")
		return nil, 0, fmt.Errorf("failed to search categories: %w", err)
	}

	return categories, total, nil
}

// GetStats retrieves category statistics
func (r *CategoryRepository) GetStats(ctx context.Context) (*CategoryStats, error) {
	stats := &CategoryStats{}

	// Total categories
	if err := r.db.WithContext(ctx).Model(&models.Category{}).Count(&stats.TotalCategories).Error; err != nil {
		return nil, fmt.Errorf("failed to count total categories: %w", err)
	}

	// Active categories
	if err := r.db.WithContext(ctx).Model(&models.Category{}).Where("is_active = true").Count(&stats.ActiveCategories).Error; err != nil {
		return nil, fmt.Errorf("failed to count active categories: %w", err)
	}

	// Inactive categories
	stats.InactiveCategories = stats.TotalCategories - stats.ActiveCategories

	// Root categories
	if err := r.db.WithContext(ctx).Model(&models.Category{}).Where("parent_id IS NULL").Count(&stats.RootCategories).Error; err != nil {
		return nil, fmt.Errorf("failed to count root categories: %w", err)
	}

	// Max depth
	var maxLevel *int
	if err := r.db.WithContext(ctx).Model(&models.Category{}).Select("MAX(level)").Scan(&maxLevel).Error; err != nil {
		return nil, fmt.Errorf("failed to get max depth: %w", err)
	}
	if maxLevel != nil {
		stats.MaxDepth = *maxLevel
	}

	// Average depth
	var avgLevel *float64
	if err := r.db.WithContext(ctx).Model(&models.Category{}).Select("AVG(level)").Scan(&avgLevel).Error; err != nil {
		return nil, fmt.Errorf("failed to get average depth: %w", err)
	}
	if avgLevel != nil {
		stats.AverageDepth = *avgLevel
	}

	// Categories with products
	if err := r.db.WithContext(ctx).
		Table("categories c").
		Joins("JOIN products p ON c.id = p.category_id").
		Where("c.deleted_at IS NULL AND p.deleted_at IS NULL").
		Distinct("c.id").
		Count(&stats.CategoriesWithProducts).Error; err != nil {
		return nil, fmt.Errorf("failed to count categories with products: %w", err)
	}

	// Top categories by product count
	if err := r.db.WithContext(ctx).
		Table("categories c").
		Select("c.id as category_id, c.name as category_name, c.level, COUNT(p.id) as product_count").
		Joins("LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL").
		Where("c.deleted_at IS NULL").
		Group("c.id, c.name, c.level").
		Order("product_count DESC").
		Limit(10).
		Scan(&stats.TopCategories).Error; err != nil {
		return nil, fmt.Errorf("failed to get top categories: %w", err)
	}

	return stats, nil
}

// BulkCreate creates multiple categories
func (r *CategoryRepository) BulkCreate(ctx context.Context, categories []*models.Category) error {
	if err := r.db.WithContext(ctx).CreateInBatches(categories, 100).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk create categories")
		return fmt.Errorf("failed to bulk create categories: %w", err)
	}

	r.logger.WithField("count", len(categories)).Info("Categories bulk created successfully")
	return nil
}

// applyCategoryFilters applies filters to the query
func (r *CategoryRepository) applyCategoryFilters(query *gorm.DB, filter CategoryFilter) *gorm.DB {
	if filter.ParentID != nil {
		query = query.Where("parent_id = ?", *filter.ParentID)
	}

	if filter.Level != nil {
		query = query.Where("level = ?", *filter.Level)
	}

	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if filter.HasProducts != nil && *filter.HasProducts {
		query = query.Joins("JOIN products p ON categories.id = p.category_id").
			Where("p.deleted_at IS NULL")
	}

	if filter.Search != "" {
		searchTerm := "%" + strings.ToLower(filter.Search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ?", searchTerm, searchTerm)
	}

	if filter.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filter.CreatedAfter)
	}

	if filter.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filter.CreatedBefore)
	}

	return query
}

// cacheCategory caches a category
func (r *CategoryRepository) cacheCategory(ctx context.Context, category *models.Category) {
	if r.redis == nil {
		return
	}

	data, err := json.Marshal(category)
	if err != nil {
		r.logger.WithError(err).Warn("Failed to marshal category for cache")
		return
	}

	if err := r.redis.Set(ctx, CategoryCacheKey(category.ID.String()), data, time.Hour).Err(); err != nil {
		r.logger.WithError(err).Warn("Failed to cache category")
	}
}

// getCategoryFromCache retrieves a category from cache
func (r *CategoryRepository) getCategoryFromCache(ctx context.Context, id string) (*models.Category, error) {
	if r.redis == nil {
		return nil, fmt.Errorf("redis not available")
	}

	data, err := r.redis.Get(ctx, CategoryCacheKey(id)).Result()
	if err != nil {
		return nil, err
	}

	var category models.Category
	if err := json.Unmarshal([]byte(data), &category); err != nil {
		return nil, err
	}

	return &category, nil
}

// BrandRepository handles brand data operations
type BrandRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewBrandRepository creates a new brand repository
func NewBrandRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) *BrandRepository {
	return &BrandRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// Create creates a new brand
func (r *BrandRepository) Create(ctx context.Context, brand *models.Brand) error {
	if err := r.db.WithContext(ctx).Create(brand).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create brand")
		return fmt.Errorf("failed to create brand: %w", err)
	}

	r.logger.WithField("brand_id", brand.ID).Info("Brand created successfully")
	return nil
}

// GetByID retrieves a brand by ID
func (r *BrandRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Brand, error) {
	var brand models.Brand
	err := r.db.WithContext(ctx).
		Preload("Products").
		First(&brand, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("brand_id", id).Error("Failed to get brand")
		return nil, fmt.Errorf("failed to get brand: %w", err)
	}

	return &brand, nil
}

// GetBySlug retrieves a brand by slug
func (r *BrandRepository) GetBySlug(ctx context.Context, slug string) (*models.Brand, error) {
	var brand models.Brand
	err := r.db.WithContext(ctx).
		Where("slug = ?", slug).
		First(&brand).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("slug", slug).Error("Failed to get brand by slug")
		return nil, fmt.Errorf("failed to get brand by slug: %w", err)
	}

	return &brand, nil
}

// List retrieves brands with pagination
func (r *BrandRepository) List(ctx context.Context, pagination Pagination) ([]*models.Brand, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Brand{})

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count brands")
		return nil, 0, fmt.Errorf("failed to count brands: %w", err)
	}

	// Get results
	var brands []*models.Brand
	err := query.
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&brands).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list brands")
		return nil, 0, fmt.Errorf("failed to list brands: %w", err)
	}

	return brands, total, nil
}

// ManufacturerRepository handles manufacturer data operations
type ManufacturerRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewManufacturerRepository creates a new manufacturer repository
func NewManufacturerRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) *ManufacturerRepository {
	return &ManufacturerRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// Create creates a new manufacturer
func (r *ManufacturerRepository) Create(ctx context.Context, manufacturer *models.Manufacturer) error {
	if err := r.db.WithContext(ctx).Create(manufacturer).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create manufacturer")
		return fmt.Errorf("failed to create manufacturer: %w", err)
	}

	r.logger.WithField("manufacturer_id", manufacturer.ID).Info("Manufacturer created successfully")
	return nil
}

// GetByID retrieves a manufacturer by ID
func (r *ManufacturerRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Manufacturer, error) {
	var manufacturer models.Manufacturer
	err := r.db.WithContext(ctx).
		Preload("Products").
		First(&manufacturer, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("manufacturer_id", id).Error("Failed to get manufacturer")
		return nil, fmt.Errorf("failed to get manufacturer: %w", err)
	}

	return &manufacturer, nil
}

// List retrieves manufacturers with pagination
func (r *ManufacturerRepository) List(ctx context.Context, pagination Pagination) ([]*models.Manufacturer, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Manufacturer{})

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count manufacturers")
		return nil, 0, fmt.Errorf("failed to count manufacturers: %w", err)
	}

	// Get results
	var manufacturers []*models.Manufacturer
	err := query.
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&manufacturers).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list manufacturers")
		return nil, 0, fmt.Errorf("failed to list manufacturers: %w", err)
	}

	return manufacturers, total, nil
}

// Cache key functions
func CategoryCacheKey(id string) string {
	return fmt.Sprintf("inventory:category:%s", id)
}

func BrandCacheKey(id string) string {
	return fmt.Sprintf("inventory:brand:%s", id)
}

func ManufacturerCacheKey(id string) string {
	return fmt.Sprintf("inventory:manufacturer:%s", id)
}

func SupplierCacheKey(id string) string {
	return fmt.Sprintf("inventory:supplier:%s", id)
}

func WarehouseCacheKey(id string) string {
	return fmt.Sprintf("inventory:warehouse:%s", id)
}

func StockCacheKey(productID, warehouseID string) string {
	return fmt.Sprintf("inventory:stock:%s:%s", productID, warehouseID)
}

