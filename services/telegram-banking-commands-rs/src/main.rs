use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// telegram-banking-commands-rs — Telegram bot banking command processor

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn parse_command(text: &str) -> (&str, Vec<&str>) {
    let parts: Vec<&str> = text.split_whitespace().collect();
    if parts.is_empty() { return ("unknown", vec![]); }
    (parts[0], parts[1..].to_vec())
}
fn format_currency(amount: f64) -> String { format!("₦{:.2}", amount) }
fn mask_account(account: &str) -> String {
    if account.len() < 6 { "****".to_string() } else { format!("{}****{}", &account[..3], &account[account.len()-3..]) }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "telegram-banking-commands-rs",
        "version": "1.0.0",
        "description": "Telegram bot banking command processor",
    }))
}

async fn process_command(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let text_s = input.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let text = text_s.as_str();
    let result = parse_command(text);
    HttpResponse::Ok().json(json!({
        "service": "telegram-banking-commands-rs",
        "endpoint": "process_command",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn balance_inquiry(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let amount = input.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = format_currency(amount);
    HttpResponse::Ok().json(json!({
        "service": "telegram-banking-commands-rs",
        "endpoint": "balance_inquiry",
        "result": json!({"value": result}),
    }))
}

async fn mini_statement(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let account_s = input.get("account").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let account = account_s.as_str();
    let result = mask_account(account);
    HttpResponse::Ok().json(json!({
        "service": "telegram-banking-commands-rs",
        "endpoint": "mini_statement",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8134);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("telegram-banking-commands-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/command", web::post().to(process_command))
            .route("/v1/balance", web::post().to(balance_inquiry))
            .route("/v1/statement", web::post().to(mini_statement))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
