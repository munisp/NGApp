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

// WarehouseRepository handles warehouse data operations
type WarehouseRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewWarehouseRepository creates a new warehouse repository
func NewWarehouseRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) *WarehouseRepository {
	return &WarehouseRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// WarehouseFilter represents warehouse filtering options
type WarehouseFilter struct {
	Type              string     `json:"type"`
	Status            string     `json:"status"`
	Country           string     `json:"country"`
	State             string     `json:"state"`
	City              string     `json:"city"`
	Search            string     `json:"search"`
	MinCapacity       *float64   `json:"min_capacity"`
	MaxCapacity       *float64   `json:"max_capacity"`
	MinUtilization    *float64   `json:"min_utilization"`
	MaxUtilization    *float64   `json:"max_utilization"`
	IsActive          *bool      `json:"is_active"`
	IsDefault         *bool      `json:"is_default"`
	HasStock          *bool      `json:"has_stock"`
	Tags              []string   `json:"tags"`
	CreatedAfter      *time.Time `json:"created_after"`
	CreatedBefore     *time.Time `json:"created_before"`
}

// WarehouseStats represents warehouse statistics
type WarehouseStats struct {
	TotalWarehouses      int64   `json:"total_warehouses"`
	ActiveWarehouses     int64   `json:"active_warehouses"`
	InactiveWarehouses   int64   `json:"inactive_warehouses"`
	TotalCapacity        float64 `json:"total_capacity"`
	UsedCapacity         float64 `json:"used_capacity"`
	AvailableCapacity    float64 `json:"available_capacity"`
	AverageUtilization   float64 `json:"average_utilization"`
	TotalLocations       int64   `json:"total_locations"`
	TotalStockItems      int64   `json:"total_stock_items"`
	WarehousesByType     []WarehouseTypeCount     `json:"warehouses_by_type"`
	WarehousesByCountry  []WarehouseCountryCount  `json:"warehouses_by_country"`
	TopUtilizedWarehouses []WarehouseUtilization  `json:"top_utilized_warehouses"`
}

// WarehouseTypeCount represents warehouse count by type
type WarehouseTypeCount struct {
	Type           string `json:"type"`
	WarehouseCount int64  `json:"warehouse_count"`
}

// WarehouseCountryCount represents warehouse count by country
type WarehouseCountryCount struct {
	Country        string `json:"country"`
	WarehouseCount int64  `json:"warehouse_count"`
}

// WarehouseUtilization represents warehouse utilization metrics
type WarehouseUtilization struct {
	WarehouseID        uuid.UUID `json:"warehouse_id"`
	WarehouseName      string    `json:"warehouse_name"`
	Type               string    `json:"type"`
	TotalCapacity      float64   `json:"total_capacity"`
	UsedCapacity       float64   `json:"used_capacity"`
	UtilizationPercent float64   `json:"utilization_percent"`
	LocationCount      int64     `json:"location_count"`
	StockItemCount     int64     `json:"stock_item_count"`
}

// Create creates a new warehouse
func (r *WarehouseRepository) Create(ctx context.Context, warehouse *models.Warehouse) error {
	if err := r.db.WithContext(ctx).Create(warehouse).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create warehouse")
		return fmt.Errorf("failed to create warehouse: %w", err)
	}

	// Cache the warehouse
	if r.redis != nil {
		r.cacheWarehouse(ctx, warehouse)
	}

	r.logger.WithField("warehouse_id", warehouse.ID).Info("Warehouse created successfully")
	return nil
}

// GetByID retrieves a warehouse by ID
func (r *WarehouseRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Warehouse, error) {
	// Try cache first
	if r.redis != nil {
		if warehouse, err := r.getWarehouseFromCache(ctx, id.String()); err == nil && warehouse != nil {
			return warehouse, nil
		}
	}

	var warehouse models.Warehouse
	err := r.db.WithContext(ctx).
		Preload("Locations").
		Preload("StockItems.Product").
		First(&warehouse, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("warehouse_id", id).Error("Failed to get warehouse")
		return nil, fmt.Errorf("failed to get warehouse: %w", err)
	}

	// Cache the warehouse
	if r.redis != nil {
		r.cacheWarehouse(ctx, &warehouse)
	}

	return &warehouse, nil
}

// GetByWarehouseNumber retrieves a warehouse by warehouse number
func (r *WarehouseRepository) GetByWarehouseNumber(ctx context.Context, warehouseNumber string) (*models.Warehouse, error) {
	var warehouse models.Warehouse
	err := r.db.WithContext(ctx).
		Preload("Locations").
		Where("warehouse_number = ?", warehouseNumber).
		First(&warehouse).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("warehouse_number", warehouseNumber).Error("Failed to get warehouse by number")
		return nil, fmt.Errorf("failed to get warehouse by number: %w", err)
	}

	return &warehouse, nil
}

// Update updates a warehouse
func (r *WarehouseRepository) Update(ctx context.Context, warehouse *models.Warehouse) error {
	if err := r.db.WithContext(ctx).Save(warehouse).Error; err != nil {
		r.logger.WithError(err).WithField("warehouse_id", warehouse.ID).Error("Failed to update warehouse")
		return fmt.Errorf("failed to update warehouse: %w", err)
	}

	// Update cache
	if r.redis != nil {
		r.cacheWarehouse(ctx, warehouse)
	}

	r.logger.WithField("warehouse_id", warehouse.ID).Info("Warehouse updated successfully")
	return nil
}

// Delete soft deletes a warehouse
func (r *WarehouseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Warehouse{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("warehouse_id", id).Error("Failed to delete warehouse")
		return fmt.Errorf("failed to delete warehouse: %w", err)
	}

	// Remove from cache
	if r.redis != nil {
		r.redis.Del(ctx, WarehouseCacheKey(id.String()))
	}

	r.logger.WithField("warehouse_id", id).Info("Warehouse deleted successfully")
	return nil
}

// List retrieves warehouses with filtering and pagination
func (r *WarehouseRepository) List(ctx context.Context, filter WarehouseFilter, pagination Pagination) ([]*models.Warehouse, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Warehouse{})

	// Apply filters
	query = r.applyWarehouseFilters(query, filter)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count warehouses")
		return nil, 0, fmt.Errorf("failed to count warehouses: %w", err)
	}

	// Apply pagination and preloading
	var warehouses []*models.Warehouse
	err := query.
		Preload("Locations").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&warehouses).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list warehouses")
		return nil, 0, fmt.Errorf("failed to list warehouses: %w", err)
	}

	return warehouses, total, nil
}

// Search performs full-text search on warehouses
func (r *WarehouseRepository) Search(ctx context.Context, query string, pagination Pagination) ([]*models.Warehouse, int64, error) {
	searchQuery := r.db.WithContext(ctx).Model(&models.Warehouse{}).
		Where("to_tsvector('english', name || ' ' || warehouse_number || ' ' || description) @@ plainto_tsquery('english', ?)", query)

	// Get total count
	var total int64
	if err := searchQuery.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count search results")
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Get results
	var warehouses []*models.Warehouse
	err := searchQuery.
		Preload("Locations").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&warehouses).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to search warehouses")
		return nil, 0, fmt.Errorf("failed to search warehouses: %w", err)
	}

	return warehouses, total, nil
}

// GetByType retrieves warehouses by type
func (r *WarehouseRepository) GetByType(ctx context.Context, warehouseType string, pagination Pagination) ([]*models.Warehouse, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Warehouse{}).
		Where("type = ?", warehouseType)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count warehouses by type")
		return nil, 0, fmt.Errorf("failed to count warehouses by type: %w", err)
	}

	// Get results
	var warehouses []*models.Warehouse
	err := query.
		Preload("Locations").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&warehouses).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get warehouses by type")
		return nil, 0, fmt.Errorf("failed to get warehouses by type: %w", err)
	}

	return warehouses, total, nil
}

// GetByLocation retrieves warehouses by location
func (r *WarehouseRepository) GetByLocation(ctx context.Context, country, state, city string, pagination Pagination) ([]*models.Warehouse, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Warehouse{})

	if country != "" {
		query = query.Where("country = ?", country)
	}
	if state != "" {
		query = query.Where("state = ?", state)
	}
	if city != "" {
		query = query.Where("city = ?", city)
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count warehouses by location")
		return nil, 0, fmt.Errorf("failed to count warehouses by location: %w", err)
	}

	// Get results
	var warehouses []*models.Warehouse
	err := query.
		Preload("Locations").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&warehouses).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get warehouses by location")
		return nil, 0, fmt.Errorf("failed to get warehouses by location: %w", err)
	}

	return warehouses, total, nil
}

// GetDefault retrieves the default warehouse
func (r *WarehouseRepository) GetDefault(ctx context.Context) (*models.Warehouse, error) {
	var warehouse models.Warehouse
	err := r.db.WithContext(ctx).
		Where("is_default = true AND status = ?", "active").
		Preload("Locations").
		First(&warehouse).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).Error("Failed to get default warehouse")
		return nil, fmt.Errorf("failed to get default warehouse: %w", err)
	}

	return &warehouse, nil
}

// GetStats retrieves warehouse statistics
func (r *WarehouseRepository) GetStats(ctx context.Context) (*WarehouseStats, error) {
	stats := &WarehouseStats{}

	// Total warehouses
	if err := r.db.WithContext(ctx).Model(&models.Warehouse{}).Count(&stats.TotalWarehouses).Error; err != nil {
		return nil, fmt.Errorf("failed to count total warehouses: %w", err)
	}

	// Active warehouses
	if err := r.db.WithContext(ctx).Model(&models.Warehouse{}).Where("status = ?", "active").Count(&stats.ActiveWarehouses).Error; err != nil {
		return nil, fmt.Errorf("failed to count active warehouses: %w", err)
	}

	// Inactive warehouses
	stats.InactiveWarehouses = stats.TotalWarehouses - stats.ActiveWarehouses

	// Capacity statistics
	var capacityStats struct {
		TotalCapacity     *float64 `json:"total_capacity"`
		UsedCapacity      *float64 `json:"used_capacity"`
		AvailableCapacity *float64 `json:"available_capacity"`
	}

	if err := r.db.WithContext(ctx).Model(&models.Warehouse{}).
		Select("SUM(total_capacity) as total_capacity, SUM(used_capacity) as used_capacity, SUM(available_capacity) as available_capacity").
		Scan(&capacityStats).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate capacity statistics: %w", err)
	}

	if capacityStats.TotalCapacity != nil {
		stats.TotalCapacity = *capacityStats.TotalCapacity
	}
	if capacityStats.UsedCapacity != nil {
		stats.UsedCapacity = *capacityStats.UsedCapacity
	}
	if capacityStats.AvailableCapacity != nil {
		stats.AvailableCapacity = *capacityStats.AvailableCapacity
	}

	// Average utilization
	if stats.TotalCapacity > 0 {
		stats.AverageUtilization = (stats.UsedCapacity / stats.TotalCapacity) * 100
	}

	// Total locations
	if err := r.db.WithContext(ctx).Model(&models.Location{}).Count(&stats.TotalLocations).Error; err != nil {
		return nil, fmt.Errorf("failed to count total locations: %w", err)
	}

	// Total stock items
	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).Count(&stats.TotalStockItems).Error; err != nil {
		return nil, fmt.Errorf("failed to count total stock items: %w", err)
	}

	// Warehouses by type
	if err := r.db.WithContext(ctx).
		Model(&models.Warehouse{}).
		Select("type, COUNT(*) as warehouse_count").
		Group("type").
		Order("warehouse_count DESC").
		Scan(&stats.WarehousesByType).Error; err != nil {
		return nil, fmt.Errorf("failed to get warehouses by type: %w", err)
	}

	// Warehouses by country
	if err := r.db.WithContext(ctx).
		Model(&models.Warehouse{}).
		Select("country, COUNT(*) as warehouse_count").
		Where("country != ''").
		Group("country").
		Order("warehouse_count DESC").
		Limit(10).
		Scan(&stats.WarehousesByCountry).Error; err != nil {
		return nil, fmt.Errorf("failed to get warehouses by country: %w", err)
	}

	// Top utilized warehouses
	if err := r.db.WithContext(ctx).
		Table("warehouse_utilization").
		Order("utilization_percentage DESC").
		Limit(10).
		Scan(&stats.TopUtilizedWarehouses).Error; err != nil {
		return nil, fmt.Errorf("failed to get top utilized warehouses: %w", err)
	}

	return stats, nil
}

// UpdateCapacity updates warehouse capacity
func (r *WarehouseRepository) UpdateCapacity(ctx context.Context, warehouseID uuid.UUID, totalCapacity, usedCapacity float64) error {
	availableCapacity := totalCapacity - usedCapacity

	if err := r.db.WithContext(ctx).Model(&models.Warehouse{}).
		Where("id = ?", warehouseID).
		Updates(map[string]interface{}{
			"total_capacity":     totalCapacity,
			"used_capacity":      usedCapacity,
			"available_capacity": availableCapacity,
		}).Error; err != nil {
		r.logger.WithError(err).WithField("warehouse_id", warehouseID).Error("Failed to update warehouse capacity")
		return fmt.Errorf("failed to update warehouse capacity: %w", err)
	}

	// Invalidate cache
	if r.redis != nil {
		r.redis.Del(ctx, WarehouseCacheKey(warehouseID.String()))
	}

	r.logger.WithField("warehouse_id", warehouseID).Info("Warehouse capacity updated successfully")
	return nil
}

// BulkCreate creates multiple warehouses
func (r *WarehouseRepository) BulkCreate(ctx context.Context, warehouses []*models.Warehouse) error {
	if err := r.db.WithContext(ctx).CreateInBatches(warehouses, 100).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk create warehouses")
		return fmt.Errorf("failed to bulk create warehouses: %w", err)
	}

	r.logger.WithField("count", len(warehouses)).Info("Warehouses bulk created successfully")
	return nil
}

// applyWarehouseFilters applies filters to the query
func (r *WarehouseRepository) applyWarehouseFilters(query *gorm.DB, filter WarehouseFilter) *gorm.DB {
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	if filter.Country != "" {
		query = query.Where("country = ?", filter.Country)
	}

	if filter.State != "" {
		query = query.Where("state = ?", filter.State)
	}

	if filter.City != "" {
		query = query.Where("city = ?", filter.City)
	}

	if filter.Search != "" {
		searchTerm := "%" + strings.ToLower(filter.Search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(warehouse_number) LIKE ? OR LOWER(description) LIKE ?", 
			searchTerm, searchTerm, searchTerm)
	}

	if filter.MinCapacity != nil {
		query = query.Where("total_capacity >= ?", *filter.MinCapacity)
	}

	if filter.MaxCapacity != nil {
		query = query.Where("total_capacity <= ?", *filter.MaxCapacity)
	}

	if filter.MinUtilization != nil {
		query = query.Where("(used_capacity / NULLIF(total_capacity, 0) * 100) >= ?", *filter.MinUtilization)
	}

	if filter.MaxUtilization != nil {
		query = query.Where("(used_capacity / NULLIF(total_capacity, 0) * 100) <= ?", *filter.MaxUtilization)
	}

	if filter.IsActive != nil {
		if *filter.IsActive {
			query = query.Where("status = ?", "active")
		} else {
			query = query.Where("status != ?", "active")
		}
	}

	if filter.IsDefault != nil {
		query = query.Where("is_default = ?", *filter.IsDefault)
	}

	if filter.HasStock != nil && *filter.HasStock {
		query = query.Joins("JOIN stock_items si ON warehouses.id = si.warehouse_id").
			Where("si.deleted_at IS NULL AND si.quantity_on_hand > 0")
	}

	if len(filter.Tags) > 0 {
		query = query.Where("tags && ?", filter.Tags)
	}

	if filter.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filter.CreatedAfter)
	}

	if filter.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filter.CreatedBefore)
	}

	return query
}

// cacheWarehouse caches a warehouse
func (r *WarehouseRepository) cacheWarehouse(ctx context.Context, warehouse *models.Warehouse) {
	if r.redis == nil {
		return
	}

	data, err := json.Marshal(warehouse)
	if err != nil {
		r.logger.WithError(err).Warn("Failed to marshal warehouse for cache")
		return
	}

	if err := r.redis.Set(ctx, WarehouseCacheKey(warehouse.ID.String()), data, time.Hour).Err(); err != nil {
		r.logger.WithError(err).Warn("Failed to cache warehouse")
	}
}

// getWarehouseFromCache retrieves a warehouse from cache
func (r *WarehouseRepository) getWarehouseFromCache(ctx context.Context, id string) (*models.Warehouse, error) {
	if r.redis == nil {
		return nil, fmt.Errorf("redis not available")
	}

	data, err := r.redis.Get(ctx, WarehouseCacheKey(id)).Result()
	if err != nil {
		return nil, err
	}

	var warehouse models.Warehouse
	if err := json.Unmarshal([]byte(data), &warehouse); err != nil {
		return nil, err
	}

	return &warehouse, nil
}

// LocationRepository handles location data operations
type LocationRepository struct {
	db     *gorm.DB
	logger *logrus.Logger
}

// NewLocationRepository creates a new location repository
func NewLocationRepository(db *gorm.DB, logger *logrus.Logger) *LocationRepository {
	return &LocationRepository{
		db:     db,
		logger: logger,
	}
}

// CreateLocation creates a new location
func (r *LocationRepository) CreateLocation(ctx context.Context, location *models.Location) error {
	if err := r.db.WithContext(ctx).Create(location).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create location")
		return fmt.Errorf("failed to create location: %w", err)
	}

	r.logger.WithField("location_id", location.ID).Info("Location created successfully")
	return nil
}

// GetLocationByID retrieves a location by ID
func (r *LocationRepository) GetLocationByID(ctx context.Context, id uuid.UUID) (*models.Location, error) {
	var location models.Location
	err := r.db.WithContext(ctx).
		Preload("Warehouse").
		Preload("ParentLocation").
		Preload("Children").
		Preload("StockItems.Product").
		First(&location, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("location_id", id).Error("Failed to get location")
		return nil, fmt.Errorf("failed to get location: %w", err)
	}

	return &location, nil
}

// GetLocationsByWarehouse retrieves locations for a warehouse
func (r *LocationRepository) GetLocationsByWarehouse(ctx context.Context, warehouseID uuid.UUID) ([]*models.Location, error) {
	var locations []*models.Location
	err := r.db.WithContext(ctx).
		Where("warehouse_id = ?", warehouseID).
		Order("level ASC, location_code ASC").
		Preload("Children").
		Find(&locations).Error

	if err != nil {
		r.logger.WithError(err).WithField("warehouse_id", warehouseID).Error("Failed to get warehouse locations")
		return nil, fmt.Errorf("failed to get warehouse locations: %w", err)
	}

	return locations, nil
}

// GetLocationTree retrieves the location tree for a warehouse
func (r *LocationRepository) GetLocationTree(ctx context.Context, warehouseID uuid.UUID) ([]*models.Location, error) {
	var locations []*models.Location
	err := r.db.WithContext(ctx).
		Where("warehouse_id = ? AND parent_location_id IS NULL", warehouseID).
		Order("location_code ASC").
		Preload("Children").
		Find(&locations).Error

	if err != nil {
		r.logger.WithError(err).WithField("warehouse_id", warehouseID).Error("Failed to get location tree")
		return nil, fmt.Errorf("failed to get location tree: %w", err)
	}

	return locations, nil
}

// UpdateLocation updates a location
func (r *LocationRepository) UpdateLocation(ctx context.Context, location *models.Location) error {
	if err := r.db.WithContext(ctx).Save(location).Error; err != nil {
		r.logger.WithError(err).WithField("location_id", location.ID).Error("Failed to update location")
		return fmt.Errorf("failed to update location: %w", err)
	}

	r.logger.WithField("location_id", location.ID).Info("Location updated successfully")
	return nil
}

// DeleteLocation soft deletes a location
func (r *LocationRepository) DeleteLocation(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Location{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("location_id", id).Error("Failed to delete location")
		return fmt.Errorf("failed to delete location: %w", err)
	}

	r.logger.WithField("location_id", id).Info("Location deleted successfully")
	return nil
}

