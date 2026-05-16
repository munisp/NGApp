package api

import (
	"net/http"

	"aml-screening-service/internal/middleware"
	"aml-screening-service/internal/models"
	"aml-screening-service/internal/services"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	amlService *services.AMLService
}

func NewHandler(amlService *services.AMLService) *Handler {
	return &Handler{
		amlService: amlService,
	}
}

func (h *Handler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api/v1")
	api.Use(middleware.AuthMiddleware())
	{
		aml := api.Group("/aml")
		{
			aml.POST("/screen",
				middleware.RequireRoles(middleware.RoleComplianceOfficer, middleware.RoleSystemAdmin),
				h.ScreenCustomer)
			aml.GET("/screening/:id",
				middleware.RequireRoles(middleware.RoleComplianceOfficer, middleware.RoleKYCAnalyst, middleware.RoleRiskManager, middleware.RoleSystemAdmin),
				h.GetScreening)
			aml.GET("/customer/:customer_id/screenings",
				middleware.RequireRoles(middleware.RoleComplianceOfficer, middleware.RoleKYCAnalyst, middleware.RoleRiskManager, middleware.RoleKYCOperator, middleware.RoleSystemAdmin),
				h.GetCustomerScreenings)
		}
	}

	router.GET("/health", h.HealthCheck)
}

func (h *Handler) ScreenCustomer(c *gin.Context) {
	var req models.ScreeningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	screening, err := h.amlService.ScreenCustomer(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := models.ScreeningResponse{
		ID:            screening.ID.String(),
		CustomerID:    screening.CustomerID.String(),
		ScreeningType: screening.ScreeningType,
		FullName:      screening.FullName,
		Status:        screening.Status,
		RiskLevel:     screening.RiskLevel,
		MatchScore:    screening.MatchScore,
		HitCount:      len(screening.Hits),
		Hits:          screening.Hits,
		CreatedAt:     screening.CreatedAt,
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetScreening(c *gin.Context) {
	id := c.Param("id")

	screening, err := h.amlService.GetScreening(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Screening not found"})
		return
	}

	response := models.ScreeningResponse{
		ID:            screening.ID.String(),
		CustomerID:    screening.CustomerID.String(),
		ScreeningType: screening.ScreeningType,
		FullName:      screening.FullName,
		Status:        screening.Status,
		RiskLevel:     screening.RiskLevel,
		MatchScore:    screening.MatchScore,
		HitCount:      len(screening.Hits),
		Hits:          screening.Hits,
		CreatedAt:     screening.CreatedAt,
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetCustomerScreenings(c *gin.Context) {
	customerID := c.Param("customer_id")

	screenings, err := h.amlService.GetCustomerScreenings(customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var responses []models.ScreeningResponse
	for _, screening := range screenings {
		response := models.ScreeningResponse{
			ID:            screening.ID.String(),
			CustomerID:    screening.CustomerID.String(),
			ScreeningType: screening.ScreeningType,
			FullName:      screening.FullName,
			Status:        screening.Status,
			RiskLevel:     screening.RiskLevel,
			MatchScore:    screening.MatchScore,
			HitCount:      len(screening.Hits),
			Hits:          screening.Hits,
			CreatedAt:     screening.CreatedAt,
		}
		responses = append(responses, response)
	}

	c.JSON(http.StatusOK, responses)
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "aml-screening",
	})
}
