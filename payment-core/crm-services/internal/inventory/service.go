package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/enterprise-crm/inventory-service/internal/models"
	"github.com/enterprise-crm/inventory-service/internal/repository"
)

// InventoryService handles inventory business logic
type InventoryService struct {
	productRepo      *repository.ProductRepository
	supplierRepo     *repository.SupplierRepository
	warehouseRepo    *repository.WarehouseRepository
	stockRepo        *repository.StockRepository
	categoryRepo     *repository.CategoryRepository
	brandRepo        *repository.BrandRepository
	manufacturerRepo *repository.ManufacturerRepository
	movementRepo     *repository.MovementRepository
	logger           *logrus.Logger
}

// NewInventoryService creates a new inventory service
func NewInventoryService(
	productRepo *repository.ProductRepository,
	supplierRepo *repository.SupplierRepository,
	warehouseRepo *repository.WarehouseRepository,
	stockRepo *repository.StockRepository,
	categoryRepo *repository.CategoryRepository,
	brandRepo *repository.BrandRepository,
	manufacturerRepo *repository.ManufacturerRepository,
	movementRepo *repository.MovementRepository,
	logger *logrus.Logger,
) *InventoryService {
	return &InventoryService{
		productRepo:      productRepo,
		supplierRepo:     supplierRepo,
		warehouseRepo:    warehouseRepo,
		stockRepo:        stockRepo,
		categoryRepo:     categoryRepo,
		brandRepo:        brandRepo,
		manufacturerRepo: manufacturerRepo,
		movementRepo:     movementRepo,
		logger:           logger,
	}
}

// Product Management

// CreateProduct creates a new product with validation
func (s *InventoryService) CreateProduct(ctx context.Context, product *models.Product) error {
	// Validate product data
	if err := s.validateProduct(ctx, product); err != nil {
		return fmt.Errorf("product validation failed: %w", err)
	}

	// Generate SKU if not provided
	if product.SKU == "" {
		product.SKU = s.generateSKU(product)
	}

	// Check SKU uniqueness
	if err := s.validateSKUUniqueness(ctx, product.SKU, nil); err != nil {
		return err
	}

	// Create product
	if err := s.productRepo.Create(ctx, product); err != nil {
		return fmt.Errorf("failed to create product: %w", err)
	}

	s.logger.WithField("product_id", product.ID).Info("Product created successfully")
	return nil
}

// UpdateProduct updates a product with validation
func (s *InventoryService) UpdateProduct(ctx context.Context, product *models.Product) error {
	// Validate product data
	if err := s.validateProduct(ctx, product); err != nil {
		return fmt.Errorf("product validation failed: %w", err)
	}

	// Check SKU uniqueness
	if err := s.validateSKUUniqueness(ctx, product.SKU, &product.ID); err != nil {
		return err
	}

	// Update product
	if err := s.productRepo.Update(ctx, product); err != nil {
		return fmt.Errorf("failed to update product: %w", err)
	}

	s.logger.WithField("product_id", product.ID).Info("Product updated successfully")
	return nil
}

// GetProduct retrieves a product by ID
func (s *InventoryService) GetProduct(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	product, err := s.productRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get product: %w", err)
	}
	if product == nil {
		return nil, fmt.Errorf("product not found")
	}
	return product, nil
}

// GetProductBySKU retrieves a product by SKU
func (s *InventoryService) GetProductBySKU(ctx context.Context, sku string) (*models.Product, error) {
	product, err := s.productRepo.GetBySKU(ctx, sku)
	if err != nil {
		return nil, fmt.Errorf("failed to get product by SKU: %w", err)
	}
	if product == nil {
		return nil, fmt.Errorf("product not found")
	}
	return product, nil
}

// DeleteProduct soft deletes a product
func (s *InventoryService) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	// Check if product has stock
	stockItems, err := s.stockRepo.GetByProduct(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check product stock: %w", err)
	}

	// Check if any stock item has quantity
	for _, stockItem := range stockItems {
		if stockItem.QuantityOnHand > 0 {
			return fmt.Errorf("cannot delete product with existing stock")
		}
	}

	// Delete product
	if err := s.productRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}

	s.logger.WithField("product_id", id).Info("Product deleted successfully")
	return nil
}

// Stock Management

// AdjustStock adjusts stock quantity with validation
func (s *InventoryService) AdjustStock(ctx context.Context, adjustment repository.StockAdjustment) error {
	// Validate adjustment
	if err := s.validateStockAdjustment(ctx, adjustment); err != nil {
		return fmt.Errorf("stock adjustment validation failed: %w", err)
	}

	// Perform adjustment
	if err := s.stockRepo.AdjustStock(ctx, adjustment); err != nil {
		return fmt.Errorf("failed to adjust stock: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"product_id":   adjustment.ProductID,
		"warehouse_id": adjustment.WarehouseID,
		"quantity":     adjustment.Quantity,
		"reason":       adjustment.Reason,
	}).Info("Stock adjusted successfully")

	return nil
}

// TransferStock transfers stock between warehouses/locations
func (s *InventoryService) TransferStock(ctx context.Context, transfer repository.StockTransfer) error {
	// Validate transfer
	if err := s.validateStockTransfer(ctx, transfer); err != nil {
		return fmt.Errorf("stock transfer validation failed: %w", err)
	}

	// Perform transfer
	if err := s.stockRepo.TransferStock(ctx, transfer); err != nil {
		return fmt.Errorf("failed to transfer stock: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"product_id":        transfer.ProductID,
		"from_warehouse_id": transfer.FromWarehouseID,
		"to_warehouse_id":   transfer.ToWarehouseID,
		"quantity":          transfer.Quantity,
	}).Info("Stock transferred successfully")

	return nil
}

// ReserveStock reserves stock for orders/allocations
func (s *InventoryService) ReserveStock(ctx context.Context, reservation repository.StockReservation) error {
	// Validate reservation
	if err := s.validateStockReservation(ctx, reservation); err != nil {
		return fmt.Errorf("stock reservation validation failed: %w", err)
	}

	// Perform reservation
	if err := s.stockRepo.ReserveStock(ctx, reservation); err != nil {
		return fmt.Errorf("failed to reserve stock: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"product_id":     reservation.ProductID,
		"warehouse_id":   reservation.WarehouseID,
		"quantity":       reservation.Quantity,
		"reference_type": reservation.ReferenceType,
	}).Info("Stock reserved successfully")

	return nil
}

// ReleaseReservation releases reserved stock
func (s *InventoryService) ReleaseReservation(ctx context.Context, productID, warehouseID uuid.UUID, locationID *uuid.UUID, quantity int64, releasedBy *uuid.UUID, reason string) error {
	// Validate release
	if quantity <= 0 {
		return fmt.Errorf("quantity must be positive")
	}

	// Perform release
	if err := s.stockRepo.ReleaseReservation(ctx, productID, warehouseID, locationID, quantity, releasedBy, reason); err != nil {
		return fmt.Errorf("failed to release reservation: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"product_id":   productID,
		"warehouse_id": warehouseID,
		"quantity":     quantity,
		"reason":       reason,
	}).Info("Stock reservation released successfully")

	return nil
}

// GetStockLevel retrieves current stock level for a product
func (s *InventoryService) GetStockLevel(ctx context.Context, productID, warehouseID uuid.UUID, locationID *uuid.UUID) (*models.StockItem, error) {
	stockItem, err := s.stockRepo.GetByProductAndWarehouse(ctx, productID, warehouseID, locationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get stock level: %w", err)
	}
	return stockItem, nil
}

// GetLowStockItems retrieves items with low stock
func (s *InventoryService) GetLowStockItems(ctx context.Context, pagination repository.Pagination) ([]*models.StockItem, int64, error) {
	stockItems, total, err := s.stockRepo.GetLowStock(ctx, pagination)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get low stock items: %w", err)
	}
	return stockItems, total, nil
}

// GetOutOfStockItems retrieves items that are out of stock
func (s *InventoryService) GetOutOfStockItems(ctx context.Context, pagination repository.Pagination) ([]*models.StockItem, int64, error) {
	stockItems, total, err := s.stockRepo.GetOutOfStock(ctx, pagination)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get out of stock items: %w", err)
	}
	return stockItems, total, nil
}

// Supplier Management

// CreateSupplier creates a new supplier with validation
func (s *InventoryService) CreateSupplier(ctx context.Context, supplier *models.Supplier) error {
	// Validate supplier data
	if err := s.validateSupplier(ctx, supplier); err != nil {
		return fmt.Errorf("supplier validation failed: %w", err)
	}

	// Generate supplier number if not provided
	if supplier.SupplierNumber == "" {
		supplier.SupplierNumber = s.generateSupplierNumber()
	}

	// Check supplier number uniqueness
	if err := s.validateSupplierNumberUniqueness(ctx, supplier.SupplierNumber, nil); err != nil {
		return err
	}

	// Create supplier
	if err := s.supplierRepo.Create(ctx, supplier); err != nil {
		return fmt.Errorf("failed to create supplier: %w", err)
	}

	s.logger.WithField("supplier_id", supplier.ID).Info("Supplier created successfully")
	return nil
}

// UpdateSupplierPerformance updates supplier performance metrics
func (s *InventoryService) UpdateSupplierPerformance(ctx context.Context, supplierID uuid.UUID, rating, onTimeDelivery, qualityScore float64) error {
	// Validate metrics
	if rating < 0 || rating > 5 {
		return fmt.Errorf("rating must be between 0 and 5")
	}
	if onTimeDelivery < 0 || onTimeDelivery > 100 {
		return fmt.Errorf("on-time delivery must be between 0 and 100")
	}
	if qualityScore < 0 || qualityScore > 100 {
		return fmt.Errorf("quality score must be between 0 and 100")
	}

	// Update performance
	if err := s.supplierRepo.UpdatePerformanceMetrics(ctx, supplierID, rating, onTimeDelivery, qualityScore); err != nil {
		return fmt.Errorf("failed to update supplier performance: %w", err)
	}

	s.logger.WithField("supplier_id", supplierID).Info("Supplier performance updated successfully")
	return nil
}

// Warehouse Management

// CreateWarehouse creates a new warehouse with validation
func (s *InventoryService) CreateWarehouse(ctx context.Context, warehouse *models.Warehouse) error {
	// Validate warehouse data
	if err := s.validateWarehouse(ctx, warehouse); err != nil {
		return fmt.Errorf("warehouse validation failed: %w", err)
	}

	// Generate warehouse number if not provided
	if warehouse.WarehouseNumber == "" {
		warehouse.WarehouseNumber = s.generateWarehouseNumber()
	}

	// Check warehouse number uniqueness
	if err := s.validateWarehouseNumberUniqueness(ctx, warehouse.WarehouseNumber, nil); err != nil {
		return err
	}

	// Create warehouse
	if err := s.warehouseRepo.Create(ctx, warehouse); err != nil {
		return fmt.Errorf("failed to create warehouse: %w", err)
	}

	s.logger.WithField("warehouse_id", warehouse.ID).Info("Warehouse created successfully")
	return nil
}

// UpdateWarehouseCapacity updates warehouse capacity
func (s *InventoryService) UpdateWarehouseCapacity(ctx context.Context, warehouseID uuid.UUID, totalCapacity, usedCapacity float64) error {
	// Validate capacity
	if totalCapacity < 0 {
		return fmt.Errorf("total capacity cannot be negative")
	}
	if usedCapacity < 0 {
		return fmt.Errorf("used capacity cannot be negative")
	}
	if usedCapacity > totalCapacity {
		return fmt.Errorf("used capacity cannot exceed total capacity")
	}

	// Update capacity
	if err := s.warehouseRepo.UpdateCapacity(ctx, warehouseID, totalCapacity, usedCapacity); err != nil {
		return fmt.Errorf("failed to update warehouse capacity: %w", err)
	}

	s.logger.WithField("warehouse_id", warehouseID).Info("Warehouse capacity updated successfully")
	return nil
}

// Analytics and Reporting

// GetInventoryDashboard retrieves comprehensive inventory dashboard data
func (s *InventoryService) GetInventoryDashboard(ctx context.Context) (*InventoryDashboard, error) {
	dashboard := &InventoryDashboard{}

	// Get product stats
	productStats, err := s.productRepo.GetStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get product stats: %w", err)
	}
	dashboard.ProductStats = productStats

	// Get stock stats
	stockStats, err := s.stockRepo.GetStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get stock stats: %w", err)
	}
	dashboard.StockStats = stockStats

	// Get supplier stats
	supplierStats, err := s.supplierRepo.GetStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get supplier stats: %w", err)
	}
	dashboard.SupplierStats = supplierStats

	// Get warehouse stats
	warehouseStats, err := s.warehouseRepo.GetStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get warehouse stats: %w", err)
	}
	dashboard.WarehouseStats = warehouseStats

	// Get movement stats
	movementStats, err := s.movementRepo.GetStats(ctx, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get movement stats: %w", err)
	}
	dashboard.MovementStats = movementStats

	// Get category stats
	categoryStats, err := s.categoryRepo.GetStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get category stats: %w", err)
	}
	dashboard.CategoryStats = categoryStats

	return dashboard, nil
}

// GetStockValuation calculates total stock valuation
func (s *InventoryService) GetStockValuation(ctx context.Context, warehouseID *uuid.UUID) (decimal.Decimal, error) {
	valuation, err := s.stockRepo.GetStockValuation(ctx, warehouseID)
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to get stock valuation: %w", err)
	}
	return valuation, nil
}

// Validation methods

// validateProduct validates product data
func (s *InventoryService) validateProduct(ctx context.Context, product *models.Product) error {
	if product.Name == "" {
		return fmt.Errorf("product name is required")
	}
	if product.Type == "" {
		return fmt.Errorf("product type is required")
	}
	if product.Status == "" {
		return fmt.Errorf("product status is required")
	}
	if product.CategoryID != nil {
		// Validate category exists
		category, err := s.categoryRepo.GetByID(ctx, *product.CategoryID)
		if err != nil {
			return fmt.Errorf("failed to validate category: %w", err)
		}
		if category == nil {
			return fmt.Errorf("category not found")
		}
	}
	if product.BrandID != nil {
		// Validate brand exists
		brand, err := s.brandRepo.GetByID(ctx, *product.BrandID)
		if err != nil {
			return fmt.Errorf("failed to validate brand: %w", err)
		}
		if brand == nil {
			return fmt.Errorf("brand not found")
		}
	}
	if product.ManufacturerID != nil {
		// Validate manufacturer exists
		manufacturer, err := s.manufacturerRepo.GetByID(ctx, *product.ManufacturerID)
		if err != nil {
			return fmt.Errorf("failed to validate manufacturer: %w", err)
		}
		if manufacturer == nil {
			return fmt.Errorf("manufacturer not found")
		}
	}
	return nil
}

// validateSKUUniqueness validates SKU uniqueness
func (s *InventoryService) validateSKUUniqueness(ctx context.Context, sku string, excludeID *uuid.UUID) error {
	existing, err := s.productRepo.GetBySKU(ctx, sku)
	if err != nil {
		return fmt.Errorf("failed to check SKU uniqueness: %w", err)
	}
	if existing != nil && (excludeID == nil || existing.ID != *excludeID) {
		return fmt.Errorf("SKU already exists")
	}
	return nil
}

// validateStockAdjustment validates stock adjustment
func (s *InventoryService) validateStockAdjustment(ctx context.Context, adjustment repository.StockAdjustment) error {
	if adjustment.Quantity == 0 {
		return fmt.Errorf("quantity cannot be zero")
	}
	if adjustment.Reason == "" {
		return fmt.Errorf("reason is required")
	}
	
	// Validate product exists
	product, err := s.productRepo.GetByID(ctx, adjustment.ProductID)
	if err != nil {
		return fmt.Errorf("failed to validate product: %w", err)
	}
	if product == nil {
		return fmt.Errorf("product not found")
	}

	// Validate warehouse exists
	warehouse, err := s.warehouseRepo.GetByID(ctx, adjustment.WarehouseID)
	if err != nil {
		return fmt.Errorf("failed to validate warehouse: %w", err)
	}
	if warehouse == nil {
		return fmt.Errorf("warehouse not found")
	}

	return nil
}

// validateStockTransfer validates stock transfer
func (s *InventoryService) validateStockTransfer(ctx context.Context, transfer repository.StockTransfer) error {
	if transfer.Quantity <= 0 {
		return fmt.Errorf("quantity must be positive")
	}
	if transfer.FromWarehouseID == transfer.ToWarehouseID {
		return fmt.Errorf("source and destination warehouses cannot be the same")
	}
	
	// Validate product exists
	product, err := s.productRepo.GetByID(ctx, transfer.ProductID)
	if err != nil {
		return fmt.Errorf("failed to validate product: %w", err)
	}
	if product == nil {
		return fmt.Errorf("product not found")
	}

	// Validate warehouses exist
	fromWarehouse, err := s.warehouseRepo.GetByID(ctx, transfer.FromWarehouseID)
	if err != nil {
		return fmt.Errorf("failed to validate source warehouse: %w", err)
	}
	if fromWarehouse == nil {
		return fmt.Errorf("source warehouse not found")
	}

	toWarehouse, err := s.warehouseRepo.GetByID(ctx, transfer.ToWarehouseID)
	if err != nil {
		return fmt.Errorf("failed to validate destination warehouse: %w", err)
	}
	if toWarehouse == nil {
		return fmt.Errorf("destination warehouse not found")
	}

	return nil
}

// validateStockReservation validates stock reservation
func (s *InventoryService) validateStockReservation(ctx context.Context, reservation repository.StockReservation) error {
	if reservation.Quantity <= 0 {
		return fmt.Errorf("quantity must be positive")
	}
	if reservation.ReferenceType == "" {
		return fmt.Errorf("reference type is required")
	}
	
	// Validate product exists
	product, err := s.productRepo.GetByID(ctx, reservation.ProductID)
	if err != nil {
		return fmt.Errorf("failed to validate product: %w", err)
	}
	if product == nil {
		return fmt.Errorf("product not found")
	}

	// Validate warehouse exists
	warehouse, err := s.warehouseRepo.GetByID(ctx, reservation.WarehouseID)
	if err != nil {
		return fmt.Errorf("failed to validate warehouse: %w", err)
	}
	if warehouse == nil {
		return fmt.Errorf("warehouse not found")
	}

	return nil
}

// validateSupplier validates supplier data
func (s *InventoryService) validateSupplier(ctx context.Context, supplier *models.Supplier) error {
	if supplier.Name == "" {
		return fmt.Errorf("supplier name is required")
	}
	if supplier.Type == "" {
		return fmt.Errorf("supplier type is required")
	}
	if supplier.Status == "" {
		return fmt.Errorf("supplier status is required")
	}
	return nil
}

// validateSupplierNumberUniqueness validates supplier number uniqueness
func (s *InventoryService) validateSupplierNumberUniqueness(ctx context.Context, supplierNumber string, excludeID *uuid.UUID) error {
	existing, err := s.supplierRepo.GetBySupplierNumber(ctx, supplierNumber)
	if err != nil {
		return fmt.Errorf("failed to check supplier number uniqueness: %w", err)
	}
	if existing != nil && (excludeID == nil || existing.ID != *excludeID) {
		return fmt.Errorf("supplier number already exists")
	}
	return nil
}

// validateWarehouse validates warehouse data
func (s *InventoryService) validateWarehouse(ctx context.Context, warehouse *models.Warehouse) error {
	if warehouse.Name == "" {
		return fmt.Errorf("warehouse name is required")
	}
	if warehouse.Type == "" {
		return fmt.Errorf("warehouse type is required")
	}
	if warehouse.Status == "" {
		return fmt.Errorf("warehouse status is required")
	}
	return nil
}

// validateWarehouseNumberUniqueness validates warehouse number uniqueness
func (s *InventoryService) validateWarehouseNumberUniqueness(ctx context.Context, warehouseNumber string, excludeID *uuid.UUID) error {
	existing, err := s.warehouseRepo.GetByWarehouseNumber(ctx, warehouseNumber)
	if err != nil {
		return fmt.Errorf("failed to check warehouse number uniqueness: %w", err)
	}
	if existing != nil && (excludeID == nil || existing.ID != *excludeID) {
		return fmt.Errorf("warehouse number already exists")
	}
	return nil
}

// Helper methods

// generateSKU generates a SKU for a product
func (s *InventoryService) generateSKU(product *models.Product) string {
	timestamp := time.Now().Format("060102")
	return fmt.Sprintf("SKU-%s-%s", timestamp, uuid.New().String()[:8])
}

// generateSupplierNumber generates a supplier number
func (s *InventoryService) generateSupplierNumber() string {
	timestamp := time.Now().Format("060102")
	return fmt.Sprintf("SUP-%s-%s", timestamp, uuid.New().String()[:8])
}

// generateWarehouseNumber generates a warehouse number
func (s *InventoryService) generateWarehouseNumber() string {
	timestamp := time.Now().Format("060102")
	return fmt.Sprintf("WH-%s-%s", timestamp, uuid.New().String()[:8])
}

// InventoryDashboard represents comprehensive inventory dashboard data
type InventoryDashboard struct {
	ProductStats   *repository.ProductStats   `json:"product_stats"`
	StockStats     *repository.StockStats     `json:"stock_stats"`
	SupplierStats  *repository.SupplierStats  `json:"supplier_stats"`
	WarehouseStats *repository.WarehouseStats `json:"warehouse_stats"`
	MovementStats  *repository.MovementStats  `json:"movement_stats"`
	CategoryStats  *repository.CategoryStats  `json:"category_stats"`
}

