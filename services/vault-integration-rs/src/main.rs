use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Serialize, Deserialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
struct Item {
    #[serde(flatten)]
    data: serde_json::Value,
}

struct State {
    items: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.vault.integration.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "vault-integration-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "vault-integration-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "HashiCorp Vault dynamic secrets, database credential rotation, PKI engine, transit encryption",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "vault_engines": *items
    }))
}

async fn get_stats(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    let mut status_map = std::collections::HashMap::new();
    for item in items.iter() {
        if let Some(s) = item.get("status").and_then(|v| v.as_str()) {
            *status_map.entry(s.to_string()).or_insert(0) += 1;
        }
    }
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "byStatus": status_map
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "VE-001", "path": "database/", "type": "database", "description": "Dynamic Postgres credentials", "leases": 266, "maxTTL": "1h", "defaultTTL": "15m", "rotationsCompleted": 15600, "lastRotation": "2026-05-09T14:45:00Z", "status": "active"}, {"id": "VE-002", "path": "pki/", "type": "pki", "description": "Service mesh certificates", "leases": 532, "maxTTL": "720h", "defaultTTL": "24h", "rotationsCompleted": 532, "lastRotation": "2026-05-09T00:00:00Z", "status": "active"}, {"id": "VE-003", "path": "transit/", "type": "transit", "description": "Encryption as a service", "leases": 0, "maxTTL": "0", "defaultTTL": "0", "rotationsCompleted": 47, "lastRotation": "2026-05-05T00:00:00Z", "status": "active"}, {"id": "VE-004", "path": "aws/", "type": "aws", "description": "Dynamic AWS IAM credentials", "leases": 12, "maxTTL": "1h", "defaultTTL": "30m", "rotationsCompleted": 8400, "lastRotation": "2026-05-09T14:30:00Z", "status": "active"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8515".to_string());
    println!("Vault Integration listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/vault-integration/list", web::get().to(list_items))
            .route("/v1/vault-integration/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
