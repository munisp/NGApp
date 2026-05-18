use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// ledger-reconciliation-rs — Multi-source ledger reconciliation engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn match_entries(entry1_amount: f64, entry2_amount: f64, tolerance: f64) -> bool { (entry1_amount - entry2_amount).abs() <= tolerance }
fn match_score(ref_val: &str, cmp_val: &str) -> f64 {
    if ref_val == cmp_val { 1.0 } else {
        let common = ref_val.chars().zip(cmp_val.chars()).filter(|(a, b)| a == b).count();
        common as f64 / ref_val.len().max(cmp_val.len()) as f64
    }
}
fn classify_exception(age_days: u32) -> &'static str {
    if age_days <= 3 { "timing" } else if age_days <= 30 { "pending" } else { "stale" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "ledger-reconciliation-rs",
        "version": "1.0.0",
        "description": "Multi-source ledger reconciliation engine",
    }))
}


async fn reconcile_accounts(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ledger-reconciliation-rs",
        "endpoint": "reconcile_accounts",
        "description": "Match and reconcile entries across GL, sub-ledger, and external sources",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn find_exceptions(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ledger-reconciliation-rs",
        "endpoint": "find_exceptions",
        "description": "Identify unmatched/mismatched entries",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn auto_match(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "ledger-reconciliation-rs",
        "endpoint": "auto_match",
        "description": "Auto-match entries using fuzzy rules",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8107);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("ledger-reconciliation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/reconcile", web::post().to(reconcile_accounts))
            .route("/v1/exceptions", web::post().to(find_exceptions))
            .route("/v1/auto_match", web::post().to(auto_match))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
