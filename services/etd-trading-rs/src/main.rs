use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// etd-trading-rs — Exchange-Traded Derivatives

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn black_scholes_call(s: f64, k: f64, r: f64, sigma: f64, t: f64) -> f64 {
    let d1 = ((s / k).ln() + (r + sigma * sigma / 2.0) * t) / (sigma * t.sqrt());
    let d2 = d1 - sigma * t.sqrt();
    s * norm_cdf(d1) - k * (-r * t).exp() * norm_cdf(d2)
}
fn norm_cdf(x: f64) -> f64 { 0.5 * (1.0 + erf(x / std::f64::consts::SQRT_2)) }
fn erf(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.3275911 * x.abs());
    let poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    let result = 1.0 - poly * (-x * x).exp();
    if x >= 0.0 { result } else { -result }
}
fn delta(s: f64, k: f64, r: f64, sigma: f64, t: f64) -> f64 {
    let d1 = ((s / k).ln() + (r + sigma * sigma / 2.0) * t) / (sigma * t.sqrt());
    norm_cdf(d1)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "etd-trading-rs",
        "version": "1.0.0",
        "description": "Exchange-Traded Derivatives",
    }))
}

async fn price_option(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let s = input.get("s").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let k = input.get("k").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let r = input.get("r").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let sigma = input.get("sigma").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let t = input.get("t").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = black_scholes_call(s, k, r, sigma, t);
    HttpResponse::Ok().json(json!({
        "service": "etd-trading-rs",
        "endpoint": "price_option",
        "result": json!({"value": result}),
    }))
}

async fn compute_greeks(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let x = input.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = norm_cdf(x);
    HttpResponse::Ok().json(json!({
        "service": "etd-trading-rs",
        "endpoint": "compute_greeks",
        "result": json!({"value": result}),
    }))
}

async fn hedge_ratio(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let x = input.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = erf(x);
    HttpResponse::Ok().json(json!({
        "service": "etd-trading-rs",
        "endpoint": "hedge_ratio",
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8156);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("etd-trading-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/option", web::post().to(price_option))
            .route("/v1/greeks", web::post().to(compute_greeks))
            .route("/v1/hedge", web::post().to(hedge_ratio))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
