#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// crossborder-agri-trade-rs — Cross-border agricultural trade finance

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn phyto_required(commodity: &str) -> bool { matches!(commodity, "cocoa" | "cashew" | "sesame" | "shea") }
fn export_duty_rate(commodity: &str) -> f64 { match commodity { "raw_cocoa" => 0.0, "processed_cocoa" => 0.0, "raw_timber" => 0.15, _ => 0.02 } }
fn compute_fob_value(quantity_mt: f64, price_per_mt: f64, logistics: f64) -> f64 { quantity_mt * price_per_mt + logistics }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "crossborder-agri-trade-rs"}))
}

async fn assess_trade(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let commodity_s = input.get("commodity").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let commodity = commodity_s.as_str();
    let result = phyto_required(commodity);
    HttpResponse::Ok().json(json!({
        "service": "crossborder-agri-trade-rs",
        "endpoint": "assess_trade",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "crossborder-agri-trade-rs"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "crossborder-agri-trade-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"crossborder-agri-trade-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"crossborder-agri-trade-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8173);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("crossborder-agri-trade-rs on port {}", port);
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
            .route("/v1/assess_trade", web::post().to(assess_trade))
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
