package handlers

import (
	"encoding/json"
	"insurance-tech-innovations/internal/models"
	"insurance-tech-innovations/internal/service"
	"net/http"

	"github.com/gorilla/mux"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api/v1/innovations").Subrouter()
	api.HandleFunc("/pricing/dynamic", h.dynamicPrice).Methods("POST")
	api.HandleFunc("/claims/instant", h.instantClaim).Methods("POST")
	api.HandleFunc("/gamification/profile", h.gamificationProfile).Methods("POST")
	api.HandleFunc("/p2p/pools", h.p2pPools).Methods("GET")
	api.HandleFunc("/product-builder/create", h.buildProduct).Methods("POST")
}

func (h *Handler) dynamicPrice(w http.ResponseWriter, r *http.Request) {
	var req models.DynamicPriceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(h.svc.CalculateDynamicPrice(req))
}

func (h *Handler) instantClaim(w http.ResponseWriter, r *http.Request) {
	var req models.InstantClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(h.svc.ProcessInstantClaim(req))
}

func (h *Handler) gamificationProfile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CustomerID  string `json:"customer_id"`
		StepsToday  int    `json:"steps_today"`
		SafeDrivingDays int `json:"safe_driving_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(h.svc.GetGamificationProfile(req.CustomerID, req.StepsToday, req.SafeDrivingDays))
}

func (h *Handler) p2pPools(w http.ResponseWriter, _ *http.Request) {
	pools := h.svc.GetP2PPools()
	json.NewEncoder(w).Encode(map[string]interface{}{"pools": pools, "count": len(pools)})
}

func (h *Handler) buildProduct(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name            string   `json:"name"`
		Perils          []string `json:"perils"`
		TriggerType     string   `json:"trigger_type"`
		PayoutMechanism string   `json:"payout_mechanism"`
		Distribution    string   `json:"distribution_channel"`
		PremiumModel    string   `json:"premium_model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(h.svc.BuildProduct(req.Name, req.Perils, req.TriggerType, req.PayoutMechanism, req.Distribution, req.PremiumModel))
}
