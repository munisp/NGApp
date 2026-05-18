use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// typology-detector-rs — Financial crime typology detection (FATF patterns)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn detect_round_tripping(sends: &[f64], receives: &[f64], tolerance: f64) -> bool {
    sends.iter().any(|s| receives.iter().any(|r| (s - r).abs() / s < tolerance))
}
fn detect_funnel_account(unique_senders: u32, unique_receivers: u32) -> bool {
    unique_senders >= 5 && unique_receivers <= 2
}
fn detect_rapid_layering(txn_count: u32, time_window_hours: u32) -> bool {
    if time_window_hours == 0 { return false; }
    txn_count / time_window_hours > 10
}
fn typology_risk_level(matched_patterns: u32) -> &'static str {
    if matched_patterns >= 3 { "critical" } else if matched_patterns >= 2 { "high" } else if matched_patterns >= 1 { "medium" } else { "low" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "typology-detector-rs",
        "version": "1.0.0",
        "description": "Financial crime typology detection (FATF patterns)",
    }))
}


async fn detect_typologies(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "detect_typologies",
        "description": "Detect FATF money laundering typologies in transaction patterns",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn pattern_library(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "pattern_library",
        "description": "Manage typology pattern definitions",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn alert_generate(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "alert_generate",
        "description": "Generate typology-based alerts",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8127);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("typology-detector-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/detect", web::post().to(detect_typologies))
            .route("/v1/patterns", web::post().to(pattern_library))
            .route("/v1/alert", web::post().to(alert_generate))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
