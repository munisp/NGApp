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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.sri.validator.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "sri-validator-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "sri-validator-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Subresource Integrity hash generation, CDN asset verification, supply chain protection, integrity monitoring",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "sri_hashes": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "SRI-001", "resource": "/assets/main.js", "algorithm": "sha384", "hash": "sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC", "lastVerified": "2026-05-09T14:00:00Z", "violations": 0, "cdnProvider": "Cloudflare", "status": "valid"}, {"id": "SRI-002", "resource": "/assets/vendor.js", "algorithm": "sha384", "hash": "sha384-T2S0+qR0UE7TbIX3rFfGJ4JLNkUfRVb6cX9UwKvZc5Y+GqP2ue2UmY06iGxY+wC", "lastVerified": "2026-05-09T14:00:00Z", "violations": 0, "cdnProvider": "Cloudflare", "status": "valid"}, {"id": "SRI-003", "resource": "/assets/styles.css", "algorithm": "sha384", "hash": "sha384-ZQlRVJ3rFfGJ4JLNkUfRVb6cX9UwKvZc5Y+Gq06iGxY+wCT2S0+qR0UE7TbIX3", "lastVerified": "2026-05-09T14:00:00Z", "violations": 0, "cdnProvider": "Cloudflare", "status": "valid"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8530".to_string());
    println!("SRI Validator listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/sri-validator/list", web::get().to(list_items))
            .route("/v1/sri-validator/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
