use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// iso20022-hub-rs — ISO 20022 message parsing and generation

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn message_type(msg_id: &str) -> &str {
    if msg_id.starts_with("pacs.008") { "FI_TO_FI_CREDIT_TRANSFER" }
    else if msg_id.starts_with("pain.001") { "CUSTOMER_CREDIT_TRANSFER" }
    else if msg_id.starts_with("camt.053") { "BANK_TO_CUSTOMER_STATEMENT" }
    else if msg_id.starts_with("pacs.002") { "PAYMENT_STATUS_REPORT" }
    else { "UNKNOWN" }
}
fn validate_bic(bic: &str) -> bool { bic.len() == 8 || bic.len() == 11 }
fn validate_iban(iban: &str) -> bool { iban.len() >= 15 && iban.len() <= 34 }
fn generate_msg_id() -> String { format!("MSG{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "iso20022-hub-rs",
        "version": "1.0.0",
        "description": "ISO 20022 message parsing and generation",
    }))
}

async fn parse_message(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let msg_id_s = input.get("msg_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let msg_id = msg_id_s.as_str();
    let result = message_type(msg_id);
    HttpResponse::Ok().json(json!({
        "service": "iso20022-hub-rs",
        "endpoint": "parse_message",
        "result": json!({"value": result}),
    }))
}

async fn generate_message(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let bic_s = input.get("bic").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let bic = bic_s.as_str();
    let result = validate_bic(bic);
    HttpResponse::Ok().json(json!({
        "service": "iso20022-hub-rs",
        "endpoint": "generate_message",
        "result": json!({"value": result}),
    }))
}

async fn validate_message(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let iban_s = input.get("iban").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let iban = iban_s.as_str();
    let result = validate_iban(iban);
    HttpResponse::Ok().json(json!({
        "service": "iso20022-hub-rs",
        "endpoint": "validate_message",
        "result": json!({"value": result}),
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8131);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("iso20022-hub-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/parse", web::post().to(parse_message))
            .route("/v1/generate", web::post().to(generate_message))
            .route("/v1/validate", web::post().to(validate_message))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
