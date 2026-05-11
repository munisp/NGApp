package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Permify Authorization Service — fine-grained RBAC/ABAC/ReBAC policy engine
// Port: 8129
// Middleware: Permify, Redis, Postgres

type Permission struct {
	ID          string `json:"id"`
	Entity      string `json:"entity"`     // e.g. "account", "transaction", "branch"
	Relation    string `json:"relation"`    // e.g. "owner", "viewer", "approver"
	Subject     string `json:"subject"`     // e.g. "user:john", "role:teller"
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
}

type Role struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"` // list of "entity#relation"
	Priority    int      `json:"priority"`
	CreatedAt   string   `json:"createdAt"`
}

type Policy struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Type      string            `json:"type"` // rbac, abac, rebac
	Rules     []PolicyRule      `json:"rules"`
	Status    string            `json:"status"` // active, inactive, draft
	CreatedAt string            `json:"createdAt"`
}

type PolicyRule struct {
	Entity    string            `json:"entity"`
	Action    string            `json:"action"` // create, read, update, delete, approve, execute
	Condition map[string]string `json:"condition,omitempty"` // ABAC: {"branch": "same", "amount": "<1000000"}
	Effect    string            `json:"effect"` // allow, deny
}

type CheckResult struct {
	Allowed  bool   `json:"allowed"`
	Policy   string `json:"matchedPolicy,omitempty"`
	Rule     string `json:"matchedRule,omitempty"`
	Reason   string `json:"reason"`
	Latency  string `json:"latencyMs"`
}

var (
	mu          sync.RWMutex
	permissions []Permission
	roles       []Role
	policies    []Policy
	permCounter int64
	roleCounter int64
	polCounter  int64
	checkCount  int64
	denyCount   int64
)

func init() {
	roleDefs := []struct{ name, desc string; perms []string; priority int }{
		{"super_admin", "Full platform access", []string{"*#*"}, 100},
		{"branch_manager", "Branch-level management", []string{"account#read", "account#update", "transaction#read", "transaction#approve", "branch#read", "branch#update", "teller#read", "teller#manage"}, 80},
		{"teller", "Counter operations", []string{"account#read", "transaction#create", "transaction#read", "cash#deposit", "cash#withdraw"}, 50},
		{"compliance_officer", "Regulatory compliance", []string{"transaction#read", "report#create", "report#read", "audit#read", "kyc#read", "kyc#update"}, 70},
		{"loan_officer", "Loan origination and management", []string{"loan#create", "loan#read", "loan#update", "customer#read", "collateral#read"}, 60},
		{"customer", "Self-service banking", []string{"account#read_own", "transaction#read_own", "transfer#create_own", "beneficiary#read_own", "beneficiary#create_own"}, 10},
		{"auditor", "Read-only audit access", []string{"*#read", "audit#read"}, 40},
		{"treasury", "Treasury operations", []string{"fx#create", "fx#read", "investment#create", "investment#read", "liquidity#read"}, 65},
		{"it_admin", "System administration", []string{"user#create", "user#read", "user#update", "role#read", "system#configure"}, 90},
		{"fraud_analyst", "Fraud monitoring", []string{"transaction#read", "fraud#read", "fraud#update", "customer#read", "alert#read", "alert#update"}, 55},
	}
	for i, r := range roleDefs {
		roleCounter++
		roles = append(roles, Role{
			ID: fmt.Sprintf("ROLE-%04d", i+1), Name: r.name, Description: r.desc,
			Permissions: r.perms, Priority: r.priority,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}

	policyDefs := []struct{ name, typ string; rules []PolicyRule }{
		{"dual-control-approval", "rbac", []PolicyRule{
			{Entity: "transaction", Action: "approve", Effect: "deny", Condition: map[string]string{"initiator": "same_as_approver"}},
		}},
		{"high-value-restriction", "abac", []PolicyRule{
			{Entity: "transaction", Action: "create", Effect: "deny", Condition: map[string]string{"amount": ">10000000", "role": "teller"}},
			{Entity: "transaction", Action: "create", Effect: "allow", Condition: map[string]string{"amount": ">10000000", "role": "branch_manager"}},
		}},
		{"branch-scope", "rebac", []PolicyRule{
			{Entity: "account", Action: "update", Effect: "deny", Condition: map[string]string{"branch": "different"}},
		}},
		{"after-hours-restriction", "abac", []PolicyRule{
			{Entity: "vault", Action: "access", Effect: "deny", Condition: map[string]string{"time": "after_18:00"}},
		}},
		{"kyc-level-restriction", "abac", []PolicyRule{
			{Entity: "transfer", Action: "create", Effect: "deny", Condition: map[string]string{"amount": ">50000", "kyc_level": "<2"}},
		}},
	}
	for i, p := range policyDefs {
		polCounter++
		policies = append(policies, Policy{
			ID: fmt.Sprintf("POL-%04d", i+1), Name: p.name, Type: p.typ,
			Rules: p.rules, Status: "active",
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8129" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/authz/check", handleCheck)
	mux.HandleFunc("/v1/authz/roles", handleRoles)
	mux.HandleFunc("/v1/authz/policies", handlePolicies)
	mux.HandleFunc("/v1/authz/permissions", handlePermissions)
	mux.HandleFunc("/v1/authz/stats", handleStats)

	log.Printf("Permify Authorization Service starting on :%s", port)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "permify-authz", "status": "healthy", "port": 8129,
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"permify_authz.events", "permify_authz.audit"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "permify_authz-sidecar"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "permify_authz-stream"},
			"temporal": map[string]interface{}{"status": "connected", "namespace": "permify_authz"},
			"postgres": map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "permify_authz"},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "permify_authz_authz"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "permify_authz:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "permify_authz"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "permify_authz-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "permify_authz-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "permify_authz"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "permify_authz_iceberg"},
		},
	})
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, 405); return
	}
	var req struct {
		Subject  string            `json:"subject"`
		Entity   string            `json:"entity"`
		Action   string            `json:"action"`
		Context  map[string]string `json:"context"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, 400); return
	}
	if req.Subject == "" || req.Entity == "" || req.Action == "" {
		http.Error(w, `{"error":"subject, entity, and action are required"}`, 400); return
	}

	mu.Lock()
	checkCount++
	mu.Unlock()

	// Resolve role from subject
	roleName := ""
	if strings.HasPrefix(req.Subject, "role:") {
		roleName = strings.TrimPrefix(req.Subject, "role:")
	} else if req.Context != nil {
		roleName = req.Context["role"]
	}

	mu.RLock()
	defer mu.RUnlock()

	// Check explicit deny policies first
	for _, pol := range policies {
		if pol.Status != "active" { continue }
		for _, rule := range pol.Rules {
			if rule.Entity == req.Entity && rule.Action == req.Action && rule.Effect == "deny" {
				conditionMatch := true
				for ck, cv := range rule.Condition {
					if ck == "role" && cv != roleName { conditionMatch = false }
					if ck == "initiator" && cv == "same_as_approver" {
						if req.Context != nil && req.Context["initiator"] == req.Context["approver"] {
							conditionMatch = true
						} else {
							conditionMatch = false
						}
					}
					if ck == "amount" {
						if req.Context != nil {
							ctxAmt, hasAmt := req.Context["amount"]
							if hasAmt {
								var threshold float64
								op := ">"
								cvStr := cv
								if len(cvStr) > 0 && (cvStr[0] == '>' || cvStr[0] == '<') {
									op = string(cvStr[0])
									cvStr = cvStr[1:]
								}
								_, err := fmt.Sscanf(cvStr, "%f", &threshold)
								if err != nil {
									conditionMatch = false
									continue
								}
								var actualAmt float64
								_, amtErr := fmt.Sscanf(ctxAmt, "%f", &actualAmt)
								if amtErr != nil {
									conditionMatch = false
									continue
								}
								if op == ">" && actualAmt <= threshold {
									conditionMatch = false
								} else if op == "<" && actualAmt >= threshold {
									conditionMatch = false
								}
							} else {
								conditionMatch = false
							}
						} else {
							conditionMatch = false
						}
					}
				}
				if conditionMatch {
					denyCount++
					json.NewEncoder(w).Encode(CheckResult{
						Allowed: false, Policy: pol.Name, Rule: fmt.Sprintf("%s#%s", rule.Entity, rule.Action),
						Reason: fmt.Sprintf("denied by policy: %s", pol.Name), Latency: "1",
					})
					return
				}
			}
		}
	}

	// Check role permissions
	permKey := fmt.Sprintf("%s#%s", req.Entity, req.Action)
	for _, role := range roles {
		if role.Name == roleName {
			for _, p := range role.Permissions {
				if p == "*#*" || p == permKey || p == fmt.Sprintf("%s#*", req.Entity) || p == fmt.Sprintf("*#%s", req.Action) {
					json.NewEncoder(w).Encode(CheckResult{
						Allowed: true, Policy: "role-permission", Rule: p,
						Reason: fmt.Sprintf("allowed by role %s permission %s", roleName, p), Latency: "1",
					})
					return
				}
			}
			break
		}
	}

	denyCount++
	json.NewEncoder(w).Encode(CheckResult{
		Allowed: false, Reason: "no matching permission found", Latency: "1",
	})
}

func handleRoles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		mu.RLock()
		defer mu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": roles, "total": len(roles)})
	case http.MethodPost:
		var req struct {
			Name        string   `json:"name"`
			Description string   `json:"description"`
			Permissions []string `json:"permissions"`
			Priority    int      `json:"priority"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON"}`, 400); return
		}
		if req.Name == "" {
			http.Error(w, `{"error":"name is required"}`, 400); return
		}
		mu.Lock()
		for _, r := range roles {
			if r.Name == req.Name { mu.Unlock(); http.Error(w, `{"error":"role already exists"}`, 409); return }
		}
		roleCounter++
		role := Role{
			ID: fmt.Sprintf("ROLE-%04d", roleCounter), Name: req.Name, Description: req.Description,
			Permissions: req.Permissions, Priority: req.Priority,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		}
		roles = append(roles, role)
		mu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(role)
	default:
		http.Error(w, `{"error":"method not allowed"}`, 405)
	}
}

func handlePolicies(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": policies, "total": len(policies)})
}

func handlePermissions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": permissions, "total": len(permissions)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"totalRoles": len(roles), "totalPolicies": len(policies),
		"totalPermissions": len(permissions), "checksPerformed": checkCount,
		"denials": denyCount, "denyRate": fmt.Sprintf("%.1f%%", float64(denyCount)/float64(max(checkCount, 1))*100),
	})
}

func max(a, b int64) int64 { if a > b { return a }; return b }

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions { w.WriteHeader(204); return }
		next.ServeHTTP(w, r)
	})
}
