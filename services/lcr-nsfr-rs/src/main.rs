#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// lcr-nsfr-rs — Liquidity Coverage Ratio & Net Stable Funding Ratio

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn compute_lcr(hqla: f64, net_outflows_30d: f64) -> f64 { if net_outflows_30d > 0.0 { hqla / net_outflows_30d * 100.0 } else { 999.0 } }
fn compute_nsfr(asf: f64, rsf: f64) -> f64 { if rsf > 0.0 { asf / rsf * 100.0 } else { 999.0 } }
fn hqla_haircut(asset_type: &str) -> f64 {
    match asset_type { "cash" => 0.0, "govt_bonds" => 0.0, "level_1" => 0.0, "level_2a" => 0.15, "level_2b" => 0.50, _ => 1.0 }
}
fn cbn_lcr_minimum() -> f64 { 100.0 }
fn cbn_nsfr_minimum() -> f64 { 100.0 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "lcr-nsfr-rs",
        "version": "1.0.0",
        "description": "Liquidity Coverage Ratio & Net Stable Funding Ratio",
    }))
}

async fn compute_lcr_handler(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let hqla = input.get("hqla").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let net_outflows_30d = input.get("net_outflows_30d").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_lcr(hqla, net_outflows_30d);
    HttpResponse::Ok().json(json!({
        "service": "lcr-nsfr-rs",
        "endpoint": "compute_lcr_handler",
        "result": json!({"value": result}),
    }))
}

async fn compute_nsfr_handler(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let asf = input.get("asf").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let rsf = input.get("rsf").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_nsfr(asf, rsf);
    HttpResponse::Ok().json(json!({
        "service": "lcr-nsfr-rs",
        "endpoint": "compute_nsfr_handler",
        "result": json!({"value": result}),
    }))
}

async fn liquidity_stress(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let asset_type_s = input.get("asset_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let asset_type = asset_type_s.as_str();
    let result = hqla_haircut(asset_type);
    HttpResponse::Ok().json(json!({
        "service": "lcr-nsfr-rs",
        "endpoint": "liquidity_stress",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "lcr-nsfr-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"lcr-nsfr-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"lcr-nsfr-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8106);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("lcr-nsfr-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/lcr", web::post().to(compute_lcr_handler))
            .route("/v1/nsfr", web::post().to(compute_nsfr_handler))
            .route("/v1/liquidity_stress", web::post().to(liquidity_stress))
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
