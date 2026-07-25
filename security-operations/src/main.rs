//! Security Operations / SIEM Service
//!
//! Provides 24/7 security monitoring, threat detection, and incident response.
//! Integrates with: OpenSearch (log storage), Kafka (event streaming),
//! Redis (real-time state), OpenAppSec (WAF), APISIX (gateway metrics).

use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use std::sync::Arc;
use tracing_subscriber;

mod handlers;
mod engine;
mod store;
mod integrations;

use engine::SiemEngine;
use store::SecurityStore;

pub struct AppState {
    pub engine: Arc<SiemEngine>,
    pub store: Arc<SecurityStore>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();
    tracing::info!("Security Operations / SIEM Service starting");

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost:5432/ngapp".to_string());
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let kafka_broker = std::env::var("KAFKA_BROKER")
        .unwrap_or_else(|_| "localhost:9092".to_string());
    let opensearch_url = std::env::var("OPENSEARCH_URL")
        .unwrap_or_else(|_| "http://localhost:9200".to_string());

    let store = Arc::new(
        SecurityStore::new(&database_url).await
            .expect("Failed to connect to database")
    );

    let engine = Arc::new(
        SiemEngine::new(
            store.clone(),
            &redis_url,
            &kafka_broker,
            &opensearch_url,
        ).await
    );

    // Start background threat detection
    let engine_clone = engine.clone();
    tokio::spawn(async move {
        engine_clone.start_threat_detection().await;
    });

    // Start log ingestion from Kafka
    let engine_clone2 = engine.clone();
    tokio::spawn(async move {
        engine_clone2.start_log_ingestion().await;
    });

    let state = web::Data::new(AppState { engine, store });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8094".to_string());

    tracing::info!("Listening on port {}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            // Health
            .route("/health", web::get().to(handlers::health_check))
            // Threat detection
            .route("/security/threats/active", web::get().to(handlers::get_active_threats))
            .route("/security/threats/history", web::get().to(handlers::get_threat_history))
            .route("/security/threats/{id}/acknowledge", web::post().to(handlers::acknowledge_threat))
            // Incidents
            .route("/security/incidents", web::get().to(handlers::list_incidents))
            .route("/security/incidents", web::post().to(handlers::create_incident))
            .route("/security/incidents/{id}", web::get().to(handlers::get_incident))
            .route("/security/incidents/{id}/resolve", web::post().to(handlers::resolve_incident))
            // Vulnerability management
            .route("/security/vulnerabilities", web::get().to(handlers::list_vulnerabilities))
            .route("/security/vulnerabilities/scan", web::post().to(handlers::trigger_scan))
            // Compliance
            .route("/security/compliance/iso27001", web::get().to(handlers::get_iso27001_status))
            .route("/security/compliance/pentest", web::get().to(handlers::get_pentest_schedule))
            // Dashboard
            .route("/security/dashboard", web::get().to(handlers::get_dashboard))
            .route("/security/metrics", web::get().to(handlers::get_metrics))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
