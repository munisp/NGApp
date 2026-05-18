use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// sanctions-batch-rescreener-rs — Batch rescreening against updated sanctions lists

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn batch_progress(processed: u64, total: u64) -> f64 { if total == 0 { 0.0 } else { processed as f64 / total as f64 * 100.0 } }
fn estimated_completion(processed: u64, total: u64, elapsed_ms: u64) -> u64 {
    if processed == 0 { return 0; }
    let rate = processed as f64 / elapsed_ms as f64;
    ((total - processed) as f64 / rate) as u64
}
fn disposition_status(is_false_positive: bool, reviewed: bool) -> &'static str {
    match (is_false_positive, reviewed) { (true, true) => "cleared", (false, true) => "confirmed_hit", _ => "pending_review" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "sanctions-batch-rescreener-rs",
        "version": "1.0.0",
        "description": "Batch rescreening against updated sanctions lists",
    }))
}


async fn schedule_resscreen(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "sanctions-batch-rescreener-rs",
        "endpoint": "schedule_resscreen",
        "description": "Schedule batch rescreening job",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn resscreen_progress(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "sanctions-batch-rescreener-rs",
        "endpoint": "resscreen_progress",
        "description": "Check rescreening job progress",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn false_positive_manage(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "sanctions-batch-rescreener-rs",
        "endpoint": "false_positive_manage",
        "description": "Manage false positive dispositions",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8126);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("sanctions-batch-rescreener-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/schedule", web::post().to(schedule_resscreen))
            .route("/v1/progress", web::post().to(resscreen_progress))
            .route("/v1/false_positives", web::post().to(false_positive_manage))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
