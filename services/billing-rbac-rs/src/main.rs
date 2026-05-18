use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// billing-rbac-rs — Billing role-based access control

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn has_permission(role: &str, action: &str) -> bool {
    match (role, action) {
        ("admin", _) => true,
        ("manager", "approve_discount") | ("manager", "view_reports") | ("manager", "rate_override") => true,
        ("agent", "view_bills") | ("agent", "rate_transaction") => true,
        ("viewer", "view_bills") | ("viewer", "view_reports") => true,
        _ => false,
    }
}
fn role_hierarchy(role: &str) -> u8 { match role { "admin" => 4, "manager" => 3, "agent" => 2, "viewer" => 1, _ => 0 } }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "billing-rbac-rs",
        "version": "1.0.0",
        "description": "Billing role-based access control",
    }))
}


async fn check_permission(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "billing-rbac-rs",
        "endpoint": "check_permission",
        "description": "Check billing permission for user/role",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn assign_role(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "billing-rbac-rs",
        "endpoint": "assign_role",
        "description": "Assign billing role to user",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn audit_access(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "billing-rbac-rs",
        "endpoint": "audit_access",
        "description": "Audit billing access logs",
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8162);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("billing-rbac-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/check", web::post().to(check_permission))
            .route("/v1/assign", web::post().to(assign_role))
            .route("/v1/audit", web::post().to(audit_access))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
