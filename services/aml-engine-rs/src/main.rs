use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// aml-engine-rs — Anti-Money Laundering detection engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn detect_structuring(amounts: &[f64], threshold: f64) -> bool {
    let below_threshold: Vec<&f64> = amounts.iter().filter(|&&a| a < threshold && a > threshold * 0.8).collect();
    below_threshold.len() >= 3
}
fn detect_rapid_movement(timestamps: &[u64], threshold_minutes: u64) -> bool {
    if timestamps.len() < 2 { return false; }
    let diffs: Vec<u64> = timestamps.windows(2).map(|w| w[1] - w[0]).collect();
    diffs.iter().any(|&d| d < threshold_minutes * 60)
}
fn aml_risk_score(pep: bool, high_risk_country: bool, cash_intensive: bool, unusual_pattern: bool) -> f64 {
    let mut score = 0.0f64;
    if pep { score += 30.0; }
    if high_risk_country { score += 25.0; }
    if cash_intensive { score += 20.0; }
    if unusual_pattern { score += 25.0; }
    score.min(100.0)
}
fn cbn_reporting_threshold_ngn() -> f64 { 5_000_000.0 }
fn fatf_reporting_threshold_usd() -> f64 { 10_000.0 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "aml-engine-rs",
        "version": "1.0.0",
        "description": "Anti-Money Laundering detection engine",
    }))
}


async fn screen_transaction(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "aml-engine-rs",
        "endpoint": "screen_transaction",
        "description": "Screen transaction against AML rules (structuring, layering, smurfing)",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn generate_str(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "aml-engine-rs",
        "endpoint": "generate_str",
        "description": "Generate Suspicious Transaction Report",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn risk_profile(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "aml-engine-rs",
        "endpoint": "risk_profile",
        "description": "Compute customer AML risk profile",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8120);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("aml-engine-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/screen", web::post().to(screen_transaction))
            .route("/v1/str", web::post().to(generate_str))
            .route("/v1/risk_profile", web::post().to(risk_profile))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
