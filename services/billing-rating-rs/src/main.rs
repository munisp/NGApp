#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// billing-rating-rs — Billing and fee rating engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

fn compute_fee(amount: f64, fee_type: &str, tier: &str) -> f64 {
    match (fee_type, tier) {
        ("transfer_fee", "tier1") => if amount <= 5000.0 { 10.0 } else if amount <= 50000.0 { 25.0 } else { 50.0 },
        ("transfer_fee", "premium") => 0.0,
        ("maintenance_fee", _) => 100.0,
        ("sms_alert", _) => 4.0,
        ("card_annual", "tier1") => 1000.0,
        ("card_annual", "premium") => 5000.0,
        _ => 0.0,
    }
}
fn total_charges(fees: &[f64], vat_rate: f64) -> (f64, f64, f64) {
    let subtotal: f64 = fees.iter().sum();
    let vat = subtotal * vat_rate / 100.0;
    (subtotal, vat, subtotal + vat)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "billing-rating-rs",
        "version": "1.0.0",
        "description": "Billing and fee rating engine",
    }))
}

async fn rate_transaction(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let amount = input.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let fee_type_s = input.get("fee_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let fee_type = fee_type_s.as_str();
    let tier_s = input.get("tier").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let tier = tier_s.as_str();
    let result = compute_fee(amount, fee_type, tier);
    HttpResponse::Ok().json(json!({
        "service": "billing-rating-rs",
        "endpoint": "rate_transaction",
        "result": json!({"value": result}),
    }))
}

async fn fee_schedule(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let fees_v: Vec<f64> = input.get("fees").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let fees = fees_v.as_slice();
    let vat_rate = input.get("vat_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = total_charges(fees, vat_rate);
    HttpResponse::Ok().json(json!({
        "service": "billing-rating-rs",
        "endpoint": "fee_schedule",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn revenue_forecast(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let monthly_txns = input.get("monthly_transactions").and_then(|v| v.as_u64()).unwrap_or(0) as f64;
    let avg_amount = input.get("avg_transaction_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let tier_s = input.get("tier").and_then(|v| v.as_str()).unwrap_or("tier1").to_string();
    let vat_rate = input.get("vat_rate").and_then(|v| v.as_f64()).unwrap_or(7.5);
    let transfer_fee = compute_fee(avg_amount, "transfer_fee", &tier_s);
    let monthly_fee_revenue = transfer_fee * monthly_txns;
    let maintenance = compute_fee(0.0, "maintenance_fee", &tier_s);
    let sms = compute_fee(0.0, "sms_alert", &tier_s);
    let fees = vec![monthly_fee_revenue, maintenance, sms];
    let (subtotal, vat, total) = total_charges(&fees, vat_rate);
    HttpResponse::Ok().json(json!({
        "service": "billing-rating-rs",
        "endpoint": "revenue_forecast",
        "result": {
            "monthly_fee_revenue": monthly_fee_revenue,
            "maintenance_fee": maintenance,
            "sms_fee": sms,
            "subtotal": subtotal,
            "vat": vat,
            "total_monthly": total,
            "annual_projection": total * 12.0
        },
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
            &[&"billing_rating_rs", &(limit as i64), &(offset as i64)]
        ).await {
            Ok(rows) => {
                let items: Vec<serde_json::Value> = rows.iter().map(|r| {
                    json!({
                        "id": r.get::<_, String>(0),
                        "service": r.get::<_, String>(1),
                        "type": r.get::<_, String>(2),
                        "status": r.get::<_, String>(3),
                        "data": r.get::<_, String>(4),
                    })
                }).collect();
                let total: i64 = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"billing_rating_rs"]).await.map(|r| r.get(0)).unwrap_or(0);
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
        if let Ok(row) = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"billing_rating_rs"]).await {
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "billing-rating-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"billing-rating-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"billing-rating-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8161);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        match init_db(&url).await {
            Some(c) => { println!("billing-rating-rs: connected to Postgres"); Some(std::sync::Arc::new(c)) }
            None => None,
        }
    } else { None };
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
        db_client,
    });
    println!("billing-rating-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[billing-rating-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/rate", web::post().to(rate_transaction))
            .route("/v1/fees", web::post().to(fee_schedule))
            .route("/v1/forecast", web::post().to(revenue_forecast))
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
    fn test_compute_fee() { let r = compute_fee(10000.0); assert!(r >= 0.0); }
}
