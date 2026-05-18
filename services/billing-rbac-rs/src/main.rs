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

async fn check_permission(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let role_s = input.get("role").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let role = role_s.as_str();
    let action_s = input.get("action").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let action = action_s.as_str();
    let result = has_permission(role, action);
    HttpResponse::Ok().json(json!({
        "service": "billing-rbac-rs",
        "endpoint": "check_permission",
        "result": json!({"value": result}),
    }))
}

async fn assign_role(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let role_s = input.get("role").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let role = role_s.as_str();
    let result = role_hierarchy(role);
    HttpResponse::Ok().json(json!({
        "service": "billing-rbac-rs",
        "endpoint": "assign_role",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn audit_access(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let role_s = input.get("role").and_then(|v| v.as_str()).unwrap_or("viewer").to_string();
    let actions = input.get("actions").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|x| x.as_str().map(String::from)).collect::<Vec<_>>()
    }).unwrap_or_default();
    let audit: Vec<serde_json::Value> = actions.iter().map(|action| {
        let allowed = has_permission(&role_s, action);
        let level = role_hierarchy(&role_s);
        json!({"action": action, "allowed": allowed, "role_level": level})
    }).collect();
    HttpResponse::Ok().json(json!({
        "service": "billing-rbac-rs",
        "endpoint": "audit_access",
        "result": {"audit": audit, "role": role_s},
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
