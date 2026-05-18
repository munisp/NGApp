use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// telegram-kyc-bot-rs — Telegram KYC verification bot

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn validate_bvn(bvn: &str) -> bool { bvn.len() == 11 && bvn.chars().all(|c| c.is_ascii_digit()) }
fn validate_nin(nin: &str) -> bool { nin.len() == 11 && nin.chars().all(|c| c.is_ascii_digit()) }
fn kyc_step_name(step: u8) -> &'static str {
    match step { 1 => "bvn_capture", 2 => "nin_capture", 3 => "selfie_upload", 4 => "document_upload", 5 => "review", _ => "complete" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "telegram-kyc-bot-rs",
        "version": "1.0.0",
        "description": "Telegram KYC verification bot",
    }))
}

async fn initiate_kyc(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let bvn_s = input.get("bvn").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let bvn = bvn_s.as_str();
    let result = validate_bvn(bvn);
    HttpResponse::Ok().json(json!({
        "service": "telegram-kyc-bot-rs",
        "endpoint": "initiate_kyc",
        "result": json!({"value": result}),
    }))
}

async fn verify_document(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let nin_s = input.get("nin").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let nin = nin_s.as_str();
    let result = validate_nin(nin);
    HttpResponse::Ok().json(json!({
        "service": "telegram-kyc-bot-rs",
        "endpoint": "verify_document",
        "result": json!({"value": result}),
    }))
}

async fn kyc_status(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    // TODO: extract step: u8
    let step = Default::default();
    let result = kyc_step_name(step);
    HttpResponse::Ok().json(json!({
        "service": "telegram-kyc-bot-rs",
        "endpoint": "kyc_status",
        "result": json!({"value": format!("{:?}", result)}),
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8135);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("telegram-kyc-bot-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/start_kyc", web::post().to(initiate_kyc))
            .route("/v1/verify_doc", web::post().to(verify_document))
            .route("/v1/status", web::post().to(kyc_status))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
