#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// watchlist-manager-rs — Consolidated watchlist management (PEP, sanctions, adverse media)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn search_score(query: &str, entry_name: &str) -> f64 {
    let q = query.to_lowercase(); let e = entry_name.to_lowercase();
    if e.contains(&q) { 0.9 } else {
        let q_words: Vec<&str> = q.split_whitespace().collect();
        let matches = q_words.iter().filter(|w| e.contains(*w)).count();
        matches as f64 / q_words.len() as f64
    }
}
fn list_type_priority(list_type: &str) -> u8 {
    match list_type { "sanctions" => 1, "pep" => 2, "adverse_media" => 3, "internal" => 4, _ => 5 }
}
fn dedup_entries(entries: &mut Vec<String>) { entries.sort(); entries.dedup(); }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "watchlist-manager-rs",
        "version": "1.0.0",
        "description": "Consolidated watchlist management (PEP, sanctions, adverse media)",
    }))
}

async fn search_watchlist(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let query_s = input.get("query").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let query = query_s.as_str();
    let entry_name_s = input.get("entry_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let entry_name = entry_name_s.as_str();
    let result = search_score(query, entry_name);
    HttpResponse::Ok().json(json!({
        "service": "watchlist-manager-rs",
        "endpoint": "search_watchlist",
        "result": json!({"value": result}),
    }))
}

async fn add_entry(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let list_type_s = input.get("list_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let list_type = list_type_s.as_str();
    let result = list_type_priority(list_type);
    HttpResponse::Ok().json(json!({
        "service": "watchlist-manager-rs",
        "endpoint": "add_entry",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn merge_lists(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let mut entries: Vec<String> = input.get("entries").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|e| e.as_str().map(String::from)).collect()
    }).unwrap_or_default();
    let before_count = entries.len();
    dedup_entries(&mut entries);
    HttpResponse::Ok().json(json!({
        "service": "watchlist-manager-rs",
        "endpoint": "merge_lists",
        "result": {"entries": entries, "before": before_count, "after": entries.len(), "duplicates_removed": before_count - entries.len()},
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "watchlist-manager-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"watchlist-manager-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"watchlist-manager-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8128);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("watchlist-manager-rs listening on port {}", port);
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
            .route("/v1/search", web::post().to(search_watchlist))
            .route("/v1/add", web::post().to(add_entry))
            .route("/v1/merge", web::post().to(merge_lists))
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
