package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/enterprise-crm/customer-service/internal/service"
	"github.com/enterprise-crm/customer-service/internal/repository"
)

// CustomerHandler handles HTTP requests for customer operations
type CustomerHandler struct {
	customerService service.CustomerService
	validator       *validator.Validate
	logger          *logrus.Logger
}

// NewCustomerHandler creates a new customer handler
func NewCustomerHandler(customerService service.CustomerService, logger *logrus.Logger) *CustomerHandler {
	return &CustomerHandler{
		customerService: customerService,
		validator:       validator.New(),
		logger:          logger,
	}
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string      `json:"error"`
	Message string      `json:"message,omitempty"`
	Details interface{} `json:"details,omitempty"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

// GetCustomers godoc
// @Summary List customers
// @Description Get a list of customers with optional filters and pagination
// @Tags customers
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Param sort_by query string false "Sort by field" default("created_at")
// @Param sort_desc query bool false "Sort descending" default(true)
// @Param status query string false "Customer status filter"
// @Param tier query string false "Customer tier filter"
// @Param kyc_status query string false "KYC status filter"
// @Success 200 {object} SuccessResponse{data=service.ListCustomersResponse}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers [get]
func (h *CustomerHandler) GetCustomers(c *gin.Context) {
	// Parse pagination parameters
	pagination := repository.Pagination{
		Page:     h.getIntParam(c, "page", 1),
		PageSize: h.getIntParam(c, "page_size", 20),
		SortBy:   c.DefaultQuery("sort_by", "created_at"),
		SortDesc: h.getBoolParam(c, "sort_desc", true),
	}

	// Parse filters
	filters := repository.CustomerFilters{}
	if status := c.Query("status"); status != "" {
		filters.Status = []models.CustomerStatus{models.CustomerStatus(status)}
	}
	if tier := c.Query("tier"); tier != "" {
		filters.Tier = []models.CustomerTier{models.CustomerTier(tier)}
	}
	if kycStatus := c.Query("kyc_status"); kycStatus != "" {
		filters.KYCStatus = []models.KYCStatus{models.KYCStatus(kycStatus)}
	}

	// Create request
	req := &service.ListCustomersRequest{
		Filters:    filters,
		Pagination: pagination,
	}

	// Call service
	response, err := h.customerService.ListCustomers(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to list customers")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to list customers",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    response,
	})
}

// CreateCustomer godoc
// @Summary Create a new customer
// @Description Create a new customer with the provided information
// @Tags customers
// @Accept json
// @Produce json
// @Param customer body service.CreateCustomerRequest true "Customer creation request"
// @Success 201 {object} SuccessResponse{data=models.Customer}
// @Failure 400 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers [post]
func (h *CustomerHandler) CreateCustomer(c *gin.Context) {
	var req service.CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Request validation failed",
			Details: h.formatValidationErrors(err),
		})
		return
	}

	// Call service
	customer, err := h.customerService.CreateCustomer(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to create customer")
		
		// Check for specific error types
		if err.Error() == "customer already exists" {
			c.JSON(http.StatusConflict, ErrorResponse{
				Error:   "customer_exists",
				Message: "Customer with this email already exists",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to create customer",
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Success: true,
		Data:    customer,
		Message: "Customer created successfully",
	})
}

// GetCustomer godoc
// @Summary Get a customer by ID
// @Description Get detailed information about a specific customer
// @Tags customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID" format(uuid)
// @Success 200 {object} SuccessResponse{data=models.Customer}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers/{id} [get]
func (h *CustomerHandler) GetCustomer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	customer, err := h.customerService.GetCustomer(c.Request.Context(), id)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to get customer")
		
		if err.Error() == "customer not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "customer_not_found",
				Message: "Customer not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get customer",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    customer,
	})
}

// UpdateCustomer godoc
// @Summary Update a customer
// @Description Update customer information
// @Tags customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID" format(uuid)
// @Param customer body service.UpdateCustomerRequest true "Customer update request"
// @Success 200 {object} SuccessResponse{data=models.Customer}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers/{id} [put]
func (h *CustomerHandler) UpdateCustomer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	var req service.UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Request validation failed",
			Details: h.formatValidationErrors(err),
		})
		return
	}

	customer, err := h.customerService.UpdateCustomer(c.Request.Context(), id, &req)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to update customer")
		
		if err.Error() == "customer not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "customer_not_found",
				Message: "Customer not found",
			})
			return
		}

		if err.Error() == "email already taken" {
			c.JSON(http.StatusConflict, ErrorResponse{
				Error:   "email_taken",
				Message: "Email is already taken by another customer",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to update customer",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    customer,
		Message: "Customer updated successfully",
	})
}

// DeleteCustomer godoc
// @Summary Delete a customer
// @Description Soft delete a customer
// @Tags customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID" format(uuid)
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers/{id} [delete]
func (h *CustomerHandler) DeleteCustomer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	err = h.customerService.DeleteCustomer(c.Request.Context(), id)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to delete customer")
		
		if err.Error() == "customer not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "customer_not_found",
				Message: "Customer not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to delete customer",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Customer deleted successfully",
	})
}

// GetCustomerProfile godoc
// @Summary Get customer profile
// @Description Get detailed profile information for a customer
// @Tags customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID" format(uuid)
// @Success 200 {object} SuccessResponse{data=models.CustomerProfile}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers/{id}/profile [get]
func (h *CustomerHandler) GetCustomerProfile(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	profile, err := h.customerService.GetCustomerProfile(c.Request.Context(), id)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to get customer profile")
		
		if err.Error() == "profile not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "profile_not_found",
				Message: "Customer profile not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get customer profile",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    profile,
	})
}

// UpdateCustomerProfile godoc
// @Summary Update customer profile
// @Description Update detailed profile information for a customer
// @Tags customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID" format(uuid)
// @Param profile body service.UpdateProfileRequest true "Profile update request"
// @Success 200 {object} SuccessResponse{data=models.CustomerProfile}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers/{id}/profile [put]
func (h *CustomerHandler) UpdateCustomerProfile(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	var req service.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	profile, err := h.customerService.UpdateCustomerProfile(c.Request.Context(), id, &req)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to update customer profile")
		
		if err.Error() == "customer not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "customer_not_found",
				Message: "Customer not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to update customer profile",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    profile,
		Message: "Customer profile updated successfully",
	})
}

// GetCustomerInteractions godoc
// @Summary Get customer interactions
// @Description Get interaction history for a customer
// @Tags customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Param type query string false "Interaction type filter"
// @Param channel query string false "Interaction channel filter"
// @Success 200 {object} SuccessResponse{data=service.GetInteractionsResponse}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers/{id}/interactions [get]
func (h *CustomerHandler) GetCustomerInteractions(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	// Parse pagination and filters
	pagination := repository.Pagination{
		Page:     h.getIntParam(c, "page", 1),
		PageSize: h.getIntParam(c, "page_size", 20),
		SortBy:   c.DefaultQuery("sort_by", "created_at"),
		SortDesc: h.getBoolParam(c, "sort_desc", true),
	}

	filters := repository.InteractionFilters{}
	if interactionType := c.Query("type"); interactionType != "" {
		filters.Type = []models.InteractionType{models.InteractionType(interactionType)}
	}
	if channel := c.Query("channel"); channel != "" {
		filters.Channel = []models.InteractionChannel{models.InteractionChannel(channel)}
	}

	req := &service.GetInteractionsRequest{
		Filters:    filters,
		Pagination: pagination,
	}

	interactions, err := h.customerService.GetCustomerInteractions(c.Request.Context(), id, req)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to get customer interactions")
		
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get customer interactions",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    interactions,
	})
}

// CreateCustomerInteraction godoc
// @Summary Create customer interaction
// @Description Create a new interaction record for a customer
// @Tags customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID" format(uuid)
// @Param interaction body service.CreateInteractionRequest true "Interaction creation request"
// @Success 201 {object} SuccessResponse{data=models.CustomerInteraction}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /customers/{id}/interactions [post]
func (h *CustomerHandler) CreateCustomerInteraction(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	var req service.CreateInteractionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	// Set customer ID from path parameter
	req.CustomerID = id

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Request validation failed",
			Details: h.formatValidationErrors(err),
		})
		return
	}

	interaction, err := h.customerService.CreateCustomerInteraction(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to create customer interaction")
		
		if err.Error() == "customer not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "customer_not_found",
				Message: "Customer not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to create customer interaction",
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Success: true,
		Data:    interaction,
		Message: "Customer interaction created successfully",
	})
}

// SearchCustomers godoc
// @Summary Search customers
// @Description Search customers using query string with filters and pagination
// @Tags search
// @Accept json
// @Produce json
// @Param q query string true "Search query"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Param sort_by query string false "Sort by field" default("created_at")
// @Param sort_desc query bool false "Sort descending" default(true)
// @Success 200 {object} SuccessResponse{data=service.SearchCustomersResponse}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /search/customers [get]
func (h *CustomerHandler) SearchCustomers(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_query",
			Message: "Search query is required",
		})
		return
	}

	// Parse pagination parameters
	pagination := repository.Pagination{
		Page:     h.getIntParam(c, "page", 1),
		PageSize: h.getIntParam(c, "page_size", 20),
		SortBy:   c.DefaultQuery("sort_by", "created_at"),
		SortDesc: h.getBoolParam(c, "sort_desc", true),
	}

	req := &service.SearchCustomersRequest{
		Query:      query,
		Filters:    repository.CustomerFilters{},
		Pagination: pagination,
	}

	response, err := h.customerService.SearchCustomers(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to search customers")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to search customers",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    response,
	})
}

// AdvancedSearchCustomers godoc
// @Summary Advanced search customers
// @Description Advanced search customers with complex filters
// @Tags search
// @Accept json
// @Produce json
// @Param search body service.SearchCustomersRequest true "Advanced search request"
// @Success 200 {object} SuccessResponse{data=service.SearchCustomersResponse}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /search/customers/advanced [post]
func (h *CustomerHandler) AdvancedSearchCustomers(c *gin.Context) {
	var req service.SearchCustomersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if req.Query == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_query",
			Message: "Search query is required",
		})
		return
	}

	response, err := h.customerService.SearchCustomers(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to perform advanced search")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to perform advanced search",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    response,
	})
}

// Analytics endpoints
func (h *CustomerHandler) GetSegmentAnalytics(c *gin.Context) {
	analytics, err := h.customerService.GetSegmentAnalytics(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get segment analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get segment analytics",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    analytics,
	})
}

func (h *CustomerHandler) GetLifecycleAnalytics(c *gin.Context) {
	analytics, err := h.customerService.GetLifecycleAnalytics(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get lifecycle analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get lifecycle analytics",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    analytics,
	})
}

func (h *CustomerHandler) GetValueAnalytics(c *gin.Context) {
	analytics, err := h.customerService.GetValueAnalytics(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get value analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get value analytics",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    analytics,
	})
}

func (h *CustomerHandler) GetChurnAnalytics(c *gin.Context) {
	analytics, err := h.customerService.GetChurnAnalytics(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get churn analytics")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get churn analytics",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    analytics,
	})
}

// Event handling endpoints
func (h *CustomerHandler) HandleCustomerEvent(c *gin.Context) {
	var req service.CustomerEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if err := h.validator.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Request validation failed",
			Details: h.formatValidationErrors(err),
		})
		return
	}

	err := h.customerService.HandleCustomerEvent(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to handle customer event")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to handle customer event",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Customer event handled successfully",
	})
}

func (h *CustomerHandler) HandleInteractionEvent(c *gin.Context) {
	var req service.InteractionEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if err := h.validator.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Request validation failed",
			Details: h.formatValidationErrors(err),
		})
		return
	}

	err := h.customerService.HandleInteractionEvent(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to handle interaction event")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to handle interaction event",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Interaction event handled successfully",
	})
}

func (h *CustomerHandler) HandleSegmentEvent(c *gin.Context) {
	var req service.SegmentEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if err := h.validator.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Request validation failed",
			Details: h.formatValidationErrors(err),
		})
		return
	}

	err := h.customerService.HandleSegmentEvent(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to handle segment event")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to handle segment event",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Segment event handled successfully",
	})
}

// Bulk operations (placeholder implementations)
func (h *CustomerHandler) BulkCreateCustomers(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, ErrorResponse{
		Error:   "not_implemented",
		Message: "Bulk create customers not implemented yet",
	})
}

func (h *CustomerHandler) BulkUpdateCustomers(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, ErrorResponse{
		Error:   "not_implemented",
		Message: "Bulk update customers not implemented yet",
	})
}

func (h *CustomerHandler) BulkDeleteCustomers(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, ErrorResponse{
		Error:   "not_implemented",
		Message: "Bulk delete customers not implemented yet",
	})
}

func (h *CustomerHandler) GetCustomerSegments(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	segments, err := h.customerService.GetCustomerSegments(c.Request.Context(), id)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to get customer segments")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to get customer segments",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    segments,
	})
}

func (h *CustomerHandler) UpdateCustomerSegments(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "Invalid customer ID format",
		})
		return
	}

	var req struct {
		SegmentIDs []uuid.UUID `json:"segment_ids" validate:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	err = h.customerService.UpdateCustomerSegments(c.Request.Context(), id, req.SegmentIDs)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", id).Error("Failed to update customer segments")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_server_error",
			Message: "Failed to update customer segments",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Customer segments updated successfully",
	})
}

// Helper methods
func (h *CustomerHandler) getIntParam(c *gin.Context, key string, defaultValue int) int {
	if value := c.Query(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func (h *CustomerHandler) getBoolParam(c *gin.Context, key string, defaultValue bool) bool {
	if value := c.Query(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func (h *CustomerHandler) formatValidationErrors(err error) interface{} {
	var errors []map[string]string
	for _, err := range err.(validator.ValidationErrors) {
		errors = append(errors, map[string]string{
			"field":   err.Field(),
			"tag":     err.Tag(),
			"message": fmt.Sprintf("Field validation for '%s' failed on the '%s' tag", err.Field(), err.Tag()),
		})
	}
	return errors
}

