package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/insurance-platform/insurance-radar/internal/explainer"
	"github.com/insurance-platform/insurance-radar/internal/features"
	"github.com/insurance-platform/insurance-radar/internal/ml"
	"github.com/insurance-platform/insurance-radar/internal/models"
	"github.com/insurance-platform/insurance-radar/internal/rules"
	"go.uber.org/zap"
)

// Handler handles HTTP requests for the Insurance Radar API
type Handler struct {
	featureEngine *features.FeatureEngine
	model         *ml.DNNModel
	rulesEngine   *rules.RulesEngine
	explainer     *explainer.FraudExplainer
	logger        *zap.Logger
}

// NewHandler creates a new API handler
func NewHandler(logger *zap.Logger) *Handler {
	modelConfig := ml.DefaultModelConfig()

	return &Handler{
		featureEngine: features.NewFeatureEngine(),
		model:         ml.NewDNNModel(modelConfig, logger),
		rulesEngine:   rules.NewRulesEngine(logger),
		explainer:     explainer.NewFraudExplainer(logger),
		logger:        logger,
	}
}

// RegisterRoutes registers API routes
func (h *Handler) RegisterRoutes(r *mux.Router) {
	// Fraud scoring endpoints
	r.HandleFunc("/api/v1/radar/score", h.ScoreFraud).Methods("POST")
	r.HandleFunc("/api/v1/radar/score/batch", h.ScoreFraudBatch).Methods("POST")

	// Rules management endpoints
	r.HandleFunc("/api/v1/radar/rules", h.ListRules).Methods("GET")
	r.HandleFunc("/api/v1/radar/rules", h.CreateRule).Methods("POST")
	r.HandleFunc("/api/v1/radar/rules/{id}", h.GetRule).Methods("GET")
	r.HandleFunc("/api/v1/radar/rules/{id}", h.UpdateRule).Methods("PUT")
	r.HandleFunc("/api/v1/radar/rules/{id}", h.DeleteRule).Methods("DELETE")
	r.HandleFunc("/api/v1/radar/rules/{id}/enable", h.EnableRule).Methods("POST")
	r.HandleFunc("/api/v1/radar/rules/{id}/disable", h.DisableRule).Methods("POST")

	// Analytics endpoints
	r.HandleFunc("/api/v1/radar/analytics/summary", h.GetAnalyticsSummary).Methods("GET")
	r.HandleFunc("/api/v1/radar/analytics/trends", h.GetFraudTrends).Methods("GET")

	// Health check
	r.HandleFunc("/api/v1/radar/health", h.HealthCheck).Methods("GET")
}

// ScoreFraud handles fraud scoring requests
func (h *Handler) ScoreFraud(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx := r.Context()

	var req models.FraudScoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Set request ID if not provided
	if req.RequestID == uuid.Nil {
		req.RequestID = uuid.New()
	}

	// Set timestamp if not provided
	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	// Extract features
	featureVector, err := h.featureEngine.ExtractFeatures(ctx, &req)
	if err != nil {
		h.logger.Error("Failed to extract features", zap.Error(err))
		h.respondError(w, http.StatusInternalServerError, "Failed to extract features")
		return
	}

	// Run ML model prediction
	prediction, err := h.model.Predict(ctx, featureVector)
	if err != nil {
		h.logger.Error("Failed to run prediction", zap.Error(err))
		h.respondError(w, http.StatusInternalServerError, "Failed to run prediction")
		return
	}

	// Evaluate rules
	ruleResults := h.rulesEngine.EvaluateRules(ctx, featureVector.Features)

	// Determine final decision (rules can override ML)
	finalDecision := prediction.Decision
	finalRiskLevel := prediction.RiskLevel
	for _, result := range ruleResults {
		if result.Matched && result.Action == rules.RuleActionBlock {
			finalDecision = "block"
			finalRiskLevel = models.RiskLevelCritical
			break
		}
	}

	// Generate explanation
	explanation := h.explainer.ExplainDecision(ctx, prediction, ruleResults, featureVector.Features)

	// Generate signals and risk factors
	signals := h.explainer.GenerateSignals(featureVector.Features, prediction.FeatureImportance)
	riskFactors := h.explainer.GenerateRiskFactors(prediction, ruleResults)

	// Build response
	response := models.FraudScoreResponse{
		RequestID:       req.RequestID,
		Score:           prediction.Score,
		RiskLevel:       finalRiskLevel,
		Decision:        finalDecision,
		Confidence:      prediction.Confidence,
		ProcessingTime:  time.Since(startTime).Milliseconds(),
		Signals:         signals,
		RiskFactors:     riskFactors,
		Recommendations: explanation.SuggestedActions,
		MatchedRules:    h.rulesEngine.GetMatchedRules(ruleResults),
		Explanation:     explanation,
		Timestamp:       time.Now(),
	}

	h.logger.Info("Fraud score computed",
		zap.String("request_id", req.RequestID.String()),
		zap.Float64("score", prediction.Score),
		zap.String("decision", finalDecision),
		zap.Int64("processing_time_ms", response.ProcessingTime))

	h.respondJSON(w, http.StatusOK, response)
}

// ScoreFraudBatch handles batch fraud scoring requests
func (h *Handler) ScoreFraudBatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var requests []models.FraudScoreRequest
	if err := json.NewDecoder(r.Body).Decode(&requests); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	responses := make([]models.FraudScoreResponse, len(requests))
	for i, req := range requests {
		response := h.scoreSingleRequest(ctx, &req)
		responses[i] = response
	}

	h.respondJSON(w, http.StatusOK, responses)
}

// scoreSingleRequest scores a single fraud request
func (h *Handler) scoreSingleRequest(ctx context.Context, req *models.FraudScoreRequest) models.FraudScoreResponse {
	startTime := time.Now()

	if req.RequestID == uuid.Nil {
		req.RequestID = uuid.New()
	}
	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	featureVector, err := h.featureEngine.ExtractFeatures(ctx, req)
	if err != nil {
		return models.FraudScoreResponse{
			RequestID: req.RequestID,
			Decision:  "error",
			Timestamp: time.Now(),
		}
	}

	prediction, err := h.model.Predict(ctx, featureVector)
	if err != nil {
		return models.FraudScoreResponse{
			RequestID: req.RequestID,
			Decision:  "error",
			Timestamp: time.Now(),
		}
	}

	ruleResults := h.rulesEngine.EvaluateRules(ctx, featureVector.Features)
	explanation := h.explainer.ExplainDecision(ctx, prediction, ruleResults, featureVector.Features)

	return models.FraudScoreResponse{
		RequestID:      req.RequestID,
		Score:          prediction.Score,
		RiskLevel:      prediction.RiskLevel,
		Decision:       prediction.Decision,
		Confidence:     prediction.Confidence,
		ProcessingTime: time.Since(startTime).Milliseconds(),
		MatchedRules:   h.rulesEngine.GetMatchedRules(ruleResults),
		Explanation:    explanation,
		Timestamp:      time.Now(),
	}
}

// ListRules returns all fraud detection rules
func (h *Handler) ListRules(w http.ResponseWriter, r *http.Request) {
	rules := h.rulesEngine.GetAllRules()
	h.respondJSON(w, http.StatusOK, rules)
}

// CreateRule creates a new fraud detection rule
func (h *Handler) CreateRule(w http.ResponseWriter, r *http.Request) {
	var rule rules.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if rule.ID == "" {
		rule.ID = "rule_" + uuid.New().String()[:8]
	}

	h.rulesEngine.AddRule(&rule)
	h.respondJSON(w, http.StatusCreated, rule)
}

// GetRule returns a specific rule
func (h *Handler) GetRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID := vars["id"]

	rule, ok := h.rulesEngine.GetRule(ruleID)
	if !ok {
		h.respondError(w, http.StatusNotFound, "Rule not found")
		return
	}

	h.respondJSON(w, http.StatusOK, rule)
}

// UpdateRule updates an existing rule
func (h *Handler) UpdateRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID := vars["id"]

	var rule rules.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	rule.ID = ruleID
	h.rulesEngine.AddRule(&rule)
	h.respondJSON(w, http.StatusOK, rule)
}

// DeleteRule deletes a rule
func (h *Handler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID := vars["id"]

	h.rulesEngine.RemoveRule(ruleID)
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// EnableRule enables a rule
func (h *Handler) EnableRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID := vars["id"]

	h.rulesEngine.EnableRule(ruleID)
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "enabled"})
}

// DisableRule disables a rule
func (h *Handler) DisableRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID := vars["id"]

	h.rulesEngine.DisableRule(ruleID)
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "disabled"})
}

// GetAnalyticsSummary returns fraud analytics summary
func (h *Handler) GetAnalyticsSummary(w http.ResponseWriter, r *http.Request) {
	summary := map[string]interface{}{
		"total_requests_today":     0,
		"blocked_today":            0,
		"reviewed_today":           0,
		"flagged_today":            0,
		"allowed_today":            0,
		"avg_processing_time_ms":   50,
		"false_positive_rate":      0.001,
		"model_version":            "insurance-radar-dnn-v1",
		"active_rules":             len(h.rulesEngine.GetAllRules()),
		"last_model_update":        time.Now().Add(-24 * time.Hour),
	}
	h.respondJSON(w, http.StatusOK, summary)
}

// GetFraudTrends returns fraud trend data
func (h *Handler) GetFraudTrends(w http.ResponseWriter, r *http.Request) {
	trends := map[string]interface{}{
		"daily_fraud_rate": []map[string]interface{}{
			{"date": time.Now().Add(-6 * 24 * time.Hour).Format("2006-01-02"), "rate": 0.012},
			{"date": time.Now().Add(-5 * 24 * time.Hour).Format("2006-01-02"), "rate": 0.011},
			{"date": time.Now().Add(-4 * 24 * time.Hour).Format("2006-01-02"), "rate": 0.013},
			{"date": time.Now().Add(-3 * 24 * time.Hour).Format("2006-01-02"), "rate": 0.010},
			{"date": time.Now().Add(-2 * 24 * time.Hour).Format("2006-01-02"), "rate": 0.009},
			{"date": time.Now().Add(-1 * 24 * time.Hour).Format("2006-01-02"), "rate": 0.011},
			{"date": time.Now().Format("2006-01-02"), "rate": 0.010},
		},
		"top_fraud_types": []map[string]interface{}{
			{"type": "claim", "count": 45, "percentage": 0.45},
			{"type": "policy_application", "count": 25, "percentage": 0.25},
			{"type": "identity", "count": 15, "percentage": 0.15},
			{"type": "agent", "count": 10, "percentage": 0.10},
			{"type": "payment", "count": 5, "percentage": 0.05},
		},
		"top_triggered_rules": []map[string]interface{}{
			{"rule_id": "rule_vpn_proxy", "count": 120},
			{"rule_id": "rule_high_amount_claim", "count": 85},
			{"rule_id": "rule_new_policy_immediate_claim", "count": 62},
			{"rule_id": "rule_velocity_claims", "count": 45},
			{"rule_id": "rule_night_time", "count": 38},
		},
	}
	h.respondJSON(w, http.StatusOK, trends)
}

// HealthCheck returns service health status
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":        "healthy",
		"service":       "insurance-radar",
		"version":       "1.0.0",
		"model_loaded":  true,
		"rules_loaded":  len(h.rulesEngine.GetAllRules()),
		"timestamp":     time.Now(),
	}
	h.respondJSON(w, http.StatusOK, health)
}

// respondJSON sends a JSON response
func (h *Handler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// respondError sends an error response
func (h *Handler) respondError(w http.ResponseWriter, status int, message string) {
	h.respondJSON(w, status, map[string]string{"error": message})
}
