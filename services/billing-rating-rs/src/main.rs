use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// billing-rating-rs — Billing and fee rating engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn compute_fee(amount: f64, fee_type: &str, tier: &str) -> f64 {
    match (fee_type, tier) {
        ("transfer_fee", "tier1") => if amount <= 5000.0 { 10.0 } else if amount <= 50000.0 { 25.0 } else { 50.0 },
        ("transfer_fee", "premium") => 0.0,
        ("maintenance_fee", _) => 100.0,
        ("sms_alert", _) => 4.0,
        ("card_annual", "tier1") => 1000.0,
        ("card_annual", "premium") => 5000.0,
        _ => 0.0,
    }
}
fn total_charges(fees: &[f64], vat_rate: f64) -> (f64, f64, f64) {
    let subtotal: f64 = fees.iter().sum();
    let vat = subtotal * vat_rate / 100.0;
    (subtotal, vat, subtotal + vat)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "billing-rating-rs",
        "version": "1.0.0",
        "description": "Billing and fee rating engine",
    }))
}


async fn rate_transaction(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "billing-rating-rs",
        "endpoint": "rate_transaction",
        "description": "Rate transaction and compute applicable fees",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn fee_schedule(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "billing-rating-rs",
        "endpoint": "fee_schedule",
        "description": "Get fee schedule for product/tier",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn revenue_forecast(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "billing-rating-rs",
        "endpoint": "revenue_forecast",
        "description": "Forecast fee revenue",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8161);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("billing-rating-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/rate", web::post().to(rate_transaction))
            .route("/v1/fees", web::post().to(fee_schedule))
            .route("/v1/forecast", web::post().to(revenue_forecast))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
