#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// relationship-pricing-rs — Relationship-based pricing engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn relationship_value(avg_balance: f64, txn_volume: f64, products_held: u32, tenure_months: u32) -> f64 {
    avg_balance * 0.3 + txn_volume * 0.2 + products_held as f64 * 10000.0 + tenure_months as f64 * 500.0
}
fn tier_from_value(value: f64) -> &'static str {
    if value >= 10_000_000.0 { "platinum" } else if value >= 5_000_000.0 { "gold" }
    else if value >= 1_000_000.0 { "silver" } else { "standard" }
}
fn discount_rate(tier: &str) -> f64 {
    match tier { "platinum" => 50.0, "gold" => 30.0, "silver" => 15.0, _ => 0.0 }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "relationship-pricing-rs",
        "version": "1.0.0",
        "description": "Relationship-based pricing engine",
    }))
}

async fn compute_discount(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let avg_balance = input.get("avg_balance").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let txn_volume = input.get("txn_volume").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let products_held = input.get("products_held").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let tenure_months = input.get("tenure_months").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = relationship_value(avg_balance, txn_volume, products_held, tenure_months);
    HttpResponse::Ok().json(json!({
        "service": "relationship-pricing-rs",
        "endpoint": "compute_discount",
        "result": json!({"value": result}),
    }))
}

async fn tier_assignment(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let value = input.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = tier_from_value(value);
    HttpResponse::Ok().json(json!({
        "service": "relationship-pricing-rs",
        "endpoint": "tier_assignment",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn pricing_override(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let tier_s = input.get("tier").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let tier = tier_s.as_str();
    let result = discount_rate(tier);
    HttpResponse::Ok().json(json!({
        "service": "relationship-pricing-rs",
        "endpoint": "pricing_override",
        "result": json!({"value": result}),
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


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "relationship-pricing-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"relationship-pricing-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"relationship-pricing-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8165);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("relationship-pricing-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/discount", web::post().to(compute_discount))
            .route("/v1/tier", web::post().to(tier_assignment))
            .route("/v1/override", web::post().to(pricing_override))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
