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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.sql.parameterizer.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "sql-parameterizer-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "sql-parameterizer-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Query parameterization engine, SQL injection prevention, prepared statement cache, query analysis",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "queries": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "QRY-001", "originalQuery": "SELECT * FROM customers WHERE id = $1", "parameterized": true, "parameters": 1, "executionCount": 450000, "avgLatencyMs": 2.1, "injectionAttempts": 234, "blocked": 234, "status": "safe"}, {"id": "QRY-002", "originalQuery": "SELECT * FROM transactions WHERE customer_id = $1 AND date >= $2", "parameterized": true, "parameters": 2, "executionCount": 890000, "avgLatencyMs": 5.4, "injectionAttempts": 567, "blocked": 567, "status": "safe"}, {"id": "QRY-003", "originalQuery": "INSERT INTO audit_logs (event, actor, details) VALUES ($1, $2, $3)", "parameterized": true, "parameters": 3, "executionCount": 2300000, "avgLatencyMs": 1.8, "injectionAttempts": 12, "blocked": 12, "status": "safe"}, {"id": "QRY-004", "originalQuery": "UPDATE accounts SET balance = balance + $1 WHERE id = $2", "parameterized": true, "parameters": 2, "executionCount": 670000, "avgLatencyMs": 3.2, "injectionAttempts": 89, "blocked": 89, "status": "safe"}, {"id": "QRY-005", "originalQuery": "SELECT c.*, a.balance FROM customers c JOIN accounts a ON c.id = a.customer_id WHERE c.bvn = $1", "parameterized": true, "parameters": 1, "executionCount": 120000, "avgLatencyMs": 8.7, "injectionAttempts": 1456, "blocked": 1456, "status": "safe"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8499".to_string());
    println!("SQL Parameterizer listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/sql-parameterizer/list", web::get().to(list_items))
            .route("/v1/sql-parameterizer/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
