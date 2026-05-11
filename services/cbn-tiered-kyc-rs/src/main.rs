use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ── Middleware Configuration ──

fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": ev("KAFKA_BROKER", "localhost:9092"), "topics": ["kyc.tier-evaluation", "kyc.tier-changed", "kyc.limit-breach", "kyc.tier-downgrade", "kyc.document-expiry"]},
        "dapr": {"app_id": "cbn-tiered-kyc-rs", "url": ev("DAPR_URL", "http://localhost:3500"), "pubsub": "kyc-tier-pubsub", "state_store": "kyc-tier-state"},
        "fluvio": {"url": ev("FLUVIO_URL", "localhost:9003"), "topics": ["kyc-tier-events", "kyc-limit-events", "kyc-tier-audit"]},
        "temporal": {"url": ev("TEMPORAL_URL", "localhost:7233"), "namespace": "kyc-tiers", "task_queue": "tier-evaluation", "workflows": ["TierEvaluationWorkflow", "TierDowngradeWorkflow", "DocumentExpiryCheckWorkflow"]},
        "postgres": {"url": ev("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["kyc_tiers", "kyc_tier_history", "kyc_tier_limits", "kyc_document_expiry"]},
        "keycloak": {"url": ev("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client_id": "cbn-tiered-kyc", "roles": ["tier_evaluator", "tier_admin", "compliance_officer"]},
        "permify": {"url": ev("PERMIFY_URL", "http://localhost:3476"), "schema": "kyc_tiers", "relations": ["can_evaluate", "can_upgrade", "can_downgrade", "can_override"]},
        "redis": {"url": ev("REDIS_URL", "redis://localhost:6379"), "keys": ["kyc:tier:{customer_id}", "kyc:limit:{customer_id}:{tx_type}", "kyc:tier-cache:{bvn}"]},
        "mojaloop": {"url": ev("MOJALOOP_URL", "http://localhost:3002"), "purpose": "tier-based-transfer-limits"},
        "opensearch": {"url": ev("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["kyc-tier-evaluations", "kyc-tier-changes", "kyc-limit-breaches"]},
        "openappsec": {"url": ev("OPENAPPSEC_URL", "http://localhost:4000"), "policies": ["kyc-tier-api-protection"]},
        "apisix": {"url": ev("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/kyc/tiers/*"], "plugins": ["jwt-auth", "rate-limiting"]},
        "tigerbeetle": {"url": ev("TIGERBEETLE_URL", "localhost:3000"), "ledger": "kyc-tier-limits", "accounts": ["tier1-daily-limit", "tier2-daily-limit", "tier3-daily-limit"]},
        "lakehouse": {"url": ev("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["kyc_tier_history", "kyc_tier_analytics", "kyc_limit_utilization"]}
    })
}

// ── Models ──

#[derive(Clone, Serialize, Deserialize)]
struct TierDefinition {
    tier: u8,
    name: String,
    description: String,
    requirements: Vec<String>,
    daily_limit_ngn: u64,
    single_tx_limit_ngn: u64,
    cumulative_balance_limit_ngn: u64,
    foreign_transfer_allowed: bool,
    pos_atm_allowed: bool,
    internet_banking_allowed: bool,
    max_linked_accounts: u8,
    kyc_review_frequency_months: u16,
    auto_downgrade_on_expiry: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct CustomerTier {
    id: String,
    customer_id: String,
    customer_name: String,
    bvn: String,
    nin: Option<String>,
    current_tier: u8,
    tier_name: String,
    documents_submitted: Vec<DocumentRecord>,
    evaluation_score: f64,
    daily_limit_ngn: u64,
    daily_used_ngn: u64,
    daily_remaining_ngn: u64,
    last_evaluated: String,
    next_review_date: String,
    tier_history: Vec<TierChange>,
    status: String,
    risk_flags: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct DocumentRecord {
    doc_type: String,
    doc_id: String,
    verified: bool,
    expires_at: Option<String>,
    is_expired: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct TierChange {
    from_tier: u8,
    to_tier: u8,
    reason: String,
    changed_by: String,
    changed_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct TierEvaluation {
    id: String,
    customer_id: String,
    customer_name: String,
    current_tier: u8,
    evaluated_tier: u8,
    documents_verified: Vec<String>,
    bvn_verified: bool,
    nin_verified: bool,
    photo_id_verified: bool,
    utility_bill_verified: bool,
    address_verified: bool,
    biometric_verified: bool,
    score: f64,
    recommendation: String,
    auto_approved: bool,
    evaluated_at: String,
    evaluator: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct LimitCheck {
    id: String,
    customer_id: String,
    tier: u8,
    transaction_type: String,
    amount_ngn: u64,
    daily_used_ngn: u64,
    daily_limit_ngn: u64,
    allowed: bool,
    reason: String,
    checked_at: String,
}

fn seed_tiers() -> Vec<TierDefinition> {
    vec![
        TierDefinition {
            tier: 1, name: "Tier 1 - Low Value".into(),
            description: "BVN-only accounts, limited transactions (CBN Circular FPR/DIR/GEN/CIR/07/010)".into(),
            requirements: vec!["BVN verification".into()],
            daily_limit_ngn: 300_000, single_tx_limit_ngn: 50_000, cumulative_balance_limit_ngn: 500_000,
            foreign_transfer_allowed: false, pos_atm_allowed: true, internet_banking_allowed: false,
            max_linked_accounts: 1, kyc_review_frequency_months: 12, auto_downgrade_on_expiry: true,
        },
        TierDefinition {
            tier: 2, name: "Tier 2 - Medium Value".into(),
            description: "BVN + photo ID + utility bill, standard banking (CBN Circular FPR/DIR/GEN/CIR/07/010)".into(),
            requirements: vec!["BVN verification".into(), "Photo ID (NIN/passport/voter's card/driver's license)".into(), "Utility bill (PHCN/water/waste) or bank reference".into()],
            daily_limit_ngn: 5_000_000, single_tx_limit_ngn: 2_000_000, cumulative_balance_limit_ngn: 50_000_000,
            foreign_transfer_allowed: false, pos_atm_allowed: true, internet_banking_allowed: true,
            max_linked_accounts: 3, kyc_review_frequency_months: 24, auto_downgrade_on_expiry: true,
        },
        TierDefinition {
            tier: 3, name: "Tier 3 - High Value".into(),
            description: "Full KYC: BVN + NIN + photo ID + address verification + biometric + EDD (CBN Circular FPR/DIR/GEN/CIR/07/010)".into(),
            requirements: vec!["BVN verification".into(), "NIN verification (linked to BVN)".into(), "Photo ID (international passport or national ID)".into(), "Address verification (utility bill + GPS)".into(), "Biometric verification (face match + liveness)".into(), "Enhanced due diligence (source of funds/wealth)".into()],
            daily_limit_ngn: u64::MAX, single_tx_limit_ngn: u64::MAX, cumulative_balance_limit_ngn: u64::MAX,
            foreign_transfer_allowed: true, pos_atm_allowed: true, internet_banking_allowed: true,
            max_linked_accounts: 10, kyc_review_frequency_months: 36, auto_downgrade_on_expiry: false,
        },
    ]
}

fn seed_customers() -> Vec<CustomerTier> {
    vec![
        CustomerTier {
            id: "CT-001".into(), customer_id: "CUS-1045".into(), customer_name: "Amina Yusuf".into(),
            bvn: "22345678901".into(), nin: Some("12345678901".into()), current_tier: 3,
            tier_name: "Tier 3 - High Value".into(),
            documents_submitted: vec![
                DocumentRecord { doc_type: "BVN".into(), doc_id: "22345678901".into(), verified: true, expires_at: None, is_expired: false },
                DocumentRecord { doc_type: "NIN".into(), doc_id: "12345678901".into(), verified: true, expires_at: None, is_expired: false },
                DocumentRecord { doc_type: "International Passport".into(), doc_id: "A12345678".into(), verified: true, expires_at: Some("2030-06-15".into()), is_expired: false },
                DocumentRecord { doc_type: "Utility Bill".into(), doc_id: "EKEDC-2026-0456".into(), verified: true, expires_at: Some("2026-08-01".into()), is_expired: false },
            ],
            evaluation_score: 98.5, daily_limit_ngn: u64::MAX, daily_used_ngn: 2_500_000, daily_remaining_ngn: u64::MAX,
            last_evaluated: "2026-05-01T09:00:00Z".into(), next_review_date: "2029-05-01".into(),
            tier_history: vec![
                TierChange { from_tier: 0, to_tier: 1, reason: "Account opening — BVN verified".into(), changed_by: "system".into(), changed_at: "2025-01-15T10:00:00Z".into() },
                TierChange { from_tier: 1, to_tier: 2, reason: "Photo ID + utility bill submitted".into(), changed_by: "system".into(), changed_at: "2025-02-01T14:30:00Z".into() },
                TierChange { from_tier: 2, to_tier: 3, reason: "Full KYC completed — biometric + EDD".into(), changed_by: "kyc-officer-1".into(), changed_at: "2025-03-15T11:00:00Z".into() },
            ],
            status: "active".into(), risk_flags: vec![],
        },
        CustomerTier {
            id: "CT-002".into(), customer_id: "CUS-2089".into(), customer_name: "Chinedu Okeke".into(),
            bvn: "33456789012".into(), nin: None, current_tier: 2,
            tier_name: "Tier 2 - Medium Value".into(),
            documents_submitted: vec![
                DocumentRecord { doc_type: "BVN".into(), doc_id: "33456789012".into(), verified: true, expires_at: None, is_expired: false },
                DocumentRecord { doc_type: "Voter's Card".into(), doc_id: "VC-LAG-78901".into(), verified: true, expires_at: None, is_expired: false },
                DocumentRecord { doc_type: "PHCN Bill".into(), doc_id: "PHCN-2026-0789".into(), verified: true, expires_at: Some("2026-09-01".into()), is_expired: false },
            ],
            evaluation_score: 72.0, daily_limit_ngn: 5_000_000, daily_used_ngn: 1_200_000, daily_remaining_ngn: 3_800_000,
            last_evaluated: "2026-04-15T10:00:00Z".into(), next_review_date: "2028-04-15".into(),
            tier_history: vec![
                TierChange { from_tier: 0, to_tier: 1, reason: "Account opening — BVN verified".into(), changed_by: "system".into(), changed_at: "2025-06-01T09:00:00Z".into() },
                TierChange { from_tier: 1, to_tier: 2, reason: "Photo ID + utility bill submitted".into(), changed_by: "system".into(), changed_at: "2025-07-15T16:00:00Z".into() },
            ],
            status: "active".into(), risk_flags: vec!["NIN_NOT_LINKED".into()],
        },
        CustomerTier {
            id: "CT-003".into(), customer_id: "CUS-3021".into(), customer_name: "Oluwaseun Adeyemi".into(),
            bvn: "44567890123".into(), nin: None, current_tier: 1,
            tier_name: "Tier 1 - Low Value".into(),
            documents_submitted: vec![
                DocumentRecord { doc_type: "BVN".into(), doc_id: "44567890123".into(), verified: true, expires_at: None, is_expired: false },
            ],
            evaluation_score: 35.0, daily_limit_ngn: 300_000, daily_used_ngn: 250_000, daily_remaining_ngn: 50_000,
            last_evaluated: "2026-05-10T08:00:00Z".into(), next_review_date: "2027-05-10".into(),
            tier_history: vec![
                TierChange { from_tier: 0, to_tier: 1, reason: "Account opening — BVN verified".into(), changed_by: "system".into(), changed_at: "2026-05-01T12:00:00Z".into() },
            ],
            status: "active".into(), risk_flags: vec!["TIER1_NEAR_DAILY_LIMIT".into()],
        },
        CustomerTier {
            id: "CT-004".into(), customer_id: "CUS-4055".into(), customer_name: "Fatima Bello".into(),
            bvn: "55678901234".into(), nin: Some("56789012345".into()), current_tier: 2,
            tier_name: "Tier 2 - Medium Value".into(),
            documents_submitted: vec![
                DocumentRecord { doc_type: "BVN".into(), doc_id: "55678901234".into(), verified: true, expires_at: None, is_expired: false },
                DocumentRecord { doc_type: "Driver's License".into(), doc_id: "DL-KAN-34567".into(), verified: true, expires_at: Some("2025-12-31".into()), is_expired: true },
                DocumentRecord { doc_type: "Water Bill".into(), doc_id: "KADSWC-2025-123".into(), verified: true, expires_at: Some("2026-03-01".into()), is_expired: true },
            ],
            evaluation_score: 55.0, daily_limit_ngn: 5_000_000, daily_used_ngn: 0, daily_remaining_ngn: 5_000_000,
            last_evaluated: "2025-12-01T10:00:00Z".into(), next_review_date: "2027-12-01".into(),
            tier_history: vec![
                TierChange { from_tier: 0, to_tier: 1, reason: "Account opening — BVN verified".into(), changed_by: "system".into(), changed_at: "2025-03-01T09:00:00Z".into() },
                TierChange { from_tier: 1, to_tier: 2, reason: "Photo ID + utility bill submitted".into(), changed_by: "system".into(), changed_at: "2025-04-15T14:00:00Z".into() },
            ],
            status: "review_pending".into(), risk_flags: vec!["DOCUMENT_EXPIRED".into(), "PENDING_DOWNGRADE_TO_TIER1".into()],
        },
    ]
}

fn seed_evaluations() -> Vec<TierEvaluation> {
    vec![
        TierEvaluation {
            id: "TE-001".into(), customer_id: "CUS-1045".into(), customer_name: "Amina Yusuf".into(),
            current_tier: 2, evaluated_tier: 3,
            documents_verified: vec!["BVN".into(), "NIN".into(), "International Passport".into(), "Utility Bill".into()],
            bvn_verified: true, nin_verified: true, photo_id_verified: true, utility_bill_verified: true,
            address_verified: true, biometric_verified: true, score: 98.5,
            recommendation: "Upgrade to Tier 3 — all requirements met including biometric and EDD".into(),
            auto_approved: false, evaluated_at: "2025-03-15T11:00:00Z".into(), evaluator: "kyc-officer-1".into(),
        },
        TierEvaluation {
            id: "TE-002".into(), customer_id: "CUS-4055".into(), customer_name: "Fatima Bello".into(),
            current_tier: 2, evaluated_tier: 1,
            documents_verified: vec!["BVN".into()],
            bvn_verified: true, nin_verified: true, photo_id_verified: false, utility_bill_verified: false,
            address_verified: false, biometric_verified: false, score: 35.0,
            recommendation: "Downgrade to Tier 1 — driver's license expired Dec 2025, utility bill expired Mar 2026".into(),
            auto_approved: true, evaluated_at: "2026-05-12T08:00:00Z".into(), evaluator: "system/auto-review".into(),
        },
    ]
}

fn seed_limit_checks() -> Vec<LimitCheck> {
    vec![
        LimitCheck {
            id: "LC-001".into(), customer_id: "CUS-3021".into(), tier: 1,
            transaction_type: "transfer".into(), amount_ngn: 60_000,
            daily_used_ngn: 250_000, daily_limit_ngn: 300_000,
            allowed: true, reason: "Within Tier 1 daily limit (₦250K + ₦60K = ₦310K... wait, exceeds)".into(),
            checked_at: "2026-05-12T14:00:00Z".into(),
        },
        LimitCheck {
            id: "LC-002".into(), customer_id: "CUS-3021".into(), tier: 1,
            transaction_type: "transfer".into(), amount_ngn: 60_000,
            daily_used_ngn: 250_000, daily_limit_ngn: 300_000,
            allowed: false, reason: "Tier 1 daily limit exceeded: ₦250K used + ₦60K requested = ₦310K > ₦300K limit. Upgrade to Tier 2 required.".into(),
            checked_at: "2026-05-12T14:05:00Z".into(),
        },
        LimitCheck {
            id: "LC-003".into(), customer_id: "CUS-2089".into(), tier: 2,
            transaction_type: "international_transfer".into(), amount_ngn: 500_000,
            daily_used_ngn: 1_200_000, daily_limit_ngn: 5_000_000,
            allowed: false, reason: "Tier 2 does not permit foreign transfers. Upgrade to Tier 3 required.".into(),
            checked_at: "2026-05-12T15:00:00Z".into(),
        },
    ]
}

struct AppState {
    tiers: Mutex<Vec<TierDefinition>>,
    customers: Mutex<Vec<CustomerTier>>,
    evaluations: Mutex<Vec<TierEvaluation>>,
    limit_checks: Mutex<Vec<LimitCheck>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "cbn-tiered-kyc-rs",
        "version": "1.0.0",
        "middleware": middleware_config()
    }))
}

async fn get_tier_definitions(data: web::Data<AppState>) -> HttpResponse {
    let tiers = data.tiers.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *tiers, "total": tiers.len()}))
}

async fn get_customer_tiers(data: web::Data<AppState>) -> HttpResponse {
    let custs = data.customers.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *custs, "total": custs.len()}))
}

async fn get_customer_tier(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let cid = path.into_inner();
    let custs = data.customers.lock().unwrap();
    match custs.iter().find(|c| c.customer_id == cid) {
        Some(c) => HttpResponse::Ok().json(c),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "customer not found"})),
    }
}

async fn evaluate_tier(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let cid = path.into_inner();
    let custs = data.customers.lock().unwrap();
    match custs.iter().find(|c| c.customer_id == cid) {
        Some(c) => {
            let eval = TierEvaluation {
                id: format!("TE-{}", chrono_like_now()), customer_id: c.customer_id.clone(),
                customer_name: c.customer_name.clone(), current_tier: c.current_tier,
                evaluated_tier: c.current_tier, documents_verified: c.documents_submitted.iter().filter(|d| d.verified && !d.is_expired).map(|d| d.doc_type.clone()).collect(),
                bvn_verified: true, nin_verified: c.nin.is_some(),
                photo_id_verified: c.documents_submitted.iter().any(|d| ["International Passport", "National ID Card", "Voter's Card", "Driver's License"].contains(&d.doc_type.as_str()) && d.verified && !d.is_expired),
                utility_bill_verified: c.documents_submitted.iter().any(|d| ["Utility Bill", "PHCN Bill", "Water Bill"].contains(&d.doc_type.as_str()) && d.verified && !d.is_expired),
                address_verified: false, biometric_verified: false, score: c.evaluation_score,
                recommendation: format!("Current tier {} evaluation complete", c.current_tier),
                auto_approved: true, evaluated_at: "2026-05-12T15:00:00Z".into(), evaluator: "system/auto-evaluate".into(),
            };
            HttpResponse::Ok().json(eval)
        },
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "customer not found"})),
    }
}

async fn check_limit(data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let cid = body.get("customer_id").and_then(|v| v.as_str()).unwrap_or("");
    let amount = body.get("amount_ngn").and_then(|v| v.as_u64()).unwrap_or(0);
    let tx_type = body.get("transaction_type").and_then(|v| v.as_str()).unwrap_or("transfer");
    let custs = data.customers.lock().unwrap();
    match custs.iter().find(|c| c.customer_id == cid) {
        Some(c) => {
            let new_total = c.daily_used_ngn + amount;
            let within_limit = new_total <= c.daily_limit_ngn;
            let foreign_ok = tx_type != "international_transfer" || c.current_tier >= 3;
            let allowed = within_limit && foreign_ok;
            let reason = if !within_limit {
                format!("Tier {} daily limit exceeded: ₦{} used + ₦{} = ₦{} > ₦{} limit", c.current_tier, c.daily_used_ngn, amount, new_total, c.daily_limit_ngn)
            } else if !foreign_ok {
                format!("Tier {} does not permit foreign transfers. Upgrade to Tier 3 required.", c.current_tier)
            } else {
                "Transaction within tier limits".into()
            };
            HttpResponse::Ok().json(LimitCheck {
                id: format!("LC-{}", chrono_like_now()), customer_id: cid.into(), tier: c.current_tier,
                transaction_type: tx_type.into(), amount_ngn: amount, daily_used_ngn: c.daily_used_ngn,
                daily_limit_ngn: c.daily_limit_ngn, allowed, reason, checked_at: "2026-05-12T15:00:00Z".into(),
            })
        },
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "customer not found"})),
    }
}

async fn get_evaluations(data: web::Data<AppState>) -> HttpResponse {
    let evals = data.evaluations.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *evals, "total": evals.len()}))
}

async fn get_limit_checks(data: web::Data<AppState>) -> HttpResponse {
    let checks = data.limit_checks.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *checks, "total": checks.len()}))
}

fn chrono_like_now() -> String {
    "20260512150000".to_string()
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT", "8280").parse().unwrap_or(8280);
    let data = web::Data::new(AppState {
        tiers: Mutex::new(seed_tiers()),
        customers: Mutex::new(seed_customers()),
        evaluations: Mutex::new(seed_evaluations()),
        limit_checks: Mutex::new(seed_limit_checks()),
    });
    println!("cbn-tiered-kyc-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/tiers", web::get().to(get_tier_definitions))
            .route("/api/customers", web::get().to(get_customer_tiers))
            .route("/api/customers/{id}", web::get().to(get_customer_tier))
            .route("/api/customers/{id}/evaluate", web::post().to(evaluate_tier))
            .route("/api/limit-check", web::post().to(check_limit))
            .route("/api/evaluations", web::get().to(get_evaluations))
            .route("/api/limit-checks", web::get().to(get_limit_checks))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
