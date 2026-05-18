use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// credit-bureau-rs — Credit bureau integration (CRC, FirstCentral, CreditRegistry)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn credit_score_band(score: u32) -> &'static str {
    if score >= 700 { "excellent" } else if score >= 600 { "good" } else if score >= 500 { "fair" } else { "poor" }
}
fn max_dti_for_score(score: u32) -> f64 { if score >= 700 { 0.50 } else if score >= 600 { 0.40 } else { 0.33 } }
fn delinquency_flag(dpd: u32) -> bool { dpd > 30 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "credit-bureau-rs"}))
}

async fn query_bureau(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let score = input.get("score").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = credit_score_band(score);
    HttpResponse::Ok().json(json!({
        "service": "credit-bureau-rs",
        "endpoint": "query_bureau",
        "result": json!({"value": format!("{:?}", result)}),
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "credit-bureau-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8190);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("credit-bureau-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/query_bureau", web::post().to(query_bureau))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
