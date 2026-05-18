#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// trust-estate-rs — Trust and estate management

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn compute_distribution(corpus: f64, beneficiaries: &[(String, f64)]) -> Vec<(String, f64)> {
    let total_share: f64 = beneficiaries.iter().map(|(_, s)| s).sum();
    beneficiaries.iter().map(|(name, share)| (name.clone(), corpus * share / total_share)).collect()
}
fn management_fee(corpus: f64, annual_rate: f64) -> f64 { corpus * annual_rate / 100.0 }
fn trust_type_rules(trust_type: &str) -> &str {
    match trust_type { "living" => "revocable_grantor_controlled", "testamentary" => "irrevocable_court_supervised", "charitable" => "irrevocable_tax_exempt", _ => "standard" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "trust-estate-rs",
        "version": "1.0.0",
        "description": "Trust and estate management",
    }))
}

async fn create_trust(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let corpus = input.get("corpus").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let beneficiaries: Vec<(String, f64)> = input.get("beneficiaries").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|b| {
            let name = b.get("name").and_then(|n| n.as_str())?.to_string();
            let share = b.get("share").and_then(|s| s.as_f64())?;
            Some((name, share))
        }).collect()
    }).unwrap_or_default();
    let distribution = compute_distribution(corpus, &beneficiaries);
    let trust_type_s = input.get("trust_type").and_then(|v| v.as_str()).unwrap_or("standard").to_string();
    let rules = trust_type_rules(&trust_type_s);
    let dist_json: Vec<serde_json::Value> = distribution.iter().map(|(name, amount)| json!({"beneficiary": name, "amount": amount})).collect();
    HttpResponse::Ok().json(json!({
        "service": "trust-estate-rs",
        "endpoint": "create_trust",
        "result": {"distribution": dist_json, "trust_rules": rules, "corpus": corpus},
    }))
}

async fn distribute(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let corpus = input.get("corpus").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let annual_rate = input.get("annual_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = management_fee(corpus, annual_rate);
    HttpResponse::Ok().json(json!({
        "service": "trust-estate-rs",
        "endpoint": "distribute",
        "result": json!({"value": result}),
    }))
}

async fn estate_valuation(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let trust_type_s = input.get("trust_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let trust_type = trust_type_s.as_str();
    let result = trust_type_rules(trust_type);
    HttpResponse::Ok().json(json!({
        "service": "trust-estate-rs",
        "endpoint": "estate_valuation",
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


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "trust-estate-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"trust-estate-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"trust-estate-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8167);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("trust-estate-rs listening on port {}", port);
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
            .route("/v1/create", web::post().to(create_trust))
            .route("/v1/distribute", web::post().to(distribute))
            .route("/v1/valuation", web::post().to(estate_valuation))
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
