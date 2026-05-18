use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

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


async fn screen_name(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "sanctions-screening-rs",
        "endpoint": "screen_name",
        "description": "Screen name against sanctions lists with fuzzy matching",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn batch_screen(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "sanctions-screening-rs",
        "endpoint": "batch_screen",
        "description": "Batch screen multiple names",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn list_update(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "sanctions-screening-rs",
        "endpoint": "list_update",
        "description": "Update sanctions list data",
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
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
