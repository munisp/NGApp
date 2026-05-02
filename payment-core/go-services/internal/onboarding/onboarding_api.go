// Package onboarding provides HTTP API handlers for stakeholder onboarding
package onboarding

import (
	"encoding/json"
	"net/http"
)

// OnboardingAPI provides HTTP handlers for the onboarding service
type OnboardingAPI struct {
	service *OnboardingService
}

// NewOnboardingAPI creates a new onboarding API
func NewOnboardingAPI(service *OnboardingService) *OnboardingAPI {
	return &OnboardingAPI{service: service}
}

// RegisterRoutes registers HTTP routes (for use with standard http.ServeMux or chi/gorilla)
func (api *OnboardingAPI) RegisterRoutes(mux *http.ServeMux) {
	// Templates
	mux.HandleFunc("/api/v1/onboarding/templates", api.handleGetTemplates)
	mux.HandleFunc("/api/v1/onboarding/templates/", api.handleGetTemplate)

	// Cases
	mux.HandleFunc("/api/v1/onboarding/cases", api.handleCases)
	mux.HandleFunc("/api/v1/onboarding/cases/", api.handleCase)

	// Evidence
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/evidence", api.handleEvidence)

	// Requirements
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/requirements/{reqId}/review", api.handleReviewRequirement)

	// Technical Profile
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/technical-profile", api.handleTechnicalProfile)

	// Approvals
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/approvals", api.handleApprovals)

	// Provisioning
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/provision/sandbox", api.handleProvisionSandbox)
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/provision/production", api.handleProvisionProduction)

	// Status transitions
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/submit", api.handleSubmit)
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/transition", api.handleTransition)

	// Notes
	mux.HandleFunc("/api/v1/onboarding/cases/{caseId}/notes", api.handleNotes)

	// Dashboard/Stats
	mux.HandleFunc("/api/v1/onboarding/stats", api.handleStats)
}

// handleGetTemplates returns all onboarding templates
func (api *OnboardingAPI) handleGetTemplates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	templates := api.service.GetAllTemplates()

	response := make([]OnboardingTemplateResponse, 0)
	for _, t := range templates {
		response = append(response, OnboardingTemplateResponse{
			StakeholderType:    string(t.StakeholderType),
			Name:               t.Name,
			Description:        t.Description,
			RequirementCount:   len(t.Requirements),
			ApprovalSteps:      len(t.ApprovalSteps),
			CertificationLevel: t.CertificationLevel,
			EstimatedDays:      t.EstimatedDays,
		})
	}

	writeJSON(w, http.StatusOK, response)
}

// OnboardingTemplateResponse represents a template summary
type OnboardingTemplateResponse struct {
	StakeholderType    string `json:"stakeholder_type"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	RequirementCount   int    `json:"requirement_count"`
	ApprovalSteps      int    `json:"approval_steps"`
	CertificationLevel string `json:"certification_level"`
	EstimatedDays      int    `json:"estimated_days"`
}

// handleGetTemplate returns a specific template
func (api *OnboardingAPI) handleGetTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract stakeholder type from path
	stakeholderType := StakeholderType(r.URL.Path[len("/api/v1/onboarding/templates/"):])

	template, err := api.service.GetTemplate(stakeholderType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, template)
}

// handleCases handles listing and creating cases
func (api *OnboardingAPI) handleCases(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	switch r.Method {
	case http.MethodGet:
		// List cases with filters
		filters := CaseFilters{
			StakeholderType: StakeholderType(r.URL.Query().Get("stakeholder_type")),
			Status:          OnboardingStatus(r.URL.Query().Get("status")),
			Jurisdiction:    r.URL.Query().Get("jurisdiction"),
		}

		cases, err := api.service.ListCases(ctx, filters)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, cases)

	case http.MethodPost:
		// Create new case
		var req CreateCaseRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		newCase, err := api.service.CreateCase(ctx, req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		writeJSON(w, http.StatusCreated, newCase)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleCase handles getting a specific case
func (api *OnboardingAPI) handleCase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract case ID from path
	caseID := r.URL.Path[len("/api/v1/onboarding/cases/"):]

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	c, err := api.service.GetCase(ctx, caseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, c)
}

// handleEvidence handles evidence upload
func (api *OnboardingAPI) handleEvidence(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract case ID from path (simplified - in production use a router)
	caseID := extractCaseID(r.URL.Path)

	var evidence EvidenceItem
	if err := json.NewDecoder(r.Body).Decode(&evidence); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.service.UploadEvidence(ctx, caseID, evidence); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "uploaded"})
}

// handleReviewRequirement handles requirement review
func (api *OnboardingAPI) handleReviewRequirement(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractCaseID(r.URL.Path)
	reqID := extractRequirementID(r.URL.Path)

	var req struct {
		ReviewerID string `json:"reviewer_id"`
		Decision   string `json:"decision"`
		Notes      string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.service.ReviewRequirement(ctx, caseID, reqID, req.ReviewerID, req.Decision, req.Notes); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "reviewed"})
}

// handleTechnicalProfile handles technical profile setup
func (api *OnboardingAPI) handleTechnicalProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	caseID := extractCaseID(r.URL.Path)

	switch r.Method {
	case http.MethodPut:
		var profile TechnicalProfile
		if err := json.NewDecoder(r.Body).Decode(&profile); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := api.service.SetTechnicalProfile(ctx, caseID, profile); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleApprovals handles approval decisions
func (api *OnboardingAPI) handleApprovals(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractCaseID(r.URL.Path)

	var approval Approval
	if err := json.NewDecoder(r.Body).Decode(&approval); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.service.AddApproval(ctx, caseID, approval); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "approval_added"})
}

// handleProvisionSandbox handles sandbox provisioning
func (api *OnboardingAPI) handleProvisionSandbox(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractCaseID(r.URL.Path)

	resources, err := api.service.ProvisionSandbox(ctx, caseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusCreated, resources)
}

// handleProvisionProduction handles production provisioning
func (api *OnboardingAPI) handleProvisionProduction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractCaseID(r.URL.Path)

	var limits ResourceLimits
	if err := json.NewDecoder(r.Body).Decode(&limits); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	resources, err := api.service.ProvisionProduction(ctx, caseID, limits)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusCreated, resources)
}

// handleSubmit handles case submission
func (api *OnboardingAPI) handleSubmit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractCaseID(r.URL.Path)

	var req struct {
		SubmittedBy string `json:"submitted_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.service.SubmitCase(ctx, caseID, req.SubmittedBy); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "submitted"})
}

// handleTransition handles status transitions
func (api *OnboardingAPI) handleTransition(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractCaseID(r.URL.Path)

	var req struct {
		NewStatus OnboardingStatus `json:"new_status"`
		ChangedBy string           `json:"changed_by"`
		Reason    string           `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.service.TransitionStatus(ctx, caseID, req.NewStatus, req.ChangedBy, req.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "transitioned"})
}

// handleNotes handles case notes
func (api *OnboardingAPI) handleNotes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractCaseID(r.URL.Path)

	var note CaseNote
	if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.service.AddNote(ctx, caseID, note); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "note_added"})
}

// handleStats returns onboarding statistics
func (api *OnboardingAPI) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// Get all cases
	cases, _ := api.service.ListCases(ctx, CaseFilters{})

	stats := OnboardingStats{
		TotalCases:        len(cases),
		ByStatus:          make(map[string]int),
		ByStakeholder:     make(map[string]int),
		AvgCompletionDays: 0,
	}

	var completedCount int
	var totalDays float64

	for _, c := range cases {
		stats.ByStatus[string(c.Status)]++
		stats.ByStakeholder[string(c.StakeholderType)]++

		if c.CompletedAt != nil {
			completedCount++
			totalDays += c.CompletedAt.Sub(c.CreatedAt).Hours() / 24
		}
	}

	if completedCount > 0 {
		stats.AvgCompletionDays = totalDays / float64(completedCount)
	}

	writeJSON(w, http.StatusOK, stats)
}

// OnboardingStats represents onboarding statistics
type OnboardingStats struct {
	TotalCases        int            `json:"total_cases"`
	ByStatus          map[string]int `json:"by_status"`
	ByStakeholder     map[string]int `json:"by_stakeholder"`
	AvgCompletionDays float64        `json:"avg_completion_days"`
}

// Helper functions
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func extractCaseID(path string) string {
	// Simplified extraction - in production use a proper router
	// Path format: /api/v1/onboarding/cases/{caseId}/...
	parts := splitPath(path)
	for i, p := range parts {
		if p == "cases" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

func extractRequirementID(path string) string {
	parts := splitPath(path)
	for i, p := range parts {
		if p == "requirements" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

func splitPath(path string) []string {
	result := make([]string, 0)
	current := ""
	for _, c := range path {
		if c == '/' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}
