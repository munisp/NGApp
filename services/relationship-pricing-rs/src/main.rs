use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

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


async fn compute_discount(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "relationship-pricing-rs",
        "endpoint": "compute_discount",
        "description": "Compute relationship discount",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn tier_assignment(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "relationship-pricing-rs",
        "endpoint": "tier_assignment",
        "description": "Assign customer relationship tier",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn pricing_override(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "relationship-pricing-rs",
        "endpoint": "pricing_override",
        "description": "Process pricing override request",
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
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
