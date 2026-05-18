use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// parametric-insurance-iot-rs — Parametric insurance with IoT triggers

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn weather_trigger(actual: f64, threshold: f64, direction: &str) -> bool {
    match direction { "below" => actual < threshold, "above" => actual > threshold, _ => false }
}
fn payout_scale(actual: f64, threshold: f64, max_payout: f64) -> f64 {
    let deviation = ((threshold - actual).abs() / threshold).min(1.0);
    max_payout * deviation
}
fn iot_data_valid(timestamp_age_hours: u64) -> bool { timestamp_age_hours < 24 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "parametric-insurance-iot-rs"}))
}

async fn evaluate_trigger(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    HttpResponse::Ok().json(json!({"service": "parametric-insurance-iot-rs", "action": "evaluate_trigger", "processed": true, "input": input}))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page-1)*limit).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "parametric-insurance-iot-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8179);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("parametric-insurance-iot-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/evaluate_trigger", web::post().to(evaluate_trigger))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
