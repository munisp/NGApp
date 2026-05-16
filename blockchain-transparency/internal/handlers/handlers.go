package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"blockchain-transparency/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) GetClaimChain(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"chain": []map[string]interface{}{
			{"block": 1, "hash": "0xabc123", "type": "claim_submitted", "timestamp": "2026-05-16T10:00:00Z"},
			{"block": 2, "hash": "0xdef456", "type": "claim_assessed", "timestamp": "2026-05-16T10:05:00Z"},
			{"block": 3, "hash": "0xghi789", "type": "claim_approved", "timestamp": "2026-05-16T10:10:00Z"},
		},
	})
}

func (h *Handler) VerifyClaim(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"verified": true, "integrity": "valid", "chain_length": 3})
}

func (h *Handler) GetAuditTrail(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"trail": []interface{}{}, "total": 0})
}

func (h *Handler) RecordClaim(w http.ResponseWriter, r *http.Request) {
	blockHash := fmt.Sprintf("0x%d", time.Now().UnixNano()%100000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{"block_hash": blockHash, "recorded": true})
}

func (h *Handler) GetChainStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"total_blocks": 15423, "total_claims": 8945, "verified_claims": 8901,
		"integrity_score": 0.995, "last_block": time.Now().UTC().Format(time.RFC3339),
	})
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{"code": code, "message": message},
	})
}
