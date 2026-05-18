use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// dormancy-management-rs — Account dormancy management (CBN guidelines)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn dormancy_status(last_txn_days: u32) -> &'static str {
    if last_txn_days > 3650 { "unclaimed" } else if last_txn_days > 365 { "dormant" }
    else if last_txn_days > 180 { "inactive" } else { "active" }
}
fn restriction_level(status: &str) -> &str {
    match status { "dormant" => "debit_restricted", "unclaimed" => "fully_restricted", "inactive" => "alert_only", _ => "none" }
}
fn cbn_unclaimed_threshold_years() -> u32 { 10 }
fn reactivation_requirements(status: &str) -> Vec<&str> {
    match status { "dormant" => vec!["id_verification", "branch_visit"], "unclaimed" => vec!["id_verification", "branch_visit", "notarized_letter", "cbn_approval"], _ => vec![] }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "dormancy-management-rs",
        "version": "1.0.0",
        "description": "Account dormancy management (CBN guidelines)",
    }))
}


async fn check_dormancy(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "dormancy-management-rs",
        "endpoint": "check_dormancy",
        "description": "Check account dormancy status",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn activate_dormant(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "dormancy-management-rs",
        "endpoint": "activate_dormant",
        "description": "Process dormant account reactivation",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn unclaimed_funds(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "dormancy-management-rs",
        "endpoint": "unclaimed_funds",
        "description": "Manage unclaimed funds (CBN 10-year rule)",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8166);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("dormancy-management-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/check", web::post().to(check_dormancy))
            .route("/v1/activate", web::post().to(activate_dormant))
            .route("/v1/unclaimed", web::post().to(unclaimed_funds))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
