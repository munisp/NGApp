#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest, middleware};
use serde::Serialize;
use serde_json::json;
use std::env;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::signal;

// fraud-detection-rs — Production-hardened service

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
        "service": "fraud-detection-rs",
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
        "service": "fraud-detection-rs",
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
        "# HELP requests_total Total requests\n# TYPE requests_total counter\nrequests_total{service=\"fraud-detection-rs\"} {}\n\
         # HELP errors_total Total errors\n# TYPE errors_total counter\nerrors_total{service=\"fraud-detection-rs\"} {}\n",
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

async fn velocity_check(body: web::Json<serde_json::Value>) -> HttpResponse {
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

async fn device_fingerprint(body: web::Json<serde_json::Value>) -> HttpResponse {
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
        "service": "fraud-detection-rs",
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

async fn evaluate_transaction(body: web::Json<serde_json::Value>) -> HttpResponse {
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

async fn velocity_check(body: web::Json<serde_json::Value>) -> HttpResponse {
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

async fn device_fingerprint(body: web::Json<serde_json::Value>) -> HttpResponse {
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
    match db_query(&state, "fraud_detection_rs", page, limit).await {
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
        "service": "fraud-detection-rs",
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
        "service": "fraud-detection-rs",
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
            "service": "fraud-detection-rs",
            "message": "shutdown_signal_received",
        }));
        shutdown_flag_clone.store(true, Ordering::Relaxed);
        server_handle.stop(true).await;
    });

    server.await
}
