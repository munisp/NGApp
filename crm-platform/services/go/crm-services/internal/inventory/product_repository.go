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

// ProductRepository handles product data operations
type ProductRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewProductRepository creates a new product repository
func NewProductRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) *ProductRepository {
	return &ProductRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// ProductFilter represents product filtering options
type ProductFilter struct {
	CategoryID     *uuid.UUID `json:"category_id"`
	BrandID        *uuid.UUID `json:"brand_id"`
	ManufacturerID *uuid.UUID `json:"manufacturer_id"`
	SupplierID     *uuid.UUID `json:"supplier_id"`
	Type           string     `json:"type"`
	Status         string     `json:"status"`
	Condition      string     `json:"condition"`
	MinPrice       *float64   `json:"min_price"`
	MaxPrice       *float64   `json:"max_price"`
	InStock        *bool      `json:"in_stock"`
	LowStock       *bool      `json:"low_stock"`
	Search         string     `json:"search"`
	Tags           []string   `json:"tags"`
	SKU            string     `json:"sku"`
	Barcode        string     `json:"barcode"`
	IsActive       *bool      `json:"is_active"`
	IsSellable     *bool      `json:"is_sellable"`
	IsBundle       *bool      `json:"is_bundle"`
	IsVariant      *bool      `json:"is_variant"`
	CreatedAfter   *time.Time `json:"created_after"`
	CreatedBefore  *time.Time `json:"created_before"`
}

// ProductStats represents product statistics
type ProductStats struct {
	TotalProducts      int64   `json:"total_products"`
	ActiveProducts     int64   `json:"active_products"`
	InactiveProducts   int64   `json:"inactive_products"`
	InStockProducts    int64   `json:"in_stock_products"`
	LowStockProducts   int64   `json:"low_stock_products"`
	OutOfStockProducts int64   `json:"out_of_stock_products"`
	AveragePrice       float64 `json:"average_price"`
	TotalValue         float64 `json:"total_value"`
	TopCategories      []CategoryCount `json:"top_categories"`
	TopBrands          []BrandCount    `json:"top_brands"`
}

// CategoryCount represents category product count
type CategoryCount struct {
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	ProductCount int64     `json:"product_count"`
}

// BrandCount represents brand product count
type BrandCount struct {
	BrandID      uuid.UUID `json:"brand_id"`
	BrandName    string    `json:"brand_name"`
	ProductCount int64     `json:"product_count"`
}

// Create creates a new product
func (r *ProductRepository) Create(ctx context.Context, product *models.Product) error {
	if err := r.db.WithContext(ctx).Create(product).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create product")
		return fmt.Errorf("failed to create product: %w", err)
	}

	// Cache the product
	if r.redis != nil {
		r.cacheProduct(ctx, product)
	}

	r.logger.WithField("product_id", product.ID).Info("Product created successfully")
	return nil
}

// GetByID retrieves a product by ID
func (r *ProductRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	// Try cache first
	if r.redis != nil {
		if product, err := r.getProductFromCache(ctx, id.String()); err == nil && product != nil {
			return product, nil
		}
	}

	var product models.Product
	err := r.db.WithContext(ctx).
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Preload("PrimarySupplier").
		Preload("Images").
		Preload("Documents").
		Preload("SupplierProducts.Supplier").
		First(&product, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("product_id", id).Error("Failed to get product")
		return nil, fmt.Errorf("failed to get product: %w", err)
	}

	// Cache the product
	if r.redis != nil {
		r.cacheProduct(ctx, &product)
	}

	return &product, nil
}

// GetBySKU retrieves a product by SKU
func (r *ProductRepository) GetBySKU(ctx context.Context, sku string) (*models.Product, error) {
	var product models.Product
	err := r.db.WithContext(ctx).
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Preload("PrimarySupplier").
		Where("sku = ?", sku).
		First(&product).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("sku", sku).Error("Failed to get product by SKU")
		return nil, fmt.Errorf("failed to get product by SKU: %w", err)
	}

	return &product, nil
}

// GetByBarcode retrieves a product by barcode
func (r *ProductRepository) GetByBarcode(ctx context.Context, barcode string) (*models.Product, error) {
	var product models.Product
	err := r.db.WithContext(ctx).
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Where("barcode = ? OR upc = ? OR ean = ?", barcode, barcode, barcode).
		First(&product).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("barcode", barcode).Error("Failed to get product by barcode")
		return nil, fmt.Errorf("failed to get product by barcode: %w", err)
	}

	return &product, nil
}

// Update updates a product
func (r *ProductRepository) Update(ctx context.Context, product *models.Product) error {
	if err := r.db.WithContext(ctx).Save(product).Error; err != nil {
		r.logger.WithError(err).WithField("product_id", product.ID).Error("Failed to update product")
		return fmt.Errorf("failed to update product: %w", err)
	}

	// Update cache
	if r.redis != nil {
		r.cacheProduct(ctx, product)
	}

	r.logger.WithField("product_id", product.ID).Info("Product updated successfully")
	return nil
}

// Delete soft deletes a product
func (r *ProductRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Product{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("product_id", id).Error("Failed to delete product")
		return fmt.Errorf("failed to delete product: %w", err)
	}

	// Remove from cache
	if r.redis != nil {
		r.redis.Del(ctx, ProductCacheKey(id.String()))
	}

	r.logger.WithField("product_id", id).Info("Product deleted successfully")
	return nil
}

// List retrieves products with filtering and pagination
func (r *ProductRepository) List(ctx context.Context, filter ProductFilter, pagination Pagination) ([]*models.Product, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Product{})

	// Apply filters
	query = r.applyProductFilters(query, filter)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count products")
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	// Apply pagination and preloading
	var products []*models.Product
	err := query.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Preload("PrimarySupplier").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list products")
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}

	return products, total, nil
}

// Search performs full-text search on products
func (r *ProductRepository) Search(ctx context.Context, query string, pagination Pagination) ([]*models.Product, int64, error) {
	searchQuery := r.db.WithContext(ctx).Model(&models.Product{}).
		Where("to_tsvector('english', name || ' ' || description || ' ' || sku) @@ plainto_tsquery('english', ?)", query)

	// Get total count
	var total int64
	if err := searchQuery.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count search results")
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Get results
	var products []*models.Product
	err := searchQuery.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Preload("PrimarySupplier").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to search products")
		return nil, 0, fmt.Errorf("failed to search products: %w", err)
	}

	return products, total, nil
}

// GetLowStock retrieves products with low stock
func (r *ProductRepository) GetLowStock(ctx context.Context, pagination Pagination) ([]*models.Product, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Product{}).
		Where("stock_quantity <= reorder_level AND track_inventory = true")

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count low stock products")
		return nil, 0, fmt.Errorf("failed to count low stock products: %w", err)
	}

	// Get results
	var products []*models.Product
	err := query.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get low stock products")
		return nil, 0, fmt.Errorf("failed to get low stock products: %w", err)
	}

	return products, total, nil
}

// GetOutOfStock retrieves products that are out of stock
func (r *ProductRepository) GetOutOfStock(ctx context.Context, pagination Pagination) ([]*models.Product, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Product{}).
		Where("stock_quantity <= 0 AND track_inventory = true")

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count out of stock products")
		return nil, 0, fmt.Errorf("failed to count out of stock products: %w", err)
	}

	// Get results
	var products []*models.Product
	err := query.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get out of stock products")
		return nil, 0, fmt.Errorf("failed to get out of stock products: %w", err)
	}

	return products, total, nil
}

// GetVariants retrieves product variants
func (r *ProductRepository) GetVariants(ctx context.Context, parentID uuid.UUID) ([]*models.Product, error) {
	var variants []*models.Product
	err := r.db.WithContext(ctx).
		Where("parent_product_id = ?", parentID).
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Find(&variants).Error

	if err != nil {
		r.logger.WithError(err).WithField("parent_id", parentID).Error("Failed to get product variants")
		return nil, fmt.Errorf("failed to get product variants: %w", err)
	}

	return variants, nil
}

// GetByCategory retrieves products by category
func (r *ProductRepository) GetByCategory(ctx context.Context, categoryID uuid.UUID, pagination Pagination) ([]*models.Product, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Product{}).
		Where("category_id = ?", categoryID)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count products by category")
		return nil, 0, fmt.Errorf("failed to count products by category: %w", err)
	}

	// Get results
	var products []*models.Product
	err := query.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get products by category")
		return nil, 0, fmt.Errorf("failed to get products by category: %w", err)
	}

	return products, total, nil
}

// GetByBrand retrieves products by brand
func (r *ProductRepository) GetByBrand(ctx context.Context, brandID uuid.UUID, pagination Pagination) ([]*models.Product, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Product{}).
		Where("brand_id = ?", brandID)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count products by brand")
		return nil, 0, fmt.Errorf("failed to count products by brand: %w", err)
	}

	// Get results
	var products []*models.Product
	err := query.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get products by brand")
		return nil, 0, fmt.Errorf("failed to get products by brand: %w", err)
	}

	return products, total, nil
}

// GetByManufacturer retrieves products by manufacturer
func (r *ProductRepository) GetByManufacturer(ctx context.Context, manufacturerID uuid.UUID, pagination Pagination) ([]*models.Product, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Product{}).
		Where("manufacturer_id = ?", manufacturerID)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count products by manufacturer")
		return nil, 0, fmt.Errorf("failed to count products by manufacturer: %w", err)
	}

	// Get results
	var products []*models.Product
	err := query.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get products by manufacturer")
		return nil, 0, fmt.Errorf("failed to get products by manufacturer: %w", err)
	}

	return products, total, nil
}

// GetBySupplier retrieves products by supplier
func (r *ProductRepository) GetBySupplier(ctx context.Context, supplierID uuid.UUID, pagination Pagination) ([]*models.Product, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Product{}).
		Joins("JOIN supplier_products sp ON products.id = sp.product_id").
		Where("sp.supplier_id = ? AND sp.deleted_at IS NULL", supplierID)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count products by supplier")
		return nil, 0, fmt.Errorf("failed to count products by supplier: %w", err)
	}

	// Get results
	var products []*models.Product
	err := query.
		Preload("Category").
		Preload("Brand").
		Preload("Manufacturer").
		Preload("SupplierProducts", "supplier_id = ?", supplierID).
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&products).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get products by supplier")
		return nil, 0, fmt.Errorf("failed to get products by supplier: %w", err)
	}

	return products, total, nil
}

// GetStats retrieves product statistics
func (r *ProductRepository) GetStats(ctx context.Context) (*ProductStats, error) {
	stats := &ProductStats{}

	// Total products
	if err := r.db.WithContext(ctx).Model(&models.Product{}).Count(&stats.TotalProducts).Error; err != nil {
		return nil, fmt.Errorf("failed to count total products: %w", err)
	}

	// Active products
	if err := r.db.WithContext(ctx).Model(&models.Product{}).Where("status = ?", "active").Count(&stats.ActiveProducts).Error; err != nil {
		return nil, fmt.Errorf("failed to count active products: %w", err)
	}

	// Inactive products
	stats.InactiveProducts = stats.TotalProducts - stats.ActiveProducts

	// In stock products
	if err := r.db.WithContext(ctx).Model(&models.Product{}).Where("stock_quantity > 0").Count(&stats.InStockProducts).Error; err != nil {
		return nil, fmt.Errorf("failed to count in stock products: %w", err)
	}

	// Low stock products
	if err := r.db.WithContext(ctx).Model(&models.Product{}).Where("stock_quantity <= reorder_level AND stock_quantity > 0").Count(&stats.LowStockProducts).Error; err != nil {
		return nil, fmt.Errorf("failed to count low stock products: %w", err)
	}

	// Out of stock products
	if err := r.db.WithContext(ctx).Model(&models.Product{}).Where("stock_quantity <= 0").Count(&stats.OutOfStockProducts).Error; err != nil {
		return nil, fmt.Errorf("failed to count out of stock products: %w", err)
	}

	// Average price
	var avgPrice *float64
	if err := r.db.WithContext(ctx).Model(&models.Product{}).Select("AVG(list_price)").Scan(&avgPrice).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate average price: %w", err)
	}
	if avgPrice != nil {
		stats.AveragePrice = *avgPrice
	}

	// Total value
	var totalValue *float64
	if err := r.db.WithContext(ctx).Model(&models.Product{}).Select("SUM(list_price * stock_quantity)").Scan(&totalValue).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate total value: %w", err)
	}
	if totalValue != nil {
		stats.TotalValue = *totalValue
	}

	// Top categories
	if err := r.db.WithContext(ctx).
		Table("products p").
		Select("c.id as category_id, c.name as category_name, COUNT(p.id) as product_count").
		Joins("LEFT JOIN categories c ON p.category_id = c.id").
		Where("p.deleted_at IS NULL AND c.deleted_at IS NULL").
		Group("c.id, c.name").
		Order("product_count DESC").
		Limit(10).
		Scan(&stats.TopCategories).Error; err != nil {
		return nil, fmt.Errorf("failed to get top categories: %w", err)
	}

	// Top brands
	if err := r.db.WithContext(ctx).
		Table("products p").
		Select("b.id as brand_id, b.name as brand_name, COUNT(p.id) as product_count").
		Joins("LEFT JOIN brands b ON p.brand_id = b.id").
		Where("p.deleted_at IS NULL AND b.deleted_at IS NULL").
		Group("b.id, b.name").
		Order("product_count DESC").
		Limit(10).
		Scan(&stats.TopBrands).Error; err != nil {
		return nil, fmt.Errorf("failed to get top brands: %w", err)
	}

	return stats, nil
}

// BulkCreate creates multiple products
func (r *ProductRepository) BulkCreate(ctx context.Context, products []*models.Product) error {
	if err := r.db.WithContext(ctx).CreateInBatches(products, 100).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk create products")
		return fmt.Errorf("failed to bulk create products: %w", err)
	}

	r.logger.WithField("count", len(products)).Info("Products bulk created successfully")
	return nil
}

// BulkUpdate updates multiple products
func (r *ProductRepository) BulkUpdate(ctx context.Context, products []*models.Product) error {
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, product := range products {
		if err := tx.Save(product).Error; err != nil {
			tx.Rollback()
			r.logger.WithError(err).Error("Failed to bulk update products")
			return fmt.Errorf("failed to bulk update products: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		r.logger.WithError(err).Error("Failed to commit bulk update")
		return fmt.Errorf("failed to commit bulk update: %w", err)
	}

	r.logger.WithField("count", len(products)).Info("Products bulk updated successfully")
	return nil
}

// BulkDelete deletes multiple products
func (r *ProductRepository) BulkDelete(ctx context.Context, ids []uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Product{}, ids).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk delete products")
		return fmt.Errorf("failed to bulk delete products: %w", err)
	}

	// Remove from cache
	if r.redis != nil {
		for _, id := range ids {
			r.redis.Del(ctx, ProductCacheKey(id.String()))
		}
	}

	r.logger.WithField("count", len(ids)).Info("Products bulk deleted successfully")
	return nil
}

// applyProductFilters applies filters to the query
func (r *ProductRepository) applyProductFilters(query *gorm.DB, filter ProductFilter) *gorm.DB {
	if filter.CategoryID != nil {
		query = query.Where("category_id = ?", *filter.CategoryID)
	}

	if filter.BrandID != nil {
		query = query.Where("brand_id = ?", *filter.BrandID)
	}

	if filter.ManufacturerID != nil {
		query = query.Where("manufacturer_id = ?", *filter.ManufacturerID)
	}

	if filter.SupplierID != nil {
		query = query.Joins("JOIN supplier_products sp ON products.id = sp.product_id").
			Where("sp.supplier_id = ? AND sp.deleted_at IS NULL", *filter.SupplierID)
	}

	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	if filter.Condition != "" {
		query = query.Where("condition = ?", filter.Condition)
	}

	if filter.MinPrice != nil {
		query = query.Where("list_price >= ?", *filter.MinPrice)
	}

	if filter.MaxPrice != nil {
		query = query.Where("list_price <= ?", *filter.MaxPrice)
	}

	if filter.InStock != nil && *filter.InStock {
		query = query.Where("stock_quantity > 0")
	}

	if filter.LowStock != nil && *filter.LowStock {
		query = query.Where("stock_quantity <= reorder_level AND stock_quantity > 0")
	}

	if filter.Search != "" {
		searchTerm := "%" + strings.ToLower(filter.Search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(sku) LIKE ?", 
			searchTerm, searchTerm, searchTerm)
	}

	if len(filter.Tags) > 0 {
		query = query.Where("tags && ?", filter.Tags)
	}

	if filter.SKU != "" {
		query = query.Where("sku = ?", filter.SKU)
	}

	if filter.Barcode != "" {
		query = query.Where("barcode = ? OR upc = ? OR ean = ?", filter.Barcode, filter.Barcode, filter.Barcode)
	}

	if filter.IsActive != nil {
		if *filter.IsActive {
			query = query.Where("status = ?", "active")
		} else {
			query = query.Where("status != ?", "active")
		}
	}

	if filter.IsSellable != nil {
		query = query.Where("is_sellable = ?", *filter.IsSellable)
	}

	if filter.IsBundle != nil {
		query = query.Where("is_bundle = ?", *filter.IsBundle)
	}

	if filter.IsVariant != nil {
		query = query.Where("is_variant = ?", *filter.IsVariant)
	}

	if filter.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filter.CreatedAfter)
	}

	if filter.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filter.CreatedBefore)
	}

	return query
}

// cacheProduct caches a product
func (r *ProductRepository) cacheProduct(ctx context.Context, product *models.Product) {
	if r.redis == nil {
		return
	}

	data, err := json.Marshal(product)
	if err != nil {
		r.logger.WithError(err).Warn("Failed to marshal product for cache")
		return
	}

	if err := r.redis.Set(ctx, ProductCacheKey(product.ID.String()), data, time.Hour).Err(); err != nil {
		r.logger.WithError(err).Warn("Failed to cache product")
	}
}

// getProductFromCache retrieves a product from cache
func (r *ProductRepository) getProductFromCache(ctx context.Context, id string) (*models.Product, error) {
	if r.redis == nil {
		return nil, fmt.Errorf("redis not available")
	}

	data, err := r.redis.Get(ctx, ProductCacheKey(id)).Result()
	if err != nil {
		return nil, err
	}

	var product models.Product
	if err := json.Unmarshal([]byte(data), &product); err != nil {
		return nil, err
	}

	return &product, nil
}

