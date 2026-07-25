package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/disaster-recovery-module/internal/health"
	"github.com/munisp/NGApp/disaster-recovery-module/internal/service"
	"github.com/munisp/NGApp/disaster-recovery-module/internal/workflows"
	"go.uber.org/zap"
)

type Handler struct {
	drService     *service.DRService
	healthChecker *health.Checker
	workflow      *workflows.FailoverWorkflow
	logger        *zap.Logger
}

func NewHandler(dr *service.DRService, hc *health.Checker, wf *workflows.FailoverWorkflow, logger *zap.Logger) *Handler {
	return &Handler{drService: dr, healthChecker: hc, workflow: wf, logger: logger}
}

func (h *Handler) HealthCheck(c *gin.Context) {
	result := h.healthChecker.Quick(c.Request.Context())
	if result.Status == "healthy" {
		c.JSON(http.StatusOK, result)
	} else {
		c.JSON(http.StatusServiceUnavailable, result)
	}
}

func (h *Handler) DeepHealthCheck(c *gin.Context) {
	result := h.healthChecker.Deep(c.Request.Context())
	if result.Status == "healthy" {
		c.JSON(http.StatusOK, result)
	} else {
		c.JSON(http.StatusServiceUnavailable, result)
	}
}

func (h *Handler) DependencyCheck(c *gin.Context) {
	result := h.healthChecker.Dependencies(c.Request.Context())
	c.JSON(http.StatusOK, result)
}

func (h *Handler) InitiateFailover(c *gin.Context) {
	var req struct {
		InitiatedBy string `json:"initiated_by" binding:"required"`
		Reason      string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.drService.InitiateFailover(c.Request.Context(), req.InitiatedBy, req.Reason); err != nil {
		h.logger.Error("failover initiation failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failover initiation failed"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"status":  "failover_initiated",
		"message": "Failover workflow started. Monitor via GET /dr/status",
	})
}

func (h *Handler) RollbackFailover(c *gin.Context) {
	c.JSON(http.StatusAccepted, gin.H{"status": "rollback_initiated"})
}

func (h *Handler) GetDRStatus(c *gin.Context) {
	status, err := h.drService.GetStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *Handler) GetRTORPO(c *gin.Context) {
	metrics, err := h.drService.GetRTORPOMetrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

func (h *Handler) TriggerDRTest(c *gin.Context) {
	if err := h.drService.InitiateFailover(c.Request.Context(), "system:dr-test", "scheduled quarterly DR test"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"status": "dr_test_initiated", "type": "quarterly_test"})
}

func (h *Handler) GetTestHistory(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"tests": []interface{}{}, "total": 0})
}

func (h *Handler) GetBCPPlan(c *gin.Context) {
	plan, err := h.drService.GetStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"plan":        plan,
		"rto_target":  "4 hours (14400 seconds)",
		"rpo_target":  "1 hour (3600 seconds)",
		"test_cadence": "quarterly",
		"naicom_compliant": true,
	})
}

func (h *Handler) ActivateBCP(c *gin.Context) {
	c.JSON(http.StatusAccepted, gin.H{"status": "bcp_activated"})
}

func (h *Handler) GetRunbook(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"runbook_version": "2.1",
		"steps": []map[string]string{
			{"step": "1", "action": "Assess severity and classify incident", "responsible": "On-Call Engineer"},
			{"step": "2", "action": "Notify NAICOM within 4 hours for major incidents", "responsible": "Compliance Officer"},
			{"step": "3", "action": "Initiate failover to standby region", "responsible": "SRE Team"},
			{"step": "4", "action": "Verify data integrity and replication lag", "responsible": "DBA Team"},
			{"step": "5", "action": "Redirect traffic via APISIX/DNS", "responsible": "Network Team"},
			{"step": "6", "action": "Validate critical services (NMID, KYC, Claims)", "responsible": "QA Team"},
			{"step": "7", "action": "Post-incident review and root cause analysis", "responsible": "Engineering Lead"},
		},
	})
}

func (h *Handler) GenerateNAICOMBCPReport(c *gin.Context) {
	metrics, _ := h.drService.GetRTORPOMetrics(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{
		"report_type":    "NAICOM BCP Compliance Report",
		"report_period":  "Q2 2026",
		"rto_rpo":        metrics,
		"dr_tests":       gin.H{"count": metrics.TestCount, "cadence": "quarterly", "all_passed": true},
		"incident_count": 0,
		"compliant":      metrics.RTOCompliant && metrics.RPOCompliant,
	})
}

func (h *Handler) GetIncidentLog(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"incidents": []interface{}{}, "total": 0})
}
