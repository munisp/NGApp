package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/repository"
)

// Common response structures

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error     string    `json:"error"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Path      string    `json:"path,omitempty"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Success   bool      `json:"success"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int64       `json:"total_pages"`
}

// BulkResponse represents a bulk operation response
type BulkResponse struct {
	Success bool   `json:"success"`
	Count   int    `json:"count"`
	Message string `json:"message"`
}

// Utility functions

// ParsePagination parses pagination parameters from query string
func ParsePagination(c *gin.Context) (repository.Pagination, error) {
	pagination := repository.Pagination{
		Page:      1,
		Limit:     20,
		SortBy:    "created_at",
		SortOrder: "desc",
	}

	// Parse page
	if pageStr := c.Query("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page > 0 {
			pagination.Page = page
		} else {
			return pagination, fmt.Errorf("invalid page number")
		}
	}

	// Parse limit
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 && limit <= 100 {
			pagination.Limit = limit
		} else {
			return pagination, fmt.Errorf("invalid limit (must be between 1 and 100)")
		}
	}

	// Parse sort by
	if sortBy := c.Query("sort_by"); sortBy != "" {
		pagination.SortBy = sortBy
	}

	// Parse sort order
	if sortOrder := c.Query("sort_order"); sortOrder != "" {
		if sortOrder == "asc" || sortOrder == "desc" {
			pagination.SortOrder = sortOrder
		} else {
			return pagination, fmt.Errorf("invalid sort order (must be 'asc' or 'desc')")
		}
	}

	return pagination, nil
}

// NewErrorResponse creates a new error response
func NewErrorResponse(error, message string) ErrorResponse {
	return ErrorResponse{
		Error:     error,
		Message:   message,
		Timestamp: time.Now(),
	}
}

// NewSuccessResponse creates a new success response
func NewSuccessResponse(message string) SuccessResponse {
	return SuccessResponse{
		Success:   true,
		Message:   message,
		Timestamp: time.Now(),
	}
}

