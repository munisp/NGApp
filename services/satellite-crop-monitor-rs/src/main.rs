use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// satellite-crop-monitor-rs — Satellite-based crop monitoring (NDVI, rainfall)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn ndvi_health(ndvi: f64) -> &'static str {
    if ndvi > 0.6 { "healthy" } else if ndvi > 0.3 { "moderate" } else if ndvi > 0.1 { "stressed" } else { "bare_soil" }
}
fn rainfall_adequacy(actual_mm: f64, expected_mm: f64) -> f64 { if expected_mm == 0.0 { 0.0 } else { actual_mm / expected_mm * 100.0 } }
fn yield_estimate(ndvi_avg: f64, rainfall_pct: f64, baseline_yield: f64) -> f64 { baseline_yield * ndvi_avg * (rainfall_pct / 100.0).min(1.2) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "satellite-crop-monitor-rs"}))
}

async fn analyze_imagery(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let ndvi = input.get("ndvi").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = ndvi_health(ndvi);
    HttpResponse::Ok().json(json!({
        "service": "satellite-crop-monitor-rs",
        "endpoint": "analyze_imagery",
        "result": json!({"value": format!("{:?}", result)}),
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "satellite-crop-monitor-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8180);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("satellite-crop-monitor-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/analyze_imagery", web::post().to(analyze_imagery))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
