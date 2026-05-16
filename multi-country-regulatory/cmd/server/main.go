package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8105"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/regulatory/countries", handleCountries)
	mux.HandleFunc("/api/v1/regulatory/requirements/", handleRequirements)
	mux.HandleFunc("/api/v1/regulatory/compliance-check", handleComplianceCheck)
	mux.HandleFunc("/api/v1/regulatory/licenses", handleLicenses)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"multi-country-regulatory"}`))
	})
	log.Printf("Multi-Country Regulatory starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

type CountryRegulation struct {
	CountryCode    string   `json:"country_code"`
	CountryName    string   `json:"country_name"`
	Regulator      string   `json:"regulator"`
	RegulatorURL   string   `json:"regulator_url"`
	DataProtection string   `json:"data_protection_law"`
	KYCRequirements []string `json:"kyc_requirements"`
	LicenseTypes   []string `json:"license_types"`
	CapitalReq     string   `json:"minimum_capital_requirement"`
	TaxRates       map[string]float64 `json:"tax_rates"`
	Currency       string   `json:"currency"`
	MobileMoneyRegs string  `json:"mobile_money_regulations"`
	Status         string   `json:"status"` // active, planned, research
}

func handleCountries(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"countries": []CountryRegulation{
			{
				CountryCode: "NG", CountryName: "Nigeria", Regulator: "NAICOM",
				RegulatorURL: "https://naicom.gov.ng",
				DataProtection: "NDPR (Nigeria Data Protection Regulation)",
				KYCRequirements: []string{"BVN", "NIN", "Driver's License", "Voter's Card", "International Passport"},
				LicenseTypes: []string{"Life Insurance", "General Insurance", "Composite", "Microinsurance", "Takaful"},
				CapitalReq: "NGN 3B (Life), NGN 3B (General)",
				TaxRates: map[string]float64{"vat": 0.075, "stamp_duty": 0.0005, "naicom_levy": 0.01},
				Currency: "NGN", MobileMoneyRegs: "CBN Mobile Money Guidelines 2022",
				Status: "active",
			},
			{
				CountryCode: "KE", CountryName: "Kenya", Regulator: "IRA Kenya",
				RegulatorURL: "https://ira.go.ke",
				DataProtection: "Kenya Data Protection Act 2019",
				KYCRequirements: []string{"National ID", "KRA PIN", "Passport"},
				LicenseTypes: []string{"Life", "General", "Composite", "Micro"},
				CapitalReq: "KES 600M (Life), KES 300M (General)",
				TaxRates: map[string]float64{"vat": 0.16, "excise_duty": 0.20},
				Currency: "KES", MobileMoneyRegs: "M-Pesa regulated by CBK",
				Status: "planned",
			},
			{
				CountryCode: "GH", CountryName: "Ghana", Regulator: "NIC Ghana",
				RegulatorURL: "https://nicgh.org",
				DataProtection: "Ghana Data Protection Act 2012",
				KYCRequirements: []string{"Ghana Card", "Voter's ID", "Passport", "SSNIT"},
				LicenseTypes: []string{"Life", "Non-Life", "Composite", "Micro"},
				CapitalReq: "GHS 50M (Life), GHS 25M (Non-Life)",
				TaxRates: map[string]float64{"nhil": 0.025, "getfund": 0.025, "vat": 0.15},
				Currency: "GHS", MobileMoneyRegs: "E-Money Issuer License (BoG)",
				Status: "planned",
			},
			{
				CountryCode: "ZA", CountryName: "South Africa", Regulator: "FSCA / PA",
				RegulatorURL: "https://fsca.co.za",
				DataProtection: "POPIA (Protection of Personal Information Act)",
				KYCRequirements: []string{"SA ID Number", "Passport", "Proof of Address"},
				LicenseTypes: []string{"Long-term (Life)", "Short-term (General)", "Microinsurance"},
				CapitalReq: "ZAR 10M+ (risk-based capital)",
				TaxRates: map[string]float64{"vat": 0.15, "policy_levy": 0.001},
				Currency: "ZAR", MobileMoneyRegs: "FIC Act, SARB fintech sandbox",
				Status: "research",
			},
		},
	})
}

func handleRequirements(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"country":      "NG",
		"requirements": []string{
			"Annual statutory returns to NAICOM",
			"Quarterly financial statements",
			"Risk-based capital adequacy compliance",
			"NDPR data protection compliance",
			"Anti-money laundering (AML/CFT) compliance",
			"Motor insurance certificates via NMID",
			"Group life compliance (Pension Reform Act)",
			"Consumer protection guidelines",
		},
	})
}

func handleComplianceCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"country": "NG",
		"checks": []map[string]interface{}{
			{"requirement": "NAICOM License", "status": "compliant", "expires": "2027-03-31"},
			{"requirement": "NDPR Registration", "status": "compliant", "reference": "NDPR/2026/001"},
			{"requirement": "Capital Adequacy", "status": "compliant", "ratio": 1.85},
			{"requirement": "AML/CFT Program", "status": "compliant", "last_audit": "2026-01-15"},
			{"requirement": "NMID Integration", "status": "compliant", "certificates_issued": 15420},
			{"requirement": "Consumer Complaints Resolution", "status": "compliant", "avg_resolution_days": 3},
		},
		"overall_status": "fully_compliant",
	})
}

func handleLicenses(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"licenses": []map[string]interface{}{
			{"country": "NG", "type": "Composite", "status": "active", "number": "NAICOM/LIC/2024/001", "expires": "2027-03-31"},
			{"country": "NG", "type": "Microinsurance", "status": "active", "number": "NAICOM/MIC/2025/001", "expires": "2027-12-31"},
		},
	})
}
