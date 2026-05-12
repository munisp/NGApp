use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionRecord { id: String, customer_id: String, channel: String, device_fingerprint: String, ip_address: String, geo_location: String, status: String, mfa_level: String, risk_score: f32, created_at: String, last_activity: String, expires_at: String, terminated_reason: Option<String> }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionPolicy { id: String, channel: String, max_idle_minutes: u32, max_duration_hours: u32, require_mfa: bool, concurrent_sessions: u8, geo_restriction: String, device_binding: bool }

struct State { sessions: Mutex<Vec<SessionRecord>>, policies: Mutex<Vec<SessionPolicy>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "session-security-rs", "version": "3.0.0", "status": "healthy", "port": 8491,
        "description": "Session Security — Device fingerprinting, geo-fencing, concurrent session control, step-up auth",
        "features": ["device_fingerprinting", "geo_fencing", "concurrent_session_control", "session_hijack_detection", "step_up_authentication", "idle_timeout", "absolute_timeout", "ip_reputation_check", "risk_based_session_duration"],
        "middleware": {
            "kafka": {"topics": ["session.created", "session.terminated", "session.suspicious", "session.step-up-required"]},
            "redis": {"usage": "Active session store, device fingerprint cache"},
            "postgres": {"tables": ["session_records", "session_policies"]},
            "opensearch": {"indices": ["session-events"]},
            "keycloak": {"realm": "54bank"}, "permify": {"schema": "session"},
            "dapr": {"appId": "session-security-rs"}, "fluvio": {"topics": ["session-events-stream"]},
            "temporal": {"workflows": ["session-cleanup", "suspicious-session-investigation"]},
            "mojaloop": {"usage": "Payment session binding"},
            "tigerbeetle": {"ledger": 19}, "lakehouse": {"tables": ["session_analytics"]},
            "apisix": {"routes": ["/v1/sessions/*"]}, "openappsec": {"policy": "session-hijack-prevention"}
        }
    }))
}

async fn list_sessions(data: web::Data<State>) -> HttpResponse {
    let s = data.sessions.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *s, "total": s.len()}))
}
async fn list_policies(data: web::Data<State>) -> HttpResponse {
    let p = data.policies.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *p, "total": p.len()}))
}
async fn stats(data: web::Data<State>) -> HttpResponse {
    let s = data.sessions.lock().unwrap();
    let mut by_channel: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    let mut by_status: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for sess in s.iter() { *by_channel.entry(sess.channel.clone()).or_insert(0) += 1; *by_status.entry(sess.status.clone()).or_insert(0) += 1; }
    HttpResponse::Ok().json(serde_json::json!({"totalSessions": s.len(), "byChannel": by_channel, "byStatus": by_status}))
}

fn seed() -> State {
    State {
        sessions: Mutex::new(vec![
            SessionRecord { id: "SESS-001".into(), customer_id: "CUST-1001".into(), channel: "mobile".into(), device_fingerprint: "fp-iphone15-a1b2c3".into(), ip_address: "105.112.45.67".into(), geo_location: "Lagos, NG".into(), status: "active".into(), mfa_level: "pin+biometric".into(), risk_score: 0.12, created_at: "2026-05-09T14:00:00Z".into(), last_activity: "2026-05-09T15:10:00Z".into(), expires_at: "2026-05-09T16:00:00Z".into(), terminated_reason: None },
            SessionRecord { id: "SESS-002".into(), customer_id: "CUST-1002".into(), channel: "web".into(), device_fingerprint: "fp-chrome-d4e5f6".into(), ip_address: "197.210.78.90".into(), geo_location: "Abuja, NG".into(), status: "active".into(), mfa_level: "password+otp".into(), risk_score: 0.25, created_at: "2026-05-09T13:30:00Z".into(), last_activity: "2026-05-09T15:05:00Z".into(), expires_at: "2026-05-09T17:30:00Z".into(), terminated_reason: None },
            SessionRecord { id: "SESS-003".into(), customer_id: "CUST-1003".into(), channel: "ussd".into(), device_fingerprint: "fp-sim-g7h8i9".into(), ip_address: "10.0.0.1".into(), geo_location: "Kano, NG".into(), status: "expired".into(), mfa_level: "pin".into(), risk_score: 0.08, created_at: "2026-05-09T10:00:00Z".into(), last_activity: "2026-05-09T10:15:00Z".into(), expires_at: "2026-05-09T10:30:00Z".into(), terminated_reason: Some("idle_timeout".into()) },
            SessionRecord { id: "SESS-004".into(), customer_id: "CUST-1004".into(), channel: "mobile".into(), device_fingerprint: "fp-android-j0k1l2".into(), ip_address: "41.58.112.33".into(), geo_location: "London, UK".into(), status: "terminated".into(), mfa_level: "pin+otp".into(), risk_score: 0.85, created_at: "2026-05-09T12:00:00Z".into(), last_activity: "2026-05-09T12:05:00Z".into(), expires_at: "2026-05-09T14:00:00Z".into(), terminated_reason: Some("geo_anomaly_detected".into()) },
            SessionRecord { id: "SESS-005".into(), customer_id: "CUST-1001".into(), channel: "web".into(), device_fingerprint: "fp-safari-m3n4o5".into(), ip_address: "105.112.45.67".into(), geo_location: "Lagos, NG".into(), status: "step_up_required".into(), mfa_level: "password".into(), risk_score: 0.55, created_at: "2026-05-09T15:00:00Z".into(), last_activity: "2026-05-09T15:02:00Z".into(), expires_at: "2026-05-09T19:00:00Z".into(), terminated_reason: None },
        ]),
        policies: Mutex::new(vec![
            SessionPolicy { id: "SP-001".into(), channel: "mobile".into(), max_idle_minutes: 15, max_duration_hours: 8, require_mfa: true, concurrent_sessions: 2, geo_restriction: "NG,GB,US".into(), device_binding: true },
            SessionPolicy { id: "SP-002".into(), channel: "web".into(), max_idle_minutes: 10, max_duration_hours: 4, require_mfa: true, concurrent_sessions: 1, geo_restriction: "NG,GB,US".into(), device_binding: false },
            SessionPolicy { id: "SP-003".into(), channel: "ussd".into(), max_idle_minutes: 3, max_duration_hours: 1, require_mfa: false, concurrent_sessions: 1, geo_restriction: "NG".into(), device_binding: true },
        ]),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8491);
    let data = web::Data::new(seed());
    println!("session-security-rs on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/sessions", web::get().to(list_sessions))
            .route("/v1/sessions/policies", web::get().to(list_policies))
            .route("/v1/sessions/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}
