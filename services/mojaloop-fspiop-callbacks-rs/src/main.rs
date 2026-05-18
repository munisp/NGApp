#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// mojaloop-fspiop-callbacks-rs — Mojaloop FSPIOP callback handler

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn validate_ilp_condition(condition: &str) -> bool { condition.len() == 48 }
fn transfer_state(fulfilled: bool, expired: bool) -> &str {
    if fulfilled { "COMMITTED" } else if expired { "ABORTED" } else { "RESERVED" }
}
fn compute_ilp_fulfilment(condition: &str) -> String { format!("FUL-{}", &condition[..8]) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "mojaloop-fspiop-callbacks-rs",
        "version": "1.0.0",
        "description": "Mojaloop FSPIOP callback handler",
    }))
}

async fn handle_transfer_callback(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let condition_s = input.get("condition").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let condition = condition_s.as_str();
    let result = validate_ilp_condition(condition);
    HttpResponse::Ok().json(json!({
        "service": "mojaloop-fspiop-callbacks-rs",
        "endpoint": "handle_transfer_callback",
        "result": json!({"value": result}),
    }))
}

async fn handle_quote_callback(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let fulfilled = input.get("fulfilled").and_then(|v| v.as_bool()).unwrap_or(false);
    let expired = input.get("expired").and_then(|v| v.as_bool()).unwrap_or(false);
    let result = transfer_state(fulfilled, expired);
    HttpResponse::Ok().json(json!({
        "service": "mojaloop-fspiop-callbacks-rs",
        "endpoint": "handle_quote_callback",
        "result": json!({"value": result}),
    }))
}

async fn handle_party_callback(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let condition_s = input.get("condition").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let condition = condition_s.as_str();
    let result = compute_ilp_fulfilment(condition);
    HttpResponse::Ok().json(json!({
        "service": "mojaloop-fspiop-callbacks-rs",
        "endpoint": "handle_party_callback",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "mojaloop-fspiop-callbacks-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"mojaloop-fspiop-callbacks-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"mojaloop-fspiop-callbacks-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8132);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("mojaloop-fspiop-callbacks-rs listening on port {}", port);
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
            .route("/v1/transfer_callback", web::post().to(handle_transfer_callback))
            .route("/v1/quote_callback", web::post().to(handle_quote_callback))
            .route("/v1/party_callback", web::post().to(handle_party_callback))
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
