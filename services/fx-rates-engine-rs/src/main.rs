use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// fx-rates-engine-rs — FX rates engine with spread management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn compute_mid_rate(bid: f64, ask: f64) -> f64 { (bid + ask) / 2.0 }
fn compute_spread(bid: f64, ask: f64) -> f64 { ask - bid }
fn spread_percentage(bid: f64, ask: f64) -> f64 { if bid == 0.0 { 0.0 } else { (ask - bid) / bid * 100.0 } }
fn convert_amount(amount: f64, rate: f64) -> f64 { (amount * rate * 100.0).round() / 100.0 }
fn cbn_rate_band(official: f64, market: f64) -> bool { (market - official).abs() / official < 0.05 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fx-rates-engine-rs",
        "version": "1.0.0",
        "description": "FX rates engine with spread management",
    }))
}


async fn get_rate(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fx-rates-engine-rs",
        "endpoint": "get_rate",
        "description": "Get current FX rate with bid/ask spread",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn convert(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fx-rates-engine-rs",
        "endpoint": "convert",
        "description": "Convert amount between currencies",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn rate_history(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fx-rates-engine-rs",
        "endpoint": "rate_history",
        "description": "Get historical rate data",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8150);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("fx-rates-engine-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/rate", web::post().to(get_rate))
            .route("/v1/convert", web::post().to(convert))
            .route("/v1/history", web::post().to(rate_history))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
