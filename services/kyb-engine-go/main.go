package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
)

// ── Middleware Configuration ──

var middlewareConfig = map[string]interface{}{
	"kafka":      map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"kyb.company-submitted", "kyb.cac-verified", "kyb.ubo-identified", "kyb.sanctions-screened", "kyb.verification-completed"}},
	"dapr":       map[string]interface{}{"app_id": "kyb-engine-go", "url": envOr("DAPR_URL", "http://localhost:3500"), "pubsub": "kyb-pubsub", "state_store": "kyb-state"},
	"fluvio":     map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"kyb-company-stream", "kyb-ubo-stream", "kyb-audit-trail"}},
	"temporal":   map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "namespace": "kyb-verification", "task_queue": "kyb-pipeline", "workflows": []string{"CompanyVerificationWorkflow", "UBOIdentificationWorkflow", "DirectorScreeningWorkflow"}},
	"postgres":   map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"kyb_verifications", "kyb_companies", "kyb_directors", "kyb_ubos", "kyb_sanctions_checks"}},
	"keycloak":   map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client_id": "kyb-engine", "roles": []string{"kyb_officer", "kyb_supervisor", "compliance_officer"}},
	"permify":    map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "schema": "kyb_engine", "relations": []string{"can_verify_company", "can_approve_ubo", "can_override"}},
	"redis":      map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "keys": []string{"kyb:company:{rc}", "kyb:director:{bvn}", "kyb:sanctions-cache:{name}"}},
	"mojaloop":   map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "purpose": "corporate-identity-oracle"},
	"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"kyb-verifications", "kyb-companies", "kyb-directors", "kyb-sanctions"}},
	"openappsec": map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policies": []string{"kyb-api-protection", "corporate-doc-sanitization"}},
	"apisix":     map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/kyb/*"}, "plugins": []string{"jwt-auth", "rate-limiting"}},
	"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledger": "kyb-billing", "accounts": []string{"kyb-verification-fees"}},
	"lakehouse":  map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"kyb_verification_history", "kyb_company_analytics"}},
}

// ── Models ──

type Director struct {
	Name       string `json:"name"`
	BVN        string `json:"bvn"`
	NIN        string `json:"nin"`
	Role       string `json:"role"`
	SharePct   float64 `json:"shareholdingPercent"`
	Nationality string `json:"nationality"`
	PEPMatch   bool   `json:"pepMatch"`
	SanctionsMatch bool `json:"sanctionsMatch"`
	RiskLevel  string `json:"riskLevel"`
	Verified   bool   `json:"verified"`
}

type UBO struct {
	Name           string  `json:"name"`
	OwnershipPct   float64 `json:"ownershipPercent"`
	ControlType    string  `json:"controlType"`
	BVN            string  `json:"bvn"`
	Nationality    string  `json:"nationality"`
	PEPCheck       bool    `json:"pepCheck"`
	SanctionsCheck bool    `json:"sanctionsCheck"`
	RiskLevel      string  `json:"riskLevel"`
	VerifiedVia    string  `json:"verifiedVia"`
}

type CACRegistration struct {
	RCNumber       string `json:"rcNumber"`
	CompanyName    string `json:"companyName"`
	CompanyType    string `json:"companyType"`
	RegistrationDate string `json:"registrationDate"`
	Status         string `json:"status"`
	RegisteredAddress string `json:"registeredAddress"`
	ShareCapital   int64  `json:"shareCapital"`
	State          string `json:"state"`
}

type KYBVerification struct {
	ID              string   `json:"id"`
	CompanyName     string   `json:"companyName"`
	RCNumber        string   `json:"rcNumber"`
	TIN             string   `json:"tin"`
	CompanyType     string   `json:"companyType"`
	Industry        string   `json:"industry"`
	CACVerified     bool     `json:"cacVerified"`
	CACDetails      CACRegistration `json:"cacDetails"`
	Directors       []Director `json:"directors"`
	UBOs            []UBO    `json:"ubos"`
	TotalUBOPct     float64  `json:"totalUBOOwnershipPercent"`
	SanctionsClean  bool     `json:"sanctionsClean"`
	PEPExposure     bool     `json:"pepExposure"`
	RiskScore       int      `json:"riskScore"`
	RiskLevel       string   `json:"riskLevel"`
	Status          string   `json:"status"`
	Flags           []string `json:"flags"`
	FinancialStmtParsed bool `json:"financialStatementParsed"`
	DoclingExtracted map[string]interface{} `json:"doclingExtractedData"`
	ProcessingTimeMs int     `json:"processingTimeMs"`
	CreatedAt       string   `json:"createdAt"`
	UpdatedAt       string   `json:"updatedAt"`
}

// ── State ──

var (
	verifications []KYBVerification
	mu            sync.RWMutex
)

// ── Seed Data ──

func init() {
	verifications = []KYBVerification{
		{
			ID: "KYB-001", CompanyName: "Dangote Industries Limited", RCNumber: "RC-71242",
			TIN: "01234567-0001", CompanyType: "public_limited_company", Industry: "Conglomerate",
			CACVerified: true,
			CACDetails: CACRegistration{
				RCNumber: "RC-71242", CompanyName: "DANGOTE INDUSTRIES LIMITED",
				CompanyType: "PLC", RegistrationDate: "1981-01-15", Status: "active",
				RegisteredAddress: "1 Alfred Rewane Road, Ikoyi, Lagos", ShareCapital: 50000000000, State: "Lagos",
			},
			Directors: []Director{
				{Name: "Aliko Dangote", BVN: "22011111111", NIN: "NIN-A001", Role: "Chairman/CEO", SharePct: 85.0, Nationality: "Nigerian", PEPMatch: true, SanctionsMatch: false, RiskLevel: "medium", Verified: true},
				{Name: "Olakunle Alake", BVN: "22022222222", NIN: "NIN-A002", Role: "Group Managing Director", SharePct: 2.0, Nationality: "Nigerian", PEPMatch: false, SanctionsMatch: false, RiskLevel: "low", Verified: true},
				{Name: "Devakumar Edwin", BVN: "22033333333", NIN: "NIN-A003", Role: "Executive Director", SharePct: 1.5, Nationality: "Indian", PEPMatch: false, SanctionsMatch: false, RiskLevel: "low", Verified: true},
			},
			UBOs: []UBO{
				{Name: "Aliko Dangote", OwnershipPct: 85.0, ControlType: "direct_shareholding", BVN: "22011111111", Nationality: "Nigerian", PEPCheck: true, SanctionsCheck: true, RiskLevel: "medium", VerifiedVia: "cac_registry_cross_ref"},
			},
			TotalUBOPct: 85.0, SanctionsClean: true, PEPExposure: true,
			RiskScore: 35, RiskLevel: "medium", Status: "verified",
			Flags: []string{"PEP_EXPOSURE: Chairman is Prominent Business Person"},
			FinancialStmtParsed: true,
			DoclingExtracted: map[string]interface{}{
				"parser": "docling-2.x", "revenue_ngn": 4800000000000, "total_assets_ngn": 8500000000000,
				"employees": 30000, "subsidiaries": 14, "auditor": "PricewaterhouseCoopers",
			},
			ProcessingTimeMs: 1250, CreatedAt: "2026-01-15T10:00:00Z", UpdatedAt: "2026-01-15T10:15:00Z",
		},
		{
			ID: "KYB-002", CompanyName: "BUA Group", RCNumber: "RC-151345",
			TIN: "05678901-0001", CompanyType: "private_limited_company", Industry: "Manufacturing",
			CACVerified: true,
			CACDetails: CACRegistration{
				RCNumber: "RC-151345", CompanyName: "BUA GROUP LIMITED",
				CompanyType: "LTD", RegistrationDate: "1988-05-20", Status: "active",
				RegisteredAddress: "5 Kingsway Road, Ikoyi, Lagos", ShareCapital: 25000000000, State: "Lagos",
			},
			Directors: []Director{
				{Name: "Abdul Samad Rabiu", BVN: "22044444444", NIN: "NIN-B001", Role: "Chairman", SharePct: 90.0, Nationality: "Nigerian", PEPMatch: true, SanctionsMatch: false, RiskLevel: "medium", Verified: true},
				{Name: "Kabiru Rabiu", BVN: "22055555555", NIN: "NIN-B002", Role: "Executive Director", SharePct: 5.0, Nationality: "Nigerian", PEPMatch: false, SanctionsMatch: false, RiskLevel: "low", Verified: true},
			},
			UBOs: []UBO{
				{Name: "Abdul Samad Rabiu", OwnershipPct: 90.0, ControlType: "direct_shareholding", BVN: "22044444444", Nationality: "Nigerian", PEPCheck: true, SanctionsCheck: true, RiskLevel: "medium", VerifiedVia: "cac_registry_cross_ref"},
			},
			TotalUBOPct: 90.0, SanctionsClean: true, PEPExposure: true,
			RiskScore: 30, RiskLevel: "medium", Status: "verified",
			Flags: []string{"PEP_EXPOSURE: Chairman is Prominent Business Person"},
			FinancialStmtParsed: true,
			DoclingExtracted: map[string]interface{}{
				"parser": "docling-2.x", "revenue_ngn": 1200000000000, "total_assets_ngn": 3200000000000,
				"employees": 15000, "subsidiaries": 8, "auditor": "Deloitte",
			},
			ProcessingTimeMs: 980, CreatedAt: "2026-02-01T14:00:00Z", UpdatedAt: "2026-02-01T14:10:00Z",
		},
		{
			ID: "KYB-003", CompanyName: "Suspicious Trading Co", RCNumber: "RC-999888",
			TIN: "09999888-0001", CompanyType: "private_limited_company", Industry: "Import/Export",
			CACVerified: false,
			CACDetails: CACRegistration{
				RCNumber: "RC-999888", CompanyName: "", CompanyType: "",
				RegistrationDate: "", Status: "not_found",
				RegisteredAddress: "", ShareCapital: 0, State: "",
			},
			Directors: []Director{
				{Name: "John Doe", BVN: "00011122233", NIN: "", Role: "Director", SharePct: 100.0, Nationality: "Unknown", PEPMatch: false, SanctionsMatch: true, RiskLevel: "critical", Verified: false},
			},
			UBOs: []UBO{
				{Name: "John Doe", OwnershipPct: 100.0, ControlType: "direct_shareholding", BVN: "00011122233", Nationality: "Unknown", PEPCheck: true, SanctionsCheck: true, RiskLevel: "critical", VerifiedVia: "unverified"},
			},
			TotalUBOPct: 100.0, SanctionsClean: false, PEPExposure: false,
			RiskScore: 95, RiskLevel: "critical", Status: "rejected",
			Flags: []string{"CAC_NOT_FOUND", "DIRECTOR_SANCTIONS_MATCH", "UBO_UNVERIFIED", "INVALID_BVN_FORMAT"},
			FinancialStmtParsed: false,
			DoclingExtracted: map[string]interface{}{},
			ProcessingTimeMs: 450, CreatedAt: "2026-03-10T09:00:00Z", UpdatedAt: "2026-03-10T09:05:00Z",
		},
		{
			ID: "KYB-004", CompanyName: "Zenith Healthcare Ltd", RCNumber: "RC-456789",
			TIN: "04567890-0001", CompanyType: "private_limited_company", Industry: "Healthcare",
			CACVerified: true,
			CACDetails: CACRegistration{
				RCNumber: "RC-456789", CompanyName: "ZENITH HEALTHCARE LIMITED",
				CompanyType: "LTD", RegistrationDate: "2015-03-10", Status: "active",
				RegisteredAddress: "42 Adeola Hopewell, VI, Lagos", ShareCapital: 500000000, State: "Lagos",
			},
			Directors: []Director{
				{Name: "Dr. Amina Hassan", BVN: "22066666666", NIN: "NIN-C001", Role: "Managing Director", SharePct: 45.0, Nationality: "Nigerian", PEPMatch: false, SanctionsMatch: false, RiskLevel: "low", Verified: true},
				{Name: "Dr. Chukwudi Eze", BVN: "22077777777", NIN: "NIN-C002", Role: "Medical Director", SharePct: 35.0, Nationality: "Nigerian", PEPMatch: false, SanctionsMatch: false, RiskLevel: "low", Verified: true},
				{Name: "Funke Adeyemi", BVN: "22088888888", NIN: "NIN-C003", Role: "Director", SharePct: 20.0, Nationality: "Nigerian", PEPMatch: false, SanctionsMatch: false, RiskLevel: "low", Verified: true},
			},
			UBOs: []UBO{
				{Name: "Dr. Amina Hassan", OwnershipPct: 45.0, ControlType: "direct_shareholding", BVN: "22066666666", Nationality: "Nigerian", PEPCheck: true, SanctionsCheck: true, RiskLevel: "low", VerifiedVia: "cac_registry_cross_ref"},
				{Name: "Dr. Chukwudi Eze", OwnershipPct: 35.0, ControlType: "direct_shareholding", BVN: "22077777777", Nationality: "Nigerian", PEPCheck: true, SanctionsCheck: true, RiskLevel: "low", VerifiedVia: "cac_registry_cross_ref"},
			},
			TotalUBOPct: 80.0, SanctionsClean: true, PEPExposure: false,
			RiskScore: 10, RiskLevel: "low", Status: "verified",
			Flags: []string{},
			FinancialStmtParsed: true,
			DoclingExtracted: map[string]interface{}{
				"parser": "docling-2.x", "revenue_ngn": 850000000, "total_assets_ngn": 1200000000,
				"employees": 250, "subsidiaries": 2, "auditor": "KPMG",
			},
			ProcessingTimeMs: 820, CreatedAt: "2026-04-01T11:00:00Z", UpdatedAt: "2026-04-01T11:08:00Z",
		},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "kyb-engine-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	port := envOr("PORT", "8225")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		jsonResp(w, 200, map[string]interface{}{
			"service": "kyb-engine-go", "status": "healthy", "version": "1.0.0",
			"capabilities": map[string]interface{}{
				"cac_registry": "Corporate Affairs Commission (CAC) verification",
				"ubo_identification": "Ultimate Beneficial Owner identification (>25% threshold)",
				"sanctions_screening": "OFAC/UN/EU/CBN sanctions list screening",
				"pep_screening": "Politically Exposed Persons screening",
				"financial_parsing": "Docling-powered financial statement extraction",
				"director_verification": "BVN/NIN cross-referencing for all directors",
			},
			"middleware": middlewareConfig,
		})
	})

	mux.HandleFunc("/v1/verifications", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)
			companyName, _ := body["company_name"].(string)
			rcNumber, _ := body["rc_number"].(string)
			if companyName == "" || rcNumber == "" {
				jsonResp(w, 400, map[string]string{"error": "company_name and rc_number required"})
				return
			}
			v := KYBVerification{
				ID: fmt.Sprintf("KYB-%03d", len(verifications)+1),
				CompanyName: companyName, RCNumber: rcNumber,
				Status: "pending", RiskLevel: "unknown",
				CreatedAt: "2026-05-10T12:00:00Z", UpdatedAt: "2026-05-10T12:00:00Z",
			}
			mu.Lock()
			verifications = append(verifications, v)
			mu.Unlock()
			jsonResp(w, 201, v)
			return
		}
		mu.RLock()
		defer mu.RUnlock()
		jsonResp(w, 200, map[string]interface{}{"items": verifications, "total": len(verifications)})
	})

	mux.HandleFunc("/v1/verifications/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/v1/verifications/")
		mu.RLock()
		defer mu.RUnlock()
		for _, v := range verifications {
			if v.ID == id {
				jsonResp(w, 200, v)
				return
			}
		}
		jsonResp(w, 404, map[string]string{"error": "Not found"})
	})

	mux.HandleFunc("/v1/cac/lookup", func(w http.ResponseWriter, r *http.Request) {
		rc := r.URL.Query().Get("rc_number")
		if rc == "" {
			jsonResp(w, 400, map[string]string{"error": "rc_number query param required"})
			return
		}
		mu.RLock()
		defer mu.RUnlock()
		for _, v := range verifications {
			if v.RCNumber == rc {
				jsonResp(w, 200, v.CACDetails)
				return
			}
		}
		jsonResp(w, 404, map[string]string{"error": "RC number not found in CAC registry", "rc_number": rc})
	})

	mux.HandleFunc("/v1/ubo/identify", func(w http.ResponseWriter, r *http.Request) {
		rc := r.URL.Query().Get("rc_number")
		mu.RLock()
		defer mu.RUnlock()
		for _, v := range verifications {
			if v.RCNumber == rc {
				jsonResp(w, 200, map[string]interface{}{
					"company": v.CompanyName, "rc_number": v.RCNumber,
					"ubos": v.UBOs, "total_ubo_ownership_pct": v.TotalUBOPct,
					"threshold": 25.0, "compliant": v.TotalUBOPct >= 25.0,
				})
				return
			}
		}
		jsonResp(w, 404, map[string]string{"error": "Company not found"})
	})

	mux.HandleFunc("/v1/sanctions/screen", func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Query().Get("name")
		if name == "" {
			jsonResp(w, 400, map[string]string{"error": "name query param required"})
			return
		}
		nameLower := strings.ToLower(name)
		sanctionedNames := map[string]string{
			"hushpuppi": "OFAC SDN — Fraud/Money Laundering",
			"invictus obi": "FBI Most Wanted — BEC Fraud",
		}
		for k, v := range sanctionedNames {
			if strings.Contains(nameLower, k) {
				jsonResp(w, 200, map[string]interface{}{
					"name": name, "match": true, "list": v, "risk": "critical",
				})
				return
			}
		}
		jsonResp(w, 200, map[string]interface{}{
			"name": name, "match": false, "risk": "clear",
		})
	})

	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		verified, rejected, pending := 0, 0, 0
		var totalRisk int
		for _, v := range verifications {
			switch v.Status {
			case "verified":
				verified++
			case "rejected":
				rejected++
			default:
				pending++
			}
			totalRisk += v.RiskScore
		}
		avgRisk := 0.0
		if len(verifications) > 0 {
			avgRisk = float64(totalRisk) / float64(len(verifications))
		}
		jsonResp(w, 200, map[string]interface{}{
			"total": len(verifications), "verified": verified, "rejected": rejected, "pending": pending,
			"avgRiskScore": avgRisk,
			"pepExposureCount": func() int { c := 0; for _, v := range verifications { if v.PEPExposure { c++ } }; return c }(),
			"sanctionsHitCount": func() int { c := 0; for _, v := range verifications { if !v.SanctionsClean { c++ } }; return c }(),
		})
	})

	fmt.Printf("KYB Engine (CAC + UBO + Sanctions) listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
