use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// multicurrency-revaluation-rs — Multi-currency position revaluation (mark-to-market)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn revalue_position(notional: f64, book_rate: f64, market_rate: f64) -> f64 { notional * (market_rate - book_rate) }
fn unrealized_pnl(positions: &[(f64, f64, f64)]) -> f64 { positions.iter().map(|(n, br, mr)| revalue_position(*n, *br, *mr)).sum() }
fn translation_rate(method: &str) -> &str { match method { "current" => "closing_rate", "temporal" => "historical_rate", _ => "closing_rate" } }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "multicurrency-revaluation-rs",
        "version": "1.0.0",
        "description": "Multi-currency position revaluation (mark-to-market)",
    }))
}

async fn revalue_positions(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let notional = input.get("notional").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let book_rate = input.get("book_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let market_rate = input.get("market_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = revalue_position(notional, book_rate, market_rate);
    HttpResponse::Ok().json(json!({
        "service": "multicurrency-revaluation-rs",
        "endpoint": "revalue_positions",
        "result": json!({"value": result}),
    }))
}

async fn compute_pnl(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    // Extract parameters from input and call domain logic
    let result = serde_json::to_value(unrealized_pnl_wrapper(&input)).unwrap_or(json!({"error": "computation failed"}));
    HttpResponse::Ok().json(json!({
        "service": "multicurrency-revaluation-rs",
        "endpoint": "compute_pnl",
        "result": result,
        "input": input,
    }))
}

async fn translation_adjustment(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let method_s = input.get("method").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let method = method_s.as_str();
    let result = translation_rate(method);
    HttpResponse::Ok().json(json!({
        "service": "multicurrency-revaluation-rs",
        "endpoint": "translation_adjustment",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8108);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("multicurrency-revaluation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/revalue", web::post().to(revalue_positions))
            .route("/v1/pnl", web::post().to(compute_pnl))
            .route("/v1/translation", web::post().to(translation_adjustment))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
