use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// otc-derivatives-rs — OTC derivatives pricing and risk

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn price_irs(notional: f64, fixed_rate: f64, floating_rate: f64, tenor_years: f64) -> f64 {
    notional * (fixed_rate - floating_rate) / 100.0 * tenor_years
}
fn compute_cva(expected_exposure: f64, pd: f64, lgd: f64) -> f64 { expected_exposure * pd * lgd }
fn initial_margin(notional: f64, asset_class: &str) -> f64 {
    let rate = match asset_class { "interest_rate" => 0.01, "fx" => 0.06, "equity" => 0.15, "commodity" => 0.15, "credit" => 0.10, _ => 0.15 };
    notional * rate
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "otc-derivatives-rs",
        "version": "1.0.0",
        "description": "OTC derivatives pricing and risk",
    }))
}


async fn price_swap(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "otc-derivatives-rs",
        "endpoint": "price_swap",
        "description": "Price interest rate swap",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn compute_cva_handler(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "otc-derivatives-rs",
        "endpoint": "compute_cva",
        "description": "Compute Credit Valuation Adjustment",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn margin_call(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "otc-derivatives-rs",
        "endpoint": "margin_call",
        "description": "Calculate margin requirements",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8153);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("otc-derivatives-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/price", web::post().to(price_swap))
            .route("/v1/cva", web::post().to(compute_cva_handler))
            .route("/v1/margin", web::post().to(margin_call))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
