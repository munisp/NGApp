use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

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


async fn search_watchlist(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "watchlist-manager-rs",
        "endpoint": "search_watchlist",
        "description": "Search consolidated watchlist",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn add_entry(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "watchlist-manager-rs",
        "endpoint": "add_entry",
        "description": "Add entry to internal watchlist",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn merge_lists(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "watchlist-manager-rs",
        "endpoint": "merge_lists",
        "description": "Merge external list updates into consolidated list",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8128);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("watchlist-manager-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/search", web::post().to(search_watchlist))
            .route("/v1/add", web::post().to(add_entry))
            .route("/v1/merge", web::post().to(merge_lists))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
