use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// hsm-key-manager-rs — HSM key lifecycle management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn key_strength(algorithm: &str, bits: u32) -> &'static str { match (algorithm, bits) { ("RSA", b) if b >= 4096 => "strong", ("EC", b) if b >= 256 => "strong", ("AES", b) if b >= 256 => "strong", _ => "adequate" } }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "hsm-key-manager-rs"}))
}

async fn manage_key(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let algorithm_s = input.get("algorithm").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let algorithm = algorithm_s.as_str();
    let bits = input.get("bits").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = key_strength(algorithm, bits);
    HttpResponse::Ok().json(json!({
        "service": "hsm-key-manager-rs",
        "endpoint": "manage_key",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "hsm-key-manager-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8220);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("hsm-key-manager-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/manage_key", web::post().to(manage_key))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
