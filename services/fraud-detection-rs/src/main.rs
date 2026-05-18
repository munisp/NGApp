use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

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


async fn evaluate_transaction(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "evaluate_transaction",
        "description": "Score transaction for fraud indicators",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn velocity_check(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "velocity_check",
        "description": "Check transaction velocity against thresholds",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn device_fingerprint(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "device_fingerprint",
        "description": "Validate device fingerprint and anomaly",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8122);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("fraud-detection-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/evaluate", web::post().to(evaluate_transaction))
            .route("/v1/velocity", web::post().to(velocity_check))
            .route("/v1/device_check", web::post().to(device_fingerprint))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
