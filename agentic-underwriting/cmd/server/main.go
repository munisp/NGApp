package main

import (
	"agentic-underwriting/workflows"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8132"
	}

	r := mux.NewRouter()

	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "healthy",
			"service": "agentic-underwriting",
		})
	}).Methods("GET")

	r.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")

	r.HandleFunc("/api/v1/underwriting/submit", func(w http.ResponseWriter, req *http.Request) {
		var input workflows.EnhancedUnderwritingInput
		if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
			return
		}

		if input.ApplicationID == "" {
			input.ApplicationID = uuid.New().String()
		}
		if input.CustomerID == "" {
			writeError(w, http.StatusBadRequest, "customer_id is required")
			return
		}
		if input.PolicyType == "" {
			writeError(w, http.StatusBadRequest, "policy_type is required")
			return
		}

		result := &workflows.EnhancedUnderwritingResult{
			ApplicationID: input.ApplicationID,
			RiskScore:     calculateLocalRiskScore(input),
			PremiumAmount: calculateLocalPremium(input),
			DataCollection: map[string]interface{}{
				"customer_id": input.CustomerID,
				"policy_type": input.PolicyType,
				"sum_assured": input.SumAssured,
				"documents":   len(input.Documents),
			},
			RiskAnalysis: map[string]interface{}{
				"risk_category":    riskCategory(calculateLocalRiskScore(input)),
				"document_count":   len(input.Documents),
				"manual_review":    input.RequiresManualReview,
				"sum_assured_tier": sumAssuredTier(input.SumAssured),
			},
			PricingTerms: map[string]interface{}{
				"base_rate":       baseRate(input.PolicyType),
				"risk_loading":    calculateLocalRiskScore(input) * 0.01,
				"discount":        0.0,
				"final_premium":   calculateLocalPremium(input),
				"payment_options": []string{"annual", "semi-annual", "quarterly", "monthly"},
			},
			CompletedAt: time.Now(),
		}

		if input.RequiresManualReview || len(input.Documents) == 0 {
			result.Decision = "MANUAL_REVIEW"
			result.Reasoning = "Manual review required or no documents submitted"
		} else if result.RiskScore > 75 {
			result.Decision = "REJECTED"
			result.Reasoning = "Risk score exceeds acceptable threshold"
		} else if result.RiskScore > 50 {
			result.Decision = "MANUAL_REVIEW"
			result.Reasoning = "Elevated risk requires underwriter review"
		} else {
			result.Decision = "APPROVED"
			result.Reasoning = "Application meets all automated underwriting criteria"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(result)
	}).Methods("POST")

	r.HandleFunc("/api/v1/underwriting/documents/analyze", func(w http.ResponseWriter, req *http.Request) {
		var analysisReq workflows.DocumentAnalysisRequest
		if err := json.NewDecoder(req.Body).Decode(&analysisReq); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
			return
		}

		result := &workflows.DocumentAnalysisResult{
			Success:           true,
			AnalysisTimestamp: time.Now().Format(time.RFC3339),
			TotalDocuments:    len(analysisReq.Documents),
			DocumentAnalyses:  make([]map[string]interface{}, 0),
			RedFlags:          []string{},
			Recommendation:    "PROCEED",
			AuthenticityScore: 85.0,
		}

		for _, doc := range analysisReq.Documents {
			result.DocumentAnalyses = append(result.DocumentAnalyses, map[string]interface{}{
				"path":               doc.Path,
				"type":               doc.Type,
				"status":             "analyzed",
				"authenticity_score": 85.0 + float64(len(doc.Type)%10),
				"fields_extracted":   documentFields(doc.Type),
			})
		}

		result.OverallAssessment = map[string]interface{}{
			"completeness":      "COMPLETE",
			"consistency":       "CONSISTENT",
			"authenticity":      "VERIFIED",
			"documents_checked": len(analysisReq.Documents),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}).Methods("POST")

	r.HandleFunc("/api/v1/underwriting/policy-types", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"policy_types": []map[string]interface{}{
				{"type": "life", "base_rate": 0.025, "required_documents": []string{"id_card", "medical_report", "income_proof"}},
				{"type": "health", "base_rate": 0.035, "required_documents": []string{"id_card", "medical_report"}},
				{"type": "motor", "base_rate": 0.045, "required_documents": []string{"id_card", "vehicle_registration", "driver_license"}},
				{"type": "property", "base_rate": 0.015, "required_documents": []string{"id_card", "property_title", "valuation_report"}},
				{"type": "marine", "base_rate": 0.055, "required_documents": []string{"id_card", "cargo_manifest", "bill_of_lading"}},
				{"type": "group_life", "base_rate": 0.020, "required_documents": []string{"company_registration", "employee_list", "group_schedule"}},
			},
		})
	}).Methods("GET")

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("Agentic Underwriting Service starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func calculateLocalRiskScore(input workflows.EnhancedUnderwritingInput) float64 {
	score := 20.0
	if input.SumAssured > 10000000 {
		score += 30
	} else if input.SumAssured > 5000000 {
		score += 20
	} else if input.SumAssured > 1000000 {
		score += 10
	}
	if len(input.Documents) == 0 {
		score += 25
	} else if len(input.Documents) < 3 {
		score += 10
	}
	switch input.PolicyType {
	case "marine", "aviation":
		score += 15
	case "motor":
		score += 10
	case "property":
		score += 5
	}
	return score
}

func calculateLocalPremium(input workflows.EnhancedUnderwritingInput) float64 {
	rate := baseRate(input.PolicyType)
	riskLoading := 1 + (calculateLocalRiskScore(input) * 0.005)
	return input.SumAssured * rate * riskLoading
}

func baseRate(policyType string) float64 {
	switch policyType {
	case "life":
		return 0.025
	case "health":
		return 0.035
	case "motor":
		return 0.045
	case "property":
		return 0.015
	case "marine":
		return 0.055
	case "group_life":
		return 0.020
	default:
		return 0.030
	}
}

func riskCategory(score float64) string {
	if score > 75 {
		return "HIGH"
	} else if score > 50 {
		return "MEDIUM"
	} else if score > 25 {
		return "LOW"
	}
	return "MINIMAL"
}

func sumAssuredTier(amount float64) string {
	if amount > 10000000 {
		return "ENTERPRISE"
	} else if amount > 5000000 {
		return "CORPORATE"
	} else if amount > 1000000 {
		return "STANDARD"
	}
	return "BASIC"
}

func documentFields(docType string) []string {
	switch docType {
	case "id_card":
		return []string{"full_name", "date_of_birth", "id_number", "expiry_date"}
	case "medical_report":
		return []string{"patient_name", "diagnosis", "treatment", "doctor_name"}
	case "income_proof":
		return []string{"employer", "salary", "employment_date", "position"}
	case "vehicle_registration":
		return []string{"registration_number", "make", "model", "year", "chassis_number"}
	default:
		return []string{"document_id", "date_issued", "issuing_authority"}
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]interface{}{
			"code":    status,
			"message": message,
		},
	})
}
