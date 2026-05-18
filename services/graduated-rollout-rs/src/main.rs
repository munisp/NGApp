use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// graduated-rollout-rs — Graduated feature rollout

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn rollout_eligible(user_hash: u32, current_pct: u32) -> bool { (user_hash % 100) < current_pct }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "graduated-rollout-rs"}))
}

async fn rollout_check(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let user_hash = input.get("user_hash").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let current_pct = input.get("current_pct").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = rollout_eligible(user_hash, current_pct);
    HttpResponse::Ok().json(json!({
        "service": "graduated-rollout-rs",
        "endpoint": "rollout_check",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "graduated-rollout-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8217);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("graduated-rollout-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/rollout_check", web::post().to(rollout_check))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
