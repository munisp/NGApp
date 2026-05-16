package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8106"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/ekyc/verify", handleVerify)
	mux.HandleFunc("/api/v1/ekyc/providers", handleProviders)
	mux.HandleFunc("/api/v1/ekyc/id-types/", handleIDTypes)
	mux.HandleFunc("/api/v1/ekyc/risk-level", handleRiskLevel)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"pan-african-ekyc"}`))
	})
	log.Printf("Pan-African eKYC starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

type VerifyRequest struct {
	Country     string `json:"country"`
	IDType      string `json:"id_type"`
	IDNumber    string `json:"id_number"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DateOfBirth string `json:"date_of_birth,omitempty"`
	PhoneNumber string `json:"phone_number,omitempty"`
}

type VerifyResponse struct {
	VerificationID string    `json:"verification_id"`
	Status         string    `json:"status"` // verified, failed, pending, partial
	Country        string    `json:"country"`
	IDType         string    `json:"id_type"`
	Confidence     float64   `json:"confidence"`
	NameMatch      bool      `json:"name_match"`
	DOBMatch       bool      `json:"dob_match"`
	PhotoMatch     float64   `json:"photo_match_score,omitempty"`
	Provider       string    `json:"provider"`
	VerifiedAt     time.Time `json:"verified_at"`
	RiskFlags      []string  `json:"risk_flags,omitempty"`
}

func handleVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req VerifyRequest
	json.NewDecoder(r.Body).Decode(&req)

	providerMap := map[string]string{
		"NG": "NIMC/VerifyMe", "KE": "IPRS/Smile Identity",
		"GH": "NIA/Appruve", "ZA": "DHA/Idenfy",
		"RW": "NIDA", "TZ": "NIDA/Smile Identity",
	}
	provider := providerMap[req.Country]
	if provider == "" {
		provider = "Smile Identity (Pan-African)"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(VerifyResponse{
		VerificationID: fmt.Sprintf("VRF-%d", time.Now().UnixNano()%1000000),
		Status:         "verified",
		Country:        req.Country,
		IDType:         req.IDType,
		Confidence:     0.97,
		NameMatch:      true,
		DOBMatch:       true,
		PhotoMatch:     0.95,
		Provider:       provider,
		VerifiedAt:     time.Now(),
	})
}

func handleProviders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"providers": []map[string]interface{}{
			{"name": "Smile Identity", "countries": []string{"NG", "KE", "GH", "ZA", "TZ", "UG", "RW"}, "type": "aggregator"},
			{"name": "VerifyMe", "countries": []string{"NG"}, "type": "local_specialist"},
			{"name": "Appruve", "countries": []string{"GH", "KE", "NG"}, "type": "aggregator"},
			{"name": "Prembly (Identitypass)", "countries": []string{"NG", "KE", "GH"}, "type": "aggregator"},
		},
	})
}

func handleIDTypes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"countries": map[string][]map[string]string{
			"NG": {
				{"type": "bvn", "name": "Bank Verification Number", "format": "11 digits"},
				{"type": "nin", "name": "National Identification Number", "format": "11 digits"},
				{"type": "drivers_license", "name": "Driver's License"},
				{"type": "voters_card", "name": "Voter's Card"},
				{"type": "passport", "name": "International Passport"},
			},
			"KE": {
				{"type": "national_id", "name": "National ID", "format": "8 digits"},
				{"type": "kra_pin", "name": "KRA PIN"},
				{"type": "passport", "name": "Passport"},
			},
			"GH": {
				{"type": "ghana_card", "name": "Ghana Card", "format": "GHA-XXXXXXXXX-X"},
				{"type": "voters_id", "name": "Voter's ID"},
				{"type": "ssnit", "name": "SSNIT Number"},
			},
			"ZA": {
				{"type": "sa_id", "name": "South African ID Number", "format": "13 digits"},
				{"type": "passport", "name": "Passport"},
			},
		},
	})
}

func handleRiskLevel(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"levels": []map[string]interface{}{
			{"level": "basic", "requirements": []string{"Phone number verification", "Name + Date of Birth"}, "max_coverage": 100000, "products": []string{"microinsurance", "device_protect"}},
			{"level": "standard", "requirements": []string{"Government ID verification", "Selfie + Liveness check"}, "max_coverage": 5000000, "products": []string{"motor", "health", "funeral"}},
			{"level": "enhanced", "requirements": []string{"Full document verification", "Address verification", "Income verification"}, "max_coverage": 50000000, "products": []string{"comprehensive_motor", "term_life", "group_life"}},
		},
	})
}
