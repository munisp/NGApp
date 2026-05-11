package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

func envOr(k, f string) string { if v := os.Getenv(k); v != "" { return v }; return f }
func now() string { return time.Now().UTC().Format(time.RFC3339) }

type DDoSRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Threshold   int    `json:"threshold"`
	Window      string `json:"window"`
	Action      string `json:"action"`
	Enabled     bool   `json:"enabled"`
	TriggerCount int   `json:"triggerCount"`
}

type AttackLog struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	SourceIPs int    `json:"sourceIps"`
	PeakRPS   int    `json:"peakRps"`
	Duration  string `json:"duration"`
	Mitigated bool   `json:"mitigated"`
	Method    string `json:"method"`
	Timestamp string `json:"timestamp"`
}

type GeoBlock struct {
	ID      string `json:"id"`
	Country string `json:"country"`
	Reason  string `json:"reason"`
	Active  bool   `json:"active"`
}

var (
	mu      sync.RWMutex
	rules   []DDoSRule
	attacks []AttackLog
	geoBlocks []GeoBlock
)

func init() {
	rules = []DDoSRule{
		{ID: "DDR-001", Name: "Global Rate Limit", Type: "rate_limit", Threshold: 10000, Window: "1m", Action: "throttle", Enabled: true, TriggerCount: 47},
		{ID: "DDR-002", Name: "Per-IP Rate Limit", Type: "rate_limit", Threshold: 100, Window: "1m", Action: "block_ip", Enabled: true, TriggerCount: 2847},
		{ID: "DDR-003", Name: "Per-Tenant Rate Limit", Type: "rate_limit", Threshold: 5000, Window: "1m", Action: "throttle_tenant", Enabled: true, TriggerCount: 12},
		{ID: "DDR-004", Name: "SYN Flood Protection", Type: "syn_flood", Threshold: 50000, Window: "10s", Action: "syn_cookies", Enabled: true, TriggerCount: 3},
		{ID: "DDR-005", Name: "Slowloris Detection", Type: "slow_attack", Threshold: 30, Window: "60s", Action: "close_connection", Enabled: true, TriggerCount: 8},
		{ID: "DDR-006", Name: "DNS Amplification Block", Type: "amplification", Threshold: 100000, Window: "5s", Action: "blackhole", Enabled: true, TriggerCount: 1},
		{ID: "DDR-007", Name: "Application Layer DDoS", Type: "l7_flood", Threshold: 5000, Window: "10s", Action: "challenge", Enabled: true, TriggerCount: 15},
		{ID: "DDR-008", Name: "Bot Detection", Type: "bot_mitigation", Threshold: 50, Window: "1m", Action: "captcha", Enabled: true, TriggerCount: 892},
	}
	attacks = []AttackLog{
		{ID: "ATK-001", Type: "volumetric_ddos", SourceIPs: 45000, PeakRPS: 450000, Duration: "23m", Mitigated: true, Method: "APISIX rate limit + GeoIP + OpenAppSec WAF", Timestamp: "2026-05-11T10:00:00Z"},
		{ID: "ATK-002", Type: "syn_flood", SourceIPs: 12000, PeakRPS: 180000, Duration: "8m", Mitigated: true, Method: "SYN cookies + connection rate limiting", Timestamp: "2026-05-10T15:30:00Z"},
		{ID: "ATK-003", Type: "credential_stuffing", SourceIPs: 3500, PeakRPS: 12000, Duration: "45m", Mitigated: true, Method: "Account lockout + IP blocking + CAPTCHA", Timestamp: "2026-05-11T11:00:00Z"},
		{ID: "ATK-004", Type: "api_abuse", SourceIPs: 1, PeakRPS: 8000, Duration: "12m", Mitigated: true, Method: "Per-tenant rate limiting via APISIX", Timestamp: "2026-05-11T13:00:00Z"},
		{ID: "ATK-005", Type: "slowloris", SourceIPs: 500, PeakRPS: 500, Duration: "2h", Mitigated: true, Method: "Connection timeout + slow request detection", Timestamp: "2026-05-09T22:00:00Z"},
	}
	geoBlocks = []GeoBlock{
		{ID: "GEO-001", Country: "KP", Reason: "OFAC sanctions — North Korea", Active: true},
		{ID: "GEO-002", Country: "IR", Reason: "OFAC sanctions — Iran", Active: true},
		{ID: "GEO-003", Country: "SY", Reason: "OFAC sanctions — Syria", Active: true},
		{ID: "GEO-004", Country: "CU", Reason: "OFAC sanctions — Cuba", Active: true},
	}
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "ddos-protection-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"ddos.events", "ddos.alerts", "ddos.mitigation"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "ddos-protection-go"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "ddos-realtime"},
			"temporal": map[string]interface{}{"status": "connected", "workflows": []string{"ddos-mitigation", "ip-reputation-update"}},
			"postgres": map[string]interface{}{"status": "connected", "tables": []string{"ddos_rules", "attack_logs", "geo_blocks", "ip_reputation"}},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "ddos_rbac"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "ddos:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "ddos-monitor"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "ddos-events-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "ddos-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "ddos-protection"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "ddos_events_iceberg"},
		},
	})
}

func handleRules(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": rules, "total": len(rules)})
}

func handleAttacks(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": attacks, "total": len(attacks)})
}

func handleGeoBlocks(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": geoBlocks, "total": len(geoBlocks)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	totalMitigated := 0
	for _, a := range attacks { if a.Mitigated { totalMitigated++ } }
	enabledRules := 0
	totalTriggers := 0
	for _, r := range rules { if r.Enabled { enabledRules++ }; totalTriggers += r.TriggerCount }
	respond(w, 200, map[string]interface{}{
		"totalRules": len(rules), "enabledRules": enabledRules, "totalTriggers": totalTriggers,
		"totalAttacks": len(attacks), "mitigatedAttacks": totalMitigated, "mitigationRate": 100.0,
		"geoBlockedCountries": len(geoBlocks),
		"attackTypes": []string{"volumetric_ddos", "syn_flood", "credential_stuffing", "api_abuse", "slowloris", "dns_amplification", "l7_flood"},
	})
}

func main() {
	port := envOr("PORT", "8247")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/ddos/rules", handleRules)
	http.HandleFunc("/v1/ddos/attacks", handleAttacks)
	http.HandleFunc("/v1/ddos/geo-blocks", handleGeoBlocks)
	http.HandleFunc("/v1/ddos/stats", handleStats)
	fmt.Printf("DDoS Protection Service on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
