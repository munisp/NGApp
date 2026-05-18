use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// risk-scoring-rs — Enterprise risk scoring engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn composite_risk(credit: f64, market: f64, operational: f64, liquidity: f64) -> f64 {
    credit * 0.35 + market * 0.25 + operational * 0.20 + liquidity * 0.20
}
fn risk_rating(score: f64) -> &'static str {
    if score >= 80.0 { "AAA" } else if score >= 60.0 { "AA" } else if score >= 40.0 { "A" }
    else if score >= 20.0 { "BBB" } else { "BB" }
}
fn within_appetite(exposure: f64, limit: f64) -> bool { exposure <= limit }
fn concentration_risk(single_exposure: f64, total_portfolio: f64) -> f64 {
    if total_portfolio == 0.0 { 0.0 } else { single_exposure / total_portfolio * 100.0 }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "risk-scoring-rs",
        "version": "1.0.0",
        "description": "Enterprise risk scoring engine",
    }))
}


async fn score_entity(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "risk-scoring-rs",
        "endpoint": "score_entity",
        "description": "Compute risk score for customer/transaction/product",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn risk_matrix(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "risk-scoring-rs",
        "endpoint": "risk_matrix",
        "description": "Generate risk heat map matrix",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn risk_appetite_check(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "risk-scoring-rs",
        "endpoint": "risk_appetite_check",
        "description": "Check if exposure within risk appetite limits",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8124);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("risk-scoring-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/score", web::post().to(score_entity))
            .route("/v1/matrix", web::post().to(risk_matrix))
            .route("/v1/appetite", web::post().to(risk_appetite_check))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
