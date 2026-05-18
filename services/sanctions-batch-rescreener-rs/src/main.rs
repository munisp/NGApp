#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// sanctions-batch-rescreener-rs — Batch rescreening against updated sanctions lists

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn batch_progress(processed: u64, total: u64) -> f64 { if total == 0 { 0.0 } else { processed as f64 / total as f64 * 100.0 } }
fn estimated_completion(processed: u64, total: u64, elapsed_ms: u64) -> u64 {
    if processed == 0 { return 0; }
    let rate = processed as f64 / elapsed_ms as f64;
    ((total - processed) as f64 / rate) as u64
}
fn disposition_status(is_false_positive: bool, reviewed: bool) -> &'static str {
    match (is_false_positive, reviewed) { (true, true) => "cleared", (false, true) => "confirmed_hit", _ => "pending_review" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "sanctions-batch-rescreener-rs",
        "version": "1.0.0",
        "description": "Batch rescreening against updated sanctions lists",
    }))
}

async fn schedule_resscreen(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let processed = input.get("processed").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let total = input.get("total").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = batch_progress(processed, total);
    HttpResponse::Ok().json(json!({
        "service": "sanctions-batch-rescreener-rs",
        "endpoint": "schedule_resscreen",
        "result": json!({"value": result}),
    }))
}

async fn resscreen_progress(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let processed = input.get("processed").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let total = input.get("total").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let elapsed_ms = input.get("elapsed_ms").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = estimated_completion(processed, total, elapsed_ms);
    HttpResponse::Ok().json(json!({
        "service": "sanctions-batch-rescreener-rs",
        "endpoint": "resscreen_progress",
        "result": json!({"value": result}),
    }))
}

async fn false_positive_manage(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let is_false_positive = input.get("is_false_positive").and_then(|v| v.as_bool()).unwrap_or(false);
    let reviewed = input.get("reviewed").and_then(|v| v.as_bool()).unwrap_or(false);
    let result = disposition_status(is_false_positive, reviewed);
    HttpResponse::Ok().json(json!({
        "service": "sanctions-batch-rescreener-rs",
        "endpoint": "false_positive_manage",
        "result": json!({"value": format!("{:?}", result)}),
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "sanctions-batch-rescreener-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"sanctions-batch-rescreener-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"sanctions-batch-rescreener-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8126);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("sanctions-batch-rescreener-rs listening on port {}", port);
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
            .route("/v1/schedule", web::post().to(schedule_resscreen))
            .route("/v1/progress", web::post().to(resscreen_progress))
            .route("/v1/false_positives", web::post().to(false_positive_manage))
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
