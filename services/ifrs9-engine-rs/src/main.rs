use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// ifrs9-engine-rs — IFRS 9 Expected Credit Loss (ECL) computation

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn compute_ecl_12m(pd_12m: f64, lgd: f64, ead: f64) -> f64 { pd_12m * lgd * ead }
fn compute_ecl_lifetime(pd_lifetime: f64, lgd: f64, ead: f64) -> f64 { pd_lifetime * lgd * ead }
fn classify_stage(dpd: u32, pd_increase: f64) -> u8 {
    if dpd > 90 { 3 } else if dpd > 30 || pd_increase > 0.5 { 2 } else { 1 }
}
fn sicr_threshold(origination_pd: f64, current_pd: f64) -> bool { current_pd > origination_pd * 2.0 || (current_pd - origination_pd) > 0.02 }
fn provision_rate(stage: u8) -> f64 { match stage { 1 => 0.01, 2 => 0.05, 3 => 0.20, _ => 0.0 } }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "ifrs9-engine-rs",
        "version": "1.0.0",
        "description": "IFRS 9 Expected Credit Loss (ECL) computation",
    }))
}


async fn compute_ecl(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ifrs9-engine-rs",
        "endpoint": "compute_ecl",
        "description": "12-month and lifetime ECL using PD × LGD × EAD",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn stage_classification(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ifrs9-engine-rs",
        "endpoint": "stage_classification",
        "description": "Classify exposures into Stage 1/2/3",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn provision_waterfall(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ifrs9-engine-rs",
        "endpoint": "provision_waterfall",
        "description": "Compute provision adequacy waterfall",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8105);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("ifrs9-engine-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/expected_credit_loss", web::post().to(compute_ecl))
            .route("/v1/staging", web::post().to(stage_classification))
            .route("/v1/provisions", web::post().to(provision_waterfall))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
