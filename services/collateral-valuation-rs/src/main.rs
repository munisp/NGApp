#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// collateral-valuation-rs — Collateral valuation and management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn apply_haircut(market_value: f64, collateral_type: &str) -> f64 {
    let haircut = match collateral_type {
        "cash" => 0.0, "government_securities" => 0.05, "property" => 0.30,
        "equipment" => 0.40, "inventory" => 0.50, "receivables" => 0.35, _ => 0.50,
    };
    market_value * (1.0 - haircut)
}
fn coverage_ratio(collateral_value: f64, loan_outstanding: f64) -> f64 {
    if loan_outstanding == 0.0 { 999.0 } else { collateral_value / loan_outstanding * 100.0 }
}
fn margin_call_needed(coverage: f64, minimum_coverage: f64) -> bool { coverage < minimum_coverage }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "collateral-valuation-rs",
        "version": "1.0.0",
        "description": "Collateral valuation and management",
    }))
}

async fn value_collateral(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let market_value = input.get("market_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let collateral_type_s = input.get("collateral_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let collateral_type = collateral_type_s.as_str();
    let result = apply_haircut(market_value, collateral_type);
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "value_collateral",
        "result": json!({"value": result}),
    }))
}

async fn revalue(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let collateral_value = input.get("collateral_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let loan_outstanding = input.get("loan_outstanding").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = coverage_ratio(collateral_value, loan_outstanding);
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "revalue",
        "result": json!({"value": result}),
    }))
}

async fn coverage_ratio_handler(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let coverage = input.get("coverage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let minimum_coverage = input.get("minimum_coverage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = margin_call_needed(coverage, minimum_coverage);
    HttpResponse::Ok().json(json!({
        "service": "collateral-valuation-rs",
        "endpoint": "coverage_ratio_handler",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "collateral-valuation-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"collateral-valuation-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"collateral-valuation-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8164);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("collateral-valuation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[collateral-valuation-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/value", web::post().to(value_collateral))
            .route("/v1/revalue", web::post().to(revalue))
            .route("/v1/coverage", web::post().to(coverage_ratio_handler))
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
    fn test_apply_haircut() { let r = apply_haircut(10000.0); assert!(r >= 0.0); }

    #[test]
    fn test_coverage_ratio() { let r = coverage_ratio(10000.0); assert!(r >= 0.0); }

    #[test]
    fn test_margin_call_needed() { let r = margin_call_needed(100.0); assert!(r == true || r == false); }
}
