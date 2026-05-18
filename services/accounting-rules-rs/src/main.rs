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
struct AccountingRule {
    pub rule_id: Option<String>,
    pub rule_name: String,
    pub event_type: String,
    pub debit_account: String,
    pub credit_account: String,
    pub amount_formula: String,
    pub currency: Option<String>,
    pub active: Option<bool>,
    pub priority: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RuleEvalRequest {
    pub event_type: String,
    pub amount: f64,
    pub currency: String,
    pub metadata: Option<serde_json::Value>,
}

struct AppState {
    rules: Mutex<Vec<AccountingRule>>,
    db_url: Option<String>,
}


fn evaluate_formula(formula: &str, amount: f64) -> f64 {
    match formula {
        "full_amount" => amount,
        "vat_component" => amount * 0.075,
        "withholding_tax" => amount * 0.10,
        "stamp_duty" => if amount >= 10000.0 { 50.0 } else { 0.0 },
        "commission" => amount * 0.01,
        "interest_accrual" => amount,
        f if f.starts_with("percent_") => {
            let pct: f64 = f.trim_start_matches("percent_").parse().unwrap_or(0.0);
            amount * pct / 100.0
        },
        _ => amount,
    }
}

fn validate_rule(rule: &AccountingRule) -> Vec<String> {
    let mut errors = Vec::new();
    if rule.debit_account.is_empty() { errors.push("debit_account required".into()); }
    if rule.credit_account.is_empty() { errors.push("credit_account required".into()); }
    if rule.debit_account == rule.credit_account { errors.push("debit and credit accounts must differ".into()); }
    if rule.event_type.is_empty() { errors.push("event_type required".into()); }
    errors
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "accounting-rules-rs",
        "version": "1.0.0",
    }))
}


async fn evaluate_rules(body: web::Json<RuleEvalRequest>, state: web::Data<AppState>) -> HttpResponse {
    let rules = state.rules.lock().unwrap();
    let matching: Vec<serde_json::Value> = rules.iter()
        .filter(|r| r.event_type == body.event_type && r.active.unwrap_or(true))
        .map(|r| {
            let computed = evaluate_formula(&r.amount_formula, body.amount);
            json!({"rule_id": r.rule_id, "debit": r.debit_account, "credit": r.credit_account, "amount": computed, "formula": r.amount_formula})
        }).collect();
    HttpResponse::Ok().json(json!({"event": body.event_type, "entries": matching, "total_rules_matched": matching.len()}))
}

async fn validate_rule_handler(body: web::Json<AccountingRule>) -> HttpResponse {
    let errors = validate_rule(&body);
    HttpResponse::Ok().json(json!({"valid": errors.is_empty(), "errors": errors}))
}

async fn rules_by_event(path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let event_type = path.into_inner();
    let rules = state.rules.lock().unwrap();
    let matching: Vec<&AccountingRule> = rules.iter().filter(|r| r.event_type == event_type).collect();
    HttpResponse::Ok().json(json!({"event_type": event_type, "rules": matching, "count": matching.len()}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "accounting-rules-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"accounting-rules-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"accounting-rules-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8102);
    let state = web::Data::new(AppState {
            rules: Mutex::new(Vec::new()),
            db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("accounting-rules-rs listening on port {}", port);
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
            .route("/v1/rules/evaluate", web::post().to(evaluate_rules))
            .route("/v1/rules/validate", web::post().to(validate_rule_handler))
            .route("/v1/rules/by-event/{event_type}", web::get().to(rules_by_event))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
