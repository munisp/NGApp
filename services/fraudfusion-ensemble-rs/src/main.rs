use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// fraudfusion-ensemble-rs — Multi-model fraud ensemble scoring

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn ensemble_weighted_avg(scores: &[(f64, f64)]) -> f64 {
    let total_w: f64 = scores.iter().map(|(_, w)| w).sum();
    if total_w == 0.0 { return 0.0; }
    scores.iter().map(|(s, w)| s * w).sum::<f64>() / total_w
}
fn ensemble_max(scores: &[f64]) -> f64 { scores.iter().cloned().fold(0.0, f64::max) }
fn ensemble_voting(scores: &[f64], threshold: f64) -> (u32, u32) {
    let fraud = scores.iter().filter(|&&s| s >= threshold).count() as u32;
    (fraud, scores.len() as u32 - fraud)
}
fn f1_score(precision: f64, recall: f64) -> f64 {
    if precision + recall == 0.0 { 0.0 } else { 2.0 * precision * recall / (precision + recall) }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fraudfusion-ensemble-rs",
        "version": "1.0.0",
        "description": "Multi-model fraud ensemble scoring",
    }))
}


async fn ensemble_score(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "ensemble_score",
        "description": "Run transaction through multiple fraud models and combine scores",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn model_performance(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "model_performance",
        "description": "Track individual model accuracy and F1 scores",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn threshold_optimize(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "threshold_optimize",
        "description": "Optimize decision thresholds per model",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8123);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("fraudfusion-ensemble-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/ensemble", web::post().to(ensemble_score))
            .route("/v1/model_stats", web::post().to(model_performance))
            .route("/v1/optimize", web::post().to(threshold_optimize))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
