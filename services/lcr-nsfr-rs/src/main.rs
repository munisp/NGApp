use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

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


async fn compute_lcr(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "lcr-nsfr-rs",
        "endpoint": "compute_lcr",
        "description": "Calculate LCR = HQLA / Net cash outflows over 30 days",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn compute_nsfr(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "lcr-nsfr-rs",
        "endpoint": "compute_nsfr",
        "description": "Calculate NSFR = Available stable funding / Required stable funding",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn liquidity_stress(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "lcr-nsfr-rs",
        "endpoint": "liquidity_stress",
        "description": "Run liquidity stress scenarios",
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
            .route("/v1/lcr", web::post().to(compute_lcr))
            .route("/v1/nsfr", web::post().to(compute_nsfr))
            .route("/v1/liquidity_stress", web::post().to(liquidity_stress))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
