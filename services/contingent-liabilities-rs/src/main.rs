use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// contingent-liabilities-rs — Off-balance sheet contingent liabilities tracking

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn classify_contingency(probability: f64) -> &'static str {
    if probability > 0.75 { "probable" } else if probability > 0.25 { "possible" } else { "remote" }
}
fn provision_required(classification: &str, amount: f64) -> f64 {
    match classification { "probable" => amount, "possible" => 0.0, "remote" => 0.0, _ => 0.0 }
}
fn disclosure_required(classification: &str) -> bool { classification != "remote" }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "contingent-liabilities-rs",
        "version": "1.0.0",
        "description": "Off-balance sheet contingent liabilities tracking",
    }))
}


async fn assess_probability(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "contingent-liabilities-rs",
        "endpoint": "assess_probability",
        "description": "Assess probability and estimate contingent liability provisions",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn monitor_triggers(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "contingent-liabilities-rs",
        "endpoint": "monitor_triggers",
        "description": "Monitor event triggers that may crystallize contingencies",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn disclosure_report(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "contingent-liabilities-rs",
        "endpoint": "disclosure_report",
        "description": "Generate IFRS/IAS 37 disclosure reports",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8109);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("contingent-liabilities-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/assess", web::post().to(assess_probability))
            .route("/v1/triggers", web::post().to(monitor_triggers))
            .route("/v1/disclosure", web::post().to(disclosure_report))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
