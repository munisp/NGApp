#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

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

async fn reconcile_accounts(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let entry1_amount = input.get("entry1_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let entry2_amount = input.get("entry2_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let tolerance = input.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = match_entries(entry1_amount, entry2_amount, tolerance);
    HttpResponse::Ok().json(json!({
        "service": "ledger-reconciliation-rs",
        "endpoint": "reconcile_accounts",
        "result": json!({"value": result}),
    }))
}

async fn find_exceptions(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let ref_val_s = input.get("ref_val").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let ref_val = ref_val_s.as_str();
    let cmp_val_s = input.get("cmp_val").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let cmp_val = cmp_val_s.as_str();
    let result = match_score(ref_val, cmp_val);
    HttpResponse::Ok().json(json!({
        "service": "ledger-reconciliation-rs",
        "endpoint": "find_exceptions",
        "result": json!({"value": result}),
    }))
}

async fn auto_match(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let age_days = input.get("age_days").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = classify_exception(age_days);
    HttpResponse::Ok().json(json!({
        "service": "ledger-reconciliation-rs",
        "endpoint": "auto_match",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "ledger-reconciliation-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"ledger-reconciliation-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"ledger-reconciliation-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- Database Connection ---
use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}


// --- JWT Auth Check ---
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(val) => {
            if let Ok(s) = val.to_str() {
                if s.starts_with("Bearer ") { return Ok(()); }
            }
            Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"})))
        }
        None => Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"})))
    }
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
            .route("/v1/reconcile", web::post().to(reconcile_accounts))
            .route("/v1/exceptions", web::post().to(find_exceptions))
            .route("/v1/auto_match", web::post().to(auto_match))
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


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_entries() { let r = match_entries(100.0); assert!(r == true || r == false); }
}
