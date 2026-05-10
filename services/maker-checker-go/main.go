package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

var port = getEnv("PORT", "8210")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "approval.requested,approval.approved,approval.rejected"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "pending-queue-cache,session-lock"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "approval_requests,approval_rules,approval_audit"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "approval-audit-trail"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "checker,maker,supervisor"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "approval:request,approval:approve,approval:reject,approval:escalate"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "approval-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "approval-completions"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "ApprovalWorkflow", "taskQueue": "approvals"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-approval-integration"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "transaction-hold-management"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "approval_history,approval_metrics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/approvals/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "approval-workflow-protection"},
}

type ApprovalRequest struct {
	ID            string  `json:"id"`
	Type          string  `json:"type"`
	Operation     string  `json:"operation"`
	Entity        string  `json:"entity"`
	EntityID      string  `json:"entityId"`
	Amount        float64 `json:"amount,omitempty"`
	Currency      string  `json:"currency,omitempty"`
	Status        string  `json:"status"`
	MakerID       string  `json:"makerId"`
	MakerName     string  `json:"makerName"`
	CheckerID     string  `json:"checkerId,omitempty"`
	CheckerName   string  `json:"checkerName,omitempty"`
	CreatedAt     string  `json:"createdAt"`
	ResolvedAt    string  `json:"resolvedAt,omitempty"`
	Level         int     `json:"approvalLevel"`
	MaxLevel      int     `json:"maxApprovalLevel"`
	Remarks       string  `json:"remarks,omitempty"`
	RiskScore     int     `json:"riskScore"`
	AutoEscalated bool    `json:"autoEscalated"`
}

type ApprovalRule struct {
	ID           string  `json:"id"`
	Operation    string  `json:"operation"`
	MinAmount    float64 `json:"minAmount"`
	MaxAmount    float64 `json:"maxAmount"`
	LevelsReq    int     `json:"levelsRequired"`
	Roles        []string `json:"requiredRoles"`
	SLAMinutes   int     `json:"slaMinutes"`
	AutoEscalate bool    `json:"autoEscalateOnSLABreach"`
}

var (
	requests []ApprovalRequest
	rules    []ApprovalRule
	mu       sync.RWMutex
)

func init() {
	rules = []ApprovalRule{
		{ID: "ARULE-001", Operation: "loan_disbursement", MinAmount: 0, MaxAmount: 5000000, LevelsReq: 1, Roles: []string{"branch-manager"}, SLAMinutes: 60, AutoEscalate: true},
		{ID: "ARULE-002", Operation: "loan_disbursement", MinAmount: 5000001, MaxAmount: 50000000, LevelsReq: 2, Roles: []string{"branch-manager", "regional-head"}, SLAMinutes: 120, AutoEscalate: true},
		{ID: "ARULE-003", Operation: "loan_disbursement", MinAmount: 50000001, MaxAmount: 1000000000, LevelsReq: 3, Roles: []string{"regional-head", "chief-risk-officer", "md"}, SLAMinutes: 480, AutoEscalate: true},
		{ID: "ARULE-004", Operation: "fund_transfer", MinAmount: 0, MaxAmount: 10000000, LevelsReq: 1, Roles: []string{"operations-officer"}, SLAMinutes: 30, AutoEscalate: false},
		{ID: "ARULE-005", Operation: "fund_transfer", MinAmount: 10000001, MaxAmount: 1000000000, LevelsReq: 2, Roles: []string{"operations-officer", "head-of-operations"}, SLAMinutes: 60, AutoEscalate: true},
		{ID: "ARULE-006", Operation: "product_creation", MinAmount: 0, MaxAmount: 0, LevelsReq: 2, Roles: []string{"product-manager", "head-of-retail"}, SLAMinutes: 1440, AutoEscalate: false},
		{ID: "ARULE-007", Operation: "gl_manual_entry", MinAmount: 0, MaxAmount: 1000000000, LevelsReq: 2, Roles: []string{"gl-officer", "chief-finance-officer"}, SLAMinutes: 240, AutoEscalate: true},
		{ID: "ARULE-008", Operation: "customer_onboarding", MinAmount: 0, MaxAmount: 0, LevelsReq: 1, Roles: []string{"kyc-officer"}, SLAMinutes: 120, AutoEscalate: false},
	}

	requests = []ApprovalRequest{
		{ID: "APR-001", Type: "financial", Operation: "loan_disbursement", Entity: "loan", EntityID: "LN-005678", Amount: 15000000, Currency: "NGN", Status: "approved", MakerID: "USR-101", MakerName: "Adebayo Olumide", CheckerID: "USR-201", CheckerName: "Fatima Abdullahi", CreatedAt: "2026-05-10T10:30:00Z", ResolvedAt: "2026-05-10T11:15:00Z", Level: 2, MaxLevel: 2, RiskScore: 65, AutoEscalated: false},
		{ID: "APR-002", Type: "financial", Operation: "fund_transfer", Entity: "payment", EntityID: "PAY-089012", Amount: 50000000, Currency: "NGN", Status: "pending", MakerID: "USR-102", MakerName: "Chinedu Okafor", CreatedAt: "2026-05-10T14:00:00Z", Level: 1, MaxLevel: 2, RiskScore: 78, AutoEscalated: false},
		{ID: "APR-003", Type: "config", Operation: "product_creation", Entity: "product", EntityID: "PROD-NEW-001", Amount: 0, Currency: "", Status: "pending", MakerID: "USR-103", MakerName: "Ngozi Eze", CreatedAt: "2026-05-10T09:00:00Z", Level: 1, MaxLevel: 2, RiskScore: 30, AutoEscalated: false},
		{ID: "APR-004", Type: "financial", Operation: "gl_manual_entry", Entity: "gl_entry", EntityID: "JV-2026-001", Amount: 125000000, Currency: "NGN", Status: "rejected", MakerID: "USR-104", MakerName: "Emeka Uche", CheckerID: "USR-202", CheckerName: "Amina Bello", CreatedAt: "2026-05-10T08:00:00Z", ResolvedAt: "2026-05-10T12:00:00Z", Level: 1, MaxLevel: 2, Remarks: "Insufficient documentation for journal voucher", RiskScore: 92, AutoEscalated: false},
		{ID: "APR-005", Type: "financial", Operation: "loan_disbursement", Entity: "loan", EntityID: "LN-009999", Amount: 75000000, Currency: "NGN", Status: "escalated", MakerID: "USR-105", MakerName: "Oluwaseun Adeyemi", CreatedAt: "2026-05-09T16:00:00Z", Level: 2, MaxLevel: 3, RiskScore: 88, AutoEscalated: true},
		{ID: "APR-006", Type: "operational", Operation: "customer_onboarding", Entity: "customer", EntityID: "CIF-NEW-234", Amount: 0, Currency: "", Status: "approved", MakerID: "USR-106", MakerName: "Blessing Okonkwo", CheckerID: "USR-203", CheckerName: "Hassan Ibrahim", CreatedAt: "2026-05-10T11:00:00Z", ResolvedAt: "2026-05-10T11:45:00Z", Level: 1, MaxLevel: 1, RiskScore: 15, AutoEscalated: false},
		{ID: "APR-007", Type: "financial", Operation: "fund_transfer", Entity: "payment", EntityID: "PAY-SWIFT-001", Amount: 250000000, Currency: "NGN", Status: "pending", MakerID: "USR-107", MakerName: "Yusuf Mohammed", CreatedAt: "2026-05-10T15:30:00Z", Level: 1, MaxLevel: 2, RiskScore: 95, AutoEscalated: false},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "maker-checker")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		pending := 0
		for _, req := range requests { if req.Status == "pending" { pending++ } }
		mu.RUnlock()
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "maker-checker",
			"queue": map[string]int{"pending": pending, "rules": len(rules)},
			"middleware": middlewareConfig,
		})
	})

	mux.HandleFunc("/v1/approvals", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		status := r.URL.Query().Get("status")
		var filtered []ApprovalRequest
		for _, req := range requests {
			if status == "" || req.Status == status { filtered = append(filtered, req) }
		}
		if filtered == nil { filtered = []ApprovalRequest{} }
		jsonResponse(w, 200, map[string]interface{}{"items": filtered, "total": len(filtered)})
	})

	mux.HandleFunc("/v1/rules", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, map[string]interface{}{"items": rules, "total": len(rules)})
	})

	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		byStatus := map[string]int{}
		byOperation := map[string]int{}
		totalAmount := 0.0
		for _, req := range requests {
			byStatus[req.Status]++
			byOperation[req.Operation]++
			totalAmount += req.Amount
		}
		avgRisk := 0.0
		for _, req := range requests { avgRisk += float64(req.RiskScore) }
		avgRisk /= float64(len(requests))

		jsonResponse(w, 200, map[string]interface{}{
			"totalRequests": len(requests), "byStatus": byStatus, "byOperation": byOperation,
			"totalAmount": totalAmount, "avgRiskScore": int(avgRisk),
			"rules": len(rules), "slaBreaches": 1,
			"approvalLevels": map[string]string{"1": "single-checker", "2": "four-eyes", "3": "six-eyes"},
		})
	})

	mux.HandleFunc("/v1/approvals/", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Path[len("/v1/approvals/"):]
		if r.Method == http.MethodPost && (id == "" || len(id) < 3) {
			// Create new approval
			var req ApprovalRequest
			json.NewDecoder(r.Body).Decode(&req)
			if req.Operation == "" { jsonResponse(w, 400, map[string]string{"error": "operation is required"}); return }
			req.ID = fmt.Sprintf("APR-%03d", len(requests)+1)
			req.Status = "pending"
			req.CreatedAt = time.Now().UTC().Format(time.RFC3339)
			req.Level = 1
			mu.Lock()
			requests = append(requests, req)
			mu.Unlock()
			jsonResponse(w, 201, req)
			return
		}
		mu.RLock()
		defer mu.RUnlock()
		for _, req := range requests {
			if req.ID == id {
				jsonResponse(w, 200, req)
				return
			}
		}
		jsonResponse(w, 404, map[string]string{"error": "Approval request not found"})
	})

	log.Printf("[maker-checker] Listening on :%s with %d rules, %d requests (%d pending)\n", port, len(rules), len(requests), func() int {
		c := 0; for _, r := range requests { if r.Status == "pending" { c++ } }; return c
	}())
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
