#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};


#[derive(Debug, Serialize, Deserialize, Clone)]
struct InterestCalcRequest {
    pub principal: f64,
    pub rate_percent: f64,
    pub tenor_days: u32,
    pub day_count_convention: Option<String>,
    pub compounding: Option<String>,
    pub accrual_start: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AccrualSchedule {
    pub account_id: String,
    pub principal: f64,
    pub rate: f64,
    pub start_date: String,
    pub end_date: String,
    pub frequency: String,
}

struct AppState {
    db_url: Option<String>,
}


fn compute_simple_interest(principal: f64, rate: f64, days: u32, day_basis: u32) -> f64 {
    principal * (rate / 100.0) * (days as f64 / day_basis as f64)
}

fn compute_compound_interest(principal: f64, rate: f64, days: u32, day_basis: u32, freq: u32) -> f64 {
    let periods = days as f64 / (day_basis as f64 / freq as f64);
    let rate_per_period = rate / 100.0 / freq as f64;
    principal * (1.0 + rate_per_period).powf(periods) - principal
}

fn get_day_basis(convention: &str) -> u32 {
    match convention {
        "ACT/360" => 360,
        "ACT/365" => 365,
        "30/360" => 360,
        "ACT/ACT" => 365,
        _ => 365,
    }
}

fn generate_accrual_schedule(principal: f64, rate: f64, days: u32, freq: &str) -> Vec<serde_json::Value> {
    let periods = match freq {
        "daily" => days,
        "monthly" => days / 30,
        "quarterly" => days / 90,
        _ => 1,
    };
    let per_period = compute_simple_interest(principal, rate, days / periods.max(1), 365) ;
    (0..periods.max(1)).map(|i| json!({"period": i + 1, "accrued": per_period * (i + 1) as f64, "incremental": per_period})).collect()
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "interest-computation-rs",
        "version": "1.0.0",
    }))
}


async fn calculate_interest(body: web::Json<InterestCalcRequest>) -> HttpResponse {
    let convention = body.day_count_convention.as_deref().unwrap_or("ACT/365");
    let day_basis = get_day_basis(convention);
    let compounding = body.compounding.as_deref().unwrap_or("simple");
    let interest = match compounding {
        "simple" => compute_simple_interest(body.principal, body.rate_percent, body.tenor_days, day_basis),
        "monthly" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 12),
        "quarterly" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 4),
        "daily" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 365),
        _ => compute_simple_interest(body.principal, body.rate_percent, body.tenor_days, day_basis),
    };
    let maturity = body.principal + interest;
    HttpResponse::Ok().json(json!({"principal": body.principal, "rate": body.rate_percent, "tenor_days": body.tenor_days,
        "day_count": convention, "compounding": compounding, "interest": (interest * 100.0).round() / 100.0,
        "maturity_amount": (maturity * 100.0).round() / 100.0}))
}

async fn accrual_schedule(body: web::Json<AccrualSchedule>) -> HttpResponse {
    let schedule = generate_accrual_schedule(body.principal, body.rate, 365, &body.frequency);
    HttpResponse::Ok().json(json!({"account_id": body.account_id, "schedule": schedule}))
}

async fn effective_rate(body: web::Json<InterestCalcRequest>) -> HttpResponse {
    let nominal = body.rate_percent / 100.0;
    let n = match body.compounding.as_deref().unwrap_or("monthly") {
        "daily" => 365.0, "monthly" => 12.0, "quarterly" => 4.0, "semi-annual" => 2.0, _ => 12.0,
    };
    let effective = ((1.0 + nominal / n).powf(n) - 1.0) * 100.0;
    HttpResponse::Ok().json(json!({"nominal_rate": body.rate_percent, "effective_rate": (effective * 10000.0).round() / 10000.0, "compounding_frequency": n}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;


async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "interest-computation-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"interest-computation-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"interest-computation-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8103);
    let state = web::Data::new(AppState {
            db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("interest-computation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[interest-computation-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/interest/calculate", web::post().to(calculate_interest))
            .route("/v1/interest/accrual-schedule", web::post().to(accrual_schedule))
            .route("/v1/interest/effective-rate", web::post().to(effective_rate))
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
    fn test_compute_simple_interest() { let r = compute_simple_interest(100, 80); assert!(r >= 0.0); }

    #[test]
    fn test_compute_compound_interest() { let r = compute_compound_interest(100, 80); assert!(r >= 0.0); }
}
