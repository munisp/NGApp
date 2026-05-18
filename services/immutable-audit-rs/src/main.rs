use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// immutable-audit-rs — Immutable audit trail (append-only)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn compute_chain_hash(prev_hash: &str, entry: &str) -> String { format!("{:x}", prev_hash.bytes().chain(entry.bytes()).fold(0u64, |h, b| h.wrapping_mul(31).wrapping_add(b as u64))) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "immutable-audit-rs"}))
}

async fn append_entry(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let prev_hash_s = input.get("prev_hash").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let prev_hash = prev_hash_s.as_str();
    let entry_s = input.get("entry").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let entry = entry_s.as_str();
    let result = compute_chain_hash(prev_hash, entry);
    HttpResponse::Ok().json(json!({
        "service": "immutable-audit-rs",
        "endpoint": "append_entry",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "immutable-audit-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8222);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("immutable-audit-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/append_entry", web::post().to(append_entry))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
