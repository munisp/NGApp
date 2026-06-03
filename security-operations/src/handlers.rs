//! HTTP handlers for security operations API.

use actix_web::{web, HttpResponse};
use serde_json::json;

use crate::AppState;

pub async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "security-operations"}))
}

pub async fn get_active_threats(state: web::Data<AppState>) -> HttpResponse {
    let threats = state.engine.get_active_threats().await;
    HttpResponse::Ok().json(json!({"threats": threats, "total": threats.len()}))
}

pub async fn get_threat_history() -> HttpResponse {
    HttpResponse::Ok().json(json!({"threats": [], "total": 0}))
}

pub async fn acknowledge_threat(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    HttpResponse::Ok().json(json!({"id": id, "status": "acknowledged"}))
}

pub async fn list_incidents() -> HttpResponse {
    HttpResponse::Ok().json(json!({"incidents": [], "total": 0}))
}

pub async fn create_incident(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Created().json(json!({
        "id": "generated-uuid",
        "status": "created",
        "title": body.get("title").and_then(|v| v.as_str()).unwrap_or(""),
    }))
}

pub async fn get_incident(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    HttpResponse::Ok().json(json!({"id": id, "status": "open"}))
}

pub async fn resolve_incident(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    HttpResponse::Ok().json(json!({"id": id, "status": "resolved"}))
}

pub async fn list_vulnerabilities() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "vulnerabilities": [],
        "total": 0,
        "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0}
    }))
}

pub async fn trigger_scan() -> HttpResponse {
    HttpResponse::Accepted().json(json!({"status": "scan_initiated", "type": "full"}))
}

pub async fn get_iso27001_status() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "framework": "ISO 27001:2022",
        "overall_progress": 0.45,
        "controls_implemented": 52,
        "controls_total": 114,
        "domains": [
            {"domain": "A.5 Information Security Policies", "status": "partial", "progress": 0.6},
            {"domain": "A.6 Organization of Information Security", "status": "partial", "progress": 0.4},
            {"domain": "A.7 Human Resource Security", "status": "not_started", "progress": 0.1},
            {"domain": "A.8 Asset Management", "status": "partial", "progress": 0.5},
            {"domain": "A.9 Access Control", "status": "implemented", "progress": 0.8},
            {"domain": "A.10 Cryptography", "status": "partial", "progress": 0.6},
            {"domain": "A.11 Physical Security", "status": "not_applicable", "progress": 0.0},
            {"domain": "A.12 Operations Security", "status": "partial", "progress": 0.5},
            {"domain": "A.13 Communications Security", "status": "partial", "progress": 0.4},
            {"domain": "A.14 System Development", "status": "implemented", "progress": 0.7},
        ],
        "next_audit_date": "2026-12-01",
        "certification_target": "2027-Q2"
    }))
}

pub async fn get_pentest_schedule() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "schedule": [
            {"type": "External Network Pentest", "frequency": "bi-annual", "next_date": "2026-09-01", "vendor": "TBD"},
            {"type": "Web Application Pentest", "frequency": "bi-annual", "next_date": "2026-09-01", "vendor": "TBD"},
            {"type": "API Security Assessment", "frequency": "annual", "next_date": "2026-12-01", "vendor": "TBD"},
            {"type": "Social Engineering Test", "frequency": "annual", "next_date": "2027-01-01", "vendor": "TBD"},
        ],
        "last_completed": null,
        "naicom_compliant": false,
        "note": "NAICOM requires penetration testing at least twice yearly"
    }))
}

pub async fn get_dashboard(state: web::Data<AppState>) -> HttpResponse {
    let dashboard = state.engine.get_dashboard().await;
    HttpResponse::Ok().json(dashboard)
}

pub async fn get_metrics(state: web::Data<AppState>) -> HttpResponse {
    let metrics = state.engine.get_metrics().await;
    HttpResponse::Ok().json(metrics)
}
