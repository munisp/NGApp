use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// money-market-rs — Money market instruments (T-bills, repos, CPs)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn tbill_price(face: f64, discount_rate: f64, days: u32) -> f64 { face * (1.0 - discount_rate / 100.0 * days as f64 / 360.0) }
fn tbill_yield(price: f64, face: f64, days: u32) -> f64 { (face - price) / price * 365.0 / days as f64 * 100.0 }
fn repo_haircut(collateral_type: &str) -> f64 {
    match collateral_type { "fgn_bonds" => 0.02, "tbills" => 0.01, "state_bonds" => 0.05, "corporate_bonds" => 0.10, _ => 0.15 }
}
fn repo_margin(collateral_value: f64, haircut: f64) -> f64 { collateral_value * (1.0 - haircut) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "money-market-rs",
        "version": "1.0.0",
        "description": "Money market instruments (T-bills, repos, CPs)",
    }))
}


async fn price_tbill(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "money-market-rs",
        "endpoint": "price_tbill",
        "description": "Price treasury bill (discount basis)",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn repo_rate(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "money-market-rs",
        "endpoint": "repo_rate",
        "description": "Calculate repo rate and haircut",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn cp_yield(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "money-market-rs",
        "endpoint": "cp_yield",
        "description": "Compute commercial paper yield",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8154);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("money-market-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/tbill", web::post().to(price_tbill))
            .route("/v1/repo", web::post().to(repo_rate))
            .route("/v1/cp", web::post().to(cp_yield))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
