#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

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

async fn process_ussd(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let input_s = input.get("input").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let input = input_s.as_str();
    let result = parse_ussd_input(input);
    HttpResponse::Ok().json(json!({
        "service": "ussd-transaction-engine-rs",
        "endpoint": "process_ussd",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn menu_navigate(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    // TODO: extract level: u8
    let level = Default::default();
    let result = ussd_menu(level);
    HttpResponse::Ok().json(json!({
        "service": "ussd-transaction-engine-rs",
        "endpoint": "menu_navigate",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn execute_transaction(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let pin_s = input.get("pin").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let pin = pin_s.as_str();
    let result = validate_pin(pin);
    HttpResponse::Ok().json(json!({
        "service": "ussd-transaction-engine-rs",
        "endpoint": "execute_transaction",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "ussd-transaction-engine-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"ussd-transaction-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"ussd-transaction-engine-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
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
            .route("/v1/process", web::post().to(process_ussd))
            .route("/v1/menu", web::post().to(menu_navigate))
            .route("/v1/execute", web::post().to(execute_transaction))
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
