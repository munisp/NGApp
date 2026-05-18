use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// fluvio-wasm-transform-rs — Fluvio WASM stream transform

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn transform_record(input: &str, transform_type: &str) -> String { match transform_type { "uppercase" => input.to_uppercase(), "lowercase" => input.to_lowercase(), "trim" => input.trim().to_string(), _ => input.to_string() } }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "fluvio-wasm-transform-rs"}))
}

async fn transform(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let input_s = input.get("input").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let input = input_s.as_str();
    let transform_type_s = input.get("transform_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let transform_type = transform_type_s.as_str();
    let result = transform_record(input, transform_type);
    HttpResponse::Ok().json(json!({
        "service": "fluvio-wasm-transform-rs",
        "endpoint": "transform",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "fluvio-wasm-transform-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8269);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("fluvio-wasm-transform-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/transform", web::post().to(transform))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
