//! Zero-Trust Network Policy Enforcement Service
//!
//! Implements zero-trust architecture principles:
//! - Never trust, always verify
//! - Least privilege access
//! - Assume breach
//! - Verify explicitly (identity, device, location)
//!
//! Integrates with: APISIX (gateway policy), Permify (fine-grained authz),
//! Redis (session/token cache), Keycloak (identity provider)

use actix_web::{web, App, HttpServer, HttpResponse};
use std::sync::Arc;

mod handlers;
mod policy;
mod mtls;

use policy::PolicyEngine;

pub struct AppState {
    pub policy_engine: Arc<PolicyEngine>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();
    tracing::info!("Zero-Trust Network Service starting");

    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let permify_url = std::env::var("PERMIFY_URL")
        .unwrap_or_else(|_| "http://localhost:3476".to_string());
    let apisix_admin_url = std::env::var("APISIX_ADMIN_URL")
        .unwrap_or_else(|_| "http://localhost:9180".to_string());
    let keycloak_url = std::env::var("KEYCLOAK_URL")
        .unwrap_or_else(|_| "http://localhost:8080".to_string());

    let policy_engine = Arc::new(
        PolicyEngine::new(&redis_url, &permify_url, &apisix_admin_url, &keycloak_url)
    );

    let state = web::Data::new(AppState { policy_engine });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8096".to_string());

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/health", web::get().to(handlers::health_check))
            // Policy management
            .route("/zt/policies", web::get().to(handlers::list_policies))
            .route("/zt/policies", web::post().to(handlers::create_policy))
            .route("/zt/policies/{id}", web::get().to(handlers::get_policy))
            .route("/zt/policies/{id}", web::delete().to(handlers::delete_policy))
            // Access decisions
            .route("/zt/authorize", web::post().to(handlers::authorize_request))
            .route("/zt/verify-device", web::post().to(handlers::verify_device))
            .route("/zt/verify-location", web::post().to(handlers::verify_location))
            // mTLS certificate management
            .route("/zt/certificates", web::get().to(handlers::list_certificates))
            .route("/zt/certificates/issue", web::post().to(handlers::issue_certificate))
            .route("/zt/certificates/{id}/revoke", web::post().to(handlers::revoke_certificate))
            // Network segmentation
            .route("/zt/segments", web::get().to(handlers::list_segments))
            .route("/zt/segments", web::post().to(handlers::create_segment))
            // APISIX integration
            .route("/zt/apisix/sync", web::post().to(handlers::sync_apisix_policies))
            .route("/zt/apisix/routes", web::get().to(handlers::get_apisix_routes))
            // Permify integration
            .route("/zt/permify/check", web::post().to(handlers::check_permission))
            // Dashboard
            .route("/zt/dashboard", web::get().to(handlers::get_dashboard))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
