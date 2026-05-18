use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// bloom-filter-cache-rs — Bloom filter cache for fast lookups

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn bloom_hash(item: &str, seed: u64) -> u64 { item.bytes().fold(seed, |h, b| h.wrapping_mul(31).wrapping_add(b as u64)) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "bloom-filter-cache-rs"}))
}

async fn check_membership(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let item_s = input.get("item").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let item = item_s.as_str();
    let seed = input.get("seed").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = bloom_hash(item, seed);
    HttpResponse::Ok().json(json!({
        "service": "bloom-filter-cache-rs",
        "endpoint": "check_membership",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "bloom-filter-cache-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8264);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("bloom-filter-cache-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/check_membership", web::post().to(check_membership))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
