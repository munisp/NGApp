use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// wire-transfer-monitor-rs — Wire transfer monitoring and compliance

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn travel_rule_required(amount_usd: f64) -> bool { amount_usd >= 1000.0 }
fn high_risk_corridor(origin: &str, destination: &str) -> bool {
    let high_risk = ["IR", "KP", "SY", "MM", "SD"];
    high_risk.contains(&origin) || high_risk.contains(&destination)
}
fn compute_transfer_risk(amount: f64, corridor_risk: bool, pep: bool) -> f64 {
    let mut risk = (amount / 100000.0 * 20.0).min(40.0);
    if corridor_risk { risk += 35.0; }
    if pep { risk += 25.0; }
    risk.min(100.0)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "wire-transfer-monitor-rs",
        "version": "1.0.0",
        "description": "Wire transfer monitoring and compliance",
    }))
}


async fn monitor_transfer(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "wire-transfer-monitor-rs",
        "endpoint": "monitor_transfer",
        "description": "Monitor wire transfer for compliance flags",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn travel_rule_check(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "wire-transfer-monitor-rs",
        "endpoint": "travel_rule_check",
        "description": "FATF Travel Rule compliance check",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn correspondent_check(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "wire-transfer-monitor-rs",
        "endpoint": "correspondent_check",
        "description": "Verify correspondent bank status",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
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
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8140);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("wire-transfer-monitor-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/monitor", web::post().to(monitor_transfer))
            .route("/v1/travel_rule", web::post().to(travel_rule_check))
            .route("/v1/correspondent", web::post().to(correspondent_check))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
