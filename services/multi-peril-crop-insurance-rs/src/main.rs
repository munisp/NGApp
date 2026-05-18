use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// multi-peril-crop-insurance-rs — Multi-peril crop insurance

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn premium_rate(crop: &str, zone_risk: f64) -> f64 {
    let base = match crop { "maize" => 0.05, "rice" => 0.06, "cassava" => 0.03, "cocoa" => 0.08, _ => 0.06 };
    base * (1.0 + zone_risk)
}
fn indemnity(insured_yield: f64, actual_yield: f64, price: f64) -> f64 { ((insured_yield - actual_yield) * price).max(0.0) }
fn trigger_payout(rainfall_mm: f64, threshold_mm: f64) -> bool { rainfall_mm < threshold_mm * 0.6 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "multi-peril-crop-insurance-rs"}))
}

async fn assess_risk(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let crop_s = input.get("crop").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let crop = crop_s.as_str();
    let zone_risk = input.get("zone_risk").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = premium_rate(crop, zone_risk);
    HttpResponse::Ok().json(json!({
        "service": "multi-peril-crop-insurance-rs",
        "endpoint": "assess_risk",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "multi-peril-crop-insurance-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8178);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("multi-peril-crop-insurance-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/assess_risk", web::post().to(assess_risk))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
