#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// otc-derivatives-rs — OTC derivatives pricing and risk

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn price_irs(notional: f64, fixed_rate: f64, floating_rate: f64, tenor_years: f64) -> f64 {
    notional * (fixed_rate - floating_rate) / 100.0 * tenor_years
}
fn compute_cva(expected_exposure: f64, pd: f64, lgd: f64) -> f64 { expected_exposure * pd * lgd }
fn initial_margin(notional: f64, asset_class: &str) -> f64 {
    let rate = match asset_class { "interest_rate" => 0.01, "fx" => 0.06, "equity" => 0.15, "commodity" => 0.15, "credit" => 0.10, _ => 0.15 };
    notional * rate
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "otc-derivatives-rs",
        "version": "1.0.0",
        "description": "OTC derivatives pricing and risk",
    }))
}

async fn price_swap(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let notional = input.get("notional").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let fixed_rate = input.get("fixed_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let floating_rate = input.get("floating_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let tenor_years = input.get("tenor_years").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = price_irs(notional, fixed_rate, floating_rate, tenor_years);
    HttpResponse::Ok().json(json!({
        "service": "otc-derivatives-rs",
        "endpoint": "price_swap",
        "result": json!({"value": result}),
    }))
}

async fn compute_cva_handler(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let expected_exposure = input.get("expected_exposure").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let pd = input.get("pd").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let lgd = input.get("lgd").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_cva(expected_exposure, pd, lgd);
    HttpResponse::Ok().json(json!({
        "service": "otc-derivatives-rs",
        "endpoint": "compute_cva_handler",
        "result": json!({"value": result}),
    }))
}

async fn margin_call(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let notional = input.get("notional").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let asset_class_s = input.get("asset_class").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let asset_class = asset_class_s.as_str();
    let result = initial_margin(notional, asset_class);
    HttpResponse::Ok().json(json!({
        "service": "otc-derivatives-rs",
        "endpoint": "margin_call",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "otc-derivatives-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"otc-derivatives-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"otc-derivatives-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8153);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("otc-derivatives-rs listening on port {}", port);
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
            .route("/v1/price", web::post().to(price_swap))
            .route("/v1/cva", web::post().to(compute_cva_handler))
            .route("/v1/margin", web::post().to(margin_call))
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
