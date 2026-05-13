use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;

#[derive(Clone)]
struct AppState { start_time: Instant }

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "ussd-transaction-engine-rs",
        "status": "healthy",
        "domain": "Ussd Transaction Engine",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "ussd-transaction-engine.events, ussd-transaction-engine.audit",
            "postgres": "ussd_transaction_engine_records",
            "redis": "ussd-transaction-engine_cache",
            "temporal": "UssdTransactionEngineWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "ussd-transaction-engine-2026"
        }
    }))
}


async fn list_records() -> HttpResponse {
    HttpResponse::Ok().json(json!({"records": [
        {"id": "REC-001", "status": "active", "domain": "Ussd Transaction Engine", "createdAt": "2026-05-09T10:00:00Z"},
        {"id": "REC-002", "status": "processing", "domain": "Ussd Transaction Engine", "createdAt": "2026-05-09T11:00:00Z"},
        {"id": "REC-003", "status": "completed", "domain": "Ussd Transaction Engine", "createdAt": "2026-05-08T14:00:00Z"},
    ], "total": 3, "domain": "Ussd Transaction Engine"}))
}
async fn create_record(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Created().json(json!({"created": true, "data": *body}))
}
async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(json!({"total": 1247, "active": 1100, "pending": 120, "archived": 27}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9316".to_string());
    let state = AppState { start_time: Instant::now() };
    println!("Ussd Transaction Engine (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/ussd-transaction-engine/list", web::get().to(list_records))
            .route("/v1/ussd-transaction-engine/create", web::post().to(create_record))
            .route("/v1/ussd-transaction-engine/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}
