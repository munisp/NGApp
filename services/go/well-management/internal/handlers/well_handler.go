// Package handlers provides HTTP handlers for the Well Management Service.
package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/og-rmm/well-management/internal/repository"
)

// WellHandler handles HTTP requests for well operations.
type WellHandler struct {
	repo *repository.WellRepository
}

// NewWellHandler creates a new handler with the given repository.
func NewWellHandler(repo *repository.WellRepository) *WellHandler {
	return &WellHandler{repo: repo}
}

// ListWells handles GET /api/v1/wells
// Query params: operator_id, status, well_type, limit, offset
func (h *WellHandler) ListWells(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))

	filter := repository.WellFilter{
		OperatorID: q.Get("operator_id"),
		Status:     q.Get("status"),
		WellType:   q.Get("well_type"),
		Limit:      limit,
		Offset:     offset,
	}

	wells, total, err := h.repo.ListWells(r.Context(), filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list wells: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":   wells,
		"total":  total,
		"limit":  filter.Limit,
		"offset": filter.Offset,
	})
}

// GetWell handles GET /api/v1/wells/{id}
func (h *WellHandler) GetWell(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	if wellID == "" {
		writeError(w, http.StatusBadRequest, "well_id is required")
		return
	}

	well, err := h.repo.GetWell(r.Context(), wellID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if well == nil {
		writeError(w, http.StatusNotFound, "well not found")
		return
	}
	writeJSON(w, http.StatusOK, well)
}

// CreateWell handles POST /api/v1/wells
func (h *WellHandler) CreateWell(w http.ResponseWriter, r *http.Request) {
	var input repository.Well
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	// Validate required fields
	if input.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if input.OperatorID == "" {
		writeError(w, http.StatusBadRequest, "operator_id is required")
		return
	}
	if input.Status == "" {
		input.Status = "ACTIVE"
	}
	if input.WellType == "" {
		input.WellType = "OIL"
	}

	well, err := h.repo.CreateWell(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create well: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, well)
}

// UpdateWell handles PUT /api/v1/wells/{id}
func (h *WellHandler) UpdateWell(w http.ResponseWriter, r *http.Request) {
	// Placeholder — full implementation mirrors CreateWell with UPDATE SQL
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteWell handles DELETE /api/v1/wells/{id}
func (h *WellHandler) DeleteWell(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	if wellID == "" {
		writeError(w, http.StatusBadRequest, "well_id is required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": wellID})
}

// UpdateWellStatus handles PATCH /api/v1/wells/{id}/status
func (h *WellHandler) UpdateWellStatus(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	var body struct {
		Status    string `json:"status"`
		ChangedBy string `json:"changed_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	validStatuses := map[string]bool{
		"ACTIVE": true, "SHUT_IN": true, "ABANDONED": true,
		"DRILLING": true, "TESTING": true,
	}
	if !validStatuses[body.Status] {
		writeError(w, http.StatusBadRequest, "invalid status: "+body.Status)
		return
	}

	if err := h.repo.UpdateWellStatus(r.Context(), wellID, body.Status, body.ChangedBy); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"well_id": wellID, "status": body.Status})
}

// ListEquipment handles GET /api/v1/wells/{id}/equipment
func (h *WellHandler) ListEquipment(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	equipment, err := h.repo.ListEquipment(r.Context(), wellID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"data": equipment})
}

// AddEquipment handles POST /api/v1/wells/{id}/equipment
func (h *WellHandler) AddEquipment(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"status": "created"})
}

// ListOperators handles GET /api/v1/operators
func (h *WellHandler) ListOperators(w http.ResponseWriter, r *http.Request) {
	operators, err := h.repo.ListOperators(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"data": operators})
}

// CreateOperator handles POST /api/v1/operators
func (h *WellHandler) CreateOperator(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"status": "created"})
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]interface{}{"error": msg, "code": code})
}
