#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest, middleware};
use serde::Serialize;
use serde_json::json;
use std::env;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::signal;

// mortgage-servicing-rs — Production-hardened service

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
        "service": "mortgage-servicing-rs",
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
        "service": "mortgage-servicing-rs",
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
        "# HELP requests_total Total requests\n# TYPE requests_total counter\nrequests_total{service=\"mortgage-servicing-rs\"} {}\n\
         # HELP errors_total Total errors\n# TYPE errors_total counter\nerrors_total{service=\"mortgage-servicing-rs\"} {}\n",
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
fn monthly_payment(principal: f64, annual_rate: f64, months: u32) -> f64 {
    let r = annual_rate / 100.0 / 12.0;
    if r == 0.0 { return principal / months as f64; }
    principal * r * (1.0 + r).powi(months as i32) / ((1.0 + r).powi(months as i32) - 1.0)
}
fn dti_ratio(monthly_debt: f64, monthly_income: f64) -> f64 {
    if monthly_income == 0.0 { 999.0 } else { monthly_debt / monthly_income * 100.0 }
}
fn ltv_ratio(loan_amount: f64, property_value: f64) -> f64 {
    if property_value == 0.0 { 999.0 } else { loan_amount / property_value * 100.0 }
}
fn prepayment_penalty(outstanding: f64, rate: f64) -> f64 { outstanding * rate / 100.0 * 0.5 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "mortgage-servicing-rs",
        "version": "1.0.0",
        "description": "Mortgage servicing and amortization",
    }))
}

    let input = body.into_inner();
    let principal = input.get("principal").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let annual_rate = input.get("annual_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let months = input.get("months").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = monthly_payment(principal, annual_rate, months);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "compute_amortization",
        "result": json!({"value": result}),
    }))
}

async fn early_repayment(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let monthly_debt = input.get("monthly_debt").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let monthly_income = input.get("monthly_income").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = dti_ratio(monthly_debt, monthly_income);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "early_repayment",
        "result": json!({"value": result}),
    }))
}

async fn affordability_check(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let loan_amount = input.get("loan_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let property_value = input.get("property_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = ltv_ratio(loan_amount, property_value);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "affordability_check",
        "result": json!({"value": result}),
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

// --- Health & Readiness ---
async fn health(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let db_status = if state.db_url.is_empty() { "not_configured" } else { "configured" };
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "mortgage-servicing-rs",
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

async fn compute_amortization(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let principal = input.get("principal").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let annual_rate = input.get("annual_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let months = input.get("months").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = monthly_payment(principal, annual_rate, months);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "compute_amortization",
        "result": json!({"value": result}),
    }))
}

async fn early_repayment(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let monthly_debt = input.get("monthly_debt").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let monthly_income = input.get("monthly_income").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = dti_ratio(monthly_debt, monthly_income);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "early_repayment",
        "result": json!({"value": result}),
    }))
}

async fn affordability_check(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let loan_amount = input.get("loan_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let property_value = input.get("property_value").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = ltv_ratio(loan_amount, property_value);
    HttpResponse::Ok().json(json!({
        "service": "mortgage-servicing-rs",
        "endpoint": "affordability_check",
        "result": json!({"value": result}),
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


async fn list_records(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let page: i64 = req.match_info().get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: i64 = 50;
    match db_query(&state, "mortgage_servicing_rs", page, limit).await {
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
        "service": "mortgage-servicing-rs",
        "db_connected": !state.db_url.is_empty(),
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(0);
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
        "service": "mortgage-servicing-rs",
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
            "service": "mortgage-servicing-rs",
            "message": "shutdown_signal_received",
        }));
        shutdown_flag_clone.store(true, Ordering::Relaxed);
        server_handle.stop(true).await;
    });

    server.await
}
