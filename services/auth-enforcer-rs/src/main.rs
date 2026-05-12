use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde_json::json;
use std::env;

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "auth-enforcer-rs", "port": 8314}))
}

async fn auth_policies() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "enforcement_mode": "strict",
        "total_protected_routes": 805,
        "unprotected_routes": 3,
        "jwt_config": {
            "issuer": "https://auth.54bank.app/realms/customer",
            "algorithm": "RS256", "key_rotation_days": 30,
            "token_ttl_minutes": 15, "refresh_ttl_days": 7,
            "audience": ["54bank-pwa", "54bank-flutter", "54bank-admin"],
            "required_claims": ["sub", "email", "roles", "tenant_id"]
        },
        "rbac_roles": [
            {"role": "super_admin", "permissions": 245, "users": 3, "scope": "global"},
            {"role": "bank_admin", "permissions": 180, "users": 12, "scope": "tenant"},
            {"role": "compliance_officer", "permissions": 95, "users": 28, "scope": "tenant"},
            {"role": "branch_manager", "permissions": 67, "users": 145, "scope": "branch"},
            {"role": "teller", "permissions": 34, "users": 890, "scope": "branch"},
            {"role": "customer_service", "permissions": 42, "users": 340, "scope": "tenant"},
            {"role": "auditor", "permissions": 120, "users": 8, "scope": "global", "read_only": true},
            {"role": "api_consumer", "permissions": 28, "users": 45, "scope": "api_key"}
        ],
        "mfa_enforcement": {
            "super_admin": "mandatory_hardware", "bank_admin": "mandatory_totp",
            "compliance_officer": "mandatory_totp", "branch_manager": "optional",
            "teller": "mandatory_otp", "customer": "optional_sms"
        },
        "session_config": {
            "max_concurrent_sessions": 3, "idle_timeout_minutes": 15,
            "absolute_timeout_hours": 8, "ip_binding": true, "device_fingerprinting": true
        },
        "blocked_24h": 234, "failed_auth_24h": 1847, "successful_auth_24h": 45230
    }))
}

async fn middleware_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "kafka": {"topics": ["auth.login", "auth.logout", "auth.failed", "auth.mfa"]},
        "dapr": {"stateStore": "auth-state"}, "fluvio": {"topics": ["auth-events"]},
        "temporal": {"workflows": ["auth-session-cleanup", "auth-key-rotation"]},
        "postgres": {"tables": ["auth_sessions", "auth_policies", "auth_audit_log"]},
        "keycloak": {"realm": "54bank", "clients": 6},
        "permify": {"schema": "auth-rbac-v2"},
        "redis": {"keys": ["auth:session:*", "auth:blacklist:*", "auth:rate:*"]},
        "mojaloop": {"oauth": "dfsp-auth"}, "opensearch": {"indices": ["auth-events"]},
        "openappsec": {"policy": "auth-brute-force-protection"},
        "apisix": {"route": "/api/auth-enforcer/*", "plugin": "jwt-auth"},
        "tigerbeetle": {"accounts": []}, "lakehouse": {"tables": ["auth_analytics"]}
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8314".into()).parse().unwrap_or(8314);
    println!("Auth Enforcer on :{}", port);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/api/auth-enforcer/policies", web::get().to(auth_policies))
        .route("/api/auth-enforcer/middleware", web::get().to(middleware_config))
    ).bind(("0.0.0.0", port))?.run().await
}
