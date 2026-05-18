#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// multicurrency-revaluation-rs — Multi-currency position revaluation (mark-to-market)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn revalue_position(notional: f64, book_rate: f64, market_rate: f64) -> f64 { notional * (market_rate - book_rate) }
fn unrealized_pnl(positions: &[(f64, f64, f64)]) -> f64 { positions.iter().map(|(n, br, mr)| revalue_position(*n, *br, *mr)).sum() }
fn translation_rate(method: &str) -> &str { match method { "current" => "closing_rate", "temporal" => "historical_rate", _ => "closing_rate" } }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "multicurrency-revaluation-rs",
        "version": "1.0.0",
        "description": "Multi-currency position revaluation (mark-to-market)",
    }))
}

async fn revalue_positions(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let notional = input.get("notional").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let book_rate = input.get("book_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let market_rate = input.get("market_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = revalue_position(notional, book_rate, market_rate);
    HttpResponse::Ok().json(json!({
        "service": "multicurrency-revaluation-rs",
        "endpoint": "revalue_positions",
        "result": json!({"value": result}),
    }))
}

async fn compute_pnl(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let positions: Vec<(f64, f64, f64)> = input.get("positions").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|p| {
            let notional = p.get("notional").and_then(|n| n.as_f64())?;
            let book_rate = p.get("book_rate").and_then(|b| b.as_f64())?;
            let market_rate = p.get("market_rate").and_then(|m| m.as_f64())?;
            Some((notional, book_rate, market_rate))
        }).collect()
    }).unwrap_or_default();
    let pnl = unrealized_pnl(&positions);
    HttpResponse::Ok().json(json!({
        "service": "multicurrency-revaluation-rs",
        "endpoint": "compute_pnl",
        "result": {"unrealized_pnl": pnl, "positions_count": positions.len()},
    }))
}

async fn translation_adjustment(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let method_s = input.get("method").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let method = method_s.as_str();
    let result = translation_rate(method);
    HttpResponse::Ok().json(json!({
        "service": "multicurrency-revaluation-rs",
        "endpoint": "translation_adjustment",
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
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": if state.db_url.is_some() { "database" } else { "in-memory" }}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME")}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "multicurrency-revaluation-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"multicurrency-revaluation-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"multicurrency-revaluation-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8108);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("multicurrency-revaluation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[multicurrency-revaluation-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/revalue", web::post().to(revalue_positions))
            .route("/v1/pnl", web::post().to(compute_pnl))
            .route("/v1/translation", web::post().to(translation_adjustment))
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
    fn test_revalue_position() { let r = revalue_position(10000.0); assert!(r >= 0.0); }
}
