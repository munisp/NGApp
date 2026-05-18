use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// ussd-transaction-engine-rs — USSD banking transaction engine (*737#, *901#)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn parse_ussd_input(input: &str) -> Vec<&str> { input.split('*').collect() }
fn ussd_menu(level: u8) -> Vec<(&'static str, &'static str)> {
    match level {
        0 => vec![("1", "Transfer"), ("2", "Balance"), ("3", "Airtime"), ("4", "Bills"), ("5", "Mini Statement")],
        _ => vec![("0", "Back"), ("00", "Main Menu")],
    }
}
fn validate_pin(pin: &str) -> bool { pin.len() == 4 && pin.chars().all(|c| c.is_ascii_digit()) }
fn format_ussd_response(text: &str, end_session: bool) -> serde_json::Value {
    json!({"text": text, "end_session": end_session})
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "ussd-transaction-engine-rs",
        "version": "1.0.0",
        "description": "USSD banking transaction engine (*737#, *901#)",
    }))
}


async fn process_ussd(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ussd-transaction-engine-rs",
        "endpoint": "process_ussd",
        "description": "Process USSD session input",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn menu_navigate(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ussd-transaction-engine-rs",
        "endpoint": "menu_navigate",
        "description": "Handle USSD menu navigation",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn execute_transaction(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ussd-transaction-engine-rs",
        "endpoint": "execute_transaction",
        "description": "Execute banking transaction from USSD",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8136);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("ussd-transaction-engine-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/process", web::post().to(process_ussd))
            .route("/v1/menu", web::post().to(menu_navigate))
            .route("/v1/execute", web::post().to(execute_transaction))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
