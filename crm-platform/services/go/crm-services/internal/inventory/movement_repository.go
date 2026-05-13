package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// MovementRepository handles stock movement data operations
type MovementRepository struct {
	db     *gorm.DB
	logger *logrus.Logger
}

// NewMovementRepository creates a new movement repository
func NewMovementRepository(db *gorm.DB, logger *logrus.Logger) *MovementRepository {
	return &MovementRepository{
		db:     db,
		logger: logger,
	}
}

// MovementFilter represents movement filtering options
type MovementFilter struct {
	ProductID         *uuid.UUID `json:"product_id"`
	WarehouseID       *uuid.UUID `json:"warehouse_id"`
	LocationID        *uuid.UUID `json:"location_id"`
	MovementType      string     `json:"movement_type"`
	Direction         string     `json:"direction"`
	MovedBy           *uuid.UUID `json:"moved_by"`
	ReferenceType     string     `json:"reference_type"`
	ReferenceID       *uuid.UUID `json:"reference_id"`
	BatchNumber       string     `json:"batch_number"`
	SerialNumber      string     `json:"serial_number"`
	MinQuantity       *int64     `json:"min_quantity"`
	MaxQuantity       *int64     `json:"max_quantity"`
	MinCost           *decimal.Decimal `json:"min_cost"`
	MaxCost           *decimal.Decimal `json:"max_cost"`
	MovementAfter     *time.Time `json:"movement_after"`
	MovementBefore    *time.Time `json:"movement_before"`
	CreatedAfter      *time.Time `json:"created_after"`
	CreatedBefore     *time.Time `json:"created_before"`
}

// MovementStats represents movement statistics
type MovementStats struct {
	TotalMovements        int64           `json:"total_movements"`
	InboundMovements      int64           `json:"inbound_movements"`
	OutboundMovements     int64           `json:"outbound_movements"`
	TotalQuantityIn       int64           `json:"total_quantity_in"`
	TotalQuantityOut      int64           `json:"total_quantity_out"`
	TotalValueIn          decimal.Decimal `json:"total_value_in"`
	TotalValueOut         decimal.Decimal `json:"total_value_out"`
	MovementsByType       []MovementTypeCount `json:"movements_by_type"`
	MovementsByWarehouse  []MovementWarehouseCount `json:"movements_by_warehouse"`
	TopMovedProducts      []MovementProductCount `json:"top_moved_products"`
	RecentMovements       []*models.StockMovement `json:"recent_movements"`
}

// MovementTypeCount represents movement count by type
type MovementTypeCount struct {
	MovementType  string `json:"movement_type"`
	MovementCount int64  `json:"movement_count"`
	TotalQuantity int64  `json:"total_quantity"`
	TotalValue    decimal.Decimal `json:"total_value"`
}

// MovementWarehouseCount represents movement count by warehouse
type MovementWarehouseCount struct {
	WarehouseID   uuid.UUID `json:"warehouse_id"`
	WarehouseName string    `json:"warehouse_name"`
	MovementCount int64     `json:"movement_count"`
	TotalQuantity int64     `json:"total_quantity"`
	TotalValue    decimal.Decimal `json:"total_value"`
}

// MovementProductCount represents movement count by product
type MovementProductCount struct {
	ProductID     uuid.UUID `json:"product_id"`
	ProductName   string    `json:"product_name"`
	ProductSKU    string    `json:"product_sku"`
	MovementCount int64     `json:"movement_count"`
	TotalQuantity int64     `json:"total_quantity"`
	TotalValue    decimal.Decimal `json:"total_value"`
}

// Create creates a new stock movement
func (r *MovementRepository) Create(ctx context.Context, movement *models.StockMovement) error {
	if err := r.db.WithContext(ctx).Create(movement).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create stock movement")
		return fmt.Errorf("failed to create stock movement: %w", err)
	}

	r.logger.WithField("movement_id", movement.ID).Info("Stock movement created successfully")
	return nil
}

// GetByID retrieves a stock movement by ID
func (r *MovementRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.StockMovement, error) {
	var movement models.StockMovement
	err := r.db.WithContext(ctx).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		First(&movement, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("movement_id", id).Error("Failed to get stock movement")
		return nil, fmt.Errorf("failed to get stock movement: %w", err)
	}

	return &movement, nil
}

// GetByMovementNumber retrieves a stock movement by movement number
func (r *MovementRepository) GetByMovementNumber(ctx context.Context, movementNumber string) (*models.StockMovement, error) {
	var movement models.StockMovement
	err := r.db.WithContext(ctx).
		Where("movement_number = ?", movementNumber).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		First(&movement).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("movement_number", movementNumber).Error("Failed to get stock movement by number")
		return nil, fmt.Errorf("failed to get stock movement by number: %w", err)
	}

	return &movement, nil
}

// List retrieves stock movements with filtering and pagination
func (r *MovementRepository) List(ctx context.Context, filter MovementFilter, pagination Pagination) ([]*models.StockMovement, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockMovement{})

	// Apply filters
	query = r.applyMovementFilters(query, filter)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count stock movements")
		return nil, 0, fmt.Errorf("failed to count stock movements: %w", err)
	}

	// Apply pagination and preloading
	var movements []*models.StockMovement
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list stock movements")
		return nil, 0, fmt.Errorf("failed to list stock movements: %w", err)
	}

	return movements, total, nil
}

// GetByProduct retrieves stock movements for a product
func (r *MovementRepository) GetByProduct(ctx context.Context, productID uuid.UUID, pagination Pagination) ([]*models.StockMovement, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockMovement{}).
		Where("product_id = ?", productID)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count movements by product")
		return nil, 0, fmt.Errorf("failed to count movements by product: %w", err)
	}

	// Get results
	var movements []*models.StockMovement
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get movements by product")
		return nil, 0, fmt.Errorf("failed to get movements by product: %w", err)
	}

	return movements, total, nil
}

// GetByWarehouse retrieves stock movements for a warehouse
func (r *MovementRepository) GetByWarehouse(ctx context.Context, warehouseID uuid.UUID, pagination Pagination) ([]*models.StockMovement, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockMovement{}).
		Where("warehouse_id = ?", warehouseID)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count movements by warehouse")
		return nil, 0, fmt.Errorf("failed to count movements by warehouse: %w", err)
	}

	// Get results
	var movements []*models.StockMovement
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get movements by warehouse")
		return nil, 0, fmt.Errorf("failed to get movements by warehouse: %w", err)
	}

	return movements, total, nil
}

// GetByType retrieves stock movements by type
func (r *MovementRepository) GetByType(ctx context.Context, movementType string, pagination Pagination) ([]*models.StockMovement, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockMovement{}).
		Where("movement_type = ?", movementType)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count movements by type")
		return nil, 0, fmt.Errorf("failed to count movements by type: %w", err)
	}

	// Get results
	var movements []*models.StockMovement
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get movements by type")
		return nil, 0, fmt.Errorf("failed to get movements by type: %w", err)
	}

	return movements, total, nil
}

// GetByReference retrieves stock movements by reference
func (r *MovementRepository) GetByReference(ctx context.Context, referenceType string, referenceID uuid.UUID) ([]*models.StockMovement, error) {
	var movements []*models.StockMovement
	err := r.db.WithContext(ctx).
		Where("reference_type = ? AND reference_id = ?", referenceType, referenceID).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).WithFields(logrus.Fields{
			"reference_type": referenceType,
			"reference_id":   referenceID,
		}).Error("Failed to get movements by reference")
		return nil, fmt.Errorf("failed to get movements by reference: %w", err)
	}

	return movements, nil
}

// GetByBatch retrieves stock movements by batch number
func (r *MovementRepository) GetByBatch(ctx context.Context, batchNumber string) ([]*models.StockMovement, error) {
	var movements []*models.StockMovement
	err := r.db.WithContext(ctx).
		Where("batch_number = ?", batchNumber).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).WithField("batch_number", batchNumber).Error("Failed to get movements by batch")
		return nil, fmt.Errorf("failed to get movements by batch: %w", err)
	}

	return movements, nil
}

// GetBySerial retrieves stock movements by serial number
func (r *MovementRepository) GetBySerial(ctx context.Context, serialNumber string) ([]*models.StockMovement, error) {
	var movements []*models.StockMovement
	err := r.db.WithContext(ctx).
		Where("serial_number = ?", serialNumber).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).WithField("serial_number", serialNumber).Error("Failed to get movements by serial")
		return nil, fmt.Errorf("failed to get movements by serial: %w", err)
	}

	return movements, nil
}

// GetRecent retrieves recent stock movements
func (r *MovementRepository) GetRecent(ctx context.Context, limit int) ([]*models.StockMovement, error) {
	var movements []*models.StockMovement
	err := r.db.WithContext(ctx).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Limit(limit).
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get recent movements")
		return nil, fmt.Errorf("failed to get recent movements: %w", err)
	}

	return movements, nil
}

// GetStats retrieves movement statistics
func (r *MovementRepository) GetStats(ctx context.Context, startDate, endDate *time.Time) (*MovementStats, error) {
	stats := &MovementStats{}

	query := r.db.WithContext(ctx).Model(&models.StockMovement{})
	if startDate != nil {
		query = query.Where("movement_date >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("movement_date <= ?", *endDate)
	}

	// Total movements
	if err := query.Count(&stats.TotalMovements).Error; err != nil {
		return nil, fmt.Errorf("failed to count total movements: %w", err)
	}

	// Inbound movements
	inboundQuery := query.Where("direction = ?", models.MovementDirectionIn)
	if err := inboundQuery.Count(&stats.InboundMovements).Error; err != nil {
		return nil, fmt.Errorf("failed to count inbound movements: %w", err)
	}

	// Outbound movements
	outboundQuery := query.Where("direction = ?", models.MovementDirectionOut)
	if err := outboundQuery.Count(&stats.OutboundMovements).Error; err != nil {
		return nil, fmt.Errorf("failed to count outbound movements: %w", err)
	}

	// Quantity statistics
	var inQuantity, outQuantity *int64
	if err := inboundQuery.Select("SUM(quantity)").Scan(&inQuantity).Error; err != nil {
		return nil, fmt.Errorf("failed to sum inbound quantity: %w", err)
	}
	if err := outboundQuery.Select("SUM(quantity)").Scan(&outQuantity).Error; err != nil {
		return nil, fmt.Errorf("failed to sum outbound quantity: %w", err)
	}

	if inQuantity != nil {
		stats.TotalQuantityIn = *inQuantity
	}
	if outQuantity != nil {
		stats.TotalQuantityOut = *outQuantity
	}

	// Value statistics
	var inValue, outValue *decimal.Decimal
	if err := inboundQuery.Select("SUM(total_cost)").Scan(&inValue).Error; err != nil {
		return nil, fmt.Errorf("failed to sum inbound value: %w", err)
	}
	if err := outboundQuery.Select("SUM(total_cost)").Scan(&outValue).Error; err != nil {
		return nil, fmt.Errorf("failed to sum outbound value: %w", err)
	}

	if inValue != nil {
		stats.TotalValueIn = *inValue
	}
	if outValue != nil {
		stats.TotalValueOut = *outValue
	}

	// Movements by type
	if err := query.
		Select("movement_type, COUNT(*) as movement_count, SUM(quantity) as total_quantity, SUM(total_cost) as total_value").
		Group("movement_type").
		Order("movement_count DESC").
		Scan(&stats.MovementsByType).Error; err != nil {
		return nil, fmt.Errorf("failed to get movements by type: %w", err)
	}

	// Movements by warehouse
	if err := query.
		Table("stock_movements sm").
		Select("sm.warehouse_id, w.name as warehouse_name, COUNT(sm.id) as movement_count, SUM(sm.quantity) as total_quantity, SUM(sm.total_cost) as total_value").
		Joins("JOIN warehouses w ON sm.warehouse_id = w.id").
		Where("sm.deleted_at IS NULL AND w.deleted_at IS NULL").
		Group("sm.warehouse_id, w.name").
		Order("movement_count DESC").
		Scan(&stats.MovementsByWarehouse).Error; err != nil {
		return nil, fmt.Errorf("failed to get movements by warehouse: %w", err)
	}

	// Top moved products
	if err := query.
		Table("stock_movements sm").
		Select("sm.product_id, p.name as product_name, p.sku as product_sku, COUNT(sm.id) as movement_count, SUM(sm.quantity) as total_quantity, SUM(sm.total_cost) as total_value").
		Joins("JOIN products p ON sm.product_id = p.id").
		Where("sm.deleted_at IS NULL AND p.deleted_at IS NULL").
		Group("sm.product_id, p.name, p.sku").
		Order("movement_count DESC").
		Limit(10).
		Scan(&stats.TopMovedProducts).Error; err != nil {
		return nil, fmt.Errorf("failed to get top moved products: %w", err)
	}

	// Recent movements
	recentMovements, err := r.GetRecent(ctx, 10)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent movements: %w", err)
	}
	stats.RecentMovements = recentMovements

	return stats, nil
}

// GetMovementHistory retrieves movement history for a product in a warehouse
func (r *MovementRepository) GetMovementHistory(ctx context.Context, productID, warehouseID uuid.UUID, locationID *uuid.UUID, pagination Pagination) ([]*models.StockMovement, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockMovement{}).
		Where("product_id = ? AND warehouse_id = ?", productID, warehouseID)

	if locationID != nil {
		query = query.Where("location_id = ?", *locationID)
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count movement history")
		return nil, 0, fmt.Errorf("failed to count movement history: %w", err)
	}

	// Get results
	var movements []*models.StockMovement
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Order("movement_date DESC, created_at DESC").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&movements).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get movement history")
		return nil, 0, fmt.Errorf("failed to get movement history: %w", err)
	}

	return movements, total, nil
}

// BulkCreate creates multiple stock movements
func (r *MovementRepository) BulkCreate(ctx context.Context, movements []*models.StockMovement) error {
	if err := r.db.WithContext(ctx).CreateInBatches(movements, 100).Error; err != nil {
		r.logger.WithError(err).Error("Failed to bulk create stock movements")
		return fmt.Errorf("failed to bulk create stock movements: %w", err)
	}

	r.logger.WithField("count", len(movements)).Info("Stock movements bulk created successfully")
	return nil
}

// applyMovementFilters applies filters to the query
func (r *MovementRepository) applyMovementFilters(query *gorm.DB, filter MovementFilter) *gorm.DB {
	if filter.ProductID != nil {
		query = query.Where("product_id = ?", *filter.ProductID)
	}

	if filter.WarehouseID != nil {
		query = query.Where("warehouse_id = ?", *filter.WarehouseID)
	}

	if filter.LocationID != nil {
		query = query.Where("location_id = ?", *filter.LocationID)
	}

	if filter.MovementType != "" {
		query = query.Where("movement_type = ?", filter.MovementType)
	}

	if filter.Direction != "" {
		query = query.Where("direction = ?", filter.Direction)
	}

	if filter.MovedBy != nil {
		query = query.Where("moved_by = ?", *filter.MovedBy)
	}

	if filter.ReferenceType != "" {
		query = query.Where("reference_type = ?", filter.ReferenceType)
	}

	if filter.ReferenceID != nil {
		query = query.Where("reference_id = ?", *filter.ReferenceID)
	}

	if filter.BatchNumber != "" {
		query = query.Where("batch_number = ?", filter.BatchNumber)
	}

	if filter.SerialNumber != "" {
		query = query.Where("serial_number = ?", filter.SerialNumber)
	}

	if filter.MinQuantity != nil {
		query = query.Where("quantity >= ?", *filter.MinQuantity)
	}

	if filter.MaxQuantity != nil {
		query = query.Where("quantity <= ?", *filter.MaxQuantity)
	}

	if filter.MinCost != nil {
		query = query.Where("unit_cost >= ?", *filter.MinCost)
	}

	if filter.MaxCost != nil {
		query = query.Where("unit_cost <= ?", *filter.MaxCost)
	}

	if filter.MovementAfter != nil {
		query = query.Where("movement_date >= ?", *filter.MovementAfter)
	}

	if filter.MovementBefore != nil {
		query = query.Where("movement_date <= ?", *filter.MovementBefore)
	}

	if filter.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filter.CreatedAfter)
	}

	if filter.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filter.CreatedBefore)
	}

	return query
}

