#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// fraudfusion-ensemble-rs — Multi-model fraud ensemble scoring

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn ensemble_weighted_avg(scores: &[(f64, f64)]) -> f64 {
    let total_w: f64 = scores.iter().map(|(_, w)| w).sum();
    if total_w == 0.0 { return 0.0; }
    scores.iter().map(|(s, w)| s * w).sum::<f64>() / total_w
}
fn ensemble_max(scores: &[f64]) -> f64 { scores.iter().cloned().fold(0.0, f64::max) }
fn ensemble_voting(scores: &[f64], threshold: f64) -> (u32, u32) {
    let fraud = scores.iter().filter(|&&s| s >= threshold).count() as u32;
    (fraud, scores.len() as u32 - fraud)
}
fn f1_score(precision: f64, recall: f64) -> f64 {
    if precision + recall == 0.0 { 0.0 } else { 2.0 * precision * recall / (precision + recall) }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fraudfusion-ensemble-rs",
        "version": "1.0.0",
        "description": "Multi-model fraud ensemble scoring",
    }))
}

async fn ensemble_score(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let scores: Vec<(f64, f64)> = input.get("models").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|m| {
            let score = m.get("score").and_then(|s| s.as_f64())?;
            let weight = m.get("weight").and_then(|w| w.as_f64()).unwrap_or(1.0);
            Some((score, weight))
        }).collect()
    }).unwrap_or_default();
    let weighted_avg = ensemble_weighted_avg(&scores);
    let all_scores: Vec<f64> = scores.iter().map(|(s, _)| *s).collect();
    let max_score = ensemble_max(&all_scores);
    let threshold = input.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.5);
    let (fraud_votes, legit_votes) = ensemble_voting(&all_scores, threshold);
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "ensemble_score",
        "result": {"weighted_avg": weighted_avg, "max_score": max_score, "fraud_votes": fraud_votes, "legit_votes": legit_votes},
    }))
}

async fn model_performance(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let scores_v: Vec<f64> = input.get("scores").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let scores = scores_v.as_slice();
    let result = ensemble_max(scores);
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "model_performance",
        "result": json!({"value": result}),
    }))
}

async fn threshold_optimize(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let scores_v: Vec<f64> = input.get("scores").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let scores = scores_v.as_slice();
    let threshold = input.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = ensemble_voting(scores, threshold);
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "threshold_optimize",
        "result": json!({"value": format!("{:?}", result)}),
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "fraudfusion-ensemble-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"fraudfusion-ensemble-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"fraudfusion-ensemble-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8123);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("fraudfusion-ensemble-rs listening on port {}", port);
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
            .route("/v1/ensemble", web::post().to(ensemble_score))
            .route("/v1/model_stats", web::post().to(model_performance))
            .route("/v1/optimize", web::post().to(threshold_optimize))
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
