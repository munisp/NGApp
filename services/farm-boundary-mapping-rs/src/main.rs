use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// farm-boundary-mapping-rs — Farm boundary GIS mapping

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn compute_area_hectares(coords: &[(f64, f64)]) -> f64 {
    let n = coords.len(); if n < 3 { return 0.0; }
    let mut area = 0.0;
    for i in 0..n { let j = (i + 1) % n; area += coords[i].0 * coords[j].1 - coords[j].0 * coords[i].1; }
    (area.abs() / 2.0) * 111.32 * 111.32 / 10000.0
}
fn valid_polygon(coords: &[(f64, f64)]) -> bool { coords.len() >= 3 }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "farm-boundary-mapping-rs"}))
}

async fn map_boundary(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    HttpResponse::Ok().json(json!({"service": "farm-boundary-mapping-rs", "action": "map_boundary", "processed": true, "input": input}))
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "farm-boundary-mapping-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8174);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("farm-boundary-mapping-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/map_boundary", web::post().to(map_boundary))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
