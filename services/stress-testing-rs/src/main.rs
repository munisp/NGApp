use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// stress-testing-rs — Regulatory stress testing (CBN, Basel)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn apply_shock(value: f64, shock_pct: f64) -> f64 { value * (1.0 - shock_pct / 100.0) }
fn gdp_impact_on_pd(base_pd: f64, gdp_shock: f64) -> f64 { (base_pd * (1.0 + gdp_shock.abs() * 2.0)).min(1.0) }
fn capital_post_stress(capital: f64, losses: f64) -> f64 { (capital - losses).max(0.0) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "stress-testing-rs"}))
}

async fn run_stress(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let value = input.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let shock_pct = input.get("shock_pct").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = apply_shock(value, shock_pct);
    HttpResponse::Ok().json(json!({
        "service": "stress-testing-rs",
        "endpoint": "run_stress",
        "result": json!({"value": result}),
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page-1)*limit).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "stress-testing-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8192);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("stress-testing-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/run_stress", web::post().to(run_stress))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
