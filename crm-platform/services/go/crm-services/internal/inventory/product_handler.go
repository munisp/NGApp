package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/repository"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/service"
)

// ProductHandler handles product HTTP requests
type ProductHandler struct {
	inventoryService *service.InventoryService
	productRepo      *repository.ProductRepository
	logger           *logrus.Logger
}

// NewProductHandler creates a new product handler
func NewProductHandler(inventoryService *service.InventoryService, productRepo *repository.ProductRepository, logger *logrus.Logger) *ProductHandler {
	return &ProductHandler{
		inventoryService: inventoryService,
		productRepo:      productRepo,
		logger:           logger,
	}
}

// CreateProduct creates a new product
// @Summary Create a new product
// @Description Create a new product with comprehensive validation
// @Tags products
// @Accept json
// @Produce json
// @Param product body models.Product true "Product data"
// @Success 201 {object} models.Product
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products [post]
func (h *ProductHandler) CreateProduct(c *gin.Context) {
	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		h.logger.WithError(err).Error("Failed to bind product data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Generate new ID
	product.ID = uuid.New()

	if err := h.inventoryService.CreateProduct(c.Request.Context(), &product); err != nil {
		h.logger.WithError(err).Error("Failed to create product")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create product",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, product)
}

// GetProduct retrieves a product by ID
// @Summary Get product by ID
// @Description Retrieve a product by its ID
// @Tags products
// @Produce json
// @Param id path string true "Product ID"
// @Success 200 {object} models.Product
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/{id} [get]
func (h *ProductHandler) GetProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid product ID",
			Message: "Product ID must be a valid UUID",
		})
		return
	}

	product, err := h.inventoryService.GetProduct(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "product not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "Product not found",
				Message: "Product with the specified ID does not exist",
			})
			return
		}
		h.logger.WithError(err).Error("Failed to get product")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve product",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, product)
}

// GetProductBySKU retrieves a product by SKU
// @Summary Get product by SKU
// @Description Retrieve a product by its SKU
// @Tags products
// @Produce json
// @Param sku path string true "Product SKU"
// @Success 200 {object} models.Product
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/sku/{sku} [get]
func (h *ProductHandler) GetProductBySKU(c *gin.Context) {
	sku := c.Param("sku")
	if sku == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid SKU",
			Message: "SKU cannot be empty",
		})
		return
	}

	product, err := h.inventoryService.GetProductBySKU(c.Request.Context(), sku)
	if err != nil {
		if err.Error() == "product not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "Product not found",
				Message: "Product with the specified SKU does not exist",
			})
			return
		}
		h.logger.WithError(err).Error("Failed to get product by SKU")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve product",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, product)
}

// UpdateProduct updates a product
// @Summary Update a product
// @Description Update an existing product
// @Tags products
// @Accept json
// @Produce json
// @Param id path string true "Product ID"
// @Param product body models.Product true "Product data"
// @Success 200 {object} models.Product
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/{id} [put]
func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid product ID",
			Message: "Product ID must be a valid UUID",
		})
		return
	}

	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		h.logger.WithError(err).Error("Failed to bind product data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Set the ID from the URL
	product.ID = id

	if err := h.inventoryService.UpdateProduct(c.Request.Context(), &product); err != nil {
		h.logger.WithError(err).Error("Failed to update product")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to update product",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, product)
}

// DeleteProduct deletes a product
// @Summary Delete a product
// @Description Delete a product by ID
// @Tags products
// @Param id path string true "Product ID"
// @Success 204
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/{id} [delete]
func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid product ID",
			Message: "Product ID must be a valid UUID",
		})
		return
	}

	if err := h.inventoryService.DeleteProduct(c.Request.Context(), id); err != nil {
		h.logger.WithError(err).Error("Failed to delete product")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to delete product",
			Message: err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListProducts lists products with filtering and pagination
// @Summary List products
// @Description List products with filtering and pagination
// @Tags products
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param sort_by query string false "Sort field" default("created_at")
// @Param sort_order query string false "Sort order (asc/desc)" default("desc")
// @Param category_id query string false "Filter by category ID"
// @Param brand_id query string false "Filter by brand ID"
// @Param manufacturer_id query string false "Filter by manufacturer ID"
// @Param type query string false "Filter by product type"
// @Param status query string false "Filter by product status"
// @Param search query string false "Search in name, SKU, description"
// @Success 200 {object} PaginatedResponse{data=[]models.Product}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products [get]
func (h *ProductHandler) ListProducts(c *gin.Context) {
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
	filter := repository.ProductFilter{}
	
	if categoryID := c.Query("category_id"); categoryID != "" {
		if id, err := uuid.Parse(categoryID); err == nil {
			filter.CategoryID = &id
		}
	}
	
	if brandID := c.Query("brand_id"); brandID != "" {
		if id, err := uuid.Parse(brandID); err == nil {
			filter.BrandID = &id
		}
	}
	
	if manufacturerID := c.Query("manufacturer_id"); manufacturerID != "" {
		if id, err := uuid.Parse(manufacturerID); err == nil {
			filter.ManufacturerID = &id
		}
	}
	
	filter.Type = c.Query("type")
	filter.Status = c.Query("status")
	filter.Search = c.Query("search")

	// Parse price range
	if minPriceStr := c.Query("min_price"); minPriceStr != "" {
		if minPrice, err := strconv.ParseFloat(minPriceStr, 64); err == nil {
			filter.MinPrice = &minPrice
		}
	}
	
	if maxPriceStr := c.Query("max_price"); maxPriceStr != "" {
		if maxPrice, err := strconv.ParseFloat(maxPriceStr, 64); err == nil {
			filter.MaxPrice = &maxPrice
		}
	}

	// Parse boolean filters
	if isActiveStr := c.Query("is_active"); isActiveStr != "" {
		if isActive, err := strconv.ParseBool(isActiveStr); err == nil {
			filter.IsActive = &isActive
		}
	}

	products, total, err := h.productRepo.List(c.Request.Context(), filter, pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to list products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve products",
			Message: err.Error(),
		})
		return
	}

	response := PaginatedResponse{
		Data:       products,
		Total:      total,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		TotalPages: (total + int64(pagination.Limit) - 1) / int64(pagination.Limit),
	}

	c.JSON(http.StatusOK, response)
}

// SearchProducts searches products
// @Summary Search products
// @Description Search products using full-text search
// @Tags products
// @Produce json
// @Param q query string true "Search query"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} PaginatedResponse{data=[]models.Product}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/search [get]
func (h *ProductHandler) SearchProducts(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Missing search query",
			Message: "Search query parameter 'q' is required",
		})
		return
	}

	// Parse pagination
	pagination, err := ParsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid pagination parameters",
			Message: err.Error(),
		})
		return
	}

	products, total, err := h.productRepo.Search(c.Request.Context(), query, pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to search products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to search products",
			Message: err.Error(),
		})
		return
	}

	response := PaginatedResponse{
		Data:       products,
		Total:      total,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		TotalPages: (total + int64(pagination.Limit) - 1) / int64(pagination.Limit),
	}

	c.JSON(http.StatusOK, response)
}

// GetProductStats retrieves product statistics
// @Summary Get product statistics
// @Description Retrieve comprehensive product statistics
// @Tags products
// @Produce json
// @Success 200 {object} repository.ProductStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/stats [get]
func (h *ProductHandler) GetProductStats(c *gin.Context) {
	stats, err := h.productRepo.GetStats(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get product stats")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve product statistics",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetLowStockProducts retrieves products with low stock
// @Summary Get low stock products
// @Description Retrieve products with low stock levels
// @Tags products
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} PaginatedResponse{data=[]models.Product}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/low-stock [get]
func (h *ProductHandler) GetLowStockProducts(c *gin.Context) {
	// Parse pagination
	pagination, err := ParsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid pagination parameters",
			Message: err.Error(),
		})
		return
	}

	products, total, err := h.productRepo.GetLowStock(c.Request.Context(), pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get low stock products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve low stock products",
			Message: err.Error(),
		})
		return
	}

	response := PaginatedResponse{
		Data:       products,
		Total:      total,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		TotalPages: (total + int64(pagination.Limit) - 1) / int64(pagination.Limit),
	}

	c.JSON(http.StatusOK, response)
}

// GetOutOfStockProducts retrieves products that are out of stock
// @Summary Get out of stock products
// @Description Retrieve products that are out of stock
// @Tags products
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} PaginatedResponse{data=[]models.Product}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/out-of-stock [get]
func (h *ProductHandler) GetOutOfStockProducts(c *gin.Context) {
	// Parse pagination
	pagination, err := ParsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid pagination parameters",
			Message: err.Error(),
		})
		return
	}

	products, total, err := h.productRepo.GetOutOfStock(c.Request.Context(), pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get out of stock products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve out of stock products",
			Message: err.Error(),
		})
		return
	}

	response := PaginatedResponse{
		Data:       products,
		Total:      total,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		TotalPages: (total + int64(pagination.Limit) - 1) / int64(pagination.Limit),
	}

	c.JSON(http.StatusOK, response)
}

// BulkCreateProducts creates multiple products
// @Summary Bulk create products
// @Description Create multiple products in a single request
// @Tags products
// @Accept json
// @Produce json
// @Param products body []models.Product true "Array of products"
// @Success 201 {object} BulkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/bulk [post]
func (h *ProductHandler) BulkCreateProducts(c *gin.Context) {
	var products []*models.Product
	if err := c.ShouldBindJSON(&products); err != nil {
		h.logger.WithError(err).Error("Failed to bind products data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Generate IDs for products
	for _, product := range products {
		product.ID = uuid.New()
	}

	if err := h.productRepo.BulkCreate(c.Request.Context(), products); err != nil {
		h.logger.WithError(err).Error("Failed to bulk create products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create products",
			Message: err.Error(),
		})
		return
	}

	response := BulkResponse{
		Success: true,
		Count:   len(products),
		Message: "Products created successfully",
	}

	c.JSON(http.StatusCreated, response)
}

// BulkUpdateProducts updates multiple products
// @Summary Bulk update products
// @Description Update multiple products in a single request
// @Tags products
// @Accept json
// @Produce json
// @Param products body []models.Product true "Array of products"
// @Success 200 {object} BulkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/bulk [put]
func (h *ProductHandler) BulkUpdateProducts(c *gin.Context) {
	var products []*models.Product
	if err := c.ShouldBindJSON(&products); err != nil {
		h.logger.WithError(err).Error("Failed to bind products data")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	if err := h.productRepo.BulkUpdate(c.Request.Context(), products); err != nil {
		h.logger.WithError(err).Error("Failed to bulk update products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to update products",
			Message: err.Error(),
		})
		return
	}

	response := BulkResponse{
		Success: true,
		Count:   len(products),
		Message: "Products updated successfully",
	}

	c.JSON(http.StatusOK, response)
}

// BulkDeleteProducts deletes multiple products
// @Summary Bulk delete products
// @Description Delete multiple products in a single request
// @Tags products
// @Accept json
// @Produce json
// @Param ids body []string true "Array of product IDs"
// @Success 200 {object} BulkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/bulk [delete]
func (h *ProductHandler) BulkDeleteProducts(c *gin.Context) {
	var idStrings []string
	if err := c.ShouldBindJSON(&idStrings); err != nil {
		h.logger.WithError(err).Error("Failed to bind product IDs")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request data",
			Message: err.Error(),
		})
		return
	}

	// Parse UUIDs
	var ids []uuid.UUID
	for _, idStr := range idStrings {
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Invalid product ID",
				Message: fmt.Sprintf("Invalid UUID: %s", idStr),
			})
			return
		}
		ids = append(ids, id)
	}

	if err := h.productRepo.BulkDelete(c.Request.Context(), ids); err != nil {
		h.logger.WithError(err).Error("Failed to bulk delete products")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to delete products",
			Message: err.Error(),
		})
		return
	}

	response := BulkResponse{
		Success: true,
		Count:   len(ids),
		Message: "Products deleted successfully",
	}

	c.JSON(http.StatusOK, response)
}

