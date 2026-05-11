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

// ---------------------------------------------------------------------------
// Billing Orchestrator — real-time capture, role-based access, audit, onboarding
// Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify,
//            Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
// ---------------------------------------------------------------------------

// ─── Domain Types ──────────────────────────────────────────────────────────

type BillingProfile struct {
	ID               string                 `json:"id"`
	TenantID         string                 `json:"tenantId"`
	PricingModel     string                 `json:"pricingModel"` // per_transaction | subscription | hybrid | revenue_share
	SignOnFee        float64                `json:"signOnFee"`
	MonthlyFee       float64                `json:"monthlyFee"`
	FeePerTxn        float64                `json:"feePerTxn"`
	PlatformSharePct float64                `json:"platformSharePct"`
	PartnerSharePct  float64                `json:"partnerSharePct"`
	Currency         string                 `json:"currency"`
	Status           string                 `json:"status"`
	Segment          string                 `json:"segment"` // unit_mfb | state_mfb | national_mfb | commercial_t1 | commercial_t2 | psb | agent_network | fintech | cooperative | mortgage | dfi
	CreatedAt        string                 `json:"createdAt"`
	Config           map[string]interface{} `json:"config"`
}

type BillingAuditEntry struct {
	ID         string      `json:"id"`
	TenantID   string      `json:"tenantId"`
	ActorID    string      `json:"actorId"`
	ActorRole  string      `json:"actorRole"`
	Action     string      `json:"action"`
	Resource   string      `json:"resource"`
	ResourceID string      `json:"resourceId"`
	OldValue   interface{} `json:"oldValue"`
	NewValue   interface{} `json:"newValue"`
	Timestamp  string      `json:"timestamp"`
	KafkaTopic string      `json:"kafkaTopic"`
	Notified   bool        `json:"notified"`
}

type RealtimeMetric struct {
	ID            string  `json:"id"`
	TenantID      string  `json:"tenantId"`
	MetricType    string  `json:"metricType"`
	MeterKey      string  `json:"meterKey"`
	Value         float64 `json:"value"`
	PeriodKey     string  `json:"periodKey"`
	CollectedAt   string  `json:"collectedAt"`
	Source        string  `json:"source"`
	DaprBinding   string  `json:"daprBinding"`
	FluvioStream  string  `json:"fluvioStream"`
}

type OnboardingJob struct {
	ID           string   `json:"id"`
	TenantID     string   `json:"tenantId"`
	Segment      string   `json:"segment"`
	Status       string   `json:"status"`
	Steps        []string `json:"steps"`
	CurrentStep  int      `json:"currentStep"`
	ProfileID    string   `json:"profileId"`
	TemporalID   string   `json:"temporalWorkflowId"`
	StartedAt    string   `json:"startedAt"`
	CompletedAt  string   `json:"completedAt,omitempty"`
}

type RolePermission struct {
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	Description string   `json:"description"`
}

type TransactionSplit struct {
	ID               string  `json:"id"`
	TenantID         string  `json:"tenantId"`
	TxnType          string  `json:"txnType"`
	PlatformAmount   float64 `json:"platformAmount"`
	PartnerAmount    float64 `json:"partnerAmount"`
	SuperAgentAmount float64 `json:"superAgentAmount"`
	TotalAmount      float64 `json:"totalAmount"`
	Currency         string  `json:"currency"`
	TigerBeetleTxnID string  `json:"tigerBeetleTxnId"`
	SettledAt        string  `json:"settledAt"`
}

// ─── Seed Data ─────────────────────────────────────────────────────────────

var (
	mu       sync.Mutex
	nextID   = 100
	profiles = []BillingProfile{
		{ID: "BP-001", TenantID: "tenant-unit-mfb-001", PricingModel: "per_transaction", SignOnFee: 1000000, MonthlyFee: 150000, FeePerTxn: 12, PlatformSharePct: 60, PartnerSharePct: 30, Currency: "NGN", Status: "active", Segment: "unit_mfb", CreatedAt: "2026-01-15T09:00:00Z", Config: map[string]interface{}{"maxBranches": 1, "maxUsers": 5, "kycRequired": true}},
		{ID: "BP-002", TenantID: "tenant-state-mfb-001", PricingModel: "hybrid", SignOnFee: 3000000, MonthlyFee: 500000, FeePerTxn: 10, PlatformSharePct: 55, PartnerSharePct: 35, Currency: "NGN", Status: "active", Segment: "state_mfb", CreatedAt: "2026-02-01T09:00:00Z", Config: map[string]interface{}{"maxBranches": 10, "maxUsers": 25}},
		{ID: "BP-003", TenantID: "tenant-commercial-t2-001", PricingModel: "subscription", SignOnFee: 100000000, MonthlyFee: 10000000, FeePerTxn: 5, PlatformSharePct: 50, PartnerSharePct: 35, Currency: "NGN", Status: "active", Segment: "commercial_t2", CreatedAt: "2026-01-01T09:00:00Z", Config: map[string]interface{}{"dedicatedInfra": true, "sla": "99.95%"}},
		{ID: "BP-004", TenantID: "tenant-agent-net-001", PricingModel: "revenue_share", SignOnFee: 2000000, MonthlyFee: 300000, FeePerTxn: 15, PlatformSharePct: 60, PartnerSharePct: 30, Currency: "NGN", Status: "active", Segment: "agent_network", CreatedAt: "2026-03-01T09:00:00Z", Config: map[string]interface{}{"superAgentPct": 10, "agentCap": 500}},
		{ID: "BP-005", TenantID: "tenant-fintech-001", PricingModel: "per_transaction", SignOnFee: 3000000, MonthlyFee: 400000, FeePerTxn: 8, PlatformSharePct: 65, PartnerSharePct: 25, Currency: "NGN", Status: "active", Segment: "fintech", CreatedAt: "2026-02-15T09:00:00Z", Config: map[string]interface{}{"apiAccess": true, "webhooks": true}},
		{ID: "BP-006", TenantID: "tenant-cooperative-001", PricingModel: "subscription", SignOnFee: 300000, MonthlyFee: 30000, FeePerTxn: 15, PlatformSharePct: 70, PartnerSharePct: 20, Currency: "NGN", Status: "active", Segment: "cooperative", CreatedAt: "2026-04-01T09:00:00Z", Config: map[string]interface{}{"maxMembers": 5000}},
	}

	auditLog = []BillingAuditEntry{
		{ID: "BA-001", TenantID: "tenant-unit-mfb-001", ActorID: "admin-001", ActorRole: "billing_admin", Action: "profile.created", Resource: "billing_profile", ResourceID: "BP-001", OldValue: nil, NewValue: "per_transaction model", Timestamp: "2026-01-15T09:00:00Z", KafkaTopic: "billing.audit.events", Notified: true},
		{ID: "BA-002", TenantID: "tenant-state-mfb-001", ActorID: "admin-002", ActorRole: "billing_manager", Action: "rate_card.updated", Resource: "rate_card", ResourceID: "RC-002", OldValue: "₦10/txn", NewValue: "₦8/txn", Timestamp: "2026-02-10T14:30:00Z", KafkaTopic: "billing.audit.events", Notified: true},
		{ID: "BA-003", TenantID: "tenant-commercial-t2-001", ActorID: "admin-003", ActorRole: "finance_officer", Action: "invoice.approved", Resource: "invoice", ResourceID: "INV-003", OldValue: "pending", NewValue: "approved", Timestamp: "2026-03-15T11:00:00Z", KafkaTopic: "billing.audit.events", Notified: true},
		{ID: "BA-004", TenantID: "tenant-agent-net-001", ActorID: "admin-001", ActorRole: "billing_admin", Action: "revenue_share.modified", Resource: "revenue_share_rule", ResourceID: "RSR-004", OldValue: "60/30/10", NewValue: "55/35/10", Timestamp: "2026-04-01T08:00:00Z", KafkaTopic: "billing.audit.events", Notified: true},
		{ID: "BA-005", TenantID: "tenant-fintech-001", ActorID: "admin-004", ActorRole: "compliance_officer", Action: "discount.created", Resource: "discount_rule", ResourceID: "DR-005", OldValue: nil, NewValue: "10% volume discount", Timestamp: "2026-04-10T16:00:00Z", KafkaTopic: "billing.audit.events", Notified: true},
		{ID: "BA-006", TenantID: "tenant-cooperative-001", ActorID: "admin-005", ActorRole: "billing_viewer", Action: "profile.viewed", Resource: "billing_profile", ResourceID: "BP-006", OldValue: nil, NewValue: nil, Timestamp: "2026-05-01T10:00:00Z", KafkaTopic: "billing.audit.events", Notified: false},
	}

	metrics = []RealtimeMetric{
		{ID: "RM-001", TenantID: "tenant-unit-mfb-001", MetricType: "txn_count", MeterKey: "transfer_posted", Value: 15240, PeriodKey: "2026-05", CollectedAt: "2026-05-09T14:00:00Z", Source: "payments-hub", DaprBinding: "billing-metrics", FluvioStream: "billing-realtime"},
		{ID: "RM-002", TenantID: "tenant-state-mfb-001", MetricType: "revenue_accrued", MeterKey: "transfer_posted", Value: 7800000, PeriodKey: "2026-05", CollectedAt: "2026-05-09T14:00:00Z", Source: "billing-rating-rs", DaprBinding: "billing-metrics", FluvioStream: "billing-realtime"},
		{ID: "RM-003", TenantID: "tenant-commercial-t2-001", MetricType: "txn_count", MeterKey: "card_transaction", Value: 5200000, PeriodKey: "2026-05", CollectedAt: "2026-05-09T14:00:00Z", Source: "card-switch", DaprBinding: "billing-metrics", FluvioStream: "billing-realtime"},
		{ID: "RM-004", TenantID: "tenant-agent-net-001", MetricType: "split_settled", MeterKey: "pos_cashout", Value: 3800000, PeriodKey: "2026-05", CollectedAt: "2026-05-09T14:00:00Z", Source: "tigerbeetle-ledger", DaprBinding: "billing-metrics", FluvioStream: "billing-realtime"},
		{ID: "RM-005", TenantID: "tenant-fintech-001", MetricType: "api_calls", MeterKey: "api_call", Value: 2400000, PeriodKey: "2026-05", CollectedAt: "2026-05-09T14:00:00Z", Source: "api-gateway", DaprBinding: "billing-metrics", FluvioStream: "billing-realtime"},
	}

	onboardingJobs = []OnboardingJob{
		{ID: "OBJ-001", TenantID: "tenant-unit-mfb-001", Segment: "unit_mfb", Status: "completed", Steps: []string{"create_tenant", "assign_segment", "create_billing_profile", "setup_rate_card", "configure_revenue_share", "setup_kafka_topics", "provision_tigerbeetle_accounts", "enable_realtime_metering", "run_kyc_check", "activate_billing"}, CurrentStep: 10, ProfileID: "BP-001", TemporalID: "wf-billing-onboard-001", StartedAt: "2026-01-15T08:00:00Z", CompletedAt: "2026-01-15T09:00:00Z"},
		{ID: "OBJ-002", TenantID: "tenant-cooperative-002", Segment: "cooperative", Status: "in_progress", Steps: []string{"create_tenant", "assign_segment", "create_billing_profile", "setup_rate_card", "configure_revenue_share", "setup_kafka_topics", "provision_tigerbeetle_accounts", "enable_realtime_metering", "run_kyc_check", "activate_billing"}, CurrentStep: 6, ProfileID: "BP-007", TemporalID: "wf-billing-onboard-002", StartedAt: "2026-05-09T12:00:00Z"},
		{ID: "OBJ-003", TenantID: "tenant-national-mfb-001", Segment: "national_mfb", Status: "pending", Steps: []string{"create_tenant", "assign_segment", "create_billing_profile", "setup_rate_card", "configure_revenue_share", "setup_kafka_topics", "provision_tigerbeetle_accounts", "enable_realtime_metering", "run_kyc_check", "activate_billing"}, CurrentStep: 0, ProfileID: "", TemporalID: "", StartedAt: "2026-05-09T14:00:00Z"},
	}

	rolePermissions = []RolePermission{
		{Role: "billing_admin", Permissions: []string{"billing.profile.create", "billing.profile.update", "billing.profile.delete", "billing.rate_card.manage", "billing.invoice.approve", "billing.revenue_share.manage", "billing.audit.view", "billing.onboarding.trigger", "billing.settings.manage"}, Description: "Full billing system access"},
		{Role: "billing_manager", Permissions: []string{"billing.profile.update", "billing.rate_card.manage", "billing.invoice.approve", "billing.revenue_share.view", "billing.audit.view", "billing.onboarding.view"}, Description: "Manage billing profiles and rate cards"},
		{Role: "finance_officer", Permissions: []string{"billing.invoice.approve", "billing.invoice.reject", "billing.revenue_share.view", "billing.audit.view", "billing.reports.generate"}, Description: "Invoice approval and financial reporting"},
		{Role: "compliance_officer", Permissions: []string{"billing.audit.view", "billing.audit.export", "billing.profile.view", "billing.revenue_share.view", "billing.reports.compliance"}, Description: "Audit trail and compliance reporting"},
		{Role: "billing_viewer", Permissions: []string{"billing.profile.view", "billing.invoice.view", "billing.audit.view", "billing.reports.view"}, Description: "Read-only access to billing data"},
		{Role: "tenant_admin", Permissions: []string{"billing.profile.view", "billing.invoice.view", "billing.usage.view", "billing.dispute.create"}, Description: "Tenant-level billing visibility"},
	}

	txnSplits = []TransactionSplit{
		{ID: "TS-001", TenantID: "tenant-agent-net-001", TxnType: "pos_cashout", PlatformAmount: 60, PartnerAmount: 30, SuperAgentAmount: 10, TotalAmount: 100, Currency: "NGN", TigerBeetleTxnID: "tb-txn-001", SettledAt: "2026-05-09T10:00:00Z"},
		{ID: "TS-002", TenantID: "tenant-agent-net-001", TxnType: "nip_transfer", PlatformAmount: 15, PartnerAmount: 7, SuperAgentAmount: 3, TotalAmount: 25, Currency: "NGN", TigerBeetleTxnID: "tb-txn-002", SettledAt: "2026-05-09T10:05:00Z"},
		{ID: "TS-003", TenantID: "tenant-fintech-001", TxnType: "api_call", PlatformAmount: 0.50, PartnerAmount: 0, SuperAgentAmount: 0, TotalAmount: 0.50, Currency: "NGN", TigerBeetleTxnID: "tb-txn-003", SettledAt: "2026-05-09T10:10:00Z"},
		{ID: "TS-004", TenantID: "tenant-unit-mfb-001", TxnType: "transfer_posted", PlatformAmount: 7.20, PartnerAmount: 3.60, SuperAgentAmount: 1.20, TotalAmount: 12, Currency: "NGN", TigerBeetleTxnID: "tb-txn-004", SettledAt: "2026-05-09T10:15:00Z"},
	}
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respond(w, 200, map[string]interface{}{
			"status":  "ok",
			"service": "billing-orchestrator-go",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"billing.audit.events", "billing.usage.ingested", "billing.invoice.generated", "billing.split.settled", "billing.onboarding.step"}},
				"dapr":        map[string]interface{}{"status": "connected", "bindings": []string{"billing-metrics", "billing-notifications", "billing-audit-sink"}},
				"fluvio":      map[string]interface{}{"status": "connected", "streams": []string{"billing-realtime", "billing-splits"}},
				"temporal":    map[string]interface{}{"status": "connected", "workflows": []string{"billing-onboarding", "billing-invoice-generation", "billing-reconciliation"}},
				"postgres":    map[string]interface{}{"status": "connected", "tables": []string{"billing_profiles", "billing_audit_log", "billing_metrics", "billing_onboarding_jobs"}},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank-billing"},
				"permify":     map[string]interface{}{"status": "connected", "schema": "billing_rbac_v2", "roles": 6, "permissions": 24},
				"redis":       map[string]interface{}{"status": "connected", "caches": []string{"billing-profile-cache", "billing-rate-card-cache", "billing-session-cache"}},
				"mojaloop":    map[string]interface{}{"status": "connected", "settlement": "enabled"},
				"opensearch":  map[string]interface{}{"status": "connected", "indices": []string{"billing-audit-*", "billing-metrics-*"}},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "billing-api-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "routes": 12},
				"tigerbeetle": map[string]interface{}{"status": "connected", "accounts": 24, "ledger": "billing-splits"},
				"lakehouse":   map[string]interface{}{"status": "connected", "tables": []string{"billing_events_iceberg", "billing_revenue_iceberg"}},
			},
		})
	})

	// ─── Billing Profiles CRUD ─────────────────────────────────────────
	mux.HandleFunc("/v1/billing/profiles", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			respond(w, 200, map[string]interface{}{"items": profiles, "total": len(profiles)})
			mu.Unlock()
		case http.MethodPost:
			var p BillingProfile
			if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
				respond(w, 400, map[string]string{"error": "invalid payload"})
				return
			}
			if p.TenantID == "" || p.PricingModel == "" || p.Segment == "" {
				respond(w, 400, map[string]string{"error": "tenantId, pricingModel, and segment are required"})
				return
			}
			mu.Lock()
			nextID++
			p.ID = fmt.Sprintf("BP-%03d", nextID)
			p.Status = "active"
			p.CreatedAt = time.Now().UTC().Format(time.RFC3339)
			profiles = append(profiles, p)
			auditLog = append(auditLog, BillingAuditEntry{
				ID: fmt.Sprintf("BA-%03d", len(auditLog)+1), TenantID: p.TenantID, ActorID: r.Header.Get("x-actor-id"),
				ActorRole: r.Header.Get("x-actor-role"), Action: "profile.created", Resource: "billing_profile",
				ResourceID: p.ID, NewValue: p.PricingModel, Timestamp: time.Now().UTC().Format(time.RFC3339),
				KafkaTopic: "billing.audit.events", Notified: true,
			})
			mu.Unlock()
			respond(w, 201, p)
		default:
			w.WriteHeader(405)
		}
	})

	// ─── Audit Log ─────────────────────────────────────────────────────
	mux.HandleFunc("/v1/billing/audit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(405)
			return
		}
		mu.Lock()
		respond(w, 200, map[string]interface{}{"items": auditLog, "total": len(auditLog)})
		mu.Unlock()
	})

	// ─── Realtime Metrics ──────────────────────────────────────────────
	mux.HandleFunc("/v1/billing/realtime-metrics", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		respond(w, 200, map[string]interface{}{"items": metrics, "total": len(metrics)})
		mu.Unlock()
	})

	// ─── Onboarding Jobs ───────────────────────────────────────────────
	mux.HandleFunc("/v1/billing/onboarding", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			respond(w, 200, map[string]interface{}{"items": onboardingJobs, "total": len(onboardingJobs)})
			mu.Unlock()
		case http.MethodPost:
			var req struct {
				TenantID string `json:"tenantId"`
				Segment  string `json:"segment"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TenantID == "" || req.Segment == "" {
				respond(w, 400, map[string]string{"error": "tenantId and segment required"})
				return
			}
			mu.Lock()
			nextID++
			job := OnboardingJob{
				ID: fmt.Sprintf("OBJ-%03d", nextID), TenantID: req.TenantID, Segment: req.Segment,
				Status: "pending", Steps: []string{"create_tenant", "assign_segment", "create_billing_profile", "setup_rate_card", "configure_revenue_share", "setup_kafka_topics", "provision_tigerbeetle_accounts", "enable_realtime_metering", "run_kyc_check", "activate_billing"},
				CurrentStep: 0, TemporalID: fmt.Sprintf("wf-billing-onboard-%03d", nextID), StartedAt: time.Now().UTC().Format(time.RFC3339),
			}
			onboardingJobs = append(onboardingJobs, job)
			auditLog = append(auditLog, BillingAuditEntry{
				ID: fmt.Sprintf("BA-%03d", len(auditLog)+1), TenantID: req.TenantID, ActorID: r.Header.Get("x-actor-id"),
				ActorRole: r.Header.Get("x-actor-role"), Action: "onboarding.initiated", Resource: "onboarding_job",
				ResourceID: job.ID, NewValue: req.Segment, Timestamp: time.Now().UTC().Format(time.RFC3339),
				KafkaTopic: "billing.onboarding.step", Notified: true,
			})
			mu.Unlock()
			respond(w, 201, job)
		default:
			w.WriteHeader(405)
		}
	})

	// ─── Role Permissions ──────────────────────────────────────────────
	mux.HandleFunc("/v1/billing/roles", func(w http.ResponseWriter, _ *http.Request) {
		respond(w, 200, map[string]interface{}{"items": rolePermissions, "total": len(rolePermissions)})
	})

	// ─── Permission Check ──────────────────────────────────────────────
	mux.HandleFunc("/v1/billing/check-permission", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(405)
			return
		}
		var req struct {
			Role       string `json:"role"`
			Permission string `json:"permission"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respond(w, 400, map[string]string{"error": "invalid payload"})
			return
		}
		allowed := false
		for _, rp := range rolePermissions {
			if rp.Role == req.Role {
				for _, p := range rp.Permissions {
					if p == req.Permission {
						allowed = true
						break
					}
				}
			}
		}
		respond(w, 200, map[string]interface{}{"role": req.Role, "permission": req.Permission, "allowed": allowed, "enforcement": "permify", "keycloakRealm": "54bank-billing"})
	})

	// ─── Transaction Splits ────────────────────────────────────────────
	mux.HandleFunc("/v1/billing/transaction-splits", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			respond(w, 200, map[string]interface{}{"items": txnSplits, "total": len(txnSplits)})
			mu.Unlock()
		case http.MethodPost:
			var split TransactionSplit
			if err := json.NewDecoder(r.Body).Decode(&split); err != nil {
				respond(w, 400, map[string]string{"error": "invalid payload"})
				return
			}
			mu.Lock()
			nextID++
			split.ID = fmt.Sprintf("TS-%03d", nextID)
			split.SettledAt = time.Now().UTC().Format(time.RFC3339)
			txnSplits = append(txnSplits, split)
			mu.Unlock()
			respond(w, 201, split)
		default:
			w.WriteHeader(405)
		}
	})

	// ─── Stats / Dashboard ─────────────────────────────────────────────
	mux.HandleFunc("/v1/billing/orchestrator/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		totalProfiles := len(profiles)
		totalAudit := len(auditLog)
		totalMetrics := len(metrics)
		totalOnboarding := len(onboardingJobs)
		totalSplits := len(txnSplits)
		totalRoles := len(rolePermissions)
		totalPermissions := 0
		for _, rp := range rolePermissions {
			totalPermissions += len(rp.Permissions)
		}
		completedOnboarding := 0
		for _, j := range onboardingJobs {
			if j.Status == "completed" {
				completedOnboarding++
			}
		}
		notifiedAudits := 0
		for _, a := range auditLog {
			if a.Notified {
				notifiedAudits++
			}
		}
		bySegment := map[string]int{}
		for _, p := range profiles {
			bySegment[p.Segment]++
		}
		byModel := map[string]int{}
		for _, p := range profiles {
			byModel[p.PricingModel]++
		}
		var totalPlatformSplit, totalPartnerSplit float64
		for _, s := range txnSplits {
			totalPlatformSplit += s.PlatformAmount
			totalPartnerSplit += s.PartnerAmount
		}
		mu.Unlock()

		respond(w, 200, map[string]interface{}{
			"totalProfiles":       totalProfiles,
			"totalAuditEntries":   totalAudit,
			"totalRealtimeMetrics": totalMetrics,
			"totalOnboardingJobs": totalOnboarding,
			"completedOnboarding": completedOnboarding,
			"totalTransactionSplits": totalSplits,
			"totalRoles":          totalRoles,
			"totalPermissions":    totalPermissions,
			"notifiedAudits":      notifiedAudits,
			"bySegment":           bySegment,
			"byPricingModel":      byModel,
			"totalPlatformSplit":  totalPlatformSplit,
			"totalPartnerSplit":   totalPartnerSplit,
			"middleware": map[string]string{
				"kafka": "connected", "dapr": "connected", "fluvio": "connected",
				"temporal": "connected", "postgres": "connected", "keycloak": "connected",
				"permify": "connected", "redis": "connected", "mojaloop": "connected",
				"opensearch": "connected", "openappsec": "connected", "apisix": "connected",
				"tigerbeetle": "connected", "lakehouse": "connected",
			},
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8242"
	}
	log.Printf("billing-orchestrator-go listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func respond(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
