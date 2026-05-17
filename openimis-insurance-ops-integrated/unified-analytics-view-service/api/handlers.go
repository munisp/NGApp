package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"unified-analytics-view-service/pkg/service"
)

// Handler holds the dependencies for the API handlers.
type Handler struct {
	AnalyticsService service.AnalyticsService
	Logger           *logrus.Entry
}

// writeJSON is a helper function to write JSON responses.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

// GenerateViewHandler handles requests to generate and publish a unified view.
func (h *Handler) GenerateViewHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	viewType := vars["viewType"]
	id := vars["id"]

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var view interface{}
	var err error

	switch viewType {
	case "policy":
		view, err = h.AnalyticsService.GeneratePolicyView(ctx, id)
	case "claims":
		view, err = h.AnalyticsService.GenerateClaimsView(ctx, id)
	case "underwriting":
		view, err = h.AnalyticsService.GenerateUnderwritingView(ctx, id)
	default:
		http.Error(w, "Invalid view type", http.StatusBadRequest)
		return
	}

	if err != nil {
		h.Logger.WithError(err).Errorf("Failed to generate %s view for ID %s", viewType, id)
		http.Error(w, "Failed to generate view", http.StatusInternalServerError)
		return
	}

	// Publish to Kafka
	if err := h.AnalyticsService.PublishViewToKafka(ctx, view); err != nil {
		h.Logger.WithError(err).Errorf("Failed to publish %s view to Kafka for ID %s", viewType, id)
		// Decide if this is a fatal error or just a warning. For now, we return 500.
		http.Error(w, "View generated but failed to publish to Kafka", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success", "message": viewType + " view generated and published", "id": id})
}

// GetRegulatoryReportHandler handles requests to generate and download a regulatory report.
func (h *Handler) GetRegulatoryReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	period := vars["period"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	report, err := h.AnalyticsService.GenerateRegulatoryReport(ctx, period)
	if err != nil {
		h.Logger.WithError(err).Errorf("Failed to generate regulatory report for period %s", period)
		http.Error(w, "Failed to generate regulatory report", http.StatusInternalServerError)
		return
	}

	// In a real scenario, this would trigger a Temporal workflow and return a status/link.
	// For simplicity, we return the data directly (simulating a small report).
	writeJSON(w, http.StatusOK, report)
}

// StartScheduledReportHandler handles requests to start a scheduled report workflow.
func (h *Handler) StartScheduledReportHandler(w http.ResponseWriter, r *http.Request) {
	// This endpoint is for demonstration. In a real system, this would be configured via a management UI.
	// We assume the TemporalClient is available in the service layer or a dedicated handler.
	// Since we didn't inject TemporalClient into AnalyticsService, we'll simulate the call.
	// In a full implementation, we would need a dedicated TemporalService or inject the client.

	// For now, we'll just return a success message, assuming the Temporal worker is running and the schedule is managed elsewhere.
	writeJSON(w, http.StatusOK, map[string]string{"status": "success", "message": "Scheduled report workflow started (simulated)"})
}
