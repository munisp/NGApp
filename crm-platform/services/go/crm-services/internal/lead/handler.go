package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/repository"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/service"
)

// LeadHandler handles lead-related HTTP requests
type LeadHandler struct {
	leadService service.LeadService
	logger      *logrus.Logger
}

// NewLeadHandler creates a new lead handler
func NewLeadHandler(leadService service.LeadService, logger *logrus.Logger) *LeadHandler {
	return &LeadHandler{
		leadService: leadService,
		logger:      logger,
	}
}

// Response structures

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// PaginatedResponse represents a paginated API response
type PaginatedResponse struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message,omitempty"`
	Data       interface{} `json:"data,omitempty"`
	Error      string      `json:"error,omitempty"`
	Pagination Pagination  `json:"pagination"`
}

// Pagination represents pagination metadata
type Pagination struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
	HasNext    bool  `json:"has_next"`
	HasPrev    bool  `json:"has_prev"`
}

// ListLeads handles GET /api/v1/leads
// @Summary List leads
// @Description Get a list of leads with optional filtering and pagination
// @Tags leads
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Param sort_by query string false "Sort field" default("created_at")
// @Param sort_desc query bool false "Sort descending" default(true)
// @Param status query []string false "Filter by status"
// @Param grade query []string false "Filter by grade"
// @Param source query []string false "Filter by source"
// @Param owner_id query string false "Filter by owner ID"
// @Param score_min query int false "Minimum score"
// @Param score_max query int false "Maximum score"
// @Success 200 {object} PaginatedResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /leads [get]
func (h *LeadHandler) ListLeads(c *gin.Context) {
	// Parse pagination parameters
	pagination := h.parsePagination(c)

	// Parse filters
	filters := h.parseLeadFilters(c)

	// Get leads
	leads, total, err := h.leadService.ListLeads(c.Request.Context(), filters, pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to list leads")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to list leads",
		})
		return
	}

	// Calculate pagination metadata
	paginationMeta := h.calculatePagination(pagination, total)

	c.JSON(http.StatusOK, PaginatedResponse{
		Success:    true,
		Data:       leads,
		Pagination: paginationMeta,
	})
}

// CreateLead handles POST /api/v1/leads
// @Summary Create a new lead
// @Description Create a new lead with the provided information
// @Tags leads
// @Accept json
// @Produce json
// @Param lead body service.CreateLeadRequest true "Lead information"
// @Success 201 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 409 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /leads [post]
func (h *LeadHandler) CreateLead(c *gin.Context) {
	var req service.CreateLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind create lead request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	// Create lead
	lead, err := h.leadService.CreateLead(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to create lead")
		
		// Check for specific error types
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, APIResponse{
				Success: false,
				Error:   err.Error(),
			})
			return
		}
		
		if strings.Contains(err.Error(), "validation failed") {
			c.JSON(http.StatusBadRequest, APIResponse{
				Success: false,
				Error:   err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to create lead",
		})
		return
	}

	c.JSON(http.StatusCreated, APIResponse{
		Success: true,
		Message: "Lead created successfully",
		Data:    lead,
	})
}

// GetLead handles GET /api/v1/leads/:id
// @Summary Get a lead by ID
// @Description Get detailed information about a specific lead
// @Tags leads
// @Accept json
// @Produce json
// @Param id path string true "Lead ID"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /leads/{id} [get]
func (h *LeadHandler) GetLead(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid lead ID format",
		})
		return
	}

	lead, err := h.leadService.GetLead(c.Request.Context(), id)
	if err != nil {
		h.logger.WithError(err).WithField("lead_id", id).Error("Failed to get lead")
		
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, APIResponse{
				Success: false,
				Error:   "Lead not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to get lead",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    lead,
	})
}

// UpdateLead handles PUT /api/v1/leads/:id
// @Summary Update a lead
// @Description Update an existing lead with new information
// @Tags leads
// @Accept json
// @Produce json
// @Param id path string true "Lead ID"
// @Param lead body service.UpdateLeadRequest true "Updated lead information"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 409 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /leads/{id} [put]
func (h *LeadHandler) UpdateLead(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid lead ID format",
		})
		return
	}

	var req service.UpdateLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind update lead request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	lead, err := h.leadService.UpdateLead(c.Request.Context(), id, req)
	if err != nil {
		h.logger.WithError(err).WithField("lead_id", id).Error("Failed to update lead")
		
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, APIResponse{
				Success: false,
				Error:   "Lead not found",
			})
			return
		}
		
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, APIResponse{
				Success: false,
				Error:   err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to update lead",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Lead updated successfully",
		Data:    lead,
	})
}

// DeleteLead handles DELETE /api/v1/leads/:id
// @Summary Delete a lead
// @Description Soft delete a lead by ID
// @Tags leads
// @Accept json
// @Produce json
// @Param id path string true "Lead ID"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /leads/{id} [delete]
func (h *LeadHandler) DeleteLead(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid lead ID format",
		})
		return
	}

	err = h.leadService.DeleteLead(c.Request.Context(), id)
	if err != nil {
		h.logger.WithError(err).WithField("lead_id", id).Error("Failed to delete lead")
		
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, APIResponse{
				Success: false,
				Error:   "Lead not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to delete lead",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Lead deleted successfully",
	})
}

// QualifyLead handles POST /api/v1/leads/:id/qualify
// @Summary Qualify a lead
// @Description Qualify a lead by assigning grade and score
// @Tags leads
// @Accept json
// @Produce json
// @Param id path string true "Lead ID"
// @Param qualification body service.QualifyLeadRequest true "Qualification information"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /leads/{id}/qualify [post]
func (h *LeadHandler) QualifyLead(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid lead ID format",
		})
		return
	}

	var req service.QualifyLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind qualify lead request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	lead, err := h.leadService.QualifyLead(c.Request.Context(), id, req)
	if err != nil {
		h.logger.WithError(err).WithField("lead_id", id).Error("Failed to qualify lead")
		
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, APIResponse{
				Success: false,
				Error:   "Lead not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to qualify lead",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Lead qualified successfully",
		Data:    lead,
	})
}

// ConvertLead handles POST /api/v1/leads/:id/convert
// @Summary Convert a lead
// @Description Convert a lead to account, contact, and/or opportunity
// @Tags leads
// @Accept json
// @Produce json
// @Param id path string true "Lead ID"
// @Param conversion body service.ConvertLeadRequest true "Conversion information"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /leads/{id}/convert [post]
func (h *LeadHandler) ConvertLead(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid lead ID format",
		})
		return
	}

	var req service.ConvertLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind convert lead request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	result, err := h.leadService.ConvertLead(c.Request.Context(), id, req)
	if err != nil {
		h.logger.WithError(err).WithField("lead_id", id).Error("Failed to convert lead")
		
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, APIResponse{
				Success: false,
				Error:   "Lead not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to convert lead",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Lead converted successfully",
		Data:    result,
	})
}

// SearchLeads handles GET /api/v1/search/leads
// @Summary Search leads
// @Description Perform full-text search on leads
// @Tags leads
// @Accept json
// @Produce json
// @Param q query string true "Search query"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Param sort_by query string false "Sort field" default("created_at")
// @Param sort_desc query bool false "Sort descending" default(true)
// @Success 200 {object} PaginatedResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /search/leads [get]
func (h *LeadHandler) SearchLeads(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Search query is required",
		})
		return
	}

	// Parse pagination parameters
	pagination := h.parsePagination(c)

	// Parse filters
	filters := h.parseLeadFilters(c)

	// Search leads
	leads, total, err := h.leadService.SearchLeads(c.Request.Context(), query, filters, pagination)
	if err != nil {
		h.logger.WithError(err).Error("Failed to search leads")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to search leads",
		})
		return
	}

	// Calculate pagination metadata
	paginationMeta := h.calculatePagination(pagination, total)

	c.JSON(http.StatusOK, PaginatedResponse{
		Success:    true,
		Data:       leads,
		Pagination: paginationMeta,
	})
}

// AdvancedSearchLeads handles POST /api/v1/search/leads/advanced
// @Summary Advanced search leads
// @Description Perform advanced search on leads with complex filters
// @Tags leads
// @Accept json
// @Produce json
// @Param search body AdvancedSearchRequest true "Advanced search criteria"
// @Success 200 {object} PaginatedResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /search/leads/advanced [post]
func (h *LeadHandler) AdvancedSearchLeads(c *gin.Context) {
	var req AdvancedSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind advanced search request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	// Convert to repository filters
	filters := h.convertToLeadFilters(req.Filters)
	pagination := req.Pagination

	// Search leads
	var leads interface{}
	var total int64
	var err error

	if req.Query != "" {
		leads, total, err = h.leadService.SearchLeads(c.Request.Context(), req.Query, filters, pagination)
	} else {
		leads, total, err = h.leadService.ListLeads(c.Request.Context(), filters, pagination)
	}

	if err != nil {
		h.logger.WithError(err).Error("Failed to perform advanced search")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to perform advanced search",
		})
		return
	}

	// Calculate pagination metadata
	paginationMeta := h.calculatePagination(pagination, total)

	c.JSON(http.StatusOK, PaginatedResponse{
		Success:    true,
		Data:       leads,
		Pagination: paginationMeta,
	})
}

// BulkCreateLeads handles POST /api/v1/bulk/leads
// @Summary Bulk create leads
// @Description Create multiple leads in a single operation
// @Tags leads
// @Accept json
// @Produce json
// @Param leads body service.BulkCreateLeadsRequest true "Bulk create request"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /bulk/leads [post]
func (h *LeadHandler) BulkCreateLeads(c *gin.Context) {
	var req service.BulkCreateLeadsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind bulk create request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	result, err := h.leadService.BulkCreateLeads(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to bulk create leads")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to bulk create leads",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Bulk create operation completed",
		Data:    result,
	})
}

// BulkUpdateLeads handles PUT /api/v1/bulk/leads
// @Summary Bulk update leads
// @Description Update multiple leads in a single operation
// @Tags leads
// @Accept json
// @Produce json
// @Param leads body service.BulkUpdateLeadsRequest true "Bulk update request"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /bulk/leads [put]
func (h *LeadHandler) BulkUpdateLeads(c *gin.Context) {
	var req service.BulkUpdateLeadsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind bulk update request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	result, err := h.leadService.BulkUpdateLeads(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to bulk update leads")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to bulk update leads",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Bulk update operation completed",
		Data:    result,
	})
}

// BulkDeleteLeads handles DELETE /api/v1/bulk/leads
// @Summary Bulk delete leads
// @Description Delete multiple leads in a single operation
// @Tags leads
// @Accept json
// @Produce json
// @Param leads body service.BulkDeleteLeadsRequest true "Bulk delete request"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /bulk/leads [delete]
func (h *LeadHandler) BulkDeleteLeads(c *gin.Context) {
	var req service.BulkDeleteLeadsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind bulk delete request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	result, err := h.leadService.BulkDeleteLeads(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to bulk delete leads")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to bulk delete leads",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Bulk delete operation completed",
		Data:    result,
	})
}

// ImportLeads handles POST /api/v1/import-export/leads/import
// @Summary Import leads
// @Description Import leads from external data
// @Tags leads
// @Accept json
// @Produce json
// @Param import body service.ImportLeadsRequest true "Import request"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /import-export/leads/import [post]
func (h *LeadHandler) ImportLeads(c *gin.Context) {
	var req service.ImportLeadsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind import request")
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	result, err := h.leadService.ImportLeads(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to import leads")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to import leads",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Import operation completed",
		Data:    result,
	})
}

// ExportLeads handles GET /api/v1/import-export/leads/export
// @Summary Export leads
// @Description Export leads to external format
// @Tags leads
// @Accept json
// @Produce json
// @Param format query string true "Export format (csv, json, xlsx)"
// @Param fields query []string false "Fields to export"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Security BearerAuth
// @Router /import-export/leads/export [get]
func (h *LeadHandler) ExportLeads(c *gin.Context) {
	format := c.Query("format")
	if format == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Export format is required",
		})
		return
	}

	fields := c.QueryArray("fields")
	filters := h.parseLeadFilters(c)

	req := service.ExportLeadsRequest{
		Filters: filters,
		Format:  format,
		Fields:  fields,
		// ExportedBy and ExporterName would come from authentication context
	}

	result, err := h.leadService.ExportLeads(c.Request.Context(), req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to export leads")
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to export leads",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Export operation completed",
		Data:    result,
	})
}

// Helper methods

// parsePagination parses pagination parameters from query string
func (h *LeadHandler) parsePagination(c *gin.Context) repository.Pagination {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortDesc, _ := strconv.ParseBool(c.DefaultQuery("sort_desc", "true"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	return repository.Pagination{
		Page:     page,
		PageSize: pageSize,
		SortBy:   sortBy,
		SortDesc: sortDesc,
	}
}

// parseLeadFilters parses lead filters from query parameters
func (h *LeadHandler) parseLeadFilters(c *gin.Context) repository.LeadFilters {
	filters := repository.LeadFilters{}

	// Parse status filter
	if statusStr := c.QueryArray("status"); len(statusStr) > 0 {
		for _, s := range statusStr {
			filters.Status = append(filters.Status, models.LeadStatus(s))
		}
	}

	// Parse grade filter
	if gradeStr := c.QueryArray("grade"); len(gradeStr) > 0 {
		for _, g := range gradeStr {
			filters.Grade = append(filters.Grade, models.LeadGrade(g))
		}
	}

	// Parse source filter
	if sources := c.QueryArray("source"); len(sources) > 0 {
		filters.Source = sources
	}

	// Parse owner ID filter
	if ownerIDStr := c.Query("owner_id"); ownerIDStr != "" {
		if ownerID, err := uuid.Parse(ownerIDStr); err == nil {
			filters.OwnerIDs = []uuid.UUID{ownerID}
		}
	}

	// Parse score range
	if scoreMinStr := c.Query("score_min"); scoreMinStr != "" {
		if scoreMin, err := strconv.Atoi(scoreMinStr); err == nil {
			filters.ScoreMin = &scoreMin
		}
	}

	if scoreMaxStr := c.Query("score_max"); scoreMaxStr != "" {
		if scoreMax, err := strconv.Atoi(scoreMaxStr); err == nil {
			filters.ScoreMax = &scoreMax
		}
	}

	// Parse industry filter
	if industries := c.QueryArray("industry"); len(industries) > 0 {
		filters.Industry = industries
	}

	// Parse company size filter
	if companySizes := c.QueryArray("company_size"); len(companySizes) > 0 {
		filters.CompanySize = companySizes
	}

	// Parse tags filter
	if tags := c.QueryArray("tags"); len(tags) > 0 {
		filters.Tags = tags
	}

	return filters
}

// calculatePagination calculates pagination metadata
func (h *LeadHandler) calculatePagination(pagination repository.Pagination, total int64) Pagination {
	totalPages := int((total + int64(pagination.PageSize) - 1) / int64(pagination.PageSize))
	
	return Pagination{
		Page:       pagination.Page,
		PageSize:   pagination.PageSize,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    pagination.Page < totalPages,
		HasPrev:    pagination.Page > 1,
	}
}

// Request structures for advanced search

// AdvancedSearchRequest represents an advanced search request
type AdvancedSearchRequest struct {
	Query      string                     `json:"query"`
	Filters    map[string]interface{}     `json:"filters"`
	Pagination repository.Pagination      `json:"pagination"`
}

// convertToLeadFilters converts generic filters to lead filters
func (h *LeadHandler) convertToLeadFilters(filters map[string]interface{}) repository.LeadFilters {
	leadFilters := repository.LeadFilters{}

	// Convert filters based on type
	if status, ok := filters["status"].([]interface{}); ok {
		for _, s := range status {
			if str, ok := s.(string); ok {
				leadFilters.Status = append(leadFilters.Status, models.LeadStatus(str))
			}
		}
	}

	if grade, ok := filters["grade"].([]interface{}); ok {
		for _, g := range grade {
			if str, ok := g.(string); ok {
				leadFilters.Grade = append(leadFilters.Grade, models.LeadGrade(str))
			}
		}
	}

	if source, ok := filters["source"].([]interface{}); ok {
		for _, s := range source {
			if str, ok := s.(string); ok {
				leadFilters.Source = append(leadFilters.Source, str)
			}
		}
	}

	// Add more filter conversions as needed...

	return leadFilters
}

