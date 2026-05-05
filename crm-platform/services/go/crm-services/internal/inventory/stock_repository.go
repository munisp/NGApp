package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/enterprise-crm/inventory-service/internal/models"
)

// StockRepository handles stock data operations
type StockRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewStockRepository creates a new stock repository
func NewStockRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) *StockRepository {
	return &StockRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// StockFilter represents stock filtering options
type StockFilter struct {
	ProductID         *uuid.UUID `json:"product_id"`
	WarehouseID       *uuid.UUID `json:"warehouse_id"`
	LocationID        *uuid.UUID `json:"location_id"`
	MinQuantity       *int64     `json:"min_quantity"`
	MaxQuantity       *int64     `json:"max_quantity"`
	MinAvailable      *int64     `json:"min_available"`
	MaxAvailable      *int64     `json:"max_available"`
	LowStock          *bool      `json:"low_stock"`
	OutOfStock        *bool      `json:"out_of_stock"`
	NegativeStock     *bool      `json:"negative_stock"`
	HasReservations   *bool      `json:"has_reservations"`
	HasAllocations    *bool      `json:"has_allocations"`
	IsActive          *bool      `json:"is_active"`
	IsTracked         *bool      `json:"is_tracked"`
	LastCountedAfter  *time.Time `json:"last_counted_after"`
	LastCountedBefore *time.Time `json:"last_counted_before"`
	CreatedAfter      *time.Time `json:"created_after"`
	CreatedBefore     *time.Time `json:"created_before"`
}

// StockStats represents stock statistics
type StockStats struct {
	TotalStockItems       int64           `json:"total_stock_items"`
	TotalQuantityOnHand   int64           `json:"total_quantity_on_hand"`
	TotalQuantityReserved int64           `json:"total_quantity_reserved"`
	TotalQuantityAllocated int64          `json:"total_quantity_allocated"`
	TotalQuantityAvailable int64          `json:"total_quantity_available"`
	TotalValue            decimal.Decimal `json:"total_value"`
	LowStockItems         int64           `json:"low_stock_items"`
	OutOfStockItems       int64           `json:"out_of_stock_items"`
	NegativeStockItems    int64           `json:"negative_stock_items"`
	AverageCost           decimal.Decimal `json:"average_cost"`
	TopValuedItems        []StockValueItem `json:"top_valued_items"`
	StockByWarehouse      []StockByWarehouse `json:"stock_by_warehouse"`
	StockTurnoverRate     decimal.Decimal `json:"stock_turnover_rate"`
}

// StockValueItem represents high-value stock items
type StockValueItem struct {
	StockItemID     uuid.UUID       `json:"stock_item_id"`
	ProductID       uuid.UUID       `json:"product_id"`
	ProductName     string          `json:"product_name"`
	ProductSKU      string          `json:"product_sku"`
	WarehouseName   string          `json:"warehouse_name"`
	QuantityOnHand  int64           `json:"quantity_on_hand"`
	AverageCost     decimal.Decimal `json:"average_cost"`
	TotalValue      decimal.Decimal `json:"total_value"`
}

// StockByWarehouse represents stock distribution by warehouse
type StockByWarehouse struct {
	WarehouseID     uuid.UUID       `json:"warehouse_id"`
	WarehouseName   string          `json:"warehouse_name"`
	StockItemCount  int64           `json:"stock_item_count"`
	TotalQuantity   int64           `json:"total_quantity"`
	TotalValue      decimal.Decimal `json:"total_value"`
	UtilizationRate decimal.Decimal `json:"utilization_rate"`
}

// StockAdjustment represents a stock adjustment request
type StockAdjustment struct {
	ProductID    uuid.UUID       `json:"product_id"`
	WarehouseID  uuid.UUID       `json:"warehouse_id"`
	LocationID   *uuid.UUID      `json:"location_id"`
	Quantity     int64           `json:"quantity"`
	Reason       string          `json:"reason"`
	UnitCost     decimal.Decimal `json:"unit_cost"`
	BatchNumber  string          `json:"batch_number"`
	SerialNumber string          `json:"serial_number"`
	ExpiryDate   *time.Time      `json:"expiry_date"`
	AdjustedBy   *uuid.UUID      `json:"adjusted_by"`
	Notes        string          `json:"notes"`
}

// StockTransfer represents a stock transfer request
type StockTransfer struct {
	ProductID         uuid.UUID  `json:"product_id"`
	FromWarehouseID   uuid.UUID  `json:"from_warehouse_id"`
	ToWarehouseID     uuid.UUID  `json:"to_warehouse_id"`
	FromLocationID    *uuid.UUID `json:"from_location_id"`
	ToLocationID      *uuid.UUID `json:"to_location_id"`
	Quantity          int64      `json:"quantity"`
	Reason            string     `json:"reason"`
	BatchNumber       string     `json:"batch_number"`
	SerialNumber      string     `json:"serial_number"`
	TransferredBy     *uuid.UUID `json:"transferred_by"`
	Notes             string     `json:"notes"`
}

// StockReservation represents a stock reservation request
type StockReservation struct {
	ProductID     uuid.UUID  `json:"product_id"`
	WarehouseID   uuid.UUID  `json:"warehouse_id"`
	LocationID    *uuid.UUID `json:"location_id"`
	Quantity      int64      `json:"quantity"`
	ReferenceType string     `json:"reference_type"`
	ReferenceID   *uuid.UUID `json:"reference_id"`
	ReservedBy    *uuid.UUID `json:"reserved_by"`
	ExpiresAt     *time.Time `json:"expires_at"`
	Notes         string     `json:"notes"`
}

// Create creates a new stock item
func (r *StockRepository) Create(ctx context.Context, stockItem *models.StockItem) error {
	if err := r.db.WithContext(ctx).Create(stockItem).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create stock item")
		return fmt.Errorf("failed to create stock item: %w", err)
	}

	// Cache the stock item
	if r.redis != nil {
		r.cacheStockItem(ctx, stockItem)
	}

	r.logger.WithField("stock_item_id", stockItem.ID).Info("Stock item created successfully")
	return nil
}

// GetByID retrieves a stock item by ID
func (r *StockRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.StockItem, error) {
	// Try cache first
	if r.redis != nil {
		if stockItem, err := r.getStockItemFromCache(ctx, id.String()); err == nil && stockItem != nil {
			return stockItem, nil
		}
	}

	var stockItem models.StockItem
	err := r.db.WithContext(ctx).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		First(&stockItem, id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithField("stock_item_id", id).Error("Failed to get stock item")
		return nil, fmt.Errorf("failed to get stock item: %w", err)
	}

	// Cache the stock item
	if r.redis != nil {
		r.cacheStockItem(ctx, &stockItem)
	}

	return &stockItem, nil
}

// GetByProductAndWarehouse retrieves stock item by product and warehouse
func (r *StockRepository) GetByProductAndWarehouse(ctx context.Context, productID, warehouseID uuid.UUID, locationID *uuid.UUID) (*models.StockItem, error) {
	// Try cache first
	cacheKey := StockCacheKey(productID.String(), warehouseID.String())
	if locationID != nil {
		cacheKey = fmt.Sprintf("%s:%s", cacheKey, locationID.String())
	}

	if r.redis != nil {
		if stockItem, err := r.getStockItemFromCache(ctx, cacheKey); err == nil && stockItem != nil {
			return stockItem, nil
		}
	}

	query := r.db.WithContext(ctx).
		Where("product_id = ? AND warehouse_id = ?", productID, warehouseID)

	if locationID != nil {
		query = query.Where("location_id = ?", *locationID)
	} else {
		query = query.Where("location_id IS NULL")
	}

	var stockItem models.StockItem
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		First(&stockItem).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.logger.WithError(err).WithFields(logrus.Fields{
			"product_id":   productID,
			"warehouse_id": warehouseID,
			"location_id":  locationID,
		}).Error("Failed to get stock item by product and warehouse")
		return nil, fmt.Errorf("failed to get stock item by product and warehouse: %w", err)
	}

	// Cache the stock item
	if r.redis != nil {
		r.cacheStockItem(ctx, &stockItem)
	}

	return &stockItem, nil
}

// Update updates a stock item
func (r *StockRepository) Update(ctx context.Context, stockItem *models.StockItem) error {
	// Calculate available quantity before saving
	stockItem.CalculateAvailableQuantity()

	if err := r.db.WithContext(ctx).Save(stockItem).Error; err != nil {
		r.logger.WithError(err).WithField("stock_item_id", stockItem.ID).Error("Failed to update stock item")
		return fmt.Errorf("failed to update stock item: %w", err)
	}

	// Update cache
	if r.redis != nil {
		r.cacheStockItem(ctx, stockItem)
	}

	r.logger.WithField("stock_item_id", stockItem.ID).Info("Stock item updated successfully")
	return nil
}

// Delete soft deletes a stock item
func (r *StockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.StockItem{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("stock_item_id", id).Error("Failed to delete stock item")
		return fmt.Errorf("failed to delete stock item: %w", err)
	}

	// Remove from cache
	if r.redis != nil {
		r.redis.Del(ctx, fmt.Sprintf("inventory:stock_item:%s", id.String()))
	}

	r.logger.WithField("stock_item_id", id).Info("Stock item deleted successfully")
	return nil
}

// List retrieves stock items with filtering and pagination
func (r *StockRepository) List(ctx context.Context, filter StockFilter, pagination Pagination) ([]*models.StockItem, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockItem{})

	// Apply filters
	query = r.applyStockFilters(query, filter)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count stock items")
		return nil, 0, fmt.Errorf("failed to count stock items: %w", err)
	}

	// Apply pagination and preloading
	var stockItems []*models.StockItem
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&stockItems).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to list stock items")
		return nil, 0, fmt.Errorf("failed to list stock items: %w", err)
	}

	return stockItems, total, nil
}

// GetLowStock retrieves stock items with low stock
func (r *StockRepository) GetLowStock(ctx context.Context, pagination Pagination) ([]*models.StockItem, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Where("quantity_available <= reorder_level AND quantity_available > 0")

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count low stock items")
		return nil, 0, fmt.Errorf("failed to count low stock items: %w", err)
	}

	// Get results
	var stockItems []*models.StockItem
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&stockItems).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get low stock items")
		return nil, 0, fmt.Errorf("failed to get low stock items: %w", err)
	}

	return stockItems, total, nil
}

// GetOutOfStock retrieves stock items that are out of stock
func (r *StockRepository) GetOutOfStock(ctx context.Context, pagination Pagination) ([]*models.StockItem, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Where("quantity_available <= 0")

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count out of stock items")
		return nil, 0, fmt.Errorf("failed to count out of stock items: %w", err)
	}

	// Get results
	var stockItems []*models.StockItem
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&stockItems).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get out of stock items")
		return nil, 0, fmt.Errorf("failed to get out of stock items: %w", err)
	}

	return stockItems, total, nil
}

// GetByProduct retrieves stock items for a product across all warehouses
func (r *StockRepository) GetByProduct(ctx context.Context, productID uuid.UUID) ([]*models.StockItem, error) {
	var stockItems []*models.StockItem
	err := r.db.WithContext(ctx).
		Where("product_id = ?", productID).
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Find(&stockItems).Error

	if err != nil {
		r.logger.WithError(err).WithField("product_id", productID).Error("Failed to get stock items by product")
		return nil, fmt.Errorf("failed to get stock items by product: %w", err)
	}

	return stockItems, nil
}

// GetByWarehouse retrieves stock items for a warehouse
func (r *StockRepository) GetByWarehouse(ctx context.Context, warehouseID uuid.UUID, pagination Pagination) ([]*models.StockItem, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Where("warehouse_id = ?", warehouseID)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count stock items by warehouse")
		return nil, 0, fmt.Errorf("failed to count stock items by warehouse: %w", err)
	}

	// Get results
	var stockItems []*models.StockItem
	err := query.
		Preload("Product").
		Preload("Warehouse").
		Preload("Location").
		Scopes(func(db *gorm.DB) *gorm.DB {
			return ApplyPagination(db, pagination)
		}).
		Find(&stockItems).Error

	if err != nil {
		r.logger.WithError(err).Error("Failed to get stock items by warehouse")
		return nil, 0, fmt.Errorf("failed to get stock items by warehouse: %w", err)
	}

	return stockItems, total, nil
}

// GetStats retrieves stock statistics
func (r *StockRepository) GetStats(ctx context.Context) (*StockStats, error) {
	stats := &StockStats{}

	// Total stock items
	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).Count(&stats.TotalStockItems).Error; err != nil {
		return nil, fmt.Errorf("failed to count total stock items: %w", err)
	}

	// Quantity statistics
	var quantityStats struct {
		TotalOnHand   *int64 `json:"total_on_hand"`
		TotalReserved *int64 `json:"total_reserved"`
		TotalAllocated *int64 `json:"total_allocated"`
		TotalAvailable *int64 `json:"total_available"`
	}

	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Select("SUM(quantity_on_hand) as total_on_hand, SUM(quantity_reserved) as total_reserved, SUM(quantity_allocated) as total_allocated, SUM(quantity_available) as total_available").
		Scan(&quantityStats).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate quantity statistics: %w", err)
	}

	if quantityStats.TotalOnHand != nil {
		stats.TotalQuantityOnHand = *quantityStats.TotalOnHand
	}
	if quantityStats.TotalReserved != nil {
		stats.TotalQuantityReserved = *quantityStats.TotalReserved
	}
	if quantityStats.TotalAllocated != nil {
		stats.TotalQuantityAllocated = *quantityStats.TotalAllocated
	}
	if quantityStats.TotalAvailable != nil {
		stats.TotalQuantityAvailable = *quantityStats.TotalAvailable
	}

	// Value statistics
	var totalValue *decimal.Decimal
	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Select("SUM(quantity_on_hand * average_cost)").
		Scan(&totalValue).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate total value: %w", err)
	}
	if totalValue != nil {
		stats.TotalValue = *totalValue
	}

	// Average cost
	var avgCost *decimal.Decimal
	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Select("AVG(average_cost)").
		Scan(&avgCost).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate average cost: %w", err)
	}
	if avgCost != nil {
		stats.AverageCost = *avgCost
	}

	// Low stock items
	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Where("quantity_available <= reorder_level AND quantity_available > 0").
		Count(&stats.LowStockItems).Error; err != nil {
		return nil, fmt.Errorf("failed to count low stock items: %w", err)
	}

	// Out of stock items
	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Where("quantity_available <= 0").
		Count(&stats.OutOfStockItems).Error; err != nil {
		return nil, fmt.Errorf("failed to count out of stock items: %w", err)
	}

	// Negative stock items
	if err := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Where("quantity_available < 0").
		Count(&stats.NegativeStockItems).Error; err != nil {
		return nil, fmt.Errorf("failed to count negative stock items: %w", err)
	}

	// Top valued items
	if err := r.db.WithContext(ctx).
		Table("stock_items si").
		Select("si.id as stock_item_id, si.product_id, p.name as product_name, p.sku as product_sku, w.name as warehouse_name, si.quantity_on_hand, si.average_cost, (si.quantity_on_hand * si.average_cost) as total_value").
		Joins("JOIN products p ON si.product_id = p.id").
		Joins("JOIN warehouses w ON si.warehouse_id = w.id").
		Where("si.deleted_at IS NULL AND p.deleted_at IS NULL AND w.deleted_at IS NULL").
		Order("total_value DESC").
		Limit(10).
		Scan(&stats.TopValuedItems).Error; err != nil {
		return nil, fmt.Errorf("failed to get top valued items: %w", err)
	}

	// Stock by warehouse
	if err := r.db.WithContext(ctx).
		Table("stock_items si").
		Select("si.warehouse_id, w.name as warehouse_name, COUNT(si.id) as stock_item_count, SUM(si.quantity_on_hand) as total_quantity, SUM(si.quantity_on_hand * si.average_cost) as total_value").
		Joins("JOIN warehouses w ON si.warehouse_id = w.id").
		Where("si.deleted_at IS NULL AND w.deleted_at IS NULL").
		Group("si.warehouse_id, w.name").
		Order("total_value DESC").
		Scan(&stats.StockByWarehouse).Error; err != nil {
		return nil, fmt.Errorf("failed to get stock by warehouse: %w", err)
	}

	return stats, nil
}

// AdjustStock adjusts stock quantity with movement tracking
func (r *StockRepository) AdjustStock(ctx context.Context, adjustment StockAdjustment) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Get or create stock item
		stockItem, err := r.getOrCreateStockItem(ctx, tx, adjustment.ProductID, adjustment.WarehouseID, adjustment.LocationID)
		if err != nil {
			return fmt.Errorf("failed to get or create stock item: %w", err)
		}

		// Update quantities
		stockItem.QuantityOnHand += adjustment.Quantity
		stockItem.CalculateAvailableQuantity()

		// Update cost if provided
		if !adjustment.UnitCost.IsZero() {
			// Calculate new average cost using weighted average
			totalCost := stockItem.AverageCost.Mul(decimal.NewFromInt(stockItem.QuantityOnHand - adjustment.Quantity))
			adjustmentCost := adjustment.UnitCost.Mul(decimal.NewFromInt(adjustment.Quantity))
			newTotalCost := totalCost.Add(adjustmentCost)
			
			if stockItem.QuantityOnHand > 0 {
				stockItem.AverageCost = newTotalCost.Div(decimal.NewFromInt(stockItem.QuantityOnHand))
			}
			stockItem.LastCost = adjustment.UnitCost
		}

		// Update timestamps
		now := time.Now().UTC()
		if adjustment.Quantity > 0 {
			stockItem.LastReceived = &now
		} else {
			stockItem.LastIssued = &now
		}

		// Save stock item
		if err := tx.Save(stockItem).Error; err != nil {
			return fmt.Errorf("failed to update stock item: %w", err)
		}

		// Create movement record
		movement := &models.StockMovement{
			MovementNumber: r.generateMovementNumber(),
			ProductID:      adjustment.ProductID,
			WarehouseID:    adjustment.WarehouseID,
			LocationID:     adjustment.LocationID,
			MovementType:   models.MovementTypeAdjustment,
			Quantity:       adjustment.Quantity,
			UnitCost:       adjustment.UnitCost,
			TotalCost:      adjustment.UnitCost.Mul(decimal.NewFromInt(adjustment.Quantity)),
			BatchNumber:    adjustment.BatchNumber,
			SerialNumber:   adjustment.SerialNumber,
			ExpiryDate:     adjustment.ExpiryDate,
			MovementDate:   now,
			MovedBy:        adjustment.AdjustedBy,
			Reason:         adjustment.Reason,
			Notes:          adjustment.Notes,
		}

		if adjustment.Quantity > 0 {
			movement.Direction = models.MovementDirectionIn
		} else {
			movement.Direction = models.MovementDirectionOut
			movement.Quantity = -movement.Quantity // Store as positive value
		}

		if err := tx.Create(movement).Error; err != nil {
			return fmt.Errorf("failed to create movement record: %w", err)
		}

		// Update cache
		if r.redis != nil {
			r.cacheStockItem(ctx, stockItem)
		}

		r.logger.WithFields(logrus.Fields{
			"product_id":   adjustment.ProductID,
			"warehouse_id": adjustment.WarehouseID,
			"quantity":     adjustment.Quantity,
			"reason":       adjustment.Reason,
		}).Info("Stock adjusted successfully")

		return nil
	})
}

// TransferStock transfers stock between warehouses/locations
func (r *StockRepository) TransferStock(ctx context.Context, transfer StockTransfer) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Get source stock item
		sourceStock, err := r.getStockItemByLocation(ctx, tx, transfer.ProductID, transfer.FromWarehouseID, transfer.FromLocationID)
		if err != nil {
			return fmt.Errorf("failed to get source stock item: %w", err)
		}
		if sourceStock == nil {
			return fmt.Errorf("source stock item not found")
		}

		// Check available quantity
		if sourceStock.QuantityAvailable < transfer.Quantity {
			return fmt.Errorf("insufficient available quantity: have %d, need %d", sourceStock.QuantityAvailable, transfer.Quantity)
		}

		// Get or create destination stock item
		destStock, err := r.getOrCreateStockItem(ctx, tx, transfer.ProductID, transfer.ToWarehouseID, transfer.ToLocationID)
		if err != nil {
			return fmt.Errorf("failed to get or create destination stock item: %w", err)
		}

		// Update source stock
		sourceStock.QuantityOnHand -= transfer.Quantity
		sourceStock.CalculateAvailableQuantity()

		// Update destination stock
		destStock.QuantityOnHand += transfer.Quantity
		destStock.CalculateAvailableQuantity()

		// Calculate weighted average cost for destination
		if destStock.QuantityOnHand > transfer.Quantity {
			totalCost := destStock.AverageCost.Mul(decimal.NewFromInt(destStock.QuantityOnHand - transfer.Quantity))
			transferCost := sourceStock.AverageCost.Mul(decimal.NewFromInt(transfer.Quantity))
			newTotalCost := totalCost.Add(transferCost)
			destStock.AverageCost = newTotalCost.Div(decimal.NewFromInt(destStock.QuantityOnHand))
		} else {
			destStock.AverageCost = sourceStock.AverageCost
		}

		// Update timestamps
		now := time.Now().UTC()
		sourceStock.LastIssued = &now
		destStock.LastReceived = &now

		// Save stock items
		if err := tx.Save(sourceStock).Error; err != nil {
			return fmt.Errorf("failed to update source stock item: %w", err)
		}
		if err := tx.Save(destStock).Error; err != nil {
			return fmt.Errorf("failed to update destination stock item: %w", err)
		}

		// Create movement records
		movementNumber := r.generateMovementNumber()
		
		// Outbound movement
		outMovement := &models.StockMovement{
			MovementNumber: movementNumber + "-OUT",
			ProductID:      transfer.ProductID,
			WarehouseID:    transfer.FromWarehouseID,
			LocationID:     transfer.FromLocationID,
			MovementType:   models.MovementTypeTransfer,
			Direction:      models.MovementDirectionOut,
			Quantity:       transfer.Quantity,
			UnitCost:       sourceStock.AverageCost,
			TotalCost:      sourceStock.AverageCost.Mul(decimal.NewFromInt(transfer.Quantity)),
			BatchNumber:    transfer.BatchNumber,
			SerialNumber:   transfer.SerialNumber,
			MovementDate:   now,
			MovedBy:        transfer.TransferredBy,
			Reason:         transfer.Reason,
			Notes:          transfer.Notes,
		}

		// Inbound movement
		inMovement := &models.StockMovement{
			MovementNumber: movementNumber + "-IN",
			ProductID:      transfer.ProductID,
			WarehouseID:    transfer.ToWarehouseID,
			LocationID:     transfer.ToLocationID,
			MovementType:   models.MovementTypeTransfer,
			Direction:      models.MovementDirectionIn,
			Quantity:       transfer.Quantity,
			UnitCost:       sourceStock.AverageCost,
			TotalCost:      sourceStock.AverageCost.Mul(decimal.NewFromInt(transfer.Quantity)),
			BatchNumber:    transfer.BatchNumber,
			SerialNumber:   transfer.SerialNumber,
			MovementDate:   now,
			MovedBy:        transfer.TransferredBy,
			Reason:         transfer.Reason,
			Notes:          transfer.Notes,
		}

		if err := tx.Create(outMovement).Error; err != nil {
			return fmt.Errorf("failed to create outbound movement record: %w", err)
		}
		if err := tx.Create(inMovement).Error; err != nil {
			return fmt.Errorf("failed to create inbound movement record: %w", err)
		}

		// Update cache
		if r.redis != nil {
			r.cacheStockItem(ctx, sourceStock)
			r.cacheStockItem(ctx, destStock)
		}

		r.logger.WithFields(logrus.Fields{
			"product_id":        transfer.ProductID,
			"from_warehouse_id": transfer.FromWarehouseID,
			"to_warehouse_id":   transfer.ToWarehouseID,
			"quantity":          transfer.Quantity,
		}).Info("Stock transferred successfully")

		return nil
	})
}

// ReserveStock reserves stock for a specific purpose
func (r *StockRepository) ReserveStock(ctx context.Context, reservation StockReservation) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Get stock item
		stockItem, err := r.getStockItemByLocation(ctx, tx, reservation.ProductID, reservation.WarehouseID, reservation.LocationID)
		if err != nil {
			return fmt.Errorf("failed to get stock item: %w", err)
		}
		if stockItem == nil {
			return fmt.Errorf("stock item not found")
		}

		// Check available quantity
		if stockItem.QuantityAvailable < reservation.Quantity {
			return fmt.Errorf("insufficient available quantity: have %d, need %d", stockItem.QuantityAvailable, reservation.Quantity)
		}

		// Update reserved quantity
		stockItem.QuantityReserved += reservation.Quantity
		stockItem.CalculateAvailableQuantity()

		// Save stock item
		if err := tx.Save(stockItem).Error; err != nil {
			return fmt.Errorf("failed to update stock item: %w", err)
		}

		// Create movement record
		movement := &models.StockMovement{
			MovementNumber: r.generateMovementNumber(),
			ProductID:      reservation.ProductID,
			WarehouseID:    reservation.WarehouseID,
			LocationID:     reservation.LocationID,
			MovementType:   models.MovementTypeReservation,
			Direction:      models.MovementDirectionOut,
			Quantity:       reservation.Quantity,
			UnitCost:       stockItem.AverageCost,
			TotalCost:      stockItem.AverageCost.Mul(decimal.NewFromInt(reservation.Quantity)),
			ReferenceType:  reservation.ReferenceType,
			ReferenceID:    reservation.ReferenceID,
			MovementDate:   time.Now().UTC(),
			MovedBy:        reservation.ReservedBy,
			Notes:          reservation.Notes,
		}

		if err := tx.Create(movement).Error; err != nil {
			return fmt.Errorf("failed to create movement record: %w", err)
		}

		// Update cache
		if r.redis != nil {
			r.cacheStockItem(ctx, stockItem)
		}

		r.logger.WithFields(logrus.Fields{
			"product_id":     reservation.ProductID,
			"warehouse_id":   reservation.WarehouseID,
			"quantity":       reservation.Quantity,
			"reference_type": reservation.ReferenceType,
		}).Info("Stock reserved successfully")

		return nil
	})
}

// ReleaseReservation releases reserved stock
func (r *StockRepository) ReleaseReservation(ctx context.Context, productID, warehouseID uuid.UUID, locationID *uuid.UUID, quantity int64, releasedBy *uuid.UUID, reason string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Get stock item
		stockItem, err := r.getStockItemByLocation(ctx, tx, productID, warehouseID, locationID)
		if err != nil {
			return fmt.Errorf("failed to get stock item: %w", err)
		}
		if stockItem == nil {
			return fmt.Errorf("stock item not found")
		}

		// Check reserved quantity
		if stockItem.QuantityReserved < quantity {
			return fmt.Errorf("insufficient reserved quantity: have %d, releasing %d", stockItem.QuantityReserved, quantity)
		}

		// Update reserved quantity
		stockItem.QuantityReserved -= quantity
		stockItem.CalculateAvailableQuantity()

		// Save stock item
		if err := tx.Save(stockItem).Error; err != nil {
			return fmt.Errorf("failed to update stock item: %w", err)
		}

		// Create movement record
		movement := &models.StockMovement{
			MovementNumber: r.generateMovementNumber(),
			ProductID:      productID,
			WarehouseID:    warehouseID,
			LocationID:     locationID,
			MovementType:   models.MovementTypeReservation,
			Direction:      models.MovementDirectionIn,
			Quantity:       quantity,
			UnitCost:       stockItem.AverageCost,
			TotalCost:      stockItem.AverageCost.Mul(decimal.NewFromInt(quantity)),
			MovementDate:   time.Now().UTC(),
			MovedBy:        releasedBy,
			Reason:         reason,
		}

		if err := tx.Create(movement).Error; err != nil {
			return fmt.Errorf("failed to create movement record: %w", err)
		}

		// Update cache
		if r.redis != nil {
			r.cacheStockItem(ctx, stockItem)
		}

		r.logger.WithFields(logrus.Fields{
			"product_id":   productID,
			"warehouse_id": warehouseID,
			"quantity":     quantity,
			"reason":       reason,
		}).Info("Stock reservation released successfully")

		return nil
	})
}

// GetStockValuation calculates total stock valuation
func (r *StockRepository) GetStockValuation(ctx context.Context, warehouseID *uuid.UUID) (decimal.Decimal, error) {
	query := r.db.WithContext(ctx).Model(&models.StockItem{}).
		Select("SUM(quantity_on_hand * average_cost)")

	if warehouseID != nil {
		query = query.Where("warehouse_id = ?", *warehouseID)
	}

	var valuation *decimal.Decimal
	if err := query.Scan(&valuation).Error; err != nil {
		r.logger.WithError(err).Error("Failed to calculate stock valuation")
		return decimal.Zero, fmt.Errorf("failed to calculate stock valuation: %w", err)
	}

	if valuation == nil {
		return decimal.Zero, nil
	}

	return *valuation, nil
}

// BulkAdjustStock performs bulk stock adjustments
func (r *StockRepository) BulkAdjustStock(ctx context.Context, adjustments []StockAdjustment) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, adjustment := range adjustments {
			if err := r.AdjustStock(ctx, adjustment); err != nil {
				return fmt.Errorf("failed to adjust stock for product %s: %w", adjustment.ProductID, err)
			}
		}

		r.logger.WithField("count", len(adjustments)).Info("Bulk stock adjustments completed successfully")
		return nil
	})
}

// Helper methods

// applyStockFilters applies filters to the query
func (r *StockRepository) applyStockFilters(query *gorm.DB, filter StockFilter) *gorm.DB {
	if filter.ProductID != nil {
		query = query.Where("product_id = ?", *filter.ProductID)
	}

	if filter.WarehouseID != nil {
		query = query.Where("warehouse_id = ?", *filter.WarehouseID)
	}

	if filter.LocationID != nil {
		query = query.Where("location_id = ?", *filter.LocationID)
	}

	if filter.MinQuantity != nil {
		query = query.Where("quantity_on_hand >= ?", *filter.MinQuantity)
	}

	if filter.MaxQuantity != nil {
		query = query.Where("quantity_on_hand <= ?", *filter.MaxQuantity)
	}

	if filter.MinAvailable != nil {
		query = query.Where("quantity_available >= ?", *filter.MinAvailable)
	}

	if filter.MaxAvailable != nil {
		query = query.Where("quantity_available <= ?", *filter.MaxAvailable)
	}

	if filter.LowStock != nil && *filter.LowStock {
		query = query.Where("quantity_available <= reorder_level AND quantity_available > 0")
	}

	if filter.OutOfStock != nil && *filter.OutOfStock {
		query = query.Where("quantity_available <= 0")
	}

	if filter.NegativeStock != nil && *filter.NegativeStock {
		query = query.Where("quantity_available < 0")
	}

	if filter.HasReservations != nil && *filter.HasReservations {
		query = query.Where("quantity_reserved > 0")
	}

	if filter.HasAllocations != nil && *filter.HasAllocations {
		query = query.Where("quantity_allocated > 0")
	}

	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if filter.IsTracked != nil {
		query = query.Where("is_tracked = ?", *filter.IsTracked)
	}

	if filter.LastCountedAfter != nil {
		query = query.Where("last_counted >= ?", *filter.LastCountedAfter)
	}

	if filter.LastCountedBefore != nil {
		query = query.Where("last_counted <= ?", *filter.LastCountedBefore)
	}

	if filter.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filter.CreatedAfter)
	}

	if filter.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filter.CreatedBefore)
	}

	return query
}

// getOrCreateStockItem gets or creates a stock item
func (r *StockRepository) getOrCreateStockItem(ctx context.Context, tx *gorm.DB, productID, warehouseID uuid.UUID, locationID *uuid.UUID) (*models.StockItem, error) {
	var stockItem models.StockItem
	
	query := tx.Where("product_id = ? AND warehouse_id = ?", productID, warehouseID)
	if locationID != nil {
		query = query.Where("location_id = ?", *locationID)
	} else {
		query = query.Where("location_id IS NULL")
	}

	err := query.First(&stockItem).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create new stock item
			stockItem = models.StockItem{
				ProductID:   productID,
				WarehouseID: warehouseID,
				LocationID:  locationID,
				IsActive:    true,
				IsTracked:   true,
			}
			if err := tx.Create(&stockItem).Error; err != nil {
				return nil, fmt.Errorf("failed to create stock item: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to get stock item: %w", err)
		}
	}

	return &stockItem, nil
}

// getStockItemByLocation gets a stock item by location
func (r *StockRepository) getStockItemByLocation(ctx context.Context, tx *gorm.DB, productID, warehouseID uuid.UUID, locationID *uuid.UUID) (*models.StockItem, error) {
	var stockItem models.StockItem
	
	query := tx.Where("product_id = ? AND warehouse_id = ?", productID, warehouseID)
	if locationID != nil {
		query = query.Where("location_id = ?", *locationID)
	} else {
		query = query.Where("location_id IS NULL")
	}

	err := query.First(&stockItem).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get stock item: %w", err)
	}

	return &stockItem, nil
}

// generateMovementNumber generates a unique movement number
func (r *StockRepository) generateMovementNumber() string {
	return fmt.Sprintf("MOV-%s-%s", time.Now().Format("20060102"), uuid.New().String()[:8])
}

// cacheStockItem caches a stock item
func (r *StockRepository) cacheStockItem(ctx context.Context, stockItem *models.StockItem) {
	if r.redis == nil {
		return
	}

	data, err := json.Marshal(stockItem)
	if err != nil {
		r.logger.WithError(err).Warn("Failed to marshal stock item for cache")
		return
	}

	cacheKey := StockCacheKey(stockItem.ProductID.String(), stockItem.WarehouseID.String())
	if stockItem.LocationID != nil {
		cacheKey = fmt.Sprintf("%s:%s", cacheKey, stockItem.LocationID.String())
	}

	if err := r.redis.Set(ctx, cacheKey, data, time.Hour).Err(); err != nil {
		r.logger.WithError(err).Warn("Failed to cache stock item")
	}
}

// getStockItemFromCache retrieves a stock item from cache
func (r *StockRepository) getStockItemFromCache(ctx context.Context, cacheKey string) (*models.StockItem, error) {
	if r.redis == nil {
		return nil, fmt.Errorf("redis not available")
	}

	data, err := r.redis.Get(ctx, cacheKey).Result()
	if err != nil {
		return nil, err
	}

	var stockItem models.StockItem
	if err := json.Unmarshal([]byte(data), &stockItem); err != nil {
		return nil, err
	}

	return &stockItem, nil
}

