package handlers

import (
	"blockchain-transparency/internal/service"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type Handler struct {
	svc *service.BlockchainService
}

func NewHandler(svc *service.BlockchainService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/blockchain/transaction", h.RecordTransaction)
	mux.HandleFunc("/api/v1/blockchain/transaction/", h.GetTransaction)
	mux.HandleFunc("/api/v1/blockchain/mine", h.MineBlock)
	mux.HandleFunc("/api/v1/blockchain/block/", h.GetBlock)
	mux.HandleFunc("/api/v1/blockchain/chain", h.GetChain)
	mux.HandleFunc("/api/v1/blockchain/validate", h.ValidateChain)
	mux.HandleFunc("/api/v1/blockchain/audit", h.GetAuditLog)
	mux.HandleFunc("/api/v1/blockchain/stats", h.GetStats)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) RecordTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var req service.RecordTxRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	tx, err := h.svc.RecordTransaction(req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, tx)
}

func (h *Handler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/blockchain/transaction/")
	tx, err := h.svc.GetTransaction(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, tx)
}

func (h *Handler) MineBlock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	block, err := h.svc.MineBlock()
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, block)
}

func (h *Handler) GetBlock(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/blockchain/block/")
	index, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid block index")
		return
	}
	block, err := h.svc.GetBlock(index)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, block)
}

func (h *Handler) GetChain(w http.ResponseWriter, r *http.Request) {
	chain := h.svc.GetChain()
	respondJSON(w, http.StatusOK, map[string]interface{}{"blocks": chain, "length": len(chain)})
}

func (h *Handler) ValidateChain(w http.ResponseWriter, r *http.Request) {
	valid := h.svc.ValidateChain()
	respondJSON(w, http.StatusOK, map[string]interface{}{"valid": valid})
}

func (h *Handler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	txID := r.URL.Query().Get("transaction_id")
	records := h.svc.GetAuditLog(txID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"audit_log": records, "count": len(records)})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, h.svc.GetStats())
}
