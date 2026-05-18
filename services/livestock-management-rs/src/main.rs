#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// livestock-management-rs — Livestock herd management system

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn herd_growth_rate(births: u32, deaths: u32, sales: u32, initial: u32) -> f64 {
    if initial == 0 { 0.0 } else { (births as f64 - deaths as f64 - sales as f64) / initial as f64 * 100.0 }
}
fn feed_cost_per_day(species: &str, count: u32) -> f64 {
    let per_animal = match species { "cattle" => 500.0, "goat" => 100.0, "poultry" => 30.0, _ => 200.0 };
    per_animal * count as f64
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "livestock-management-rs"}))
}

async fn manage_herd(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let births = input.get("births").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let deaths = input.get("deaths").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let sales = input.get("sales").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let initial = input.get("initial").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = herd_growth_rate(births, deaths, sales, initial);
    HttpResponse::Ok().json(json!({
        "service": "livestock-management-rs",
        "endpoint": "manage_herd",
        "result": json!({"value": result}),
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page-1)*limit).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "livestock-management-rs"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "livestock-management-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"livestock-management-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"livestock-management-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8177);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("livestock-management-rs on port {}", port);
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
            .route("/v1/manage_herd", web::post().to(manage_herd))
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
