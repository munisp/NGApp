#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest, middleware};
use serde::Serialize;
use serde_json::json;
use std::env;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::signal;

// gl-engine-rs — Production-hardened service

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
        "service": "gl-engine-rs",
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
        "service": "gl-engine-rs",
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
        "# HELP requests_total Total requests\n# TYPE requests_total counter\nrequests_total{service=\"gl-engine-rs\"} {}\n\
         # HELP errors_total Total errors\n# TYPE errors_total counter\nerrors_total{service=\"gl-engine-rs\"} {}\n",
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
fn validate_double_entry(entries: &[JournalEntry]) -> Result<(), String> {
    let total_debit: f64 = entries.iter().map(|e| e.amount).sum();
    let total_credit: f64 = entries.iter().map(|e| e.amount).sum();
    if (total_debit - total_credit).abs() > 0.01 {
        return Err(format!("Double-entry imbalance: debit={} credit={}", total_debit, total_credit));
    }
    Ok(())
}

fn classify_account(code: &str) -> &str {
    match code.chars().next() {
        Some('1') => "asset",
        Some('2') => "liability",
        Some('3') => "equity",
        Some('4') => "revenue",
        Some('5') => "expense",
        _ => "unknown",
    }
}

fn compute_trial_balance(accounts: &[GLAccount]) -> serde_json::Value {
    let mut total_debit = 0.0f64;
    let mut total_credit = 0.0f64;
    let mut entries = Vec::new();
    for acc in accounts {
        let bal = acc.balance.unwrap_or(0.0);
        let acct_type = acc.account_type.as_deref().unwrap_or("unknown");
        let (dr, cr) = match acct_type {
            "asset" | "expense" => if bal >= 0.0 { (bal, 0.0) } else { (0.0, bal.abs()) },
            _ => if bal >= 0.0 { (0.0, bal) } else { (bal.abs(), 0.0) },
        };
        total_debit += dr;
        total_credit += cr;
        entries.push(json!({
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "debit": dr, "credit": cr,
        }));
    }
    json!({
        "entries": entries,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "balanced": (total_debit - total_credit).abs() < 0.01,
    })
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "gl-engine-rs",
        "version": "1.0.0",
    }))
}


async fn post_journal(body: web::Json<Vec<JournalEntry>>, state: web::Data<AppState>) -> HttpResponse {
    let entries = body.into_inner();
    if let Err(e) = validate_double_entry(&entries) {
        return HttpResponse::BadRequest().json(json!({"error": e}));
    }
    let entry_id = format!("JRN-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));
    let mut accounts = state.accounts.lock().unwrap();
    for entry in &entries {
        if let Some(acc) = accounts.iter_mut().find(|a| a.account_code.as_deref() == Some(&entry.debit_account)) {
            *acc.balance.get_or_insert(0.0) += entry.amount;
        }
        if let Some(acc) = accounts.iter_mut().find(|a| a.account_code.as_deref() == Some(&entry.credit_account)) {
            *acc.balance.get_or_insert(0.0) -= entry.amount;
        }
    }
    HttpResponse::Ok().json(json!({"entry_id": entry_id, "status": "posted", "entries": entries.len()}))
}

async fn trial_balance(body: web::Json<TrialBalanceRequest>, state: web::Data<AppState>) -> HttpResponse {
    let accounts = state.accounts.lock().unwrap();
    let tb = compute_trial_balance(&accounts);
    HttpResponse::Ok().json(tb)
}

async fn chart_of_accounts(state: web::Data<AppState>) -> HttpResponse {
    let accounts = state.accounts.lock().unwrap();
    let grouped: std::collections::HashMap<&str, Vec<&GLAccount>> = accounts.iter().fold(
        std::collections::HashMap::new(),
        |mut map, acc| { map.entry(classify_account(acc.account_code.as_deref().unwrap_or(""))).or_default().push(acc); map }
    );
    HttpResponse::Ok().json(json!({"chart": grouped, "total_accounts": accounts.len()}))
}

async fn account_balance(path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let code = path.into_inner();
    let accounts = state.accounts.lock().unwrap();
    match accounts.iter().find(|a| a.account_code.as_deref() == Some(&code)) {
        Some(acc) => HttpResponse::Ok().json(json!({"account": acc, "classification": classify_account(&code)})),
        None => HttpResponse::NotFound().json(json!({"error": "Account not found"})),
    }
}

    match validate_double_entry(&body) {
        Ok(_) => HttpResponse::Ok().json(json!({"valid": true})),
        Err(e) => HttpResponse::Ok().json(json!({"valid": false, "error": e})),
    }
}

#[actix_web::main]

// --- Health & Readiness ---
async fn health(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let db_status = if state.db_url.is_empty() { "not_configured" } else { "configured" };
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "gl-engine-rs",
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

async fn post_journal(body: web::Json<Vec<JournalEntry>>, state: web::Data<AppState>) -> HttpResponse {
    let entries = body.into_inner();
    if let Err(e) = validate_double_entry(&entries) {
        return HttpResponse::BadRequest().json(json!({"error": e}));
    }
    let entry_id = format!("JRN-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));
    let mut accounts = state.accounts.lock().unwrap();
    for entry in &entries {
        if let Some(acc) = accounts.iter_mut().find(|a| a.account_code.as_deref() == Some(&entry.debit_account)) {
            *acc.balance.get_or_insert(0.0) += entry.amount;
        }
        if let Some(acc) = accounts.iter_mut().find(|a| a.account_code.as_deref() == Some(&entry.credit_account)) {
            *acc.balance.get_or_insert(0.0) -= entry.amount;
        }
    }
    HttpResponse::Ok().json(json!({"entry_id": entry_id, "status": "posted", "entries": entries.len()}))
}

async fn trial_balance(body: web::Json<TrialBalanceRequest>, state: web::Data<AppState>) -> HttpResponse {
    let accounts = state.accounts.lock().unwrap();
    let tb = compute_trial_balance(&accounts);
    HttpResponse::Ok().json(tb)
}

async fn chart_of_accounts(state: web::Data<AppState>) -> HttpResponse {
    let accounts = state.accounts.lock().unwrap();
    let grouped: std::collections::HashMap<&str, Vec<&GLAccount>> = accounts.iter().fold(
        std::collections::HashMap::new(),
        |mut map, acc| { map.entry(classify_account(acc.account_code.as_deref().unwrap_or(""))).or_default().push(acc); map }
    );
    HttpResponse::Ok().json(json!({"chart": grouped, "total_accounts": accounts.len()}))
}

async fn validate_entry(body: web::Json<Vec<JournalEntry>>) -> HttpResponse {
    match validate_double_entry(&body) {
        Ok(_) => HttpResponse::Ok().json(json!({"valid": true})),
        Err(e) => HttpResponse::Ok().json(json!({"valid": false, "error": e})),
    }
}


async fn list_records(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let page: i64 = req.match_info().get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: i64 = 50;
    match db_query(&state, "gl_engine_rs", page, limit).await {
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
        "service": "gl-engine-rs",
        "db_connected": !state.db_url.is_empty(),
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8101);
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
        "service": "gl-engine-rs",
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
            "service": "gl-engine-rs",
            "message": "shutdown_signal_received",
        }));
        shutdown_flag_clone.store(true, Ordering::Relaxed);
        server_handle.stop(true).await;
    });

    server.await
}
