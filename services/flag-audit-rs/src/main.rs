use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// flag-audit-rs — Feature flag audit trail

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn change_type(old: bool, new: bool) -> &'static str { match (old, new) { (false, true) => "enabled", (true, false) => "disabled", _ => "unchanged" } }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "flag-audit-rs"}))
}

async fn audit_change(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let old = input.get("old").and_then(|v| v.as_bool()).unwrap_or(false);
    let new = input.get("new").and_then(|v| v.as_bool()).unwrap_or(false);
    let result = change_type(old, new);
    HttpResponse::Ok().json(json!({
        "service": "flag-audit-rs",
        "endpoint": "audit_change",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "flag-audit-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8216);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("flag-audit-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/audit_change", web::post().to(audit_change))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
