package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/repository"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/service"
)

// StockHandler handles stock HTTP requests
type StockHandler struct {
	inventoryService *service.InventoryService
	stockRepo        *repository.StockRepository
	logger           *logrus.Logger
}

// NewStockHandler creates a new stock handler
func NewStockHandler(inventoryService *service.InventoryService, stockRepo *repository.StockRepository, logger *logrus.Logger) *StockHandler {
	return &StockHandler{
		inventoryService: inventoryService,
		stockRepo:        stockRepo,
		logger:           logger,
	}
}

// GetStockItem retrieves a stock item by ID
// @Summary Get stock item by ID
// @Description Retrieve a stock item by its ID
// @Tags stock
// @Produce json
// @Param id path string true "Stock Item ID"
// @Success 200 {object} models.StockItem
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/{id} [get]
func (h *StockHandler) GetStockItem(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid stock item ID",
			Message: "Stock item ID must be a valid UUID",
		})
		return
	}

	stockItem, err := h.stockRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get stock item")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve stock item",
			Message: err.Error(),
		})
		return
	}

	if stockItem == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Stock item not found",
			Message: "Stock item with the specified ID does not exist",
		})
		return
	}

	c.JSON(http.StatusOK, stockItem)
}

// GetStockLevel retrieves stock level for a product in a warehouse
// @Summary Get stock level
// @Description Retrieve stock level for a product in a specific warehouse/location
// @Tags stock
// @Produce json
// @Param product_id query string true "Product ID"
// @Param warehouse_id query string true "Warehouse ID"
// @Param location_id query string false "Location ID"
// @Success 200 {object} models.StockItem
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/level [get]
func (h *StockHandler) GetStockLevel(c *gin.Context) {
	productIDStr := c.Query("product_id")
	warehouseIDStr := c.Query("warehouse_id")
	locationIDStr := c.Query("location_id")

	if productIDStr == "" || warehouseIDStr == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Missing required parameters",
			Message: "product_id and warehouse_id are required",
		})
		return
	}

	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid product ID",
			Message: "Product ID must be a valid UUID",
		})
		return
	}

	warehouseID, err := uuid.Parse(warehouseIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid warehouse ID",
			Message: "Warehouse ID must be a valid UUID",
		})
		return
	}

	var locationID *uuid.UUID
	if locationIDStr != "" {
		if id, err := uuid.Parse(locationIDStr); err == nil {
			locationID = &id
		} else {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Invalid location ID",
				Message: "Location ID must be a valid UUID",
			})
			return
		}
	}

	stockItem, err := h.inventoryService.GetStockLevel(c.Request.Context(), productID, warehouseID, locationID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get stock level")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve stock level",
			Message: err.Error(),
		})
		return
	}

	if stockItem == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Stock item not found",
			Message: "No stock found for the specified product and warehouse",
		})
		return
	}

	c.JSON(http.StatusOK, stockItem)
}

// ListStock lists stock items with filtering and pagination
// @Summary List stock items
// @Description List stock items with filtering and pagination
// @Tags stock
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param product_id query string false "Filter by product ID"
// @Param warehouse_id query string false "Filter by warehouse ID"
// @Param location_id query string false "Filter by location ID"
// @Param low_stock query bool false "Filter low stock items"
// @Param out_of_stock query bool false "Filter out of stock items"
// @Success 200 {object} PaginatedResponse{data=[]models.StockItem}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock [get]
func (h *StockHandler) ListStock(c *gin.Context) {
	// Parse pagination
	pagination, err := ParsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid pagination parameters",
			Message: err.Error(),
		})
		return
	}

	// Parse filters
	filter := repository.StockFilter{}

	if productIDStr := c.Query("product_id"); productIDStr != "" {
		if id, err := uuid.Parse(productIDStr); err == nil {
			filter.ProductID = &id
		}
	}

	if warehouseIDStr := c.Query("warehouse_id"); warehouseIDStr != "" {
		if id, err := uuid.Parse(warehouseIDStr); err == nil {
			filter.WarehouseID = &id
		}
	}

	if locationIDStr := c.Query("location_id"); locationIDStr != "" {
		if id, err := uuid.Parse(locationIDStr); err == nil {
			filter.LocationID = &id
		}
	}

	// Parse boolean filters
	if lowStockStr := c.Query("low_stock"); lowStockStr != "" {
		if lowStock, err := strconv.ParseBool(lowStockStr); err == nil {
			filter.LowStock = &lowStock
		}
	}

	if outOfStockStr := c.Query("out_of_stock"); outOfStockStr != "" {
		if outOfStock, err := strconv.ParseBool(outOfStockStr); err == nil {
			filter.OutOfStock = &outOfStock
		}
	}

	stockItems, total, err := h.stockRepo.List(c.Request.Context(), filter, pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to list stock items")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve stock items",
			Message: err.Error(),
		})
		return
	}

	response := PaginatedResponse{
		Data:       stockItems,
		Total:      total,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		TotalPages: (total + int64(pagination.Limit) - 1) / int64(pagination.Limit),
	}

	c.JSON(http.StatusOK, response)
}

// GetLowStock retrieves items with low stock
// @Summary Get low stock items
// @Description Retrieve items with low stock levels
// @Tags stock
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} PaginatedResponse{data=[]models.StockItem}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/low-stock [get]
func (h *StockHandler) GetLowStock(c *gin.Context) {
	// Parse pagination
	pagination, err := ParsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid pagination parameters",
			Message: err.Error(),
		})
		return
	}

	stockItems, total, err := h.inventoryService.GetLowStockItems(c.Request.Context(), pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get low stock items")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve low stock items",
			Message: err.Error(),
		})
		return
	}

	response := PaginatedResponse{
		Data:       stockItems,
		Total:      total,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		TotalPages: (total + int64(pagination.Limit) - 1) / int64(pagination.Limit),
	}

	c.JSON(http.StatusOK, response)
}

// GetOutOfStock retrieves items that are out of stock
// @Summary Get out of stock items
// @Description Retrieve items that are out of stock
// @Tags stock
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} PaginatedResponse{data=[]models.StockItem}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/out-of-stock [get]
func (h *StockHandler) GetOutOfStock(c *gin.Context) {
	// Parse pagination
	pagination, err := ParsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid pagination parameters",
			Message: err.Error(),
		})
		return
	}

	stockItems, total, err := h.inventoryService.GetOutOfStockItems(c.Request.Context(), pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get out of stock items")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve out of stock items",
			Message: err.Error(),
		})
		return
	}

	response := PaginatedResponse{
		Data:       stockItems,
		Total:      total,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		TotalPages: (total + int64(pagination.Limit) - 1) / int64(pagination.Limit),
	}

	c.JSON(http.StatusOK, response)
}

// AdjustStock adjusts stock quantity
// @Summary Adjust stock
// @Description Adjust stock quantity with reason and audit trail
// @Tags stock
// @Accept json
// @Produce json
// @Param adjustment body StockAdjustmentRequest true "Stock adjustment data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/adjust [post]
func (h *StockHandler) AdjustStock(c *gin.Context) {
	var req StockAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind stock adjustment data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Convert to repository struct
	adjustment := repository.StockAdjustment{
		ProductID:    req.ProductID,
		WarehouseID:  req.WarehouseID,
		LocationID:   req.LocationID,
		Quantity:     req.Quantity,
		Reason:       req.Reason,
		UnitCost:     req.UnitCost,
		BatchNumber:  req.BatchNumber,
		SerialNumber: req.SerialNumber,
		ExpiryDate:   req.ExpiryDate,
		AdjustedBy:   req.AdjustedBy,
		Notes:        req.Notes,
	}

	if err := h.inventoryService.AdjustStock(c.Request.Context(), adjustment); err != nil {
		h.logger.WithError(err).Error("Failed to adjust stock")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to adjust stock",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Stock adjusted successfully",
	})
}

// TransferStock transfers stock between warehouses/locations
// @Summary Transfer stock
// @Description Transfer stock between warehouses or locations
// @Tags stock
// @Accept json
// @Produce json
// @Param transfer body StockTransferRequest true "Stock transfer data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/transfer [post]
func (h *StockHandler) TransferStock(c *gin.Context) {
	var req StockTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind stock transfer data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Convert to repository struct
	transfer := repository.StockTransfer{
		ProductID:       req.ProductID,
		FromWarehouseID: req.FromWarehouseID,
		ToWarehouseID:   req.ToWarehouseID,
		FromLocationID:  req.FromLocationID,
		ToLocationID:    req.ToLocationID,
		Quantity:        req.Quantity,
		Reason:          req.Reason,
		BatchNumber:     req.BatchNumber,
		SerialNumber:    req.SerialNumber,
		TransferredBy:   req.TransferredBy,
		Notes:           req.Notes,
	}

	if err := h.inventoryService.TransferStock(c.Request.Context(), transfer); err != nil {
		h.logger.WithError(err).Error("Failed to transfer stock")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to transfer stock",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Stock transferred successfully",
	})
}

// ReserveStock reserves stock for orders/allocations
// @Summary Reserve stock
// @Description Reserve stock for orders or allocations
// @Tags stock
// @Accept json
// @Produce json
// @Param reservation body StockReservationRequest true "Stock reservation data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/reserve [post]
func (h *StockHandler) ReserveStock(c *gin.Context) {
	var req StockReservationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind stock reservation data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Convert to repository struct
	reservation := repository.StockReservation{
		ProductID:     req.ProductID,
		WarehouseID:   req.WarehouseID,
		LocationID:    req.LocationID,
		Quantity:      req.Quantity,
		ReferenceType: req.ReferenceType,
		ReferenceID:   req.ReferenceID,
		ReservedBy:    req.ReservedBy,
		ExpiresAt:     req.ExpiresAt,
		Notes:         req.Notes,
	}

	if err := h.inventoryService.ReserveStock(c.Request.Context(), reservation); err != nil {
		h.logger.WithError(err).Error("Failed to reserve stock")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to reserve stock",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Stock reserved successfully",
	})
}

// ReleaseReservation releases reserved stock
// @Summary Release stock reservation
// @Description Release reserved stock back to available inventory
// @Tags stock
// @Accept json
// @Produce json
// @Param release body StockReleaseRequest true "Stock release data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/release [post]
func (h *StockHandler) ReleaseReservation(c *gin.Context) {
	var req StockReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind stock release data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	if err := h.inventoryService.ReleaseReservation(
		c.Request.Context(),
		req.ProductID,
		req.WarehouseID,
		req.LocationID,
		req.Quantity,
		req.ReleasedBy,
		req.Reason,
	); err != nil {
		h.logger.WithError(err).Error("Failed to release reservation")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to release reservation",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Stock reservation released successfully",
	})
}

// GetStockStats retrieves stock statistics
// @Summary Get stock statistics
// @Description Retrieve comprehensive stock statistics
// @Tags stock
// @Produce json
// @Success 200 {object} repository.StockStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/stats [get]
func (h *StockHandler) GetStockStats(c *gin.Context) {
	stats, err := h.stockRepo.GetStats(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get stock stats")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve stock statistics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetStockValuation calculates stock valuation
// @Summary Get stock valuation
// @Description Calculate total stock valuation
// @Tags stock
// @Produce json
// @Param warehouse_id query string false "Filter by warehouse ID"
// @Success 200 {object} StockValuationResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/valuation [get]
func (h *StockHandler) GetStockValuation(c *gin.Context) {
	var warehouseID *uuid.UUID
	if warehouseIDStr := c.Query("warehouse_id"); warehouseIDStr != "" {
		if id, err := uuid.Parse(warehouseIDStr); err == nil {
			warehouseID = &id
		} else {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Invalid warehouse ID",
				Message: "Warehouse ID must be a valid UUID",
			})
			return
		}
	}

	valuation, err := h.inventoryService.GetStockValuation(c.Request.Context(), warehouseID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get stock valuation")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to calculate stock valuation",
			Message: err.Error(),
		})
		return
	}

	response := StockValuationResponse{
		TotalValuation: valuation,
		WarehouseID:    warehouseID,
	}

	c.JSON(http.StatusOK, response)
}

// BulkAdjustStock performs bulk stock adjustments
// @Summary Bulk adjust stock
// @Description Perform multiple stock adjustments in a single request
// @Tags stock
// @Accept json
// @Produce json
// @Param adjustments body []StockAdjustmentRequest true "Array of stock adjustments"
// @Success 200 {object} BulkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/stock/bulk-adjust [post]
func (h *StockHandler) BulkAdjustStock(c *gin.Context) {
	var requests []StockAdjustmentRequest
	if err := c.ShouldBindJSON(&requests); err != nil {
		h.logger.WithError(err).Error("Failed to bind bulk adjustment data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Convert to repository structs
	var adjustments []repository.StockAdjustment
	for _, req := range requests {
		adjustment := repository.StockAdjustment{
			ProductID:    req.ProductID,
			WarehouseID:  req.WarehouseID,
			LocationID:   req.LocationID,
			Quantity:     req.Quantity,
			Reason:       req.Reason,
			UnitCost:     req.UnitCost,
			BatchNumber:  req.BatchNumber,
			SerialNumber: req.SerialNumber,
			ExpiryDate:   req.ExpiryDate,
			AdjustedBy:   req.AdjustedBy,
			Notes:        req.Notes,
		}
		adjustments = append(adjustments, adjustment)
	}

	if err := h.stockRepo.BulkAdjustStock(c.Request.Context(), adjustments); err != nil {
		h.logger.WithError(err).Error("Failed to bulk adjust stock")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to adjust stock",
			Message: err.Error(),
		})
		return
	}

	response := BulkResponse{
		Success: true,
		Count:   len(adjustments),
		Message: "Stock adjustments completed successfully",
	}

	c.JSON(http.StatusOK, response)
}

// Request/Response structs

// StockAdjustmentRequest represents a stock adjustment request
type StockAdjustmentRequest struct {
	ProductID    uuid.UUID       `json:"product_id" binding:"required"`
	WarehouseID  uuid.UUID       `json:"warehouse_id" binding:"required"`
	LocationID   *uuid.UUID      `json:"location_id"`
	Quantity     int64           `json:"quantity" binding:"required"`
	Reason       string          `json:"reason" binding:"required"`
	UnitCost     decimal.Decimal `json:"unit_cost"`
	BatchNumber  string          `json:"batch_number"`
	SerialNumber string          `json:"serial_number"`
	ExpiryDate   *time.Time      `json:"expiry_date"`
	AdjustedBy   *uuid.UUID      `json:"adjusted_by"`
	Notes        string          `json:"notes"`
}

// StockTransferRequest represents a stock transfer request
type StockTransferRequest struct {
	ProductID       uuid.UUID  `json:"product_id" binding:"required"`
	FromWarehouseID uuid.UUID  `json:"from_warehouse_id" binding:"required"`
	ToWarehouseID   uuid.UUID  `json:"to_warehouse_id" binding:"required"`
	FromLocationID  *uuid.UUID `json:"from_location_id"`
	ToLocationID    *uuid.UUID `json:"to_location_id"`
	Quantity        int64      `json:"quantity" binding:"required"`
	Reason          string     `json:"reason" binding:"required"`
	BatchNumber     string     `json:"batch_number"`
	SerialNumber    string     `json:"serial_number"`
	TransferredBy   *uuid.UUID `json:"transferred_by"`
	Notes           string     `json:"notes"`
}

// StockReservationRequest represents a stock reservation request
type StockReservationRequest struct {
	ProductID     uuid.UUID  `json:"product_id" binding:"required"`
	WarehouseID   uuid.UUID  `json:"warehouse_id" binding:"required"`
	LocationID    *uuid.UUID `json:"location_id"`
	Quantity      int64      `json:"quantity" binding:"required"`
	ReferenceType string     `json:"reference_type" binding:"required"`
	ReferenceID   *uuid.UUID `json:"reference_id"`
	ReservedBy    *uuid.UUID `json:"reserved_by"`
	ExpiresAt     *time.Time `json:"expires_at"`
	Notes         string     `json:"notes"`
}

// StockReleaseRequest represents a stock release request
type StockReleaseRequest struct {
	ProductID   uuid.UUID  `json:"product_id" binding:"required"`
	WarehouseID uuid.UUID  `json:"warehouse_id" binding:"required"`
	LocationID  *uuid.UUID `json:"location_id"`
	Quantity    int64      `json:"quantity" binding:"required"`
	ReleasedBy  *uuid.UUID `json:"released_by"`
	Reason      string     `json:"reason" binding:"required"`
}

// StockValuationResponse represents stock valuation response
type StockValuationResponse struct {
	TotalValuation decimal.Decimal `json:"total_valuation"`
	WarehouseID    *uuid.UUID      `json:"warehouse_id"`
}

