#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

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

async fn screen_transaction(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let amounts_v: Vec<f64> = input.get("amounts").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let amounts = amounts_v.as_slice();
    let threshold = input.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = detect_structuring(amounts, threshold);
    HttpResponse::Ok().json(json!({
        "service": "aml-engine-rs",
        "endpoint": "screen_transaction",
        "result": json!({"value": result}),
    }))
}

async fn generate_str(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let timestamps_v: Vec<u64> = input.get("timestamps").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_u64()).collect()).unwrap_or_default();
    let timestamps = timestamps_v.as_slice();
    let threshold_minutes = input.get("threshold_minutes").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = detect_rapid_movement(timestamps, threshold_minutes);
    HttpResponse::Ok().json(json!({
        "service": "aml-engine-rs",
        "endpoint": "generate_str",
        "result": json!({"value": result}),
    }))
}

async fn risk_profile(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let pep = input.get("pep").and_then(|v| v.as_bool()).unwrap_or(false);
    let high_risk_country = input.get("high_risk_country").and_then(|v| v.as_bool()).unwrap_or(false);
    let cash_intensive = input.get("cash_intensive").and_then(|v| v.as_bool()).unwrap_or(false);
    let unusual_pattern = input.get("unusual_pattern").and_then(|v| v.as_bool()).unwrap_or(false);
    let result = aml_risk_score(pep, high_risk_country, cash_intensive, unusual_pattern);
    HttpResponse::Ok().json(json!({
        "service": "aml-engine-rs",
        "endpoint": "risk_profile",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "aml-engine-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"aml-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"aml-engine-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
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
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    if res.status().is_server_error() || res.status().is_client_error() {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    Ok(res)
                }
            })
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/screen", web::post().to(screen_transaction))
            .route("/v1/str", web::post().to(generate_str))
            .route("/v1/risk_profile", web::post().to(risk_profile))
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
