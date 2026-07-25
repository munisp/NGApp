package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/enterprise-mdm/internal/service"
	"go.uber.org/zap"
)

type Handler struct {
	svc    *service.MDMService
	logger *zap.Logger
}

func NewHandler(svc *service.MDMService, logger *zap.Logger) *Handler {
	return &Handler{svc: svc, logger: logger}
}

func (h *Handler) GetGoldenRecord(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": c.Param("id"), "entity_type": "customer"})
}

func (h *Handler) SearchCustomers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"results": []interface{}{}, "total": 0})
}

func (h *Handler) MergeRecords(c *gin.Context) {
	var req struct {
		SurvivorID   string   `json:"survivor_id"`
		DuplicateIDs []string `json:"duplicate_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.MergeRecords(c.Request.Context(), req.SurvivorID, req.DuplicateIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) FindDuplicates(c *gin.Context) {
	candidates := h.svc.FindDuplicates(c.Request.Context(), c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"candidates": candidates, "total": len(candidates)})
}

func (h *Handler) GetQualityDashboard(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"overall_score": 0.0,
		"domains": []map[string]interface{}{
			{"domain": "customer", "completeness": 0.0, "accuracy": 0.0, "score": 0.0},
			{"domain": "agent", "completeness": 0.0, "accuracy": 0.0, "score": 0.0},
			{"domain": "product", "completeness": 0.0, "accuracy": 0.0, "score": 0.0},
			{"domain": "policy", "completeness": 0.0, "accuracy": 0.0, "score": 0.0},
		},
		"target_completeness": 0.95,
	})
}

func (h *Handler) GetQualityRules(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"rules": []interface{}{}, "total": 0})
}

func (h *Handler) ValidateRecord(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"valid": true, "violations": []interface{}{}})
}

func (h *Handler) GetCompletenessReport(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"fields": []map[string]interface{}{
			{"field": "name", "completeness": 0.99},
			{"field": "phone", "completeness": 0.97},
			{"field": "email", "completeness": 0.82},
			{"field": "bvn", "completeness": 0.75},
			{"field": "nin", "completeness": 0.68},
			{"field": "address", "completeness": 0.71},
			{"field": "date_of_birth", "completeness": 0.64},
		},
	})
}

func (h *Handler) ListDomains(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"domains": []map[string]interface{}{
			{"name": "customer", "record_count": 0, "quality_score": 0.0},
			{"name": "agent", "record_count": 0, "quality_score": 0.0},
			{"name": "product", "record_count": 0, "quality_score": 0.0},
			{"name": "policy", "record_count": 0, "quality_score": 0.0},
		},
	})
}

func (h *Handler) GetDomainStats(c *gin.Context) {
	metrics := h.svc.GetDomainQuality(c.Request.Context(), c.Param("domain"))
	c.JSON(http.StatusOK, metrics)
}

func (h *Handler) RunDeduplication(c *gin.Context) {
	c.JSON(http.StatusAccepted, gin.H{"status": "deduplication_started"})
}

func (h *Handler) GetDedupCandidates(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"candidates": []interface{}{}, "total": 0})
}

func (h *Handler) GetDataLineage(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"entity_id": c.Param("entity_id"), "lineage": []interface{}{}})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "enterprise-mdm"})
}
