package main

import (
	"net/http"
	"time"

	"claims-reserve-service/internal/model"
	"claims-reserve-service/pkg/log"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
	"go.uber.org/zap"
)

// Handler holds the Temporal client and other dependencies
type Handler struct {
	TemporalClient client.Client
}

// NewHandler creates a new Handler
func NewHandler(tc client.Client) *Handler {
	return &Handler{
		TemporalClient: tc,
	}
}

// TriggerReserveCalculation handles the API request to start the reserve adjustment workflow
func (h *Handler) TriggerReserveCalculation(c *gin.Context) {
	var req model.ReserveAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.L().Error("Invalid request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.ClaimID == uuid.Nil {
		log.L().Error("ClaimID is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "ClaimID is required"})
		return
	}

	// Start the Temporal Workflow
	workflowID := "reserve-adjustment-" + req.ClaimID.String() + "-" + time.Now().Format("20060102150405")
	
	options := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: "CLAIMS_RESERVE_TASK_QUEUE", // Should be read from config
	}

	// For simplicity, we hardcode the TaskQueue here, but it should be read from config
	// The main function will ensure the worker is listening on this queue.
	
	we, err := h.TemporalClient.ExecuteWorkflow(c.Request.Context(), options, "ReserveAdjustmentWorkflow", req)
	if err != nil {
		log.L().Error("Failed to start ReserveAdjustmentWorkflow", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start workflow"})
		return
	}

	log.L().Info("ReserveAdjustmentWorkflow started", zap.String("workflowID", we.GetID()), zap.String("runID", we.GetRunID()))
	c.JSON(http.StatusOK, gin.H{
		"message":    "Reserve adjustment workflow started",
		"workflowID": we.GetID(),
		"runID":      we.GetRunID(),
	})
}

// TriggerIBNRCalculation handles the API request to manually trigger the IBNR calculation workflow
func (h *Handler) TriggerIBNRCalculation(c *gin.Context) {
	// Start the Temporal Workflow
	workflowID := "ibnr-calculation-manual-" + time.Now().Format("20060102150405")
	
	options := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: "CLAIMS_RESERVE_TASK_QUEUE", // Should be read from config
	}
	
	we, err := h.TemporalClient.ExecuteWorkflow(c.Request.Context(), options, "IBNRCalculationWorkflow")
	if err != nil {
		log.L().Error("Failed to start IBNRCalculationWorkflow", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start IBNR workflow"})
		return
	}

	log.L().Info("IBNRCalculationWorkflow started", zap.String("workflowID", we.GetID()), zap.String("runID", we.GetRunID()))
	c.JSON(http.StatusOK, gin.H{
		"message":    "IBNR calculation workflow started",
		"workflowID": we.GetID(),
		"runID":      we.GetRunID(),
	})
}
