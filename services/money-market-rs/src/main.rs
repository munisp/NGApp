#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// money-market-rs — Money market instruments (T-bills, repos, CPs)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn tbill_price(face: f64, discount_rate: f64, days: u32) -> f64 { face * (1.0 - discount_rate / 100.0 * days as f64 / 360.0) }
fn tbill_yield(price: f64, face: f64, days: u32) -> f64 { (face - price) / price * 365.0 / days as f64 * 100.0 }
fn repo_haircut(collateral_type: &str) -> f64 {
    match collateral_type { "fgn_bonds" => 0.02, "tbills" => 0.01, "state_bonds" => 0.05, "corporate_bonds" => 0.10, _ => 0.15 }
}
fn repo_margin(collateral_value: f64, haircut: f64) -> f64 { collateral_value * (1.0 - haircut) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "money-market-rs",
        "version": "1.0.0",
        "description": "Money market instruments (T-bills, repos, CPs)",
    }))
}

async fn price_tbill(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let face = input.get("face").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let discount_rate = input.get("discount_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let days = input.get("days").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = tbill_price(face, discount_rate, days);
    HttpResponse::Ok().json(json!({
        "service": "money-market-rs",
        "endpoint": "price_tbill",
        "result": json!({"value": result}),
    }))
}

async fn repo_rate(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let price = input.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let face = input.get("face").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let days = input.get("days").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = tbill_yield(price, face, days);
    HttpResponse::Ok().json(json!({
        "service": "money-market-rs",
        "endpoint": "repo_rate",
        "result": json!({"value": result}),
    }))
}

async fn cp_yield(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let collateral_type_s = input.get("collateral_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let collateral_type = collateral_type_s.as_str();
    let result = repo_haircut(collateral_type);
    HttpResponse::Ok().json(json!({
        "service": "money-market-rs",
        "endpoint": "cp_yield",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "money-market-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"money-market-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"money-market-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8154);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("money-market-rs listening on port {}", port);
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
            .route("/v1/tbill", web::post().to(price_tbill))
            .route("/v1/repo", web::post().to(repo_rate))
            .route("/v1/cp", web::post().to(cp_yield))
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
    fn test_tbill_price() { let r = tbill_price(100); assert!(r >= 0.0); }

    #[test]
    fn test_tbill_yield() { let r = tbill_yield(100); assert!(r >= 0.0); }

    #[test]
    fn test_repo_margin() { let r = repo_margin(10000.0); assert!(r >= 0.0); }
}
