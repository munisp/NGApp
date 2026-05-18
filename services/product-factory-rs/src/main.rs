#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// product-factory-rs — Dynamic product configuration factory

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn validate_product_config(min_balance: f64, max_balance: f64, interest_rate: f64) -> Vec<String> {
    let mut errors = Vec::new();
    if min_balance < 0.0 { errors.push("min_balance must be non-negative".into()); }
    if max_balance < min_balance { errors.push("max_balance must exceed min_balance".into()); }
    if interest_rate < 0.0 || interest_rate > 50.0 { errors.push("interest_rate must be 0-50%".into()); }
    errors
}
fn product_code(category: &str, sub: &str) -> String { format!("{}-{}-{}", category.to_uppercase(), sub.to_uppercase(), "001") }
fn eligible(age: u32, income: f64, min_age: u32, min_income: f64) -> bool { age >= min_age && income >= min_income }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "product-factory-rs",
        "version": "1.0.0",
        "description": "Dynamic product configuration factory",
    }))
}

async fn create_product(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let min_balance = input.get("min_balance").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let max_balance = input.get("max_balance").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let interest_rate = input.get("interest_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = validate_product_config(min_balance, max_balance, interest_rate);
    HttpResponse::Ok().json(json!({
        "service": "product-factory-rs",
        "endpoint": "create_product",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn configure_features(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let category_s = input.get("category").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let category = category_s.as_str();
    let sub_s = input.get("sub").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let sub = sub_s.as_str();
    let result = product_code(category, sub);
    HttpResponse::Ok().json(json!({
        "service": "product-factory-rs",
        "endpoint": "configure_features",
        "result": json!({"value": result}),
    }))
}

async fn product_eligibility(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let age = input.get("age").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let income = input.get("income").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let min_age = input.get("min_age").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let min_income = input.get("min_income").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = eligible(age, income, min_age, min_income);
    HttpResponse::Ok().json(json!({
        "service": "product-factory-rs",
        "endpoint": "product_eligibility",
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


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "product-factory-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"product-factory-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"product-factory-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8163);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("product-factory-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    if res.status().is_server_error() || res.status().is_client_error() {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    Ok(res)
                }
            })
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/create", web::post().to(create_product))
            .route("/v1/configure", web::post().to(configure_features))
            .route("/v1/eligibility", web::post().to(product_eligibility))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
