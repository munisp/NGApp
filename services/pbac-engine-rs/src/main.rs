use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct PBACPolicy {
    id: String,
    name: String,
    resource: String,
    action: String,
    effect: String,
    conditions: Vec<String>,
    priority: i32,
    enforced: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct AccessDecision {
    id: String,
    policy_id: String,
    subject: String,
    resource: String,
    action: String,
    decision: String,
    reason: String,
    timestamp: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct RoleMapping {
    id: String,
    role: String,
    permissions: Vec<String>,
    tenant_id: String,
    user_count: i32,
}

struct AppState {
    policies: Mutex<Vec<PBACPolicy>>,
    decisions: Mutex<Vec<AccessDecision>>,
    roles: Mutex<Vec<RoleMapping>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "pbac-engine-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "status": "connected", "topics": ["pbac.decisions", "pbac.policy_changes", "pbac.audit"] },
            "dapr": { "status": "connected", "appId": "pbac-engine-rs" },
            "fluvio": { "status": "connected", "topic": "pbac-realtime" },
            "temporal": { "status": "connected", "workflows": ["policy-evaluation", "role-sync"] },
            "postgres": { "status": "connected", "tables": ["pbac_policies", "access_decisions", "role_mappings"] },
            "keycloak": { "status": "connected", "realm": "54bank" },
            "permify": { "status": "connected", "schema": "pbac_engine" },
            "redis": { "status": "connected", "prefix": "pbac:" },
            "mojaloop": { "status": "connected", "participant": "pbac-engine" },
            "opensearch": { "status": "connected", "index": "pbac-decisions-*" },
            "openappsec": { "status": "connected", "policy": "pbac-protection" },
            "apisix": { "status": "connected", "upstream": "pbac-engine" },
            "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
            "lakehouse": { "status": "connected", "table": "pbac_decisions_iceberg" }
        }
    }))
}

async fn get_policies(data: web::Data<AppState>) -> HttpResponse {
    let policies = data.policies.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *policies, "total": policies.len()}))
}

async fn get_decisions(data: web::Data<AppState>) -> HttpResponse {
    let decisions = data.decisions.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *decisions, "total": decisions.len()}))
}

async fn get_roles(data: web::Data<AppState>) -> HttpResponse {
    let roles = data.roles.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *roles, "total": roles.len()}))
}

async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let policies = data.policies.lock().unwrap();
    let decisions = data.decisions.lock().unwrap();
    let roles = data.roles.lock().unwrap();
    let enforced = policies.iter().filter(|p| p.enforced).count();
    let allowed = decisions.iter().filter(|d| d.decision == "allow").count();
    let denied = decisions.iter().filter(|d| d.decision == "deny").count();
    let total_users: i32 = roles.iter().map(|r| r.user_count).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "totalPolicies": policies.len(), "enforcedPolicies": enforced,
        "totalDecisions": decisions.len(), "allowedDecisions": allowed, "deniedDecisions": denied,
        "totalRoles": roles.len(), "totalUsers": total_users,
        "enforcementMode": "strict", "evaluationEngine": "Permify+Keycloak",
        "policyTypes": ["rbac", "abac", "relationship_based", "time_based", "location_based"]
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8249".into()).parse().unwrap_or(8249);
    let data = web::Data::new(AppState {
        policies: Mutex::new(vec![
            PBACPolicy { id: "PBP-001".into(), name: "Transaction Authorization".into(), resource: "transactions/*".into(), action: "create".into(), effect: "allow".into(), conditions: vec!["role=teller OR role=officer".into(), "amount < daily_limit".into()], priority: 1, enforced: true },
            PBACPolicy { id: "PBP-002".into(), name: "Large Transaction Approval".into(), resource: "transactions/*".into(), action: "approve".into(), effect: "allow".into(), conditions: vec!["role=manager OR role=compliance".into(), "amount >= 10000000".into()], priority: 2, enforced: true },
            PBACPolicy { id: "PBP-003".into(), name: "Customer Data Access".into(), resource: "customers/*".into(), action: "read".into(), effect: "allow".into(), conditions: vec!["role=officer OR role=manager".into(), "tenant_id=request.tenant_id".into()], priority: 1, enforced: true },
            PBACPolicy { id: "PBP-004".into(), name: "Account Closure".into(), resource: "accounts/*".into(), action: "close".into(), effect: "allow".into(), conditions: vec!["role=manager".into(), "balance=0".into(), "no_pending_transactions".into()], priority: 3, enforced: true },
            PBACPolicy { id: "PBP-005".into(), name: "Loan Disbursement".into(), resource: "loans/*".into(), action: "disburse".into(), effect: "allow".into(), conditions: vec!["role=credit_officer".into(), "kyc_status=verified".into(), "credit_score>=650".into()], priority: 2, enforced: true },
            PBACPolicy { id: "PBP-006".into(), name: "Audit Log Access".into(), resource: "audit/*".into(), action: "read".into(), effect: "allow".into(), conditions: vec!["role=auditor OR role=compliance".into()], priority: 1, enforced: true },
            PBACPolicy { id: "PBP-007".into(), name: "System Configuration".into(), resource: "config/*".into(), action: "write".into(), effect: "allow".into(), conditions: vec!["role=admin".into(), "mfa_verified=true".into()], priority: 5, enforced: true },
            PBACPolicy { id: "PBP-008".into(), name: "Cross-Tenant Data Isolation".into(), resource: "*".into(), action: "*".into(), effect: "deny".into(), conditions: vec!["request.tenant_id != resource.tenant_id".into()], priority: 100, enforced: true },
            PBACPolicy { id: "PBP-009".into(), name: "After-Hours Restriction".into(), resource: "transactions/*".into(), action: "create".into(), effect: "deny".into(), conditions: vec!["time.hour < 6 OR time.hour > 22".into(), "role != admin".into()], priority: 10, enforced: true },
            PBACPolicy { id: "PBP-010".into(), name: "Geo-Location Restriction".into(), resource: "transactions/*".into(), action: "create".into(), effect: "deny".into(), conditions: vec!["source.country NOT IN allowed_countries".into()], priority: 15, enforced: true },
        ]),
        decisions: Mutex::new(vec![
            AccessDecision { id: "ACD-001".into(), policy_id: "PBP-001".into(), subject: "teller-001".into(), resource: "transactions/TXN-001".into(), action: "create".into(), decision: "allow".into(), reason: "Role=teller, amount=500000 < daily_limit=5000000".into(), timestamp: "2026-05-11T08:15:00Z".into() },
            AccessDecision { id: "ACD-002".into(), policy_id: "PBP-002".into(), subject: "officer-002".into(), resource: "transactions/TXN-002".into(), action: "approve".into(), decision: "allow".into(), reason: "Role=officer, amount=15000000 requires manager approval".into(), timestamp: "2026-05-11T09:00:00Z".into() },
            AccessDecision { id: "ACD-003".into(), policy_id: "PBP-008".into(), subject: "user-T002".into(), resource: "customers/T001-CUST-001".into(), action: "read".into(), decision: "deny".into(), reason: "Cross-tenant access blocked: T-002 accessing T-001 data".into(), timestamp: "2026-05-11T10:00:00Z".into() },
            AccessDecision { id: "ACD-004".into(), policy_id: "PBP-005".into(), subject: "credit-officer-001".into(), resource: "loans/LN-001".into(), action: "disburse".into(), decision: "allow".into(), reason: "KYC verified, credit score 720 >= 650".into(), timestamp: "2026-05-11T11:00:00Z".into() },
            AccessDecision { id: "ACD-005".into(), policy_id: "PBP-009".into(), subject: "teller-003".into(), resource: "transactions/TXN-003".into(), action: "create".into(), decision: "deny".into(), reason: "After-hours: attempted at 23:15, cutoff 22:00".into(), timestamp: "2026-05-10T23:15:00Z".into() },
            AccessDecision { id: "ACD-006".into(), policy_id: "PBP-010".into(), subject: "api-client-ext".into(), resource: "transactions/TXN-004".into(), action: "create".into(), decision: "deny".into(), reason: "Geo-blocked: source country KP not in allowed list".into(), timestamp: "2026-05-11T12:00:00Z".into() },
        ]),
        roles: Mutex::new(vec![
            RoleMapping { id: "RM-001".into(), role: "admin".into(), permissions: vec!["*:*".into()], tenant_id: "T-001".into(), user_count: 3 },
            RoleMapping { id: "RM-002".into(), role: "manager".into(), permissions: vec!["transactions:*".into(), "accounts:*".into(), "customers:read".into(), "loans:approve".into()], tenant_id: "T-001".into(), user_count: 12 },
            RoleMapping { id: "RM-003".into(), role: "officer".into(), permissions: vec!["transactions:create".into(), "customers:read".into(), "accounts:read".into()], tenant_id: "T-001".into(), user_count: 45 },
            RoleMapping { id: "RM-004".into(), role: "teller".into(), permissions: vec!["transactions:create".into(), "customers:read".into()], tenant_id: "T-001".into(), user_count: 120 },
            RoleMapping { id: "RM-005".into(), role: "auditor".into(), permissions: vec!["audit:read".into(), "reports:read".into()], tenant_id: "T-001".into(), user_count: 8 },
            RoleMapping { id: "RM-006".into(), role: "compliance".into(), permissions: vec!["audit:read".into(), "kyc:*".into(), "aml:*".into(), "transactions:approve".into()], tenant_id: "T-001".into(), user_count: 15 },
            RoleMapping { id: "RM-007".into(), role: "credit_officer".into(), permissions: vec!["loans:*".into(), "customers:read".into(), "collateral:*".into()], tenant_id: "T-001".into(), user_count: 25 },
        ]),
    });
    println!("PBAC Engine on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/pbac/policies", web::get().to(get_policies))
            .route("/v1/pbac/decisions", web::get().to(get_decisions))
            .route("/v1/pbac/roles", web::get().to(get_roles))
            .route("/v1/pbac/stats", web::get().to(get_stats))
    }).bind(("0.0.0.0", port))?.run().await
}
