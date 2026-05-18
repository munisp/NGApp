#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

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


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "adaptive-rate-limiter-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"adaptive-rate-limiter-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"adaptive-rate-limiter-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
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
            .route("/v1/check-rate", web::post().to(check_rate))
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
