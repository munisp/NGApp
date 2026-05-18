use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// collateral-valuation-rs — Collateral valuation and management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn apply_haircut(market_value: f64, collateral_type: &str) -> f64 {
    let haircut = match collateral_type {
        "cash" => 0.0, "government_securities" => 0.05, "property" => 0.30,
        "equipment" => 0.40, "inventory" => 0.50, "receivables" => 0.35, _ => 0.50,
    };
    market_value * (1.0 - haircut)
}
fn coverage_ratio(collateral_value: f64, loan_outstanding: f64) -> f64 {
    if loan_outstanding == 0.0 { 999.0 } else { collateral_value / loan_outstanding * 100.0 }
}
fn margin_call_needed(coverage: f64, minimum_coverage: f64) -> bool { coverage < minimum_coverage }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "collateral-valuation-rs",
        "version": "1.0.0",
        "description": "Collateral valuation and management",
    }))
}


async fn value_collateral(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "value_collateral",
        "description": "Compute collateral value with haircuts",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn revalue(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "revalue",
        "description": "Revalue collateral portfolio",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn coverage_ratio_handler(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "coverage_ratio",
        "description": "Compute loan-to-collateral coverage ratio",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8164);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("collateral-valuation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/value", web::post().to(value_collateral))
            .route("/v1/revalue", web::post().to(revalue))
            .route("/v1/coverage", web::post().to(coverage_ratio_handler))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
