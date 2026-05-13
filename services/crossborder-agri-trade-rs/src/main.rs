use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;

#[derive(Clone)]
struct AppState { start_time: Instant }

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "crossborder-agri-trade-rs",
        "status": "healthy",
        "domain": "Crossborder Agri Trade",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "crossborder-agri-trade.events, crossborder-agri-trade.audit",
            "postgres": "crossborder_agri_trade_records",
            "redis": "crossborder-agri-trade_cache",
            "temporal": "CrossborderAgriTradeWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "crossborder-agri-trade-2026"
        }
    }))
}


async fn list_records() -> HttpResponse {
    HttpResponse::Ok().json(json!({"records": [
        {"id": "MLT-001", "type": "transfer", "payerFsp": "54BANK", "payeeFsp": "MTNMOMO", "amount": 50000, "currency": "NGN", "state": "COMMITTED", "ilpCondition": "HOr22-H3AfTDHr"},
        {"id": "MLT-002", "type": "settlement_window", "state": "CLOSED", "totalTransfers": 14523, "netAmount": 52340000000},
        {"id": "MLT-003", "type": "participant", "fspId": "54BANK", "ndcLimit": 500000000000_u64, "currentPosition": 12500000000},
    ], "total": 3, "domain": "Crossborder Agri Trade"}))
}
async fn create_record(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Created().json(json!({"created": true, "data": *body, "state": "RECEIVED"}))
}
async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(json!({"totalTransfers24h": 45000, "settlementWindows": 2, "participants": 12, "avgCompletionMs": 1200}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9219".to_string());
    let state = AppState { start_time: Instant::now() };
    println!("Crossborder Agri Trade (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/crossborder-agri-trade/list", web::get().to(list_records))
            .route("/v1/crossborder-agri-trade/create", web::post().to(create_record))
            .route("/v1/crossborder-agri-trade/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}
