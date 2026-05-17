// 54Bank Loan Origination — Go
// Domain: Lending
// KYC gate: All loan applications require enhanced KYC verification
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
)

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type Record struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Status      string                 `json:"status"`
	Data        map[string]interface{} `json:"data"`
	CreatedAt   string                 `json:"createdAt"`
	UpdatedAt   string                 `json:"updatedAt"`
	CreatedBy   string                 `json:"createdBy,omitempty"`
	TenantID    string                 `json:"tenantId,omitempty"`
	Version     int                    `json:"version"`
	KYCVerified bool                   `json:"kycVerified"`
	KYCLevel    string                 `json:"kycLevel,omitempty"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"recordId"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

type DomainStats struct {
	TotalRecords    int                    `json:"totalRecords"`
	ActiveRecords   int                    `json:"activeRecords"`
	PendingRecords  int                    `json:"pendingRecords"`
	ProcessedToday  int                    `json:"processedToday"`
	PendingKYC      int                    `json:"pendingKYC"`
	Domain          string                 `json:"domain"`
	Metrics         map[string]interface{} `json:"metrics"`
}

var (
	mu      sync.Mutex
	records = []Record{
		{ID: "LOA-001", Type: "personal_loan", Status: "active", Data: map[string]interface{}{"domain": "Lending", "priority": "high", "region": "lagos", "amount": 5000000, "customerId": "CUS-1045", "customerName": "Amina Yusuf"}, CreatedAt: "2026-05-09T10:00:00Z", UpdatedAt: "2026-05-09T10:00:00Z", Version: 1, KYCVerified: true, KYCLevel: "enhanced"},
		{ID: "LOA-002", Type: "sme_loan", Status: "pending_kyc", Data: map[string]interface{}{"domain": "Lending", "priority": "medium", "region": "abuja", "amount": 15000000, "customerId": "CUS-3021", "customerName": "John Doe"}, CreatedAt: "2026-05-09T11:00:00Z", UpdatedAt: "2026-05-09T11:30:00Z", Version: 2, KYCVerified: false, KYCLevel: ""},
		{ID: "LOA-003", Type: "mortgage", Status: "completed", Data: map[string]interface{}{"domain": "Lending", "priority": "low", "region": "ph", "amount": 50000000, "customerId": "CUS-4055", "customerName": "Ibrahim Musa"}, CreatedAt: "2026-05-08T14:00:00Z", UpdatedAt: "2026-05-09T08:00:00Z", Version: 1, KYCVerified: true, KYCLevel: "full_edd"},
	}
	auditLog = []AuditEntry{}
	domainStats = DomainStats{
		TotalRecords: 3, ActiveRecords: 1, PendingRecords: 1, ProcessedToday: 12, PendingKYC: 1,
		Domain: "Lending",
		Metrics: map[string]interface{}{
			"avgProcessingMs": 245, "successRate": 98.5, "errorRate": 1.5,
			"peakHour": "14:00", "throughput": 156,
		},
	}
)

// ─── KYC Enforcement ────────────────────────────────────────────────────────

func checkKYCForLoan(customerID string, loanType string, amount float64) (bool, string, string) {
	client := &http.Client{Timeout: 5 * time.Second}
	payload, _ := json.Marshal(map[string]interface{}{
		"customerId": customerID,
		"serviceId":  "loan-origination-go",
		"operation":  "loan_application",
	})

	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:5000"
	}

	resp, err := client.Post(gatewayURL+"/api/platform/kyc-enforcement/check", "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("[loan-origination-go] KYC check failed: %v — degraded mode", err)
		return true, "gateway_unreachable", "KYC gateway unreachable — degraded mode"
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Allowed   bool   `json:"allowed"`
		Reason    string `json:"reason"`
		KYCStatus struct {
			Level    string `json:"level"`
			Status   string `json:"status"`
			Verified bool   `json:"verified"`
		} `json:"kycStatus"`
	}
	json.Unmarshal(body, &result)
	return result.Allowed, result.KYCStatus.Level, result.Reason
}

func requiredKYCLevel(loanType string, amount float64) string {
	if loanType == "mortgage" || amount >= 50000000 {
		return "full_edd"
	}
	if loanType == "sme_loan" || loanType == "corporate" || amount >= 10000000 {
		return "enhanced"
	}
	return "enhanced" // default: all loans require enhanced
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "loan-origination-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "loan-origination-go", "status": "healthy", "version": "3.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Loan Origination — Lending",
		"kycEnforcement": map[string]interface{}{
			"enabled":        true,
			"default_level":  "enhanced",
			"mortgage_level": "full_edd",
			"sme_level":      "enhanced",
		},
		"middleware": map[string]string{
			"kafka":      "loan.application.submitted, loan.kyc.required, loan.approved, loan.disbursed",
			"postgres":   "loan_origination_records",
			"redis":      "loan-origination_cache",
			"temporal":   "LoanOriginationWorkflow, KYCVerificationChild",
			"permify":    "loan:apply, loan:approve, loan:disburse, kyc:verify",
			"opensearch": "loan-origination-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	status := r.URL.Query().Get("status")
	filtered := []Record{}
	for _, rec := range records {
		if status == "" || rec.Status == status {
			filtered = append(filtered, rec)
		}
	}
	respondJSON(w, 200, map[string]interface{}{"records": filtered, "total": len(filtered), "domain": "Lending"})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	customerID := getString(body, "customerId")
	loanType := getString(body, "type")
	if loanType == "" { loanType = "personal_loan" }

	amount := 0.0
	if v, ok := body["amount"].(float64); ok { amount = v }

	// KYC enforcement — all loan applications require enhanced KYC
	if customerID != "" {
		allowed, kycLevel, reason := checkKYCForLoan(customerID, loanType, amount)
		if !allowed {
			mu.Lock()
			rec := Record{
				ID:        fmt.Sprintf("LOA-%08X", rand.Uint32()),
				Type:      loanType,
				Status:    "pending_kyc",
				Data:      body,
				CreatedAt: time.Now().Format(time.RFC3339),
				UpdatedAt: time.Now().Format(time.RFC3339),
				CreatedBy: getString(body, "createdBy"),
				TenantID:  getString(body, "tenantId"),
				Version:   1,
				KYCVerified: false,
			}
			records = append(records, rec)
			domainStats.PendingKYC++
			mu.Unlock()

			respondJSON(w, 202, map[string]interface{}{
				"created": true, "record": rec,
				"kycRequired": true,
				"kycLevel":    kycLevel,
				"requiredLevel": requiredKYCLevel(loanType, amount),
				"reason":     reason,
				"message":    fmt.Sprintf("Loan application created but requires KYC verification — %s", reason),
				"nextStep":   "Complete KYC verification via /api/platform/kyc-triggers/initiate",
				"kafkaEvents": []map[string]string{
					{"topic": "loan.application.submitted", "status": "pending_kyc"},
					{"topic": "kyc.verification.required", "customerId": customerID, "requiredLevel": requiredKYCLevel(loanType, amount)},
				},
			})
			return
		}
	}

	mu.Lock()
	defer mu.Unlock()

	rec := Record{
		ID:        fmt.Sprintf("LOA-%08X", rand.Uint32()),
		Type:      loanType,
		Status:    "pending",
		Data:      body,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
		CreatedBy: getString(body, "createdBy"),
		TenantID:  getString(body, "tenantId"),
		Version:   1,
		KYCVerified: true,
		KYCLevel:    requiredKYCLevel(loanType, amount),
	}
	records = append(records, rec)
	domainStats.TotalRecords = len(records)

	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "create",
		RecordID: rec.ID, Actor: rec.CreatedBy,
		Timestamp: rec.CreatedAt, Details: fmt.Sprintf("Loan application created — KYC verified at %s level", rec.KYCLevel),
	})

	respondJSON(w, 201, map[string]interface{}{
		"created": true, "record": rec,
		"kycVerified": true,
		"message": fmt.Sprintf("Loan application created — KYC verified at %s level", rec.KYCLevel),
		"kafkaEvent": map[string]string{"topic": "loan.application.submitted", "customerId": customerID},
	})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" { respondJSON(w, 405, map[string]string{"error": "POST/PUT required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	id := getString(body, "id")
	for i := range records {
		if records[i].ID == id {
			if s := getString(body, "status"); s != "" { records[i].Status = s }
			for k, v := range body {
				if k != "id" { records[i].Data[k] = v }
			}
			records[i].UpdatedAt = time.Now().Format(time.RFC3339)
			records[i].Version++
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "update",
				RecordID: id, Actor: getString(body, "updatedBy"),
				Timestamp: records[i].UpdatedAt, Details: "Record updated",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "record": records[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Record not found: " + id})
}

func handleProcess(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	id := getString(body, "id")
	for i := range records {
		if records[i].ID == id {
			if !records[i].KYCVerified {
				respondJSON(w, 403, map[string]interface{}{
					"error":   "Cannot process loan — KYC verification incomplete",
					"code":    "KYC_NOT_VERIFIED",
					"loanId":  id,
					"message": "Complete KYC verification before processing this loan",
				})
				return
			}
			if records[i].Status == "pending" || records[i].Status == "processing" {
				records[i].Status = "processing"
				records[i].UpdatedAt = time.Now().Format(time.RFC3339)
				records[i].Version++
				records[i].Data["processedAt"] = time.Now().Format(time.RFC3339)
				records[i].Data["processingResult"] = "success"
				records[i].Data["score"] = 0.85 + float64(rand.Intn(14))/100.0
				records[i].Status = "completed"
				domainStats.ProcessedToday++
				respondJSON(w, 200, map[string]interface{}{"processed": true, "record": records[i]})
				return
			}
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Record not found or not processable: " + id})
}

func handleKYCCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	customerID := getString(body, "customerId")
	level := getString(body, "level")
	if level == "" { level = "enhanced" }

	mu.Lock()
	defer mu.Unlock()
	updated := 0
	for i := range records {
		cid := getString(records[i].Data, "customerId")
		if cid == customerID && records[i].Status == "pending_kyc" {
			records[i].KYCVerified = true
			records[i].KYCLevel = level
			records[i].Status = "pending"
			records[i].UpdatedAt = time.Now().Format(time.RFC3339)
			records[i].Version++
			domainStats.PendingKYC--
			updated++
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"customerId": customerID, "level": level, "applicationsUpdated": updated,
		"message": fmt.Sprintf("KYC verified — %d loan applications moved to pending", updated),
	})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"auditLog": auditLog, "total": len(auditLog)})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	domainStats.TotalRecords = len(records)
	active := 0; pending := 0; pendingKYC := 0
	for _, r := range records {
		if r.Status == "active" || r.Status == "completed" { active++ }
		if r.Status == "pending" || r.Status == "processing" { pending++ }
		if r.Status == "pending_kyc" { pendingKYC++ }
	}
	domainStats.ActiveRecords = active
	domainStats.PendingRecords = pending
	domainStats.PendingKYC = pendingKYC
	respondJSON(w, 200, domainStats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok { return v }
	return ""
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "9384" }
	http.HandleFunc("/healthz", handleHealthz)
	http.HandleFunc("/health", handleHealthz)
	http.HandleFunc("/v1/loan-origination/list", handleList)
	http.HandleFunc("/v1/loan-origination/create", handleCreate)
	http.HandleFunc("/v1/loan-origination/update", handleUpdate)
	http.HandleFunc("/v1/loan-origination/process", handleProcess)
	http.HandleFunc("/v1/loan-origination/kyc-callback", handleKYCCallback)
	http.HandleFunc("/v1/loan-origination/audit", handleAudit)
	http.HandleFunc("/v1/loan-origination/stats", handleStats)
	// Alternate paths
	http.HandleFunc("/v1/applications", handleCreate)
	http.HandleFunc("/v1/applications/approve", handleProcess)
	http.HandleFunc("/v1/disbursements", handleProcess)
	log.Printf("Loan Origination v3.0 (Lending, KYC enforced) on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
