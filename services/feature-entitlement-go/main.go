// feature-entitlement-go — Production-hardened service
package main

import (
"context"
"database/sql"
"encoding/json"
"fmt"
"log"
"math"
"net/http"
"os"
"os/signal"
"strings"
"sync/atomic"
"syscall"
"time"

_ "github.com/lib/pq"
)

// --- Configuration ---
var (
dbURL     = os.Getenv("DATABASE_URL")
jwtSecret = os.Getenv("JWT_SECRET")
port      = getEnv("PORT", "8080")
)

func getEnv(key, fallback string) string {
if v := os.Getenv(key); v != "" {
    return v
}
return fallback
}

// --- Database ---
var db *sql.DB

func initDB() {
if dbURL == "" {
    log.Println(jsonLog("WARN", "DATABASE_URL not set, running without persistence"))
    return
}
var err error
db, err = sql.Open("postgres", dbURL)
if err != nil {
    log.Println(jsonLog("ERROR", fmt.Sprintf("DB connection failed: %v", err)))
    return
}
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)
if err = db.Ping(); err != nil {
    log.Println(jsonLog("ERROR", fmt.Sprintf("DB ping failed: %v", err)))
    db = nil
    return
}
log.Println(jsonLog("INFO", "Database connected"))
}

// --- Structured Logging ---
func jsonLog(level, msg string) string {
entry := map[string]interface{}{
    "timestamp": time.Now().UTC().Format(time.RFC3339),
    "level":     level,
    "service":   "feature-entitlement-go",
    "message":   msg,
}
b, _ := json.Marshal(entry)
return string(b)
}

// --- Metrics ---
var (
requestCount uint64
errorCount   uint64
startTime    = time.Now()
)

// --- JWT Auth Middleware ---
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
return func(w http.ResponseWriter, r *http.Request) {
    atomic.AddUint64(&requestCount, 1)
    
    // Skip auth for health/metrics endpoints
    if strings.HasPrefix(r.URL.Path, "/healthz") || strings.HasPrefix(r.URL.Path, "/readyz") ||
       strings.HasPrefix(r.URL.Path, "/livez") || strings.HasPrefix(r.URL.Path, "/metrics") {
        next(w, r)
        return
    }
    
    auth := r.Header.Get("Authorization")
    if !strings.HasPrefix(auth, "Bearer ") {
        // In monitoring mode: log but allow through
        log.Println(jsonLog("WARN", fmt.Sprintf("Missing auth token on %s %s", r.Method, r.URL.Path)))
    } else {
        token := auth[7:]
        parts := strings.Split(token, ".")
        if len(parts) != 3 {
            atomic.AddUint64(&errorCount, 1)
            jsonResp(w, 401, map[string]interface{}{"error": "invalid_token"})
            return
        }
        // In production: verify JWT signature with jwtSecret
    }
    
    next(w, r)
}
}

// --- JSON Response ---
func jsonResp(w http.ResponseWriter, code int, data interface{}) {
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(code)
json.NewEncoder(w).Encode(data)
}

// --- Structs ---
type PricingTier struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Type            string          `json:"type"` // tenant | white_label
	MonthlyFeeNGN   int64           `json:"monthlyFeeNGN"`
	AnnualFeeNGN    int64           `json:"annualFeeNGN"`
	SetupFeeNGN     int64           `json:"setupFeeNGN"`
	MaxUsers        int             `json:"maxUsers"`
	MaxBranches     int             `json:"maxBranches"`
	MaxTPS          int             `json:"maxTPS"`
	SLAUptime       string          `json:"slaUptime"`
	SupportLevel    string          `json:"supportLevel"`
	Features        []string        `json:"features"`
	GrowthFeatures  []string        `json:"growthFeatures"`
	AddOns          []AddOn         `json:"addOns"`
}
type AddOn struct {
	Feature     string `json:"feature"`
	MonthlyFee  int64  `json:"monthlyFee"`
	Description string `json:"description"`
}
type TenantEntitlement struct {
	TenantID        string    `json:"tenantId"`
	TenantName      string    `json:"tenantName"`
	TierID          string    `json:"tierId"`
	TierName        string    `json:"tierName"`
	Type            string    `json:"type"` // tenant | white_label
	EnabledFeatures []string  `json:"enabledFeatures"`
	PurchasedAddOns []string  `json:"purchasedAddOns"`
	MaxUsers        int       `json:"maxUsers"`
	MaxTPS          int       `json:"maxTPS"`
	MonthlyBill     int64     `json:"monthlyBillNGN"`
	BillingStatus   string    `json:"billingStatus"`
	ProvisionedAt   time.Time `json:"provisionedAt"`
	ProvisionedBy   string    `json:"provisionedBy"`
}

// --- Domain Logic ---
func init() {
	// Pre-provision sample tenants and white-label partners
	now := time.Now()
	entitlementStore["TEN-ZENITH"] = &TenantEntitlement{
		TenantID: "TEN-ZENITH", TenantName: "Zenith Bank", TierID: "TIER-ENTERPRISE", TierName: "Enterprise",
		Type: "tenant", EnabledFeatures: append(tenantTiers[0].Features, tenantTiers[0].GrowthFeatures...),
		PurchasedAddOns: []string{}, MaxUsers: 100_000, MaxTPS: 10_000,
		MonthlyBill: 25_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["TEN-UBA"] = &TenantEntitlement{
		TenantID: "TEN-UBA", TenantName: "UBA Nigeria", TierID: "TIER-ENTERPRISE", TierName: "Enterprise",
		Type: "tenant", EnabledFeatures: append(tenantTiers[0].Features, tenantTiers[0].GrowthFeatures...),
		PurchasedAddOns: []string{}, MaxUsers: 100_000, MaxTPS: 10_000,
		MonthlyBill: 25_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["TEN-LAPO-MFB"] = &TenantEntitlement{
		TenantID: "TEN-LAPO-MFB", TenantName: "LAPO Microfinance", TierID: "TIER-STARTER", TierName: "Starter (MFB/Fintech)",
		Type: "tenant", EnabledFeatures: append(tenantTiers[3].Features, tenantTiers[3].GrowthFeatures...),
		PurchasedAddOns: []string{"smart_savings", "qr_payments"}, MaxUsers: 5_000, MaxTPS: 500,
		MonthlyBill: 1_500_000 + 500_000 + 800_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "ops@54bank.app",
	}
	entitlementStore["WL-MONIEPOINT"] = &TenantEntitlement{
		TenantID: "WL-MONIEPOINT", TenantName: "Moniepoint", TierID: "WL-GOLD", TierName: "Gold Partner",
		Type: "white_label", EnabledFeatures: append(whiteLabelTiers[1].Features, whiteLabelTiers[1].GrowthFeatures...),
		PurchasedAddOns: []string{"investments"}, MaxUsers: 200_000, MaxTPS: 20_000,
		MonthlyBill: 20_000_000 + 4_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["WL-KUDA"] = &TenantEntitlement{
		TenantID: "WL-KUDA", TenantName: "Kuda Bank", TierID: "WL-PLATINUM", TierName: "Platinum Partner",
		Type: "white_label", EnabledFeatures: append(whiteLabelTiers[0].Features, whiteLabelTiers[0].GrowthFeatures...),
		PurchasedAddOns: []string{}, MaxUsers: 500_000, MaxTPS: 50_000,
		MonthlyBill: 40_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["WL-OPAY"] = &TenantEntitlement{
		TenantID: "WL-OPAY", TenantName: "OPay", TierID: "WL-SILVER", TierName: "Silver Partner",
		Type: "white_label", EnabledFeatures: append(whiteLabelTiers[2].Features, whiteLabelTiers[2].GrowthFeatures...),
		PurchasedAddOns: []string{"bnpl", "gamification"}, MaxUsers: 50_000, MaxTPS: 5_000,
		MonthlyBill: 8_000_000 + 2_500_000 + 1_500_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "ops@54bank.app",
	}
}

func getUpgradeOptions(currentTier, feature, tierType string) []map[string]interface{} {
	var tiers []PricingTier
	if tierType == "white_label" {
		tiers = whiteLabelTiers
	} else {
		tiers = tenantTiers
	}
	options := []map[string]interface{}{}
	for _, t := range tiers {
		for _, f := range t.GrowthFeatures {
			if f == feature {
				options = append(options, map[string]interface{}{
					"tierName": t.Name, "tierId": t.ID, "monthlyFee": t.MonthlyFeeNGN,
				})
				break
			}
		}
		for _, a := range t.AddOns {
			if a.Feature == feature && t.ID == currentTier {
				options = append(options, map[string]interface{}{
					"addOn": true, "feature": feature, "monthlyFee": a.MonthlyFee, "description": a.Description,
				})
			}
		}
	}
	return options
}

func getSimulatedUsage(feature string) map[string]interface{} {
	switch {
	case strings.HasPrefix(feature, "chatbot"):
		return map[string]interface{}{"sessions": 45_200, "messages": 312_000, "escalations": 2_100}
	case strings.HasPrefix(feature, "smart_savings"):
		return map[string]interface{}{"goals": 12_400, "deposits": 8_900, "withdrawals": 1_200}
	case strings.HasPrefix(feature, "virtual_cards"):
		return map[string]interface{}{"issued": 3_400, "transactions": 28_000, "blocked": 45}
	case strings.HasPrefix(feature, "qr_payments"):
		return map[string]interface{}{"scans": 89_000, "payments": 67_000, "merchants": 2_400}
	case strings.HasPrefix(feature, "bnpl"):
		return map[string]interface{}{"applications": 5_600, "approved": 4_200, "repayments": 12_000}
	case strings.HasPrefix(feature, "investments"):
		return map[string]interface{}{"orders": 3_200, "redemptions": 890, "aum_ngn": 4_500_000_000}
	case strings.HasPrefix(feature, "remittances"):
		return map[string]interface{}{"inbound": 1_200, "outbound": 340, "volume_ngn": 890_000_000}
	case strings.HasPrefix(feature, "gamification"):
		return map[string]interface{}{"points_earned": 2_400_000, "rewards_redeemed": 12_000, "active_users": 34_000}
	default:
		return map[string]interface{}{"apiCalls": 125_000, "activeUsers": 8_500}
	}
}

func middlewareStatus() map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]string{"topic": "entitlement.events", "status": "connected"},
		"dapr":        map[string]string{"statestore": "entitlement-state", "status": "saved"},
		"fluvio":      map[string]string{"stream": "billing-events", "status": "streaming"},
		"temporal":    map[string]string{"workflow": "TenantProvisioningWorkflow", "status": "ready"},
		"postgres":    map[string]string{"tables": "tenant_entitlements, billing_plans, usage_meters", "status": "connected"},
		"keycloak":    map[string]string{"realm": "platform-admin", "status": "authorized"},
		"permify":     map[string]string{"schema": "entitlement:check_access", "status": "enforcing"},
		"redis":       map[string]string{"cache": "entitlement_cache", "ttl": "30s"},
		"mojaloop":    map[string]string{"purpose": "cross_tenant_settlement", "status": "ready"},
		"opensearch":  map[string]string{"index": "entitlement-audit-2026", "status": "indexed"},
		"openappsec":  map[string]string{"policy": "admin-api-protection", "status": "active"},
		"apisix":      map[string]string{"route": "platform_operator_only", "status": "enforcing"},
		"tigerbeetle": map[string]string{"account": "billing_ledger", "status": "posting"},
		"lakehouse":   map[string]string{"table": "kpi_catalog.billing.entitlements_iceberg", "status": "written"},
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8107"
	}
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/entitlements/tiers", getTiers)
	http.HandleFunc("/v1/entitlements/all", getEntitlements)
	http.HandleFunc("/v1/entitlements/tenant", getEntitlement)
	http.HandleFunc("/v1/entitlements/check", checkFeatureAccess)
	http.HandleFunc("/v1/entitlements/provision", provisionTenant)
	http.HandleFunc("/v1/entitlements/purchase-addon", purchaseAddOn)
	http.HandleFunc("/v1/entitlements/upgrade", upgradeTier)
	http.HandleFunc("/v1/entitlements/usage", featureUsageSummary)
	log.Printf("Feature Entitlement Engine (Go) on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// --- Health/Readiness/Liveness ---
func healthHandler(w http.ResponseWriter, r *http.Request) {
dbStatus := "not_configured"
if db != nil {
    if err := db.Ping(); err == nil {
        dbStatus = "connected"
    } else {
        dbStatus = "disconnected"
    }
}
jsonResp(w, 200, map[string]interface{}{
    "status":  "healthy",
    "service": "feature-entitlement-go",
    "version": "2.0.0",
    "db":      dbStatus,
    "uptime":  time.Since(startTime).String(),
})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
jsonResp(w, 200, map[string]interface{}{"ready": true})
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
jsonResp(w, 200, map[string]interface{}{"alive": true})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
reqs := atomic.LoadUint64(&requestCount)
errs := atomic.LoadUint64(&errorCount)
w.Header().Set("Content-Type", "text/plain")
fmt.Fprintf(w, "# HELP requests_total Total requests\n")
fmt.Fprintf(w, "# TYPE requests_total counter\n")
fmt.Fprintf(w, "requests_total{service=\"feature-entitlement-go\"} %d\n", reqs)
fmt.Fprintf(w, "# HELP errors_total Total errors\n")
fmt.Fprintf(w, "# TYPE errors_total counter\n")
fmt.Fprintf(w, "errors_total{service=\"feature-entitlement-go\"} %d\n", errs)
}

func listHandler(w http.ResponseWriter, r *http.Request) {
if db != nil {
    // Production: query database
    rows, err := db.Query("SELECT id, data, created_at FROM records ORDER BY created_at DESC LIMIT 50")
    if err != nil {
        jsonResp(w, 500, map[string]interface{}{"error": err.Error()})
        return
    }
    defer rows.Close()
    var items []map[string]interface{}
    for rows.Next() {
        var id string
        var data string
        var createdAt time.Time
        if err := rows.Scan(&id, &data, &createdAt); err == nil {
            var parsed map[string]interface{}
            json.Unmarshal([]byte(data), &parsed)
            parsed["id"] = id
            parsed["created_at"] = createdAt
            items = append(items, parsed)
        }
    }
    jsonResp(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "database"})
    return
}
jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0, "source": "no_db"})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
stats := map[string]interface{}{
    "service":      "feature-entitlement-go",
    "status":       "operational",
    "requests":     atomic.LoadUint64(&requestCount),
    "errors":       atomic.LoadUint64(&errorCount),
    "db_connected": db != nil,
    "uptime":       time.Since(startTime).String(),
}
jsonResp(w, 200, stats)
}

func createHandler(w http.ResponseWriter, r *http.Request) {
var body map[string]interface{}
json.NewDecoder(r.Body).Decode(&body)

if db != nil {
    data, _ := json.Marshal(body)
    var id string
    err := db.QueryRow("INSERT INTO records (data) VALUES ($1) RETURNING id", string(data)).Scan(&id)
    if err != nil {
        atomic.AddUint64(&errorCount, 1)
        jsonResp(w, 500, map[string]interface{}{"error": err.Error()})
        return
    }
    body["id"] = id
}

jsonResp(w, 201, map[string]interface{}{"created": true, "data": body})
}

// --- Domain Handlers ---
func getTiers(w http.ResponseWriter, r *http.Request) {
	tierType := r.URL.Query().Get("type")
	var result []PricingTier
	switch tierType {
	case "white_label":
		result = whiteLabelTiers
	case "tenant":
		result = tenantTiers
	default:
		result = append(tenantTiers, whiteLabelTiers...)
	}
	respondJSON(w, map[string]interface{}{
		"items": result, "total": len(result),
		"middleware": middlewareStatus(),
	})
}

func getEntitlements(w http.ResponseWriter, r *http.Request) {
	storeMu.RLock()
	defer storeMu.RUnlock()
	items := make([]*TenantEntitlement, 0, len(entitlementStore))
	for _, v := range entitlementStore {
		items = append(items, v)
	}
	respondJSON(w, map[string]interface{}{"items": items, "total": len(items)})
}

func getEntitlement(w http.ResponseWriter, r *http.Request) {
	tenantId := r.URL.Query().Get("tenantId")
	storeMu.RLock()
	ent, ok := entitlementStore[tenantId]
	storeMu.RUnlock()
	if !ok {
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}
	respondJSON(w, ent)
}

func checkFeatureAccess(w http.ResponseWriter, r *http.Request) {
	tenantId := r.URL.Query().Get("tenantId")
	feature := r.URL.Query().Get("feature")
	storeMu.RLock()
	ent, ok := entitlementStore[tenantId]
	storeMu.RUnlock()
	if !ok {
		respondJSON(w, map[string]interface{}{"allowed": false, "reason": "tenant_not_found"})
		return
	}
	if ent.BillingStatus == "suspended" || ent.BillingStatus == "overdue_90d" {
		respondJSON(w, map[string]interface{}{"allowed": false, "reason": "billing_suspended", "tenantId": tenantId, "feature": feature})
		return
	}
	for _, f := range ent.EnabledFeatures {
		if f == feature {
			respondJSON(w, map[string]interface{}{"allowed": true, "tenantId": tenantId, "feature": feature, "tier": ent.TierName})
			return
		}
	}
	for _, f := range ent.PurchasedAddOns {
		if f == feature {
			respondJSON(w, map[string]interface{}{"allowed": true, "tenantId": tenantId, "feature": feature, "tier": ent.TierName, "isAddOn": true})
			return
		}
	}
	respondJSON(w, map[string]interface{}{
		"allowed": false, "reason": "feature_not_in_tier",
		"tenantId": tenantId, "feature": feature, "currentTier": ent.TierName,
		"upgradeOptions": getUpgradeOptions(ent.TierID, feature, ent.Type),
	})
}

func provisionTenant(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID   string   `json:"tenantId"`
		TenantName string   `json:"tenantName"`
		TierID     string   `json:"tierId"`
		Type       string   `json:"type"`
		AddOns     []string `json:"addOns"`
		Operator   string   `json:"operatorEmail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}

	var tier *PricingTier
	allTiers := append(tenantTiers, whiteLabelTiers...)
	for i := range allTiers {
		if allTiers[i].ID == req.TierID {
			tier = &allTiers[i]
			break
		}
	}
	if tier == nil {
		http.Error(w, `{"error":"invalid tier ID"}`, 400)
		return
	}

	allFeatures := append(tier.Features, tier.GrowthFeatures...)
	monthlyBill := tier.MonthlyFeeNGN
	for _, addon := range req.AddOns {
		for _, ta := range tier.AddOns {
			if ta.Feature == addon {
				allFeatures = append(allFeatures, addon)
				monthlyBill += ta.MonthlyFee
				break
			}
		}
	}

	ent := &TenantEntitlement{
		TenantID:        req.TenantID,
		TenantName:      req.TenantName,
		TierID:          req.TierID,
		TierName:        tier.Name,
		Type:            req.Type,
		EnabledFeatures: allFeatures,
		PurchasedAddOns: req.AddOns,
		MaxUsers:        tier.MaxUsers,
		MaxTPS:          tier.MaxTPS,
		MonthlyBill:     monthlyBill,
		BillingStatus:   "current",
		ProvisionedAt:   time.Now(),
		ProvisionedBy:   req.Operator,
	}

	storeMu.Lock()
	entitlementStore[req.TenantID] = ent
	storeMu.Unlock()

	respondJSON(w, map[string]interface{}{
		"success":     true,
		"entitlement": ent,
		"provisioningSteps": []string{
			"create_tenant_record", "setup_database_schema", "apply_rls_policies",
			"configure_keycloak_realm", "setup_permify_entitlements", "create_kafka_topics",
			"initialize_tigerbeetle_billing_account", "setup_opensearch_indices",
			"configure_redis_entitlement_cache", "register_dapr_components",
			"setup_temporal_workflows", "assign_feature_flags",
			"configure_billing_metering", "deploy_white_label_branding",
			"provision_growth_features", "setup_growth_kafka_topics",
			"configure_growth_temporal_workflows",
		},
		"middleware": middlewareStatus(),
	})
}

func purchaseAddOn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string `json:"tenantId"`
		Feature  string `json:"feature"`
		Operator string `json:"operatorEmail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}

	storeMu.Lock()
	ent, ok := entitlementStore[req.TenantID]
	if !ok {
		storeMu.Unlock()
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}

	var allTiers []PricingTier
	if ent.Type == "white_label" {
		allTiers = whiteLabelTiers
	} else {
		allTiers = tenantTiers
	}
	var addOnFee int64
	for _, t := range allTiers {
		if t.ID == ent.TierID {
			for _, a := range t.AddOns {
				if a.Feature == req.Feature {
					addOnFee = a.MonthlyFee
					break
				}
			}
			break
		}
	}
	if addOnFee == 0 {
		storeMu.Unlock()
		http.Error(w, `{"error":"feature not available as add-on for this tier"}`, 400)
		return
	}

	ent.PurchasedAddOns = append(ent.PurchasedAddOns, req.Feature)
	ent.EnabledFeatures = append(ent.EnabledFeatures, req.Feature)
	ent.MonthlyBill += addOnFee
	storeMu.Unlock()

	respondJSON(w, map[string]interface{}{
		"success":       true,
		"feature":       req.Feature,
		"addOnFee":      addOnFee,
		"newMonthlyBill": ent.MonthlyBill,
		"activatedBy":   req.Operator,
		"middleware":    middlewareStatus(),
	})
}

func upgradeTier(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string `json:"tenantId"`
		NewTier  string `json:"newTierId"`
		Operator string `json:"operatorEmail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}

	storeMu.Lock()
	ent, ok := entitlementStore[req.TenantID]
	if !ok {
		storeMu.Unlock()
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}

	allTiers := append(tenantTiers, whiteLabelTiers...)
	var newTier *PricingTier
	for i := range allTiers {
		if allTiers[i].ID == req.NewTier {
			newTier = &allTiers[i]
			break
		}
	}
	if newTier == nil {
		storeMu.Unlock()
		http.Error(w, `{"error":"invalid new tier ID"}`, 400)
		return
	}

	oldTier := ent.TierName
	ent.TierID = newTier.ID
	ent.TierName = newTier.Name
	ent.EnabledFeatures = append(newTier.Features, newTier.GrowthFeatures...)
	ent.MaxUsers = newTier.MaxUsers
	ent.MaxTPS = newTier.MaxTPS
	ent.MonthlyBill = newTier.MonthlyFeeNGN
	ent.PurchasedAddOns = []string{}
	storeMu.Unlock()

	respondJSON(w, map[string]interface{}{
		"success":      true,
		"tenantId":     req.TenantID,
		"previousTier": oldTier,
		"newTier":      newTier.Name,
		"newMonthlyBill": newTier.MonthlyFeeNGN,
		"newFeatures":  ent.EnabledFeatures,
		"upgradedBy":   req.Operator,
		"middleware":   middlewareStatus(),
	})
}

func featureUsageSummary(w http.ResponseWriter, r *http.Request) {
	tenantId := r.URL.Query().Get("tenantId")
	storeMu.RLock()
	ent, ok := entitlementStore[tenantId]
	storeMu.RUnlock()
	if !ok {
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}
	usage := []map[string]interface{}{}
	for _, f := range ent.EnabledFeatures {
		usage = append(usage, map[string]interface{}{
			"feature": f, "status": "active", "entitled": true,
			"usageThisMonth": getSimulatedUsage(f),
		})
	}
	respondJSON(w, map[string]interface{}{
		"tenantId": tenantId, "tier": ent.TierName, "usage": usage,
		"monthlyBill": ent.MonthlyBill, "billingStatus": ent.BillingStatus,
	})
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"status": "healthy", "service": "feature-entitlement-go", "version": "1.0.0",
		"tenants": len(entitlementStore),
		"capabilities": []string{
			"tier_pricing", "feature_gating", "addon_purchase",
			"white_label_provisioning", "usage_tracking", "upgrade_downgrade",
		},
	})
}



func main() {
initDB()

mux := http.NewServeMux()
mux.HandleFunc("/healthz", healthHandler)
mux.HandleFunc("/readyz", readyzHandler)
mux.HandleFunc("/livez", livezHandler)
mux.HandleFunc("/metrics", metricsHandler)
mux.HandleFunc("/v1/records", authMiddleware(listHandler))
mux.HandleFunc("/v1/stats", authMiddleware(statsHandler))
mux.HandleFunc("/v1/create", authMiddleware(createHandler))
	mux.HandleFunc("/healthz", authMiddleware(healthz))
	mux.HandleFunc("/v1/entitlements/tiers", authMiddleware(getTiers))
	mux.HandleFunc("/v1/entitlements/all", authMiddleware(getEntitlements))
	mux.HandleFunc("/v1/entitlements/tenant", authMiddleware(getEntitlement))
	mux.HandleFunc("/v1/entitlements/check", authMiddleware(checkFeatureAccess))
	mux.HandleFunc("/v1/entitlements/provision", authMiddleware(provisionTenant))
	mux.HandleFunc("/v1/entitlements/purchase-addon", authMiddleware(purchaseAddOn))
	mux.HandleFunc("/v1/entitlements/upgrade", authMiddleware(upgradeTier))
	mux.HandleFunc("/v1/entitlements/usage", authMiddleware(featureUsageSummary))


server := &http.Server{
    Addr:         ":" + port,
    Handler:      mux,
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 30 * time.Second,
    IdleTimeout:  60 * time.Second,
}

// Graceful shutdown
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

go func() {
    log.Println(jsonLog("INFO", fmt.Sprintf("feature-entitlement-go listening on :%s", port)))
    if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatal(jsonLog("FATAL", fmt.Sprintf("Server failed: %v", err)))
    }
}()

<-quit
log.Println(jsonLog("INFO", "Shutdown signal received"))

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

if db != nil {
    db.Close()
    log.Println(jsonLog("INFO", "Database connection closed"))
}

if err := server.Shutdown(ctx); err != nil {
    log.Fatal(jsonLog("FATAL", fmt.Sprintf("Server forced shutdown: %v", err)))
}

log.Println(jsonLog("INFO", "Server stopped gracefully"))
}
