#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// securities-trading-rs — Securities trading and order management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn match_price(buy_price: f64, sell_price: f64) -> bool { buy_price >= sell_price }
fn execution_price(buy: f64, sell: f64) -> f64 { (buy + sell) / 2.0 }
fn portfolio_return(current_value: f64, cost_basis: f64) -> f64 {
    if cost_basis == 0.0 { 0.0 } else { (current_value - cost_basis) / cost_basis * 100.0 }
}
fn position_pnl(quantity: f64, avg_cost: f64, market_price: f64) -> f64 { quantity * (market_price - avg_cost) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "securities-trading-rs",
        "version": "1.0.0",
        "description": "Securities trading and order management",
    }))
}

async fn place_order(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let buy_price = input.get("buy_price").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let sell_price = input.get("sell_price").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = match_price(buy_price, sell_price);
    HttpResponse::Ok().json(json!({
        "service": "securities-trading-rs",
        "endpoint": "place_order",
        "result": json!({"value": result}),
    }))
}

async fn match_orders(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let buy = input.get("buy").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let sell = input.get("sell").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = execution_price(buy, sell);
    HttpResponse::Ok().json(json!({
        "service": "securities-trading-rs",
        "endpoint": "match_orders",
        "result": json!({"value": result}),
    }))
}

async fn portfolio_value(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let current_value = input.get("current_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let cost_basis = input.get("cost_basis").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = portfolio_return(current_value, cost_basis);
    HttpResponse::Ok().json(json!({
        "service": "securities-trading-rs",
        "endpoint": "portfolio_value",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "securities-trading-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"securities-trading-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"securities-trading-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8152);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("securities-trading-rs listening on port {}", port);
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
            .route("/v1/order", web::post().to(place_order))
            .route("/v1/match", web::post().to(match_orders))
            .route("/v1/portfolio", web::post().to(portfolio_value))
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
