use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// treasury-liquidity-rs — Treasury liquidity management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn net_liquidity(inflows: f64, outflows: f64, reserves: f64) -> f64 { inflows - outflows + reserves }
fn days_liquidity_cover(liquid_assets: f64, avg_daily_outflow: f64) -> f64 {
    if avg_daily_outflow == 0.0 { 999.0 } else { liquid_assets / avg_daily_outflow }
}
fn optimal_placement(surplus: f64) -> Vec<(&'static str, f64)> {
    if surplus <= 0.0 { return vec![]; }
    vec![("overnight_lending", surplus * 0.3), ("treasury_bills", surplus * 0.4), ("repos", surplus * 0.2), ("call_money", surplus * 0.1)]
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "treasury-liquidity-rs",
        "version": "1.0.0",
        "description": "Treasury liquidity management",
    }))
}

async fn liquidity_position(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let inflows = input.get("inflows").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let outflows = input.get("outflows").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let reserves = input.get("reserves").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = net_liquidity(inflows, outflows, reserves);
    HttpResponse::Ok().json(json!({
        "service": "treasury-liquidity-rs",
        "endpoint": "liquidity_position",
        "result": json!({"value": result}),
    }))
}

async fn cash_forecast(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let liquid_assets = input.get("liquid_assets").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let avg_daily_outflow = input.get("avg_daily_outflow").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = days_liquidity_cover(liquid_assets, avg_daily_outflow);
    HttpResponse::Ok().json(json!({
        "service": "treasury-liquidity-rs",
        "endpoint": "cash_forecast",
        "result": json!({"value": result}),
    }))
}

async fn optimize_placement(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let surplus = input.get("surplus").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = optimal_placement(surplus);
    HttpResponse::Ok().json(json!({
        "service": "treasury-liquidity-rs",
        "endpoint": "optimize_placement",
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8151);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("treasury-liquidity-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/position", web::post().to(liquidity_position))
            .route("/v1/forecast", web::post().to(cash_forecast))
            .route("/v1/optimize", web::post().to(optimize_placement))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
