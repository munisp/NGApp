package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/agent-banking/agent-management/models"
	"github.com/agent-banking/agent-management/services"
	"github.com/agent-banking/agent-management/utils"
	"github.com/agent-banking/agent-management/validators"
)

type AgentHandler struct {
	agentService     *services.AgentService
	hierarchyService *services.HierarchyService
	auditService     *services.AuditService
	notificationService *services.NotificationService
}

func NewAgentHandler(
	agentService *services.AgentService,
	hierarchyService *services.HierarchyService,
	auditService *services.AuditService,
	notificationService *services.NotificationService,
) *AgentHandler {
	return &AgentHandler{
		agentService:     agentService,
		hierarchyService: hierarchyService,
		auditService:     auditService,
		notificationService: notificationService,
	}
}

// CreateAgent handles agent registration
func (h *AgentHandler) CreateAgent(w http.ResponseWriter, r *http.Request) {
	var req models.CreateAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate request
	if err := validators.ValidateCreateAgentRequest(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Validation failed", err)
		return
	}

	// Extract user context
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		utils.WriteErrorResponse(w, http.StatusUnauthorized, "User ID required", nil)
		return
	}

	// Create agent
	agent, err := h.agentService.CreateAgent(r.Context(), &req, userID)
	if err != nil {
		switch err {
		case services.ErrAgentAlreadyExists:
			utils.WriteErrorResponse(w, http.StatusConflict, "Agent already exists", err)
		case services.ErrInvalidHierarchy:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid hierarchy configuration", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create agent", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.created",
		EntityID:  agent.ID,
		EntityType: "agent",
		Details:   map[string]interface{}{"agent_code": agent.AgentCode},
		Timestamp: time.Now(),
	})

	// Send notification
	go h.notificationService.SendAgentCreatedNotification(agent)

	utils.WriteSuccessResponse(w, http.StatusCreated, "Agent created successfully", agent)
}

// GetAgent retrieves agent by ID
func (h *AgentHandler) GetAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	if agentID == "" {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Agent ID required", nil)
		return
	}

	agent, err := h.agentService.GetAgentByID(r.Context(), agentID)
	if err != nil {
		if err == services.ErrAgentNotFound {
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		} else {
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to retrieve agent", err)
		}
		return
	}

	utils.WriteSuccessResponse(w, http.StatusOK, "Agent retrieved successfully", agent)
}

// UpdateAgent updates agent information
func (h *AgentHandler) UpdateAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	var req models.UpdateAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate request
	if err := validators.ValidateUpdateAgentRequest(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Validation failed", err)
		return
	}

	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		utils.WriteErrorResponse(w, http.StatusUnauthorized, "User ID required", nil)
		return
	}

	agent, err := h.agentService.UpdateAgent(r.Context(), agentID, &req, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrUnauthorized:
			utils.WriteErrorResponse(w, http.StatusForbidden, "Unauthorized to update agent", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update agent", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.updated",
		EntityID:  agent.ID,
		EntityType: "agent",
		Details:   map[string]interface{}{"changes": req},
		Timestamp: time.Now(),
	})

	utils.WriteSuccessResponse(w, http.StatusOK, "Agent updated successfully", agent)
}

// ListAgents retrieves agents with filtering and pagination
func (h *AgentHandler) ListAgents(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	query := r.URL.Query()
	
	filters := &models.AgentFilters{
		Status:     query.Get("status"),
		Type:       query.Get("type"),
		Region:     query.Get("region"),
		ParentID:   query.Get("parent_id"),
		SearchTerm: query.Get("search"),
	}

	// Parse pagination
	page, _ := strconv.Atoi(query.Get("page"))
	if page < 1 {
		page = 1
	}
	
	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	pagination := &models.Pagination{
		Page:  page,
		Limit: limit,
	}

	// Parse sorting
	sortBy := query.Get("sort_by")
	sortOrder := query.Get("sort_order")
	if sortBy == "" {
		sortBy = "created_at"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	sorting := &models.Sorting{
		Field: sortBy,
		Order: sortOrder,
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	result, err := h.agentService.ListAgents(r.Context(), filters, pagination, sorting, userID, userRole)
	if err != nil {
		utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to retrieve agents", err)
		return
	}

	utils.WriteSuccessResponse(w, http.StatusOK, "Agents retrieved successfully", result)
}

// ApproveAgent approves pending agent registration
func (h *AgentHandler) ApproveAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	var req models.ApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanApproveAgent(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions to approve agent", nil)
		return
	}

	agent, err := h.agentService.ApproveAgent(r.Context(), agentID, &req, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrInvalidStatus:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "Agent cannot be approved in current status", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to approve agent", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.approved",
		EntityID:  agent.ID,
		EntityType: "agent",
		Details:   map[string]interface{}{"approval_notes": req.Notes},
		Timestamp: time.Now(),
	})

	// Send notification
	go h.notificationService.SendAgentApprovedNotification(agent)

	utils.WriteSuccessResponse(w, http.StatusOK, "Agent approved successfully", agent)
}

// RejectAgent rejects pending agent registration
func (h *AgentHandler) RejectAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	var req models.RejectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.Reason == "" {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Rejection reason is required", nil)
		return
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanRejectAgent(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions to reject agent", nil)
		return
	}

	agent, err := h.agentService.RejectAgent(r.Context(), agentID, &req, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrInvalidStatus:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "Agent cannot be rejected in current status", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to reject agent", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.rejected",
		EntityID:  agent.ID,
		EntityType: "agent",
		Details:   map[string]interface{}{"rejection_reason": req.Reason},
		Timestamp: time.Now(),
	})

	// Send notification
	go h.notificationService.SendAgentRejectedNotification(agent, req.Reason)

	utils.WriteSuccessResponse(w, http.StatusOK, "Agent rejected successfully", agent)
}

// SuspendAgent suspends an active agent
func (h *AgentHandler) SuspendAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	var req models.SuspensionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanSuspendAgent(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions to suspend agent", nil)
		return
	}

	agent, err := h.agentService.SuspendAgent(r.Context(), agentID, &req, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrInvalidStatus:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "Agent cannot be suspended in current status", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to suspend agent", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.suspended",
		EntityID:  agent.ID,
		EntityType: "agent",
		Details:   map[string]interface{}{"suspension_reason": req.Reason},
		Timestamp: time.Now(),
	})

	// Send notification
	go h.notificationService.SendAgentSuspendedNotification(agent, req.Reason)

	utils.WriteSuccessResponse(w, http.StatusOK, "Agent suspended successfully", agent)
}

// ReactivateAgent reactivates a suspended agent
func (h *AgentHandler) ReactivateAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	var req models.ReactivationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanReactivateAgent(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions to reactivate agent", nil)
		return
	}

	agent, err := h.agentService.ReactivateAgent(r.Context(), agentID, &req, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrInvalidStatus:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "Agent cannot be reactivated in current status", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to reactivate agent", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.reactivated",
		EntityID:  agent.ID,
		EntityType: "agent",
		Details:   map[string]interface{}{"reactivation_notes": req.Notes},
		Timestamp: time.Now(),
	})

	// Send notification
	go h.notificationService.SendAgentReactivatedNotification(agent)

	utils.WriteSuccessResponse(w, http.StatusOK, "Agent reactivated successfully", agent)
}

// GetAgentHierarchy retrieves agent hierarchy
func (h *AgentHandler) GetAgentHierarchy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	hierarchy, err := h.hierarchyService.GetAgentHierarchy(r.Context(), agentID)
	if err != nil {
		if err == services.ErrAgentNotFound {
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		} else {
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to retrieve hierarchy", err)
		}
		return
	}

	utils.WriteSuccessResponse(w, http.StatusOK, "Hierarchy retrieved successfully", hierarchy)
}

// GetAgentPerformance retrieves agent performance metrics
func (h *AgentHandler) GetAgentPerformance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	query := r.URL.Query()
	startDate := query.Get("start_date")
	endDate := query.Get("end_date")
	
	if startDate == "" || endDate == "" {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Start date and end date are required", nil)
		return
	}

	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid start date format", err)
		return
	}

	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid end date format", err)
		return
	}

	performance, err := h.agentService.GetAgentPerformance(r.Context(), agentID, start, end)
	if err != nil {
		if err == services.ErrAgentNotFound {
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		} else {
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to retrieve performance", err)
		}
		return
	}

	utils.WriteSuccessResponse(w, http.StatusOK, "Performance retrieved successfully", performance)
}

// GetAgentTransactions retrieves agent transaction history
func (h *AgentHandler) GetAgentTransactions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	query := r.URL.Query()
	
	// Parse pagination
	page, _ := strconv.Atoi(query.Get("page"))
	if page < 1 {
		page = 1
	}
	
	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	// Parse filters
	filters := &models.TransactionFilters{
		Type:      query.Get("type"),
		Status:    query.Get("status"),
		StartDate: query.Get("start_date"),
		EndDate:   query.Get("end_date"),
	}

	pagination := &models.Pagination{
		Page:  page,
		Limit: limit,
	}

	transactions, err := h.agentService.GetAgentTransactions(r.Context(), agentID, filters, pagination)
	if err != nil {
		if err == services.ErrAgentNotFound {
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		} else {
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to retrieve transactions", err)
		}
		return
	}

	utils.WriteSuccessResponse(w, http.StatusOK, "Transactions retrieved successfully", transactions)
}

// UpdateAgentLimits updates agent transaction limits
func (h *AgentHandler) UpdateAgentLimits(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	var req models.UpdateLimitsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate limits
	if err := validators.ValidateAgentLimits(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid limits", err)
		return
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanUpdateAgentLimits(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions to update limits", nil)
		return
	}

	limits, err := h.agentService.UpdateAgentLimits(r.Context(), agentID, &req, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrInvalidLimits:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid limit configuration", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update limits", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.limits_updated",
		EntityID:  agentID,
		EntityType: "agent",
		Details:   map[string]interface{}{"new_limits": req},
		Timestamp: time.Now(),
	})

	utils.WriteSuccessResponse(w, http.StatusOK, "Limits updated successfully", limits)
}

// BulkUpdateAgents performs bulk operations on multiple agents
func (h *AgentHandler) BulkUpdateAgents(w http.ResponseWriter, r *http.Request) {
	var req models.BulkUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if len(req.AgentIDs) == 0 {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Agent IDs are required", nil)
		return
	}

	if len(req.AgentIDs) > 100 {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Maximum 100 agents can be updated at once", nil)
		return
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanBulkUpdateAgents(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions for bulk operations", nil)
		return
	}

	result, err := h.agentService.BulkUpdateAgents(r.Context(), &req, userID)
	if err != nil {
		utils.WriteErrorResponse(w, http.StatusInternalServerError, "Bulk update failed", err)
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.bulk_updated",
		EntityID:  fmt.Sprintf("bulk_%d_agents", len(req.AgentIDs)),
		EntityType: "agent",
		Details:   map[string]interface{}{
			"operation": req.Operation,
			"agent_count": len(req.AgentIDs),
			"success_count": result.SuccessCount,
			"failure_count": result.FailureCount,
		},
		Timestamp: time.Now(),
	})

	utils.WriteSuccessResponse(w, http.StatusOK, "Bulk update completed", result)
}

// ExportAgents exports agent data
func (h *AgentHandler) ExportAgents(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	format := query.Get("format")
	if format == "" {
		format = "csv"
	}

	if !utils.IsValidExportFormat(format) {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid export format", nil)
		return
	}

	// Parse filters
	filters := &models.AgentFilters{
		Status:     query.Get("status"),
		Type:       query.Get("type"),
		Region:     query.Get("region"),
		ParentID:   query.Get("parent_id"),
		SearchTerm: query.Get("search"),
	}

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanExportAgents(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions to export data", nil)
		return
	}

	exportData, err := h.agentService.ExportAgents(r.Context(), filters, format, userID)
	if err != nil {
		utils.WriteErrorResponse(w, http.StatusInternalServerError, "Export failed", err)
		return
	}

	// Set appropriate headers
	filename := fmt.Sprintf("agents_export_%s.%s", time.Now().Format("20060102_150405"), format)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	
	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv")
	case "xlsx":
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	case "json":
		w.Header().Set("Content-Type", "application/json")
	}

	w.Write(exportData)

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.exported",
		EntityID:  "export",
		EntityType: "agent",
		Details:   map[string]interface{}{
			"format": format,
			"filters": filters,
		},
		Timestamp: time.Now(),
	})
}

// GetAgentDocuments retrieves agent documents
func (h *AgentHandler) GetAgentDocuments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	documents, err := h.agentService.GetAgentDocuments(r.Context(), agentID)
	if err != nil {
		if err == services.ErrAgentNotFound {
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		} else {
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to retrieve documents", err)
		}
		return
	}

	utils.WriteSuccessResponse(w, http.StatusOK, "Documents retrieved successfully", documents)
}

// UploadAgentDocument uploads agent document
func (h *AgentHandler) UploadAgentDocument(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]

	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Failed to parse form", err)
		return
	}

	file, header, err := r.FormFile("document")
	if err != nil {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Document file is required", err)
		return
	}
	defer file.Close()

	documentType := r.FormValue("type")
	description := r.FormValue("description")

	if documentType == "" {
		utils.WriteErrorResponse(w, http.StatusBadRequest, "Document type is required", nil)
		return
	}

	userID := r.Header.Get("X-User-ID")

	document, err := h.agentService.UploadAgentDocument(r.Context(), agentID, file, header, documentType, description, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrInvalidFileType:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "Invalid file type", err)
		case services.ErrFileTooLarge:
			utils.WriteErrorResponse(w, http.StatusBadRequest, "File too large", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to upload document", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.document_uploaded",
		EntityID:  agentID,
		EntityType: "agent",
		Details:   map[string]interface{}{
			"document_type": documentType,
			"filename": header.Filename,
		},
		Timestamp: time.Now(),
	})

	utils.WriteSuccessResponse(w, http.StatusCreated, "Document uploaded successfully", document)
}

// DeleteAgentDocument deletes agent document
func (h *AgentHandler) DeleteAgentDocument(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["id"]
	documentID := vars["document_id"]

	userID := r.Header.Get("X-User-ID")
	userRole := r.Header.Get("X-User-Role")

	// Check authorization
	if !utils.CanDeleteAgentDocument(userRole) {
		utils.WriteErrorResponse(w, http.StatusForbidden, "Insufficient permissions to delete document", nil)
		return
	}

	err := h.agentService.DeleteAgentDocument(r.Context(), agentID, documentID, userID)
	if err != nil {
		switch err {
		case services.ErrAgentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Agent not found", err)
		case services.ErrDocumentNotFound:
			utils.WriteErrorResponse(w, http.StatusNotFound, "Document not found", err)
		default:
			utils.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to delete document", err)
		}
		return
	}

	// Log audit event
	h.auditService.LogEvent(r.Context(), &models.AuditEvent{
		UserID:    userID,
		Action:    "agent.document_deleted",
		EntityID:  agentID,
		EntityType: "agent",
		Details:   map[string]interface{}{"document_id": documentID},
		Timestamp: time.Now(),
	})

	utils.WriteSuccessResponse(w, http.StatusOK, "Document deleted successfully", nil)
}

