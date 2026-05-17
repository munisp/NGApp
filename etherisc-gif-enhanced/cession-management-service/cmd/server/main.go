package main

import (
	"cession-management-service/internal/model"
	"cession-management-service/internal/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8120"
	}

	svc := service.NewCessionService()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "cession-management-service"})
	})

	mux.HandleFunc("/api/v1/cession/treaties", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			var treaty model.Treaty
			if err := json.NewDecoder(r.Body).Decode(&treaty); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			result, err := svc.CreateTreaty(r.Context(), treaty)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(result)
			return
		}
		treaties, _ := svc.GetTreaties(r.Context())
		json.NewEncoder(w).Encode(treaties)
	})

	mux.HandleFunc("/api/v1/cession/calculate", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			PolicyID   string  `json:"policy_id"`
			Premium    float64 `json:"premium"`
			SumAssured float64 `json:"sum_assured"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		result, err := svc.CalculateCession(r.Context(), req.PolicyID, req.Premium, req.SumAssured)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(result)
	})

	mux.HandleFunc("/api/v1/cession/cessions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		treatyID := r.URL.Query().Get("treaty_id")
		cessions, _ := svc.GetCessions(r.Context(), treatyID)
		json.NewEncoder(w).Encode(cessions)
	})

	log.Printf("Cession Management Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatalf("could not start server: %v", err)
	}
}
