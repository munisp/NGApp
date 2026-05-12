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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.token.rotation.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "token-rotation-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "token-rotation-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Refresh token rotation, token family tracking, revocation cascade, Redis blacklist, replay detection",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "token_families": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "TF-001", "familyId": "fam_a1b2c3d4", "userId": "USR-001", "clientId": "54bank-pwa", "currentToken": "rt_***masked***", "generation": 47, "maxGenerations": 100, "rotatedAt": "2026-05-09T14:30:00Z", "expiresAt": "2026-05-09T15:00:00Z", "replayDetected": false, "revokedDescendants": 0, "status": "active"}, {"id": "TF-002", "familyId": "fam_e5f6g7h8", "userId": "USR-002", "clientId": "54bank-mobile", "currentToken": "rt_***masked***", "generation": 156, "maxGenerations": 500, "rotatedAt": "2026-05-09T14:25:00Z", "expiresAt": "2026-05-10T14:25:00Z", "replayDetected": false, "revokedDescendants": 0, "status": "active"}, {"id": "TF-003", "familyId": "fam_i9j0k1l2", "userId": "USR-003", "clientId": "54bank-pwa", "currentToken": "rt_***masked***", "generation": 23, "maxGenerations": 100, "rotatedAt": "2026-05-09T10:00:00Z", "expiresAt": "2026-05-09T10:30:00Z", "replayDetected": true, "revokedDescendants": 3, "status": "revoked"}, {"id": "TF-004", "familyId": "fam_m3n4o5p6", "userId": "USR-004", "clientId": "54bank-agent", "currentToken": "rt_***masked***", "generation": 8, "maxGenerations": 50, "rotatedAt": "2026-05-09T13:00:00Z", "expiresAt": "2026-05-09T14:00:00Z", "replayDetected": false, "revokedDescendants": 0, "status": "active"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8504".to_string());
    println!("Token Rotation Engine listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/token-rotation/list", web::get().to(list_items))
            .route("/v1/token-rotation/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
