package api

import (
	"net/http"
	"strconv"

	"github.com/etherisc/treaty-reinsurance-service/internal/models"
	"github.com/etherisc/treaty-reinsurance-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Handler holds the dependencies for the API
type Handler struct {
	service *service.TreatyService
	log     *logrus.Logger
}

// NewHandler creates a new API handler
func NewHandler(s *service.TreatyService, log *logrus.Logger) *Handler {
	return &Handler{service: s, log: log}
}

// RegisterRoutes registers all API routes
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	treatyGroup := r.Group("/api/v1/treaties")
	{
		treatyGroup.POST("/", h.CreateTreaty)
		treatyGroup.GET("/", h.GetAllTreaties)
		treatyGroup.GET("/:id", h.GetTreatyByID)
		treatyGroup.PUT("/:id", h.UpdateTreaty)
		treatyGroup.DELETE("/:id", h.DeleteTreaty)
		treatyGroup.POST("/calculate-cession", h.CalculateCession)
		treatyGroup.GET("/:id/utilization", h.GetUtilization)
	}
}

// CreateTreaty handles the creation of a new treaty
func (h *Handler) CreateTreaty(c *gin.Context) {
	var req CreateTreatyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	treaty := models.Treaty{
		Name:             req.Name,
		TreatyType:       req.TreatyType,
		EffectiveDate:    req.EffectiveDate,
		ExpirationDate:   req.ExpirationDate,
		ReinsurerID:      req.ReinsurerID,
		SharePercentage:  req.SharePercentage,
		RetentionLimit:   req.RetentionLimit,
		PriorityLimit:    req.PriorityLimit,
		TreatyLimit:      req.TreatyLimit,
		AggregateLimit:   req.AggregateLimit,
	}

	if err := h.service.CreateTreaty(c.Request.Context(), &treaty); err != nil {
		h.log.WithError(err).Error("Failed to create treaty")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create treaty"})
		return
	}

	c.JSON(http.StatusCreated, treatyToResponse(&treaty))
}

// GetAllTreaties handles the retrieval of all treaties
func (h *Handler) GetAllTreaties(c *gin.Context) {
	treaties, err := h.service.GetAllTreaties(c.Request.Context())
	if err != nil {
		h.log.WithError(err).Error("Failed to get all treaties")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve treaties"})
		return
	}

	var responses []TreatyResponse
	for _, t := range treaties {
		responses = append(responses, treatyToResponse(&t))
	}

	c.JSON(http.StatusOK, responses)
}

// GetTreatyByID handles the retrieval of a single treaty
func (h *Handler) GetTreatyByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid treaty ID"})
		return
	}

	treaty, err := h.service.GetTreatyByID(c.Request.Context(), uint(id))
	if err != nil {
		h.log.WithError(err).Error("Failed to get treaty by ID")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve treaty"})
		return
	}
	if treaty == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Treaty not found"})
		return
	}

	c.JSON(http.StatusOK, treatyToResponse(treaty))
}

// UpdateTreaty handles the update of an existing treaty
func (h *Handler) UpdateTreaty(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid treaty ID"})
		return
	}

	var req CreateTreatyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	treaty, err := h.service.GetTreatyByID(c.Request.Context(), uint(id))
	if err != nil {
		h.log.WithError(err).Error("Failed to get treaty for update")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve treaty"})
		return
	}
	if treaty == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Treaty not found"})
		return
	}

	// Update fields
	treaty.Name = req.Name
	treaty.TreatyType = req.TreatyType
	treaty.EffectiveDate = req.EffectiveDate
	treaty.ExpirationDate = req.ExpirationDate
	treaty.ReinsurerID = req.ReinsurerID
	treaty.SharePercentage = req.SharePercentage
	treaty.RetentionLimit = req.RetentionLimit
	treaty.PriorityLimit = req.PriorityLimit
	treaty.TreatyLimit = req.TreatyLimit
	treaty.AggregateLimit = req.AggregateLimit

	if err := h.service.UpdateTreaty(c.Request.Context(), treaty); err != nil {
		h.log.WithError(err).Error("Failed to update treaty")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update treaty"})
		return
	}

	c.JSON(http.StatusOK, treatyToResponse(treaty))
}

// DeleteTreaty handles the deletion of a treaty
func (h *Handler) DeleteTreaty(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid treaty ID"})
		return
	}

	if err := h.service.DeleteTreaty(c.Request.Context(), uint(id)); err != nil {
		h.log.WithError(err).Error("Failed to delete treaty")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete treaty"})
		return
	}

	c.Status(http.StatusNoContent)
}

// CalculateCession handles the automatic cession calculation
func (h *Handler) CalculateCession(c *gin.Context) {
	var req CalculateCessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cession, err := h.service.CalculateCession(c.Request.Context(), req.ExternalRefID, req.OriginalAmount)
	if err != nil {
		h.log.WithError(err).Error("Cession calculation failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cessionToResponse(cession))
}

// GetUtilization handles the retrieval of treaty utilization
func (h *Handler) GetUtilization(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid treaty ID"})
		return
	}

	utilization, err := h.service.GetUtilizationByTreatyID(c.Request.Context(), uint(id))
	if err != nil {
		h.log.WithError(err).Error("Failed to get utilization")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve utilization"})
		return
	}

	c.JSON(http.StatusOK, utilizationToResponse(utilization))
}

// treatyToResponse converts a models.Treaty to a TreatyResponse DTO
func treatyToResponse(t *models.Treaty) TreatyResponse {
	return TreatyResponse{
		ID:               t.ID,
		Name:             t.Name,
		TreatyType:       t.TreatyType,
		EffectiveDate:    t.EffectiveDate,
		ExpirationDate:   t.ExpirationDate,
		ReinsurerID:      t.ReinsurerID,
		Status:           t.Status,
		SharePercentage:  t.SharePercentage,
		RetentionLimit:   t.RetentionLimit,
		PriorityLimit:    t.PriorityLimit,
		TreatyLimit:      t.TreatyLimit,
		AggregateLimit:   t.AggregateLimit,
		CreatedAt:        t.CreatedAt,
		UpdatedAt:        t.UpdatedAt,
	}
}

// cessionToResponse converts a models.Cession to a CessionResponse DTO
func cessionToResponse(c *models.Cession) CessionResponse {
	return CessionResponse{
		ID:               c.ID,
		TreatyID:         c.TreatyID,
		ExternalRefID:    c.ExternalRefID,
		CessionType:      c.CessionType,
		OriginalAmount:   c.OriginalAmount,
		CededAmount:      c.CededAmount,
		RetainedAmount:   c.RetainedAmount,
		CededPercentage:  c.CededPercentage,
		CessionDate:      c.CessionDate,
	}
}

// utilizationToResponse converts a models.Utilization to a UtilizationResponse DTO
func utilizationToResponse(u *models.Utilization) UtilizationResponse {
	return UtilizationResponse{
		TreatyID:         u.TreatyID,
		CurrentLosses:    u.CurrentLosses,
		LastUpdated:      u.LastUpdated,
	}
}
