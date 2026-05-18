use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// portfolio-mgmt-rs — Investment portfolio management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn sharpe_ratio(returns: f64, risk_free: f64, volatility: f64) -> f64 {
    if volatility == 0.0 { 0.0 } else { (returns - risk_free) / volatility }
}
fn portfolio_var_parametric(portfolio_value: f64, volatility: f64, confidence: f64) -> f64 {
    let z = match confidence as u32 { 95 => 1.645, 99 => 2.326, _ => 1.96 };
    portfolio_value * volatility * z
}
fn rebalance_trade(current_weight: f64, target_weight: f64, portfolio_value: f64) -> f64 {
    (target_weight - current_weight) / 100.0 * portfolio_value
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "portfolio-mgmt-rs",
        "version": "1.0.0",
        "description": "Investment portfolio management",
    }))
}

async fn portfolio_analytics(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let returns = input.get("returns").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let risk_free = input.get("risk_free").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let volatility = input.get("volatility").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = sharpe_ratio(returns, risk_free, volatility);
    HttpResponse::Ok().json(json!({
        "service": "portfolio-mgmt-rs",
        "endpoint": "portfolio_analytics",
        "result": json!({"value": result}),
    }))
}

async fn rebalance(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let portfolio_value = input.get("portfolio_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let volatility = input.get("volatility").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let confidence = input.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = portfolio_var_parametric(portfolio_value, volatility, confidence);
    HttpResponse::Ok().json(json!({
        "service": "portfolio-mgmt-rs",
        "endpoint": "rebalance",
        "result": json!({"value": result}),
    }))
}

async fn performance_attribution(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let current_weight = input.get("current_weight").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let target_weight = input.get("target_weight").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let portfolio_value = input.get("portfolio_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = rebalance_trade(current_weight, target_weight, portfolio_value);
    HttpResponse::Ok().json(json!({
        "service": "portfolio-mgmt-rs",
        "endpoint": "performance_attribution",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8158);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("portfolio-mgmt-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/analytics", web::post().to(portfolio_analytics))
            .route("/v1/rebalance", web::post().to(rebalance))
            .route("/v1/attribution", web::post().to(performance_attribution))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
