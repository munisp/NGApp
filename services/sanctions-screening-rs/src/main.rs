#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// sanctions-screening-rs — OFAC/EU/UN/CBN sanctions screening

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn fuzzy_match_score(name1: &str, name2: &str) -> f64 {
    let n1 = name1.to_lowercase(); let n2 = name2.to_lowercase();
    if n1 == n2 { return 1.0; }
    let words1: Vec<&str> = n1.split_whitespace().collect();
    let words2: Vec<&str> = n2.split_whitespace().collect();
    let matches = words1.iter().filter(|w| words2.contains(w)).count();
    matches as f64 / words1.len().max(words2.len()) as f64
}
fn is_hit(score: f64, threshold: f64) -> bool { score >= threshold }
fn sanctions_list_priority(list: &str) -> u8 {
    match list { "OFAC_SDN" => 1, "UN_CONSOLIDATED" => 2, "EU_SANCTIONS" => 3, "CBN_SANCTIONS" => 4, _ => 5 }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "sanctions-screening-rs",
        "version": "1.0.0",
        "description": "OFAC/EU/UN/CBN sanctions screening",
    }))
}

async fn screen_name(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let name1_s = input.get("name1").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let name1 = name1_s.as_str();
    let name2_s = input.get("name2").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let name2 = name2_s.as_str();
    let result = fuzzy_match_score(name1, name2);
    HttpResponse::Ok().json(json!({
        "service": "sanctions-screening-rs",
        "endpoint": "screen_name",
        "result": json!({"value": result}),
    }))
}

async fn batch_screen(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let score = input.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let threshold = input.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = is_hit(score, threshold);
    HttpResponse::Ok().json(json!({
        "service": "sanctions-screening-rs",
        "endpoint": "batch_screen",
        "result": json!({"value": result}),
    }))
}

async fn list_update(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let list_s = input.get("list").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let list = list_s.as_str();
    let result = sanctions_list_priority(list);
    HttpResponse::Ok().json(json!({
        "service": "sanctions-screening-rs",
        "endpoint": "list_update",
        "result": json!({"value": format!("{:?}", result)}),
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "sanctions-screening-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"sanctions-screening-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"sanctions-screening-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8125);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("sanctions-screening-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/screen", web::post().to(screen_name))
            .route("/v1/batch", web::post().to(batch_screen))
            .route("/v1/update_lists", web::post().to(list_update))
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
