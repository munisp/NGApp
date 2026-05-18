use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// agriculture-banking-rs — Agriculture-specific banking products

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn crop_cycle_months(crop: &str) -> u32 { match crop { "maize" => 4, "rice" => 5, "cassava" => 12, "cocoa" => 36, "yam" => 8, _ => 6 } }
fn seasonal_repayment(principal: f64, crop: &str) -> Vec<(u32, f64)> { let months = crop_cycle_months(crop); vec![(months, principal * 1.1)] }
fn anchor_borrower_eligible(farm_size_ha: f64, registered: bool) -> bool { farm_size_ha >= 0.5 && registered }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "agriculture-banking-rs"}))
}

async fn assess_farm(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    HttpResponse::Ok().json(json!({"service": "agriculture-banking-rs", "action": "assess_farm", "processed": true, "input": input}))
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "agriculture-banking-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8171);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("agriculture-banking-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/assess_farm", web::post().to(assess_farm))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
