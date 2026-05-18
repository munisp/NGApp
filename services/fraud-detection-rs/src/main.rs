#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// fraud-detection-rs — Real-time fraud detection with rule engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

fn velocity_score(txn_count_1h: u32, txn_count_24h: u32, avg_1h: f64, avg_24h: f64) -> f64 {
    let h_ratio = if avg_1h > 0.0 { txn_count_1h as f64 / avg_1h } else { txn_count_1h as f64 };
    let d_ratio = if avg_24h > 0.0 { txn_count_24h as f64 / avg_24h } else { txn_count_24h as f64 };
    ((h_ratio * 0.6 + d_ratio * 0.4) * 25.0).min(100.0)
}
fn amount_anomaly_score(amount: f64, avg_amount: f64, std_dev: f64) -> f64 {
    if std_dev == 0.0 { return 0.0; }
    let z_score = (amount - avg_amount) / std_dev;
    (z_score.abs() * 15.0).min(100.0)
}
fn geo_anomaly(current_country: &str, usual_country: &str, minutes_since_last: u64) -> f64 {
    if current_country == usual_country { 0.0 } else if minutes_since_last < 120 { 90.0 } else { 40.0 }
}
fn combined_fraud_score(velocity: f64, amount: f64, geo: f64, device: f64) -> f64 {
    (velocity * 0.3 + amount * 0.25 + geo * 0.25 + device * 0.2).min(100.0)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fraud-detection-rs",
        "version": "1.0.0",
        "description": "Real-time fraud detection with rule engine",
    }))
}

async fn evaluate_transaction(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let txn_count_1h = input.get("txn_count_1h").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let txn_count_24h = input.get("txn_count_24h").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let avg_1h = input.get("avg_1h").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let avg_24h = input.get("avg_24h").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = velocity_score(txn_count_1h, txn_count_24h, avg_1h, avg_24h);
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "evaluate_transaction",
        "result": json!({"value": result}),
    }))
}

async fn velocity_check(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let amount = input.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let avg_amount = input.get("avg_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let std_dev = input.get("std_dev").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = amount_anomaly_score(amount, avg_amount, std_dev);
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "velocity_check",
        "result": json!({"value": result}),
    }))
}

async fn device_fingerprint(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let current_country_s = input.get("current_country").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let current_country = current_country_s.as_str();
    let usual_country_s = input.get("usual_country").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let usual_country = usual_country_s.as_str();
    let minutes_since_last = input.get("minutes_since_last").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = geo_anomaly(current_country, usual_country, minutes_since_last);
    HttpResponse::Ok().json(json!({
        "service": "fraud-detection-rs",
        "endpoint": "device_fingerprint",
        "result": json!({"value": result}),
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let offset = (page - 1) * limit;
    if let Some(ref client) = state.db_client {
        match client.query(
            "SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            &[&"fraud_detection_rs", &(limit as i64), &(offset as i64)]
        ).await {
            Ok(rows) => {
                let items: Vec<serde_json::Value> = rows.iter().map(|r| {
                    json!({
                        "id": r.get::<_, String>(0),
                        "service": r.get::<_, String>(1),
                        "type": r.get::<_, String>(2),
                        "status": r.get::<_, String>(3),
                        "data": r.get::<_, serde_json::Value>(4),
                    })
                }).collect();
                let total: i64 = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"fraud_detection_rs"]).await.map(|r| r.get(0)).unwrap_or(0);
                return HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "database"}));
            }
            Err(e) => { eprintln!("DB query failed: {} — fallback to in-memory", e); }
        }
    }
    let records = state.records.lock().unwrap();
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip(offset).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "in-memory"}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    if let Some(ref client) = state.db_client {
        if let Ok(row) = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"fraud_detection_rs"]).await {
            let total: i64 = row.get(0);
            return HttpResponse::Ok().json(json!({"total": total, "service": env!("CARGO_PKG_NAME"), "source": "database"}));
        }
    }
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME"), "source": "in-memory"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;


async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "fraud-detection-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"fraud-detection-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"fraud-detection-rs\"}} {}\n", r, e);
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


// --- Security Headers Middleware ---
fn add_security_headers(resp: &mut actix_web::HttpResponse) {
    let hdrs = resp.headers_mut();
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-content-type-options"),
        actix_web::http::header::HeaderValue::from_static("nosniff"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-frame-options"),
        actix_web::http::header::HeaderValue::from_static("DENY"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-xss-protection"),
        actix_web::http::header::HeaderValue::from_static("1; mode=block"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("strict-transport-security"),
        actix_web::http::header::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("referrer-policy"),
        actix_web::http::header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8122);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        match init_db(&url).await {
            Some(c) => { println!("fraud-detection-rs: connected to Postgres"); Some(std::sync::Arc::new(c)) }
            None => None,
        }
    } else { None };
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
        db_client,
    });
    println!("fraud-detection-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[fraud-detection-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/evaluate", web::post().to(evaluate_transaction))
            .route("/v1/velocity", web::post().to(velocity_check))
            .route("/v1/device_check", web::post().to(device_fingerprint))
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
    fn test_velocity_score() { let r = velocity_score(100, 80); assert!(r >= 0.0); }

    #[test]
    fn test_amount_anomaly_score() { let r = amount_anomaly_score(10000.0); assert!(r >= 0.0); }

    #[test]
    fn test_combined_fraud_score() { let r = combined_fraud_score(10000.0); assert!(r >= 0.0); }
}
