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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.output.encoder.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "output-encoder-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "output-encoder-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Response output encoding, XSS prevention, HTML entity encoding, JSON escape verification, context-aware encoding",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "encoding_rules": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "ENC-001", "context": "html_body", "encoder": "HTML entity encoding", "charsEncoded": ["<", ">", "&", "\"", "'"], "applied24h": 12000000, "xssBlocked": 456, "status": "active"}, {"id": "ENC-002", "context": "html_attribute", "encoder": "Attribute encoding", "charsEncoded": ["<", ">", "&", "\"", "'", "`", "="], "applied24h": 8900000, "xssBlocked": 234, "status": "active"}, {"id": "ENC-003", "context": "javascript", "encoder": "JS hex encoding", "charsEncoded": ["<", ">", "&", "\"", "'", "\\", "/"], "applied24h": 3400000, "xssBlocked": 89, "status": "active"}, {"id": "ENC-004", "context": "url", "encoder": "Percent encoding", "charsEncoded": [" ", "<", ">", "#", "%", "{", "}", "|", "\\", "^", "~", "[", "]", "`"], "applied24h": 5600000, "xssBlocked": 123, "status": "active"}, {"id": "ENC-005", "context": "json", "encoder": "JSON escape verification", "charsEncoded": ["\\", "\"", "/", "\\b", "\\f", "\\n", "\\r", "\\t"], "applied24h": 45000000, "xssBlocked": 12, "status": "active"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8518".to_string());
    println!("Output Encoder listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/output-encoder/list", web::get().to(list_items))
            .route("/v1/output-encoder/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
