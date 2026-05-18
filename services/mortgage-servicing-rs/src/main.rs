use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// mortgage-servicing-rs — Mortgage servicing and amortization

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn monthly_payment(principal: f64, annual_rate: f64, months: u32) -> f64 {
    let r = annual_rate / 100.0 / 12.0;
    if r == 0.0 { return principal / months as f64; }
    principal * r * (1.0 + r).powi(months as i32) / ((1.0 + r).powi(months as i32) - 1.0)
}
fn dti_ratio(monthly_debt: f64, monthly_income: f64) -> f64 {
    if monthly_income == 0.0 { 999.0 } else { monthly_debt / monthly_income * 100.0 }
}
fn ltv_ratio(loan_amount: f64, property_value: f64) -> f64 {
    if property_value == 0.0 { 999.0 } else { loan_amount / property_value * 100.0 }
}
fn prepayment_penalty(outstanding: f64, rate: f64) -> f64 { outstanding * rate / 100.0 * 0.5 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "mortgage-servicing-rs",
        "version": "1.0.0",
        "description": "Mortgage servicing and amortization",
    }))
}

async fn compute_amortization(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let principal = input.get("principal").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let annual_rate = input.get("annual_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let months = input.get("months").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = monthly_payment(principal, annual_rate, months);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "compute_amortization",
        "result": json!({"value": result}),
    }))
}

async fn early_repayment(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let monthly_debt = input.get("monthly_debt").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let monthly_income = input.get("monthly_income").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = dti_ratio(monthly_debt, monthly_income);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "early_repayment",
        "result": json!({"value": result}),
    }))
}

async fn affordability_check(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let loan_amount = input.get("loan_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let property_value = input.get("property_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = ltv_ratio(loan_amount, property_value);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "affordability_check",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8160);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("mortgage-servicing-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/amortize", web::post().to(compute_amortization))
            .route("/v1/prepay", web::post().to(early_repayment))
            .route("/v1/affordability", web::post().to(affordability_check))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
