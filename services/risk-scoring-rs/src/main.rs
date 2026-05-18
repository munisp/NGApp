#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// risk-scoring-rs — Enterprise risk scoring engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn composite_risk(credit: f64, market: f64, operational: f64, liquidity: f64) -> f64 {
    credit * 0.35 + market * 0.25 + operational * 0.20 + liquidity * 0.20
}
fn risk_rating(score: f64) -> &'static str {
    if score >= 80.0 { "AAA" } else if score >= 60.0 { "AA" } else if score >= 40.0 { "A" }
    else if score >= 20.0 { "BBB" } else { "BB" }
}
fn within_appetite(exposure: f64, limit: f64) -> bool { exposure <= limit }
fn concentration_risk(single_exposure: f64, total_portfolio: f64) -> f64 {
    if total_portfolio == 0.0 { 0.0 } else { single_exposure / total_portfolio * 100.0 }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "risk-scoring-rs",
        "version": "1.0.0",
        "description": "Enterprise risk scoring engine",
    }))
}

async fn score_entity(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let credit = input.get("credit").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let market = input.get("market").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let operational = input.get("operational").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let liquidity = input.get("liquidity").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = composite_risk(credit, market, operational, liquidity);
    HttpResponse::Ok().json(json!({
        "service": "risk-scoring-rs",
        "endpoint": "score_entity",
        "result": json!({"value": result}),
    }))
}

async fn risk_matrix(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let score = input.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = risk_rating(score);
    HttpResponse::Ok().json(json!({
        "service": "risk-scoring-rs",
        "endpoint": "risk_matrix",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn risk_appetite_check(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let exposure = input.get("exposure").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let limit = input.get("limit").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = within_appetite(exposure, limit);
    HttpResponse::Ok().json(json!({
        "service": "risk-scoring-rs",
        "endpoint": "risk_appetite_check",
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "risk-scoring-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"risk-scoring-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"risk-scoring-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8124);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("risk-scoring-rs listening on port {}", port);
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
            .route("/v1/score", web::post().to(score_entity))
            .route("/v1/matrix", web::post().to(risk_matrix))
            .route("/v1/appetite", web::post().to(risk_appetite_check))
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
