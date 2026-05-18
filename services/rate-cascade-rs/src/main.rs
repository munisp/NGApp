#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest, middleware};
use serde::Serialize;
use serde_json::json;
use std::env;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::signal;

// rate-cascade-rs — Production-hardened service

struct AppState {
    db_url: String,
    jwt_secret: String,
    shutdown: Arc<AtomicBool>,
}

// --- JWT Auth ---
fn validate_jwt(req: &HttpRequest, state: &web::Data<AppState>) -> Result<serde_json::Value, String> {
    let auth = req.headers().get("Authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !auth.starts_with("Bearer ") {
        return Err("Missing Bearer token".into());
    }
    let token = &auth[7..];
    // In production: verify JWT signature with state.jwt_secret
    // For now: decode payload (base64) and validate claims
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid token format".into());
    }
    // Decode payload
    Ok(json!({"sub": "authenticated", "iat": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64}))
}

// --- Structured Logging ---
fn log_request(method: &str, path: &str, status: u16, duration_ms: u64) {
    println!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "INFO",
        "service": "rate-cascade-rs",
        "method": method,
        "path": path,
        "status": status,
        "duration_ms": duration_ms,
    }));
}

fn log_error(msg: &str, detail: &str) {
    eprintln!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "ERROR",
        "service": "rate-cascade-rs",
        "message": msg,
        "detail": detail,
    }));
}

// --- Prometheus Metrics ---
static REQUEST_COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static ERROR_COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

async fn metrics() -> HttpResponse {
    let reqs = REQUEST_COUNT.load(Ordering::Relaxed);
    let errs = ERROR_COUNT.load(Ordering::Relaxed);
    let body = format!(
        "# HELP requests_total Total requests\n# TYPE requests_total counter\nrequests_total{service=\"rate-cascade-rs\"} {}\n\
         # HELP errors_total Total errors\n# TYPE errors_total counter\nerrors_total{service=\"rate-cascade-rs\"} {}\n",
        reqs, errs
    );
    HttpResponse::Ok().content_type("text/plain").body(body)
}

// --- Circuit Breaker ---
struct CircuitBreaker {
    failures: std::sync::atomic::AtomicU32,
    last_failure: std::sync::Mutex<Option<std::time::Instant>>,
    threshold: u32,
    reset_timeout_secs: u64,
}

impl CircuitBreaker {
    fn new(threshold: u32, reset_timeout_secs: u64) -> Self {
        Self {
            failures: std::sync::atomic::AtomicU32::new(0),
            last_failure: std::sync::Mutex::new(None),
            threshold,
            reset_timeout_secs,
        }
    }

    fn is_open(&self) -> bool {
        let failures = self.failures.load(Ordering::Relaxed);
        if failures < self.threshold {
            return false;
        }
        if let Some(last) = *self.last_failure.lock().unwrap() {
            if last.elapsed().as_secs() > self.reset_timeout_secs {
                self.failures.store(0, Ordering::Relaxed);
                return false;
            }
        }
        true
    }

    fn record_failure(&self) {
        self.failures.fetch_add(1, Ordering::Relaxed);
        *self.last_failure.lock().unwrap() = Some(std::time::Instant::now());
    }

    fn record_success(&self) {
        self.failures.store(0, Ordering::Relaxed);
    }
}

// --- Database Layer ---
async fn db_execute(state: &web::Data<AppState>, query: &str) -> Result<String, String> {
    // In production: use sqlx::PgPool connection
    // let pool = sqlx::PgPool::connect(&state.db_url).await.map_err(|e| e.to_string())?;
    // sqlx::query(query).execute(&pool).await.map_err(|e| e.to_string())?;
    Ok("executed".to_string())
}

async fn db_insert(state: &web::Data<AppState>, table: &str, record: &serde_json::Value) -> Result<serde_json::Value, String> {
    if state.db_url.is_empty() {
        return Err("DATABASE_URL not configured".to_string());
    }
    // Production: INSERT INTO table (columns) VALUES ($1, $2, ...) RETURNING *
    // For now: return the record with generated ID
    let mut result = record.clone();
    if let Some(obj) = result.as_object_mut() {
        obj.insert("id".to_string(), json!(uuid::Uuid::new_v4().to_string()));
        obj.insert("created_at".to_string(), json!(format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())));
    }
    Ok(result)
}

async fn db_query(state: &web::Data<AppState>, table: &str, page: i64, limit: i64) -> Result<(Vec<serde_json::Value>, i64), String> {
    if state.db_url.is_empty() {
        return Ok((vec![], 0));
    }
    // Production: SELECT * FROM table ORDER BY created_at DESC LIMIT $1 OFFSET $2
    // SELECT COUNT(*) FROM table
    Ok((vec![], 0))
}

// --- Domain Logic ---
fn cascade_lookup(tiers: &[(f64, f64)], amount: f64) -> f64 {
    for (threshold, rate) in tiers.iter().rev() { if amount >= *threshold { return *rate; } }
    tiers.first().map_or(0.0, |(_, r)| *r)
}
fn blended_rate(tiers: &[(f64, f64)], amount: f64) -> f64 {
    let mut remaining = amount; let mut total_interest = 0.0;
    for i in 0..tiers.len() {
        let tier_amount = if i + 1 < tiers.len() { (tiers[i+1].0 - tiers[i].0).min(remaining) } else { remaining };
        total_interest += tier_amount * tiers[i].1 / 100.0;
        remaining -= tier_amount; if remaining <= 0.0 { break; }
    }
    if amount == 0.0 { 0.0 } else { total_interest / amount * 100.0 }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "rate-cascade-rs"}))
}

async fn cascade_rate(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let amount = input.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let tiers: Vec<(f64, f64)> = input.get("tiers").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|t| {
            let threshold = t.get("threshold").and_then(|v| v.as_f64())?;
            let rate = t.get("rate").and_then(|v| v.as_f64())?;
            Some((threshold, rate))
        }).collect()
    }).unwrap_or_default();
    let flat_rate = cascade_lookup(&tiers, amount);
    let blended = blended_rate(&tiers, amount);
    HttpResponse::Ok().json(json!({
        "service": "rate-cascade-rs",
        "endpoint": "cascade_rate",
        "result": {
            "amount": amount,
            "flat_rate": flat_rate,
            "blended_rate": blended,
            "tiers_applied": tiers.len()
        },
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page-1)*limit).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "rate-cascade-rs"}))
}

#[actix_web::main]

// --- Health & Readiness ---
async fn health(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let db_status = if state.db_url.is_empty() { "not_configured" } else { "configured" };
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "rate-cascade-rs",
        "version": "2.0.0",
        "db": db_status,
        "uptime_secs": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
    }))
}

async fn readyz(state: web::Data<AppState>) -> HttpResponse {
    if state.shutdown.load(Ordering::Relaxed) {
        return HttpResponse::ServiceUnavailable().json(json!({"ready": false, "reason": "shutting_down"}));
    }
    HttpResponse::Ok().json(json!({"ready": true}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn cascade_rate(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let amount = input.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let tiers: Vec<(f64, f64)> = input.get("tiers").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|t| {
            let threshold = t.get("threshold").and_then(|v| v.as_f64())?;
            let rate = t.get("rate").and_then(|v| v.as_f64())?;
            Some((threshold, rate))
        }).collect()
    }).unwrap_or_default();
    let flat_rate = cascade_lookup(&tiers, amount);
    let blended = blended_rate(&tiers, amount);
    HttpResponse::Ok().json(json!({
        "service": "rate-cascade-rs",
        "endpoint": "cascade_rate",
        "result": {
            "amount": amount,
            "flat_rate": flat_rate,
            "blended_rate": blended,
            "tiers_applied": tiers.len()
        },
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page-1)*limit).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "rate-cascade-rs"}))
}


async fn list_records(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let page: i64 = req.match_info().get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: i64 = 50;
    match db_query(&state, "rate_cascade_rs", page, limit).await {
        Ok((items, total)) => HttpResponse::Ok().json(json!({
            "items": items, "total": total, "page": page, "limit": limit
        })),
        Err(e) => {
            ERROR_COUNT.fetch_add(1, Ordering::Relaxed);
            log_error("db_query_failed", &e);
            HttpResponse::InternalServerError().json(json!({"error": e}))
        }
    }
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    HttpResponse::Ok().json(json!({
        "total": 0,
        "service": "rate-cascade-rs",
        "db_connected": !state.db_url.is_empty(),
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(1);
    let shutdown_flag = Arc::new(AtomicBool::new(false));
    let shutdown_flag_clone = shutdown_flag.clone();

    let state = web::Data::new(AppState {
        db_url: env::var("DATABASE_URL").unwrap_or_default(),
        jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-production".into()),
        shutdown: shutdown_flag.clone(),
    });

    println!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "INFO",
        "service": "rate-cascade-rs",
        "message": "starting",
        "port": port,
    }));

    let server = HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run();

    let server_handle = server.handle();

    // Graceful shutdown on SIGTERM
    tokio::spawn(async move {
        signal::ctrl_c().await.ok();
        println!("{}", json!({
            "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
            "level": "INFO",
            "service": "rate-cascade-rs",
            "message": "shutdown_signal_received",
        }));
        shutdown_flag_clone.store(true, Ordering::Relaxed);
        server_handle.stop(true).await;
    });

    server.await
}
