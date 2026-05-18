use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// aml-risk-scoring-rs — AML risk scoring with weighted factors

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn weighted_score(factors: &[(f64, f64)]) -> f64 {
    let total_weight: f64 = factors.iter().map(|(_, w)| w).sum();
    if total_weight == 0.0 { return 0.0; }
    factors.iter().map(|(s, w)| s * w).sum::<f64>() / total_weight
}
fn risk_band(score: f64) -> &'static str {
    if score >= 80.0 { "critical" } else if score >= 60.0 { "high" } else if score >= 40.0 { "medium" } else { "low" }
}
fn edd_required(score: f64) -> bool { score >= 60.0 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "aml-risk-scoring-rs",
        "version": "1.0.0",
        "description": "AML risk scoring with weighted factors",
    }))
}


async fn score_customer(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "aml-risk-scoring-rs",
        "endpoint": "score_customer",
        "description": "Compute composite AML risk score",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn calibrate_model(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "aml-risk-scoring-rs",
        "endpoint": "calibrate_model",
        "description": "Calibrate scoring model weights",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn batch_rescore(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "aml-risk-scoring-rs",
        "endpoint": "batch_rescore",
        "description": "Batch rescore customers after model update",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8121);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("aml-risk-scoring-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/score", web::post().to(score_customer))
            .route("/v1/calibrate", web::post().to(calibrate_model))
            .route("/v1/batch_rescore", web::post().to(batch_rescore))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
