use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// express-rate-limiter-rs — Express-compatible rate limiter

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn sliding_window_count(timestamps: &[u64], window_ms: u64, now: u64) -> u32 { timestamps.iter().filter(|&&t| now - t <= window_ms).count() as u32 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "express-rate-limiter-rs"}))
}

async fn check_rate(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let timestamps_v: Vec<u64> = input.get("timestamps").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_u64()).collect()).unwrap_or_default();
    let timestamps = timestamps_v.as_slice();
    let window_ms = input.get("window_ms").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let now = input.get("now").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = sliding_window_count(timestamps, window_ms, now);
    HttpResponse::Ok().json(json!({
        "service": "express-rate-limiter-rs",
        "endpoint": "check_rate",
        "result": json!({"value": result}),
    }))
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "express-rate-limiter-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8213);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("express-rate-limiter-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/check_rate", web::post().to(check_rate))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
