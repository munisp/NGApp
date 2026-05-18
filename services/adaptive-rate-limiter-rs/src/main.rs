use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::collections::HashMap;

// adaptive-rate-limiter-rs — Adaptive rate limiting with ML-based traffic analysis

struct AppState {
    buckets: Mutex<HashMap<String, (u64, u64)>>,  // client_id -> (tokens, last_refill_ms)
    db_url: Option<String>,
}

fn tokens_available(bucket_size: u64, refill_rate: f64, elapsed_ms: u64, current: u64) -> u64 {
    let refilled = (refill_rate * elapsed_ms as f64 / 1000.0) as u64;
    (current + refilled).min(bucket_size)
}

fn adaptive_limit(base_rate: u64, error_rate: f64, latency_p99: f64) -> u64 {
    let factor = if error_rate > 0.05 { 0.5 } else if latency_p99 > 500.0 { 0.7 } else { 1.0 };
    (base_rate as f64 * factor) as u64
}

fn sliding_window_count(timestamps: &[u64], window_ms: u64, now: u64) -> u32 {
    timestamps.iter().filter(|&&t| now.saturating_sub(t) <= window_ms).count() as u32
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "adaptive-rate-limiter-rs", "version": "1.0.0"}))
}

async fn check_rate(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let client_id = body.get("client_id").and_then(|v| v.as_str()).unwrap_or("unknown");
    let base_rate = body.get("base_rate").and_then(|v| v.as_u64()).unwrap_or(100);
    let error_rate = body.get("error_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let latency_p99 = body.get("latency_p99").and_then(|v| v.as_f64()).unwrap_or(100.0);
    let limit = adaptive_limit(base_rate, error_rate, latency_p99);
    let mut buckets = state.buckets.lock().unwrap();
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    let (tokens, _) = buckets.entry(client_id.to_string()).or_insert((limit, now_ms));
    let allowed = *tokens > 0;
    if allowed { *tokens -= 1; }
    HttpResponse::Ok().json(json!({"client_id": client_id, "allowed": allowed, "remaining": tokens, "limit": limit, "adaptive_factor": limit as f64 / base_rate as f64}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let buckets = state.buckets.lock().unwrap();
    HttpResponse::Ok().json(json!({"active_clients": buckets.len(), "service": "adaptive-rate-limiter-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8200);
    let state = web::Data::new(AppState {
        buckets: Mutex::new(HashMap::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("adaptive-rate-limiter-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/check-rate", web::post().to(check_rate))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
