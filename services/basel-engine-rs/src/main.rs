#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// basel-engine-rs — Basel III/IV regulatory capital computation

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn compute_rwa_credit(exposure: f64, risk_weight: f64) -> f64 { exposure * risk_weight / 100.0 }
fn compute_rwa_market(var_10day: f64) -> f64 { var_10day * 3.0 }
fn compute_rwa_operational(gross_income_3yr_avg: f64) -> f64 { gross_income_3yr_avg * 0.15 }
fn capital_adequacy_ratio(capital: f64, rwa: f64) -> f64 { if rwa > 0.0 { capital / rwa * 100.0 } else { 0.0 } }
fn cbn_minimum_car() -> f64 { 15.0 }  // CBN requires 15% for systemically important banks
fn countercyclical_buffer(car: f64) -> f64 { (car - cbn_minimum_car()).max(0.0) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "basel-engine-rs",
        "version": "1.0.0",
        "description": "Basel III/IV regulatory capital computation",
    }))
}

async fn compute_rwa(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let exposure = input.get("exposure").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let risk_weight = input.get("risk_weight").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_rwa_credit(exposure, risk_weight);
    HttpResponse::Ok().json(json!({
        "service": "basel-engine-rs",
        "endpoint": "compute_rwa",
        "result": json!({"value": result}),
    }))
}

async fn capital_ratio(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let var_10day = input.get("var_10day").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_rwa_market(var_10day);
    HttpResponse::Ok().json(json!({
        "service": "basel-engine-rs",
        "endpoint": "capital_ratio",
        "result": json!({"value": result}),
    }))
}

async fn stress_scenario(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let gross_income_3yr_avg = input.get("gross_income_3yr_avg").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = compute_rwa_operational(gross_income_3yr_avg);
    HttpResponse::Ok().json(json!({
        "service": "basel-engine-rs",
        "endpoint": "stress_scenario",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "basel-engine-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"basel-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"basel-engine-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8104);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("basel-engine-rs listening on port {}", port);
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
            .route("/v1/risk_weighted_assets", web::post().to(compute_rwa))
            .route("/v1/capital_adequacy", web::post().to(capital_ratio))
            .route("/v1/stress_test", web::post().to(stress_scenario))
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
