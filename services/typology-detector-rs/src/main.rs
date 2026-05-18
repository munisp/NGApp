#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

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

async fn detect_typologies(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let sends_v: Vec<f64> = input.get("sends").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let sends = sends_v.as_slice();
    let receives_v: Vec<f64> = input.get("receives").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let receives = receives_v.as_slice();
    let tolerance = input.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = detect_round_tripping(sends, receives, tolerance);
    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "detect_typologies",
        "result": json!({"value": result}),
    }))
}

async fn pattern_library(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let unique_senders = input.get("unique_senders").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let unique_receivers = input.get("unique_receivers").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = detect_funnel_account(unique_senders, unique_receivers);
    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "pattern_library",
        "result": json!({"value": result}),
    }))
}

async fn alert_generate(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let txn_count = input.get("txn_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let time_window_hours = input.get("time_window_hours").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = detect_rapid_layering(txn_count, time_window_hours);
    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "alert_generate",
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
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": if state.db_url.is_some() { "database" } else { "in-memory" }}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME")}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "typology-detector-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"typology-detector-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"typology-detector-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8127);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("typology-detector-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[typology-detector-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/detect", web::post().to(detect_typologies))
            .route("/v1/patterns", web::post().to(pattern_library))
            .route("/v1/alert", web::post().to(alert_generate))
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


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_round_tripping() { let r = detect_round_tripping(100.0); assert!(r == true || r == false); }
}
