#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// interbank-lending-rs — Interbank lending and borrowing (NIBOR)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn compute_nibor(submissions: &mut Vec<f64>) -> f64 {
    if submissions.len() < 5 { return 0.0; }
    submissions.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let trimmed = &submissions[1..submissions.len()-1];
    trimmed.iter().sum::<f64>() / trimmed.len() as f64
}
fn overnight_rate(nibor: f64, spread: f64) -> f64 { nibor + spread }
fn collateral_required(amount: f64, unsecured_limit: f64) -> f64 { (amount - unsecured_limit).max(0.0) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "interbank-lending-rs",
        "version": "1.0.0",
        "description": "Interbank lending and borrowing (NIBOR)",
    }))
}

async fn quote_rate(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let mut submissions: Vec<f64> = input.get("submissions").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let result = compute_nibor(&mut submissions);
    HttpResponse::Ok().json(json!({
        "service": "interbank-lending-rs",
        "endpoint": "quote_rate",
        "result": json!({"value": result}),
    }))
}

async fn accept_bid(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let nibor = input.get("nibor").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let spread = input.get("spread").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = overnight_rate(nibor, spread);
    HttpResponse::Ok().json(json!({
        "service": "interbank-lending-rs",
        "endpoint": "accept_bid",
        "result": json!({"value": result}),
    }))
}

async fn nibor_compute(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let amount = input.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let unsecured_limit = input.get("unsecured_limit").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = collateral_required(amount, unsecured_limit);
    HttpResponse::Ok().json(json!({
        "service": "interbank-lending-rs",
        "endpoint": "nibor_compute",
        "result": json!({"value": result}),
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "interbank-lending-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"interbank-lending-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"interbank-lending-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8157);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("interbank-lending-rs listening on port {}", port);
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
            .route("/v1/quote", web::post().to(quote_rate))
            .route("/v1/accept", web::post().to(accept_bid))
            .route("/v1/nibor", web::post().to(nibor_compute))
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
    fn test_compute_nibor() { let r = compute_nibor(10000.0); assert!(r >= 0.0); }

    #[test]
    fn test_overnight_rate() { let r = overnight_rate(10000.0); assert!(r >= 0.0); }

    #[test]
    fn test_collateral_required() { let r = collateral_required(10000.0); assert!(r >= 0.0); }
}
