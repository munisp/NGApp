#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// fx-rates-engine-rs — FX rates engine with spread management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn compute_mid_rate(bid: f64, ask: f64) -> f64 { (bid + ask) / 2.0 }
fn compute_spread(bid: f64, ask: f64) -> f64 { ask - bid }
fn spread_percentage(bid: f64, ask: f64) -> f64 { if bid == 0.0 { 0.0 } else { (ask - bid) / bid * 100.0 } }
fn convert_amount(amount: f64, rate: f64) -> f64 { (amount * rate * 100.0).round() / 100.0 }
fn cbn_rate_band(official: f64, market: f64) -> bool { (market - official).abs() / official < 0.05 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fx-rates-engine-rs",
        "version": "1.0.0",
        "description": "FX rates engine with spread management",
    }))
}

async fn get_rate(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let bid = input.get("bid").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let ask = input.get("ask").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_mid_rate(bid, ask);
    HttpResponse::Ok().json(json!({
        "service": "fx-rates-engine-rs",
        "endpoint": "get_rate",
        "result": json!({"value": result}),
    }))
}

async fn convert(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let bid = input.get("bid").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let ask = input.get("ask").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_spread(bid, ask);
    HttpResponse::Ok().json(json!({
        "service": "fx-rates-engine-rs",
        "endpoint": "convert",
        "result": json!({"value": result}),
    }))
}

async fn rate_history(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let bid = input.get("bid").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let ask = input.get("ask").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = spread_percentage(bid, ask);
    HttpResponse::Ok().json(json!({
        "service": "fx-rates-engine-rs",
        "endpoint": "rate_history",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "fx-rates-engine-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"fx-rates-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"fx-rates-engine-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8150);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("fx-rates-engine-rs listening on port {}", port);
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
            .route("/v1/rate", web::post().to(get_rate))
            .route("/v1/convert", web::post().to(convert))
            .route("/v1/history", web::post().to(rate_history))
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
