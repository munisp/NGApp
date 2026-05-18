use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// mojaloop-tb-bridge-rs — Mojaloop to TigerBeetle bridge

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn dfsp_position(credits: f64, debits: f64) -> f64 { credits - debits }
fn settlement_eligible(position: f64, ndc: f64) -> bool { position.abs() <= ndc }
fn window_status(open: bool, settled: bool) -> &str {
    if settled { "SETTLED" } else if open { "OPEN" } else { "CLOSED" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "mojaloop-tb-bridge-rs",
        "version": "1.0.0",
        "description": "Mojaloop to TigerBeetle bridge",
    }))
}

async fn sync_transfer(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let credits = input.get("credits").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let debits = input.get("debits").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = dfsp_position(credits, debits);
    HttpResponse::Ok().json(json!({
        "service": "mojaloop-tb-bridge-rs",
        "endpoint": "sync_transfer",
        "result": json!({"value": result}),
    }))
}

async fn reconcile_positions(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let position = input.get("position").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let ndc = input.get("ndc").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = settlement_eligible(position, ndc);
    HttpResponse::Ok().json(json!({
        "service": "mojaloop-tb-bridge-rs",
        "endpoint": "reconcile_positions",
        "result": json!({"value": result}),
    }))
}

async fn settlement_window(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let open = input.get("open").and_then(|v| v.as_bool()).unwrap_or(false);
    let settled = input.get("settled").and_then(|v| v.as_bool()).unwrap_or(false);
    let result = window_status(open, settled);
    HttpResponse::Ok().json(json!({
        "service": "mojaloop-tb-bridge-rs",
        "endpoint": "settlement_window",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8133);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("mojaloop-tb-bridge-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/sync", web::post().to(sync_transfer))
            .route("/v1/reconcile", web::post().to(reconcile_positions))
            .route("/v1/settlement", web::post().to(settlement_window))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
