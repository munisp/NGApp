use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// commodity-exchange-rs — Commodity exchange trading

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn futures_price(spot: f64, risk_free_rate: f64, storage_cost: f64, tenor_days: u32) -> f64 {
    spot * (1.0 + (risk_free_rate + storage_cost) / 100.0 * tenor_days as f64 / 365.0)
}
fn basis(spot: f64, futures: f64) -> f64 { spot - futures }
fn margin_requirement(contract_value: f64, initial_margin_pct: f64) -> f64 { contract_value * initial_margin_pct / 100.0 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "commodity-exchange-rs",
        "version": "1.0.0",
        "description": "Commodity exchange trading",
    }))
}


async fn place_commodity_order(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "commodity-exchange-rs",
        "endpoint": "place_commodity_order",
        "description": "Place commodity buy/sell order",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn spot_price(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "commodity-exchange-rs",
        "endpoint": "spot_price",
        "description": "Get commodity spot price",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn futures_price_handler(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "commodity-exchange-rs",
        "endpoint": "futures_price",
        "description": "Calculate futures price from spot + carry cost",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let start = (page - 1) * limit;
    let items: Vec<&serde_json::Value> = records.iter().skip(start).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME")}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8155);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("commodity-exchange-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/order", web::post().to(place_commodity_order))
            .route("/v1/spot", web::post().to(spot_price))
            .route("/v1/futures", web::post().to(futures_price_handler))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
