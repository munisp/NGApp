#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// whatsapp-banking-flows-rs — WhatsApp Banking interactive flow engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn flow_completion_rate(started: u32, completed: u32) -> f64 { if started == 0 { 0.0 } else { completed as f64 / started as f64 * 100.0 } }
fn avg_flow_duration(durations_ms: &[u64]) -> u64 {
    if durations_ms.is_empty() { 0 } else { durations_ms.iter().sum::<u64>() / durations_ms.len() as u64 }
}
fn next_step(current: u8, response: &str) -> u8 {
    if response == "cancel" { 0 } else { current + 1 }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "whatsapp-banking-flows-rs",
        "version": "1.0.0",
        "description": "WhatsApp Banking interactive flow engine",
    }))
}

async fn create_flow(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let started = input.get("started").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let completed = input.get("completed").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = flow_completion_rate(started, completed);
    HttpResponse::Ok().json(json!({
        "service": "whatsapp-banking-flows-rs",
        "endpoint": "create_flow",
        "result": json!({"value": result}),
    }))
}

async fn process_response(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let durations_ms_v: Vec<u64> = input.get("durations_ms").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_u64()).collect()).unwrap_or_default();
    let durations_ms = durations_ms_v.as_slice();
    let result = avg_flow_duration(durations_ms);
    HttpResponse::Ok().json(json!({
        "service": "whatsapp-banking-flows-rs",
        "endpoint": "process_response",
        "result": json!({"value": result}),
    }))
}

async fn flow_analytics(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    // TODO: extract current: u8
    let current = Default::default();
    let response_s = input.get("response").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let response = response_s.as_str();
    let result = next_step(current, response);
    HttpResponse::Ok().json(json!({
        "service": "whatsapp-banking-flows-rs",
        "endpoint": "flow_analytics",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "whatsapp-banking-flows-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"whatsapp-banking-flows-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"whatsapp-banking-flows-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8138);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("whatsapp-banking-flows-rs listening on port {}", port);
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
            .route("/v1/create", web::post().to(create_flow))
            .route("/v1/respond", web::post().to(process_response))
            .route("/v1/analytics", web::post().to(flow_analytics))
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
