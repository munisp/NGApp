package api

import (
	"net/http"

	"risk-scoring-service/internal/middleware"
	"risk-scoring-service/internal/models"
	"risk-scoring-service/internal/services"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	riskService *services.RiskScoringService
}

func NewHandler(riskService *services.RiskScoringService) *Handler {
	return &Handler{
		riskService: riskService,
	}
}

func (h *Handler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api/v1")
	api.Use(middleware.AuthMiddleware())
	{
		risk := api.Group("/risk")
		{
			risk.POST("/score",
				middleware.RequireRoles(middleware.RoleRiskManager, middleware.RoleSystemAdmin),
				h.CalculateRiskScore)
			risk.GET("/score/:id",
				middleware.RequireRoles(middleware.RoleRiskManager, middleware.RoleComplianceOfficer, middleware.RoleKYCAnalyst, middleware.RoleSystemAdmin),
				h.GetRiskScore)
			risk.GET("/customer/:customer_id/scores",
				middleware.RequireRoles(middleware.RoleRiskManager, middleware.RoleComplianceOfficer, middleware.RoleKYCAnalyst, middleware.RoleKYCOperator, middleware.RoleSystemAdmin),
				h.GetCustomerRiskScores)
			risk.GET("/customer/:customer_id/latest",
				middleware.RequireRoles(middleware.RoleRiskManager, middleware.RoleComplianceOfficer, middleware.RoleKYCAnalyst, middleware.RoleKYCOperator, middleware.RoleSystemAdmin),
				h.GetLatestRiskScore)
		}
	}

	router.GET("/health", h.HealthCheck)
}

func (h *Handler) CalculateRiskScore(c *gin.Context) {
	var req models.RiskScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	riskScore, err := h.riskService.CalculateRiskScore(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := models.RiskScoreResponse{
		ID:               riskScore.ID.String(),
		CustomerID:       riskScore.CustomerID.String(),
		OverallScore:     riskScore.OverallScore,
		RiskLevel:        riskScore.RiskLevel,
		DDLevel:          riskScore.DDLevel,
		IdentityScore:    riskScore.IdentityScore,
		DocumentScore:    riskScore.DocumentScore,
		AMLScore:         riskScore.AMLScore,
		BehaviorScore:    riskScore.BehaviorScore,
		GeographicScore:  riskScore.GeographicScore,
		TransactionScore: riskScore.TransactionScore,
		RiskFactors:      riskScore.RiskFactors,
		CalculatedAt:     riskScore.CalculatedAt,
		ExpiresAt:        riskScore.ExpiresAt,
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetRiskScore(c *gin.Context) {
	id := c.Param("id")

	riskScore, err := h.riskService.GetRiskScore(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Risk score not found"})
		return
	}

	response := models.RiskScoreResponse{
		ID:               riskScore.ID.String(),
		CustomerID:       riskScore.CustomerID.String(),
		OverallScore:     riskScore.OverallScore,
		RiskLevel:        riskScore.RiskLevel,
		DDLevel:          riskScore.DDLevel,
		IdentityScore:    riskScore.IdentityScore,
		DocumentScore:    riskScore.DocumentScore,
		AMLScore:         riskScore.AMLScore,
		BehaviorScore:    riskScore.BehaviorScore,
		GeographicScore:  riskScore.GeographicScore,
		TransactionScore: riskScore.TransactionScore,
		RiskFactors:      riskScore.RiskFactors,
		CalculatedAt:     riskScore.CalculatedAt,
		ExpiresAt:        riskScore.ExpiresAt,
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetCustomerRiskScores(c *gin.Context) {
	customerID := c.Param("customer_id")

	riskScores, err := h.riskService.GetCustomerRiskScores(customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var responses []models.RiskScoreResponse
	for _, riskScore := range riskScores {
		response := models.RiskScoreResponse{
			ID:               riskScore.ID.String(),
			CustomerID:       riskScore.CustomerID.String(),
			OverallScore:     riskScore.OverallScore,
			RiskLevel:        riskScore.RiskLevel,
			DDLevel:          riskScore.DDLevel,
			IdentityScore:    riskScore.IdentityScore,
			DocumentScore:    riskScore.DocumentScore,
			AMLScore:         riskScore.AMLScore,
			BehaviorScore:    riskScore.BehaviorScore,
			GeographicScore:  riskScore.GeographicScore,
			TransactionScore: riskScore.TransactionScore,
			RiskFactors:      riskScore.RiskFactors,
			CalculatedAt:     riskScore.CalculatedAt,
			ExpiresAt:        riskScore.ExpiresAt,
		}
		responses = append(responses, response)
	}

	c.JSON(http.StatusOK, responses)
}

func (h *Handler) GetLatestRiskScore(c *gin.Context) {
	customerID := c.Param("customer_id")

	riskScore, err := h.riskService.GetLatestRiskScore(customerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No valid risk score found"})
		return
	}

	response := models.RiskScoreResponse{
		ID:               riskScore.ID.String(),
		CustomerID:       riskScore.CustomerID.String(),
		OverallScore:     riskScore.OverallScore,
		RiskLevel:        riskScore.RiskLevel,
		DDLevel:          riskScore.DDLevel,
		IdentityScore:    riskScore.IdentityScore,
		DocumentScore:    riskScore.DocumentScore,
		AMLScore:         riskScore.AMLScore,
		BehaviorScore:    riskScore.BehaviorScore,
		GeographicScore:  riskScore.GeographicScore,
		TransactionScore: riskScore.TransactionScore,
		RiskFactors:      riskScore.RiskFactors,
		CalculatedAt:     riskScore.CalculatedAt,
		ExpiresAt:        riskScore.ExpiresAt,
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "risk-scoring",
	})
}
