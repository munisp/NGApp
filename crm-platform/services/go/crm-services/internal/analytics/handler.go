package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/enterprise-crm/inventory-service/internal/repository"
	"github.com/enterprise-crm/inventory-service/internal/service"
)

// AnalyticsHandler handles analytics HTTP requests
type AnalyticsHandler struct {
	inventoryService *service.InventoryService
	productRepo      *repository.ProductRepository
	stockRepo        *repository.StockRepository
	supplierRepo     *repository.SupplierRepository
	warehouseRepo    *repository.WarehouseRepository
	movementRepo     *repository.MovementRepository
	categoryRepo     *repository.CategoryRepository
	logger           *logrus.Logger
}

// NewAnalyticsHandler creates a new analytics handler
func NewAnalyticsHandler(
	inventoryService *service.InventoryService,
	productRepo *repository.ProductRepository,
	stockRepo *repository.StockRepository,
	supplierRepo *repository.SupplierRepository,
	warehouseRepo *repository.WarehouseRepository,
	movementRepo *repository.MovementRepository,
	categoryRepo *repository.CategoryRepository,
	logger *logrus.Logger,
) *AnalyticsHandler {
	return &AnalyticsHandler{
		inventoryService: inventoryService,
		productRepo:      productRepo,
		stockRepo:        stockRepo,
		supplierRepo:     supplierRepo,
		warehouseRepo:    warehouseRepo,
		movementRepo:     movementRepo,
		categoryRepo:     categoryRepo,
		logger:           logger,
	}
}

// GetDashboard retrieves comprehensive inventory dashboard data
// @Summary Get inventory dashboard
// @Description Retrieve comprehensive inventory dashboard with all key metrics
// @Tags analytics
// @Produce json
// @Success 200 {object} service.InventoryDashboard
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/dashboard [get]
func (h *AnalyticsHandler) GetDashboard(c *gin.Context) {
	dashboard, err := h.inventoryService.GetInventoryDashboard(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get inventory dashboard")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve dashboard data",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

// GetProductAnalytics retrieves product analytics
// @Summary Get product analytics
// @Description Retrieve comprehensive product analytics and statistics
// @Tags analytics
// @Produce json
// @Success 200 {object} repository.ProductStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/products [get]
func (h *AnalyticsHandler) GetProductAnalytics(c *gin.Context) {
	stats, err := h.productRepo.GetStats(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get product analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve product analytics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetStockAnalytics retrieves stock analytics
// @Summary Get stock analytics
// @Description Retrieve comprehensive stock analytics and statistics
// @Tags analytics
// @Produce json
// @Success 200 {object} repository.StockStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/stock [get]
func (h *AnalyticsHandler) GetStockAnalytics(c *gin.Context) {
	stats, err := h.stockRepo.GetStats(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get stock analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve stock analytics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetSupplierAnalytics retrieves supplier analytics
// @Summary Get supplier analytics
// @Description Retrieve comprehensive supplier analytics and performance metrics
// @Tags analytics
// @Produce json
// @Success 200 {object} repository.SupplierStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/suppliers [get]
func (h *AnalyticsHandler) GetSupplierAnalytics(c *gin.Context) {
	stats, err := h.supplierRepo.GetStats(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get supplier analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve supplier analytics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetWarehouseAnalytics retrieves warehouse analytics
// @Summary Get warehouse analytics
// @Description Retrieve comprehensive warehouse analytics and utilization metrics
// @Tags analytics
// @Produce json
// @Success 200 {object} repository.WarehouseStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/warehouses [get]
func (h *AnalyticsHandler) GetWarehouseAnalytics(c *gin.Context) {
	stats, err := h.warehouseRepo.GetStats(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get warehouse analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve warehouse analytics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetMovementAnalytics retrieves movement analytics
// @Summary Get movement analytics
// @Description Retrieve comprehensive movement analytics and trends
// @Tags analytics
// @Produce json
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} repository.MovementStats
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/movements [get]
func (h *AnalyticsHandler) GetMovementAnalytics(c *gin.Context) {
	var startDate, endDate *time.Time

	// Parse start date
	if startDateStr := c.Query("start_date"); startDateStr != "" {
		if date, err := time.Parse("2006-01-02", startDateStr); err == nil {
			startDate = &date
		} else {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Invalid start date",
				Message: "Start date must be in YYYY-MM-DD format",
			})
			return
		}
	}

	// Parse end date
	if endDateStr := c.Query("end_date"); endDateStr != "" {
		if date, err := time.Parse("2006-01-02", endDateStr); err == nil {
			endDate = &date
		} else {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Invalid end date",
				Message: "End date must be in YYYY-MM-DD format",
			})
			return
		}
	}

	stats, err := h.movementRepo.GetStats(c.Request.Context(), startDate, endDate)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get movement analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve movement analytics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetCategoryAnalytics retrieves category analytics
// @Summary Get category analytics
// @Description Retrieve comprehensive category analytics and distribution
// @Tags analytics
// @Produce json
// @Success 200 {object} repository.CategoryStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/categories [get]
func (h *AnalyticsHandler) GetCategoryAnalytics(c *gin.Context) {
	stats, err := h.categoryRepo.GetStats(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get category analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve category analytics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetStockValuation calculates stock valuation
// @Summary Get stock valuation
// @Description Calculate total stock valuation with optional warehouse filtering
// @Tags analytics
// @Produce json
// @Param warehouse_id query string false "Filter by warehouse ID"
// @Success 200 {object} StockValuationResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/valuation [get]
func (h *AnalyticsHandler) GetStockValuation(c *gin.Context) {
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

// GetTopProducts retrieves top performing products
// @Summary Get top products
// @Description Retrieve top performing products by various metrics
// @Tags analytics
// @Produce json
// @Param metric query string false "Metric type (value, quantity, movements)" default("value")
// @Param limit query int false "Number of products to return" default(10)
// @Success 200 {object} TopProductsResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/top-products [get]
func (h *AnalyticsHandler) GetTopProducts(c *gin.Context) {
	metric := c.DefaultQuery("metric", "value")
	limitStr := c.DefaultQuery("limit", "10")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid limit",
			Message: "Limit must be a positive integer between 1 and 100",
		})
		return
	}

	var topProducts interface{}

	switch metric {
	case "value":
		topProducts, err = h.stockRepo.GetTopProductsByValue(c.Request.Context(), limit)
	case "quantity":
		topProducts, err = h.stockRepo.GetTopProductsByQuantity(c.Request.Context(), limit)
	case "movements":
		topProducts, err = h.movementRepo.GetTopMovedProducts(c.Request.Context(), limit)
	default:
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid metric",
			Message: "Metric must be one of: value, quantity, movements",
		})
		return
	}

	if err != nil {
		h.logger.WithError(err).Error("Failed to get top products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve top products",
			Message: err.Error(),
		})
		return
	}

	response := TopProductsResponse{
		Metric:      metric,
		Limit:       limit,
		TopProducts: topProducts,
	}

	c.JSON(http.StatusOK, response)
}

// GetLowStockAlert retrieves low stock alerts
// @Summary Get low stock alerts
// @Description Retrieve products with low stock levels for alerting
// @Tags analytics
// @Produce json
// @Param warehouse_id query string false "Filter by warehouse ID"
// @Success 200 {object} LowStockAlertResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/low-stock-alert [get]
func (h *AnalyticsHandler) GetLowStockAlert(c *gin.Context) {
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

	// Get low stock items
	pagination := repository.Pagination{Page: 1, Limit: 100}
	lowStockItems, total, err := h.stockRepo.GetLowStock(c.Request.Context(), pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get low stock items")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve low stock items",
			Message: err.Error(),
		})
		return
	}

	// Filter by warehouse if specified
	if warehouseID != nil {
		var filteredItems []*models.StockItem
		for _, item := range lowStockItems {
			if item.WarehouseID == *warehouseID {
				filteredItems = append(filteredItems, item)
			}
		}
		lowStockItems = filteredItems
		total = int64(len(filteredItems))
	}

	response := LowStockAlertResponse{
		TotalItems:    total,
		WarehouseID:   warehouseID,
		LowStockItems: lowStockItems,
		AlertLevel:    "warning",
	}

	// Set alert level based on count
	if total > 50 {
		response.AlertLevel = "critical"
	} else if total > 20 {
		response.AlertLevel = "high"
	}

	c.JSON(http.StatusOK, response)
}

// GetInventoryTrends retrieves inventory trends
// @Summary Get inventory trends
// @Description Retrieve inventory trends and patterns over time
// @Tags analytics
// @Produce json
// @Param period query string false "Time period (daily, weekly, monthly)" default("daily")
// @Param days query int false "Number of days to analyze" default(30)
// @Success 200 {object} InventoryTrendsResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/analytics/trends [get]
func (h *AnalyticsHandler) GetInventoryTrends(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")
	daysStr := c.DefaultQuery("days", "30")

	days, err := strconv.Atoi(daysStr)
	if err != nil || days <= 0 || days > 365 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid days",
			Message: "Days must be a positive integer between 1 and 365",
		})
		return
	}

	if period != "daily" && period != "weekly" && period != "monthly" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid period",
			Message: "Period must be one of: daily, weekly, monthly",
		})
		return
	}

	// Calculate date range
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)

	// Get movement trends
	movementStats, err := h.movementRepo.GetStats(c.Request.Context(), &startDate, &endDate)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get movement trends")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve inventory trends",
			Message: err.Error(),
		})
		return
	}

	response := InventoryTrendsResponse{
		Period:        period,
		Days:          days,
		StartDate:     startDate,
		EndDate:       endDate,
		MovementStats: movementStats,
	}

	c.JSON(http.StatusOK, response)
}

// Response structures

// TopProductsResponse represents top products response
type TopProductsResponse struct {
	Metric      string      `json:"metric"`
	Limit       int         `json:"limit"`
	TopProducts interface{} `json:"top_products"`
}

// LowStockAlertResponse represents low stock alert response
type LowStockAlertResponse struct {
	TotalItems    int64                `json:"total_items"`
	WarehouseID   *uuid.UUID           `json:"warehouse_id"`
	LowStockItems []*models.StockItem  `json:"low_stock_items"`
	AlertLevel    string               `json:"alert_level"`
}

// InventoryTrendsResponse represents inventory trends response
type InventoryTrendsResponse struct {
	Period        string                     `json:"period"`
	Days          int                        `json:"days"`
	StartDate     time.Time                  `json:"start_date"`
	EndDate       time.Time                  `json:"end_date"`
	MovementStats *repository.MovementStats  `json:"movement_stats"`
}

