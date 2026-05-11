use actix_web::{web, App, HttpServer, HttpResponse};
use serde::Serialize;

#[derive(Serialize, Clone)]
struct AuditEntry {
    id: String, flag_key: String, action: String, actor: String,
    old_value: String, new_value: String, tenant_id: String, timestamp: String,
}

#[derive(Serialize)]
struct Stats {
    total_entries: usize, flags_modified: usize, actors: usize,
    last_audit: String, compliance_score: f64,
}

fn seed_data() -> Vec<AuditEntry> {
    vec![
        AuditEntry { id: "FA-001".into(), flag_key: "mobile_money_v2".into(), action: "enabled".into(), actor: "admin@54bank.ng".into(), old_value: "false".into(), new_value: "true".into(), tenant_id: "TEN-GTBANK".into(), timestamp: "2026-05-09T08:30:00Z".into() },
        AuditEntry { id: "FA-002".into(), flag_key: "ussd_fallback".into(), action: "rollout_updated".into(), actor: "ops@54bank.ng".into(), old_value: "50%".into(), new_value: "80%".into(), tenant_id: "TEN-FIRSTBANK".into(), timestamp: "2026-05-09T09:15:00Z".into() },
        AuditEntry { id: "FA-003".into(), flag_key: "cbdc_pilot".into(), action: "disabled".into(), actor: "compliance@54bank.ng".into(), old_value: "true".into(), new_value: "false".into(), tenant_id: "TEN-UBA".into(), timestamp: "2026-05-09T10:00:00Z".into() },
        AuditEntry { id: "FA-004".into(), flag_key: "biometric_auth".into(), action: "created".into(), actor: "cto@54bank.ng".into(), old_value: "".into(), new_value: "true".into(), tenant_id: "TEN-ACCESS".into(), timestamp: "2026-05-09T11:45:00Z".into() },
        AuditEntry { id: "FA-005".into(), flag_key: "agent_banking_offline".into(), action: "kill_switched".into(), actor: "security@54bank.ng".into(), old_value: "true".into(), new_value: "false".into(), tenant_id: "TEN-WEMA".into(), timestamp: "2026-05-09T14:20:00Z".into() },
    ]
}

async fn list_audits() -> HttpResponse {
    let data = seed_data();
    HttpResponse::Ok().json(serde_json::json!({"items": data, "total": data.len()}))
}

async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(Stats { total_entries: 5, flags_modified: 5, actors: 5, last_audit: "2026-05-09T14:20:00Z".into(), compliance_score: 98.5 })
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status":"healthy","service":"flag-audit-rs","port":8256}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8256".into()).parse::<u16>().unwrap_or(8256);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/v1/flag-audits", web::get().to(list_audits))
        .route("/v1/stats", web::get().to(get_stats))
    ).bind(("0.0.0.0", port))?.run().await
}
