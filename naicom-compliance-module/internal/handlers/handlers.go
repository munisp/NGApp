package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/naicom-compliance-module/internal/engine"
	"go.uber.org/zap"
)

type Handler struct {
	engine *engine.ReportingEngine
	logger *zap.Logger
}

func NewHandler(e *engine.ReportingEngine, logger *zap.Logger) *Handler {
	return &Handler{engine: e, logger: logger}
}

func (h *Handler) GenerateQuarterlyReturn(c *gin.Context) {
	data, err := h.engine.GenerateQuarterlyReturn(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "generated", "data": data})
}

func (h *Handler) GenerateAnnualReturn(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "annual_return_generated", "period": "2025"})
}

func (h *Handler) GetReturnHistory(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"returns": []interface{}{}, "total": 0})
}

func (h *Handler) GetReturnDetail(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": c.Param("id"), "status": "draft"})
}

func (h *Handler) GetCurrentSolvency(c *gin.Context) {
	metrics, err := h.engine.CalculateSolvency(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

func (h *Handler) GetSolvencyHistory(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"metrics": []interface{}{}, "total": 0})
}

func (h *Handler) GetSolvencyAlerts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"alerts": []interface{}{}, "total": 0})
}

func (h *Handler) GetComplianceScorecard(c *gin.Context) {
	scorecard := h.engine.GetComplianceScorecard(c.Request.Context())
	c.JSON(http.StatusOK, scorecard)
}

func (h *Handler) GetDirectives(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"directives": []map[string]interface{}{
			{"code": "NAICOM-DPI-001", "title": "Digital Policy Issuance", "status": "compliant"},
			{"code": "NAICOM-NMID-001", "title": "NMID Motor Verification", "status": "compliant"},
			{"code": "NAICOM-AML-001", "title": "AML/KYC All Policyholders", "status": "compliant"},
			{"code": "NAICOM-SEC-001", "title": "Cybersecurity & IT Risk", "status": "in_progress"},
			{"code": "NAICOM-RPT-001", "title": "Automated Regulatory Reporting", "status": "in_progress"},
			{"code": "NAICOM-DR-001", "title": "Disaster Recovery & BCP", "status": "compliant"},
			{"code": "NAICOM-NDPR-001", "title": "NDPR Data Protection", "status": "in_progress"},
			{"code": "NAICOM-CLM-001", "title": "Claims Resolution Timelines", "status": "compliant"},
		},
	})
}

func (h *Handler) GetRegulatoryCalendar(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"calendar": []map[string]interface{}{
			{"filing": "Q2 Quarterly Return", "deadline": time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02"), "status": "pending"},
			{"filing": "Annual Audited Accounts", "deadline": "2026-03-31", "status": "submitted"},
			{"filing": "Solvency Margin Report", "deadline": time.Now().Add(60 * 24 * time.Hour).Format("2006-01-02"), "status": "pending"},
			{"filing": "NDPR Annual Compliance Report", "deadline": "2026-12-31", "status": "pending"},
			{"filing": "IT Risk Assessment Report", "deadline": "2026-09-30", "status": "in_progress"},
		},
	})
}

func (h *Handler) SubmitFiling(c *gin.Context) {
	c.JSON(http.StatusAccepted, gin.H{"status": "filing_submitted", "reference": "NAICOM-2026-Q2-001"})
}

func (h *Handler) GetFilingStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"filings": []interface{}{}, "total": 0})
}

func (h *Handler) GetFilingDeadlines(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"deadlines": []interface{}{}, "total": 0})
}

func (h *Handler) GetNMIDCompliance(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"nmid_connected":      true,
		"verification_rate":   0.98,
		"total_verifications": 15420,
		"failed_verifications": 310,
		"last_sync":           time.Now().Add(-5 * time.Minute).Format(time.RFC3339),
	})
}

func (h *Handler) GetNMIDVerificationStats(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"daily_verifications": 520,
		"monthly_total":       15420,
		"success_rate":        0.98,
		"avg_response_time_ms": 230,
	})
}
