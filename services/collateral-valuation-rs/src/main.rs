#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// collateral-valuation-rs — Collateral valuation and management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn apply_haircut(market_value: f64, collateral_type: &str) -> f64 {
    let haircut = match collateral_type {
        "cash" => 0.0, "government_securities" => 0.05, "property" => 0.30,
        "equipment" => 0.40, "inventory" => 0.50, "receivables" => 0.35, _ => 0.50,
    };
    market_value * (1.0 - haircut)
}
fn coverage_ratio(collateral_value: f64, loan_outstanding: f64) -> f64 {
    if loan_outstanding == 0.0 { 999.0 } else { collateral_value / loan_outstanding * 100.0 }
}
fn margin_call_needed(coverage: f64, minimum_coverage: f64) -> bool { coverage < minimum_coverage }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "collateral-valuation-rs",
        "version": "1.0.0",
        "description": "Collateral valuation and management",
    }))
}

async fn value_collateral(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let market_value = input.get("market_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let collateral_type_s = input.get("collateral_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let collateral_type = collateral_type_s.as_str();
    let result = apply_haircut(market_value, collateral_type);
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "value_collateral",
        "result": json!({"value": result}),
    }))
}

async fn revalue(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let collateral_value = input.get("collateral_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let loan_outstanding = input.get("loan_outstanding").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = coverage_ratio(collateral_value, loan_outstanding);
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "revalue",
        "result": json!({"value": result}),
    }))
}

async fn coverage_ratio_handler(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let coverage = input.get("coverage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let minimum_coverage = input.get("minimum_coverage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = margin_call_needed(coverage, minimum_coverage);
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "coverage_ratio_handler",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "collateral-valuation-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"collateral-valuation-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"collateral-valuation-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8164);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("collateral-valuation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/value", web::post().to(value_collateral))
            .route("/v1/revalue", web::post().to(revalue))
            .route("/v1/coverage", web::post().to(coverage_ratio_handler))
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
