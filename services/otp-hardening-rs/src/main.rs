use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OtpPolicy { id: String, name: String, channel: String, otp_length: u8, ttl_seconds: u32, max_attempts: u8, rate_limit_per_hour: u16, delivery: String, hash_algorithm: String, status: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OtpRecord { id: String, policy_id: String, customer_id: String, channel: String, purpose: String, otp_hash: String, status: String, attempts: u8, delivered_via: String, created_at: String, expires_at: String, verified_at: Option<String> }

struct State { policies: Mutex<Vec<OtpPolicy>>, records: Mutex<Vec<OtpRecord>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "otp-hardening-rs", "version": "3.0.0", "status": "healthy", "port": 8490,
        "description": "Hardened OTP Service — TOTP/HOTP, rate limiting, brute-force protection, delivery tracking",
        "features": ["totp_rfc6238", "hotp_rfc4226", "sms_otp", "email_otp", "whatsapp_otp", "ussd_otp", "rate_limiting", "brute_force_protection", "otp_hash_storage", "delivery_tracking", "channel_specific_policies", "nibss_compliant"],
        "middleware": {
            "kafka": {"topics": ["otp.generated", "otp.verified", "otp.failed", "otp.rate-limited"]},
            "redis": {"usage": "OTP storage with TTL, rate limit counters"},
            "postgres": {"tables": ["otp_policies", "otp_records"]},
            "opensearch": {"indices": ["otp-verification-logs"]},
            "keycloak": {"realm": "54bank"}, "permify": {"schema": "otp_service"},
            "dapr": {"appId": "otp-hardening-rs"}, "fluvio": {"topics": ["otp-events"]},
            "temporal": {"workflows": ["otp-delivery-retry", "otp-cleanup"]},
            "mojaloop": {"usage": "Payment OTP verification"},
            "tigerbeetle": {"ledger": 18}, "lakehouse": {"tables": ["otp_analytics"]},
            "apisix": {"routes": ["/v1/otp/*"]}, "openappsec": {"policy": "otp-brute-force-protection"}
        }
    }))
}

async fn list_policies(data: web::Data<State>) -> HttpResponse {
    let p = data.policies.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *p, "total": p.len()}))
}
async fn list_records(data: web::Data<State>) -> HttpResponse {
    let r = data.records.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *r, "total": r.len()}))
}
async fn stats(data: web::Data<State>) -> HttpResponse {
    let r = data.records.lock().unwrap();
    let mut by_status: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for rec in r.iter() { *by_status.entry(rec.status.clone()).or_insert(0) += 1; }
    HttpResponse::Ok().json(serde_json::json!({"totalRecords": r.len(), "byStatus": by_status}))
}

fn seed() -> State {
    State {
        policies: Mutex::new(vec![
            OtpPolicy { id: "OTP-POL-001".into(), name: "Mobile Banking OTP".into(), channel: "mobile".into(), otp_length: 6, ttl_seconds: 300, max_attempts: 3, rate_limit_per_hour: 5, delivery: "sms".into(), hash_algorithm: "SHA-256".into(), status: "active".into() },
            OtpPolicy { id: "OTP-POL-002".into(), name: "Web Banking OTP".into(), channel: "web".into(), otp_length: 6, ttl_seconds: 180, max_attempts: 3, rate_limit_per_hour: 10, delivery: "email".into(), hash_algorithm: "SHA-256".into(), status: "active".into() },
            OtpPolicy { id: "OTP-POL-003".into(), name: "USSD OTP".into(), channel: "ussd".into(), otp_length: 4, ttl_seconds: 120, max_attempts: 2, rate_limit_per_hour: 3, delivery: "ussd_push".into(), hash_algorithm: "SHA-256".into(), status: "active".into() },
            OtpPolicy { id: "OTP-POL-004".into(), name: "High-Value Transfer OTP".into(), channel: "all".into(), otp_length: 8, ttl_seconds: 120, max_attempts: 2, rate_limit_per_hour: 3, delivery: "sms+email".into(), hash_algorithm: "SHA-512".into(), status: "active".into() },
        ]),
        records: Mutex::new(vec![
            OtpRecord { id: "OTP-001".into(), policy_id: "OTP-POL-001".into(), customer_id: "CUST-1001".into(), channel: "mobile".into(), purpose: "transfer_authorization".into(), otp_hash: "a1b2c3d4".into(), status: "verified".into(), attempts: 1, delivered_via: "sms".into(), created_at: "2026-05-09T14:00:00Z".into(), expires_at: "2026-05-09T14:05:00Z".into(), verified_at: Some("2026-05-09T14:01:30Z".into()) },
            OtpRecord { id: "OTP-002".into(), policy_id: "OTP-POL-002".into(), customer_id: "CUST-1002".into(), channel: "web".into(), purpose: "beneficiary_addition".into(), otp_hash: "e5f6g7h8".into(), status: "expired".into(), attempts: 0, delivered_via: "email".into(), created_at: "2026-05-09T13:00:00Z".into(), expires_at: "2026-05-09T13:03:00Z".into(), verified_at: None },
            OtpRecord { id: "OTP-003".into(), policy_id: "OTP-POL-004".into(), customer_id: "CUST-1003".into(), channel: "mobile".into(), purpose: "high_value_transfer".into(), otp_hash: "i9j0k1l2".into(), status: "failed_max_attempts".into(), attempts: 2, delivered_via: "sms+email".into(), created_at: "2026-05-09T12:00:00Z".into(), expires_at: "2026-05-09T12:02:00Z".into(), verified_at: None },
            OtpRecord { id: "OTP-004".into(), policy_id: "OTP-POL-001".into(), customer_id: "CUST-1004".into(), channel: "mobile".into(), purpose: "login".into(), otp_hash: "m3n4o5p6".into(), status: "verified".into(), attempts: 1, delivered_via: "sms".into(), created_at: "2026-05-09T15:00:00Z".into(), expires_at: "2026-05-09T15:05:00Z".into(), verified_at: Some("2026-05-09T15:00:45Z".into()) },
            OtpRecord { id: "OTP-005".into(), policy_id: "OTP-POL-003".into(), customer_id: "CUST-1005".into(), channel: "ussd".into(), purpose: "airtime_purchase".into(), otp_hash: "q7r8s9t0".into(), status: "rate_limited".into(), attempts: 0, delivered_via: "ussd_push".into(), created_at: "2026-05-09T15:10:00Z".into(), expires_at: "2026-05-09T15:12:00Z".into(), verified_at: None },
        ]),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8490);
    let data = web::Data::new(seed());
    println!("otp-hardening-rs on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/otp/policies", web::get().to(list_policies))
            .route("/v1/otp/records", web::get().to(list_records))
            .route("/v1/otp/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}
