package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"reinsurer-api/internal/model"
	"reinsurer-api/internal/service"
)

// ReinsurerHandler handles HTTP requests related to reinsurers.
type ReinsurerHandler struct {
	reinsurerService service.ReinsurerService
}

// NewReinsurerHandler creates a new instance of ReinsurerHandler.
func NewReinsurerHandler(s service.ReinsurerService) *ReinsurerHandler {
	return &ReinsurerHandler{
		reinsurerService: s,
	}
}

// SubmitQuote handles the POST /api/v1/reinsurer/quotes endpoint.
func (h *ReinsurerHandler) SubmitQuote(c *gin.Context) {
	var req model.QuoteSubmission
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Basic validation (more comprehensive validation should be in the service layer)
	if req.PolicyID == "" || req.QuoteAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: policyId, quoteAmount"})
		return
	}

	// Extract ReinsurerID from JWT claims set by AuthMiddleware
	reinsurerID, exists := c.Get("reinsurer_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Reinsurer identity not found in token"})
		return
	}
	req.ReinsurerID = reinsurerID.(string)

	// Set current time for submission
	req.ExpirationDate = time.Now().Add(48 * time.Hour) // Example

	resp, err := h.reinsurerService.SubmitQuote(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit quote", "details": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, resp)
}

// NotifyClaim handles the POST /api/v1/reinsurer/claims endpoint.
// This endpoint is typically called by the core system (e.g., Claims Service) to notify the reinsurer.
func (h *ReinsurerHandler) NotifyClaim(c *gin.Context) {
	var req model.ClaimNotification
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Basic validation
	if req.ClaimID == "" || req.PolicyID == "" || req.ReinsurerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: claimId, policyId, reinsurerId"})
		return
	}

	// Set current time for notification
	req.NotificationDate = time.Now()

	resp, err := h.reinsurerService.NotifyClaim(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to notify claim", "details": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, resp)
}
