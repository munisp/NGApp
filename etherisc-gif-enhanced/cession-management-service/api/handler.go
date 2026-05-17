package api

import (
	"cession-management-service/internal/model"
	"cession-management-service/internal/service"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics
var (
	cessionCounter = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "cession_management_cessions_total",
		Help: "Total number of cessions tracked, labeled by type.",
	}, []string{"type"})

	cessionCalculationDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name: "cession_management_calculation_duration_seconds",
		Help: "Duration of cession calculation engine runs.",
		Buckets: prometheus.DefBuckets,
	})

	reinsurerBalanceGauge = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cession_management_reinsurer_net_balance",
		Help: "Current net balance with a reinsurer.",
	}, []string{"reinsurer_id"})
)

// Handler holds the service and router
type Handler struct {
	Service service.Service
	Router  *mux.Router
}

// NewHandler creates a new Handler instance and sets up routes
func NewHandler(svc service.Service) *Handler {
	h := &Handler{
		Service: svc,
		Router:  mux.NewRouter(),
	}
	h.setupRoutes()
	return h
}

func (h *Handler) setupRoutes() {
	h.Router.HandleFunc("/v1/cessions", h.trackCession).Methods("POST")
	h.Router.HandleFunc("/v1/balances/{reinsurerID}", h.getReinsurerBalance).Methods("GET")
	h.Router.HandleFunc("/v1/bordereaux", h.generateBordereau).Methods("POST")
	h.Router.HandleFunc("/v1/bordereaux/{bordereauID}/send", h.sendBordereau).Methods("POST")
	h.Router.HandleFunc("/v1/bordereaux/{bordereauID}/settle", h.initiateSettlement).Methods("POST")
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

// POST /v1/cessions
func (h *Handler) trackCession(w http.ResponseWriter, r *http.Request) {
	var req TrackCessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	var cession *model.Cession
	var err error

	switch model.CessionType(req.Type) {
	case model.CessionTypePremium:
		cession, err = h.Service.TrackPremiumCession(r.Context(), req.PolicyID, req.ReinsurerID, req.Amount, req.CededShare, req.Currency)
		cessionCounter.WithLabelValues("premium").Inc()
	case model.CessionTypeClaim:
		cession, err = h.Service.TrackClaimCession(r.Context(), req.PolicyID, req.ReinsurerID, req.Amount, req.CededShare, req.Currency)
		cessionCounter.WithLabelValues("claim").Inc()
	default:
		respondWithError(w, http.StatusBadRequest, "Invalid cession type")
		return
	}

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// NOTE: In a real system, this would trigger the Temporal Workflow and wait for the result.
	// For this implementation, we'll simulate the calculation immediately for the response.
	start := time.Now()
	calc, err := h.Service.CalculateCession(r.Context(), cession.ID)
	cessionCalculationDuration.Observe(time.Since(start).Seconds())
	if err != nil {
		// Log error but proceed with just the cession if calculation fails
		// In a production system, the Temporal workflow would handle retries and failures
	}

	response := CessionResponse{
		ID: cession.ID,
		PolicyID: cession.PolicyID,
		ReinsurerID: cession.ReinsurerID,
		Type: cession.Type,
		Amount: cession.Amount,
		Currency: cession.Currency,
		CededShare: cession.CededShare,
		EffectiveDate: cession.EffectiveDate,
	}

	if calc != nil {
		response.Calculation = &CalculationResponse{
			CededAmount: calc.CededAmount,
			Commission: calc.Commission,
			NetPayable: calc.NetPayable,
		}
		// Update balance and record metric
		balance, _ := h.Service.UpdateReinsurerBalance(r.Context(), calc)
		if balance != nil {
			reinsurerBalanceGauge.WithLabelValues(balance.ReinsurerID.String()).Set(balance.NetBalance)
		}
	}

	respondWithJSON(w, http.StatusCreated, response)
}

// GET /v1/balances/{reinsurerID}
func (h *Handler) getReinsurerBalance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reinsurerID, err := uuid.Parse(vars["reinsurerID"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid reinsurer ID")
		return
	}

	balance, err := h.Service.GetReinsurerBalance(r.Context(), reinsurerID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Reinsurer balance not found")
		return
	}

	respondWithJSON(w, http.StatusOK, BalanceResponse{
		ReinsurerID: balance.ReinsurerID,
		Month: balance.Month,
		TotalPremium: balance.TotalPremium,
		TotalClaim: balance.TotalClaim,
		TotalCommission: balance.TotalCommission,
		NetBalance: balance.NetBalance,
	})
}

// POST /v1/bordereaux
func (h *Handler) generateBordereau(w http.ResponseWriter, r *http.Request) {
	var req BordereauRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	bordereau, err := h.Service.GenerateBordereau(r.Context(), req.ReinsurerID, req.Month)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// NOTE: In a real system, this would start the BordereauGenerationWorkflow
	// For now, we return the initial record.

	respondWithJSON(w, http.StatusAccepted, BordereauResponse{
		ID: bordereau.ID,
		ReinsurerID: bordereau.ReinsurerID,
		StatementMonth: bordereau.StatementMonth,
		Status: bordereau.Status,
		TotalNetPayable: bordereau.TotalNetPayable,
		FilePath: bordereau.FilePath,
	})
}

// POST /v1/bordereaux/{bordereauID}/send
func (h *Handler) sendBordereau(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	bordereauID, err := uuid.Parse(vars["bordereauID"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid bordereau ID")
		return
	}

	// NOTE: In a real system, this would start the Temporal workflow for sending the bordereau.
	// For now, we call the service directly.
	if err := h.Service.SendBordereau(r.Context(), bordereauID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "Bordereau send initiated"})
}

// POST /v1/bordereaux/{bordereauID}/settle
func (h *Handler) initiateSettlement(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	bordereauID, err := uuid.Parse(vars["bordereauID"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid bordereau ID")
		return
	}

	settlement, err := h.Service.InitiateSettlement(r.Context(), bordereauID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// NOTE: In a real system, this would start the SettlementWorkflow
	// For now, we return the initial record.

	respondWithJSON(w, http.StatusAccepted, SettlementResponse{
		ID: settlement.ID,
		BordereauID: settlement.BordereauID,
		Amount: settlement.Amount,
		Direction: settlement.Direction,
	})
}
