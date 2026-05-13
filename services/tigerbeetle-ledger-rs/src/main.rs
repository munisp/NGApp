use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;

#[derive(Clone)]
struct AppState { start_time: Instant }

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "tigerbeetle-ledger-rs",
        "status": "healthy",
        "domain": "Tigerbeetle Ledger",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "tigerbeetle-ledger.events, tigerbeetle-ledger.audit",
            "postgres": "tigerbeetle_ledger_records",
            "redis": "tigerbeetle-ledger_cache",
            "temporal": "TigerbeetleLedgerWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "tigerbeetle-ledger-2026"
        }
    }))
}


async fn list_records() -> HttpResponse {
    HttpResponse::Ok().json(json!({"records": [
        {"id": "TB-001", "type": "account", "ledger": 1, "code": 1001, "balance": 500000000000_u64, "pending": 0, "flags": ["debits_must_not_exceed_credits"]},
        {"id": "TB-002", "type": "transfer", "debit": "TB-001", "credit": "TB-003", "amount": 50000000, "status": "posted", "twoPhase": false},
        {"id": "TB-003", "type": "account", "ledger": 1, "code": 2001, "balance": 150000000000_u64, "flags": []},
    ], "total": 3, "domain": "Tigerbeetle Ledger"}))
}
async fn create_record(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Created().json(json!({"created": true, "data": *body, "status": "posted"}))
}
async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(json!({"totalAccounts": 250000, "totalTransfers24h": 1450000, "pendingTransfers": 342, "avgLatencyUs": 50}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9308".to_string());
    let state = AppState { start_time: Instant::now() };
    println!("Tigerbeetle Ledger (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/tigerbeetle-ledger/list", web::get().to(list_records))
            .route("/v1/tigerbeetle-ledger/create", web::post().to(create_record))
            .route("/v1/tigerbeetle-ledger/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}
