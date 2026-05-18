#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// rate-cascade-rs — Rate cascade/waterfall engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


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


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "rate-cascade-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"rate-cascade-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"rate-cascade-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8199);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("rate-cascade-rs on port {}", port);
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
            .route("/v1/cascade_rate", web::post().to(cascade_rate))
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
