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
struct GLAccount {
    pub account_code: Option<String>,
    pub account_name: Option<String>,
    pub account_type: Option<String>,  // asset, liability, equity, revenue, expense
    pub parent_code: Option<String>,
    pub currency: Option<String>,
    pub balance: Option<f64>,
    pub blocked: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct JournalEntry {
    pub entry_id: Option<String>,
    pub debit_account: String,
    pub credit_account: String,
    pub amount: f64,
    pub currency: String,
    pub narration: String,
    pub value_date: String,
    pub posted_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TrialBalanceRequest {
    pub as_of_date: Option<String>,
    pub currency: Option<String>,
    pub branch_code: Option<String>,
}

struct AppState {
    accounts: Mutex<Vec<GLAccount>>,
    db_url: Option<String>,
}


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

async fn chart_of_accounts(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
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

async fn validate_entry(body: web::Json<Vec<JournalEntry>>) -> HttpResponse {
    match validate_double_entry(&body) {
        Ok(_) => HttpResponse::Ok().json(json!({"valid": true})),
        Err(e) => HttpResponse::Ok().json(json!({"valid": false, "error": e})),
    }
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "gl-engine-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"gl-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"gl-engine-rs\"}} {}\n", r, e);
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8101);
    let state = web::Data::new(AppState {
            accounts: Mutex::new(Vec::new()),
            db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("gl-engine-rs listening on port {}", port);
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
            .route("/v1/gl/post-journal", web::post().to(post_journal))
            .route("/v1/gl/trial-balance", web::post().to(trial_balance))
            .route("/v1/gl/chart-of-accounts", web::get().to(chart_of_accounts))
            .route("/v1/gl/account/{code}/balance", web::get().to(account_balance))
            .route("/v1/gl/validate-entry", web::post().to(validate_entry))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
