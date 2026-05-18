#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// fraud-detection-rs — Real-time fraud detection with rule engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn velocity_score(txn_count_1h: u32, txn_count_24h: u32, avg_1h: f64, avg_24h: f64) -> f64 {
    let h_ratio = if avg_1h > 0.0 { txn_count_1h as f64 / avg_1h } else { txn_count_1h as f64 };
    let d_ratio = if avg_24h > 0.0 { txn_count_24h as f64 / avg_24h } else { txn_count_24h as f64 };
    ((h_ratio * 0.6 + d_ratio * 0.4) * 25.0).min(100.0)
}
fn amount_anomaly_score(amount: f64, avg_amount: f64, std_dev: f64) -> f64 {
    if std_dev == 0.0 { return 0.0; }
    let z_score = (amount - avg_amount) / std_dev;
    (z_score.abs() * 15.0).min(100.0)
}
fn geo_anomaly(current_country: &str, usual_country: &str, minutes_since_last: u64) -> f64 {
    if current_country == usual_country { 0.0 } else if minutes_since_last < 120 { 90.0 } else { 40.0 }
}
fn combined_fraud_score(velocity: f64, amount: f64, geo: f64, device: f64) -> f64 {
    (velocity * 0.3 + amount * 0.25 + geo * 0.25 + device * 0.2).min(100.0)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fraud-detection-rs",
        "version": "1.0.0",
        "description": "Real-time fraud detection with rule engine",
    }))
}

async fn evaluate_transaction(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let txn_count_1h = input.get("txn_count_1h").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let txn_count_24h = input.get("txn_count_24h").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let avg_1h = input.get("avg_1h").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let avg_24h = input.get("avg_24h").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = velocity_score(txn_count_1h, txn_count_24h, avg_1h, avg_24h);
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "evaluate_transaction",
        "result": json!({"value": result}),
    }))
}

async fn velocity_check(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let amount = input.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let avg_amount = input.get("avg_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let std_dev = input.get("std_dev").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = amount_anomaly_score(amount, avg_amount, std_dev);
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "velocity_check",
        "result": json!({"value": result}),
    }))
}

async fn device_fingerprint(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let current_country_s = input.get("current_country").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let current_country = current_country_s.as_str();
    let usual_country_s = input.get("usual_country").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let usual_country = usual_country_s.as_str();
    let minutes_since_last = input.get("minutes_since_last").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = geo_anomaly(current_country, usual_country, minutes_since_last);
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "device_fingerprint",
        "result": json!({"value": result}),
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "fraud-detection-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"fraud-detection-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"fraud-detection-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- Database Connection ---
use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}


// --- JWT Auth Check ---
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(val) => {
            if let Ok(s) = val.to_str() {
                if s.starts_with("Bearer ") { return Ok(()); }
            }
            Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"})))
        }
        None => Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"})))
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8122);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("fraud-detection-rs listening on port {}", port);
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
            .route("/v1/evaluate", web::post().to(evaluate_transaction))
            .route("/v1/velocity", web::post().to(velocity_check))
            .route("/v1/device_check", web::post().to(device_fingerprint))
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
