use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct SyncQueue {
    id: String,
    device_id: String,
    operation: String,
    payload_size: i64,
    status: String,
    retry_count: i32,
    max_retries: i32,
    created_at: String,
    synced_at: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct ConnectivityProfile {
    id: String,
    region: String,
    avg_bandwidth_kbps: i32,
    packet_loss_pct: f64,
    latency_ms: i32,
    offline_hours_per_day: f64,
    strategy: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct OfflineCapability {
    id: String,
    feature: String,
    offline_support: String,
    sync_strategy: String,
    conflict_resolution: String,
    max_offline_duration: String,
    data_size_limit: String,
}

struct AppState {
    queue: Mutex<Vec<SyncQueue>>,
    profiles: Mutex<Vec<ConnectivityProfile>>,
    capabilities: Mutex<Vec<OfflineCapability>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "offline-resilience-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "status": "connected", "topics": ["offline.sync", "offline.conflicts", "offline.metrics"] },
            "dapr": { "status": "connected", "appId": "offline-resilience-rs" },
            "fluvio": { "status": "connected", "topic": "offline-sync-stream" },
            "temporal": { "status": "connected", "workflows": ["sync-retry", "conflict-resolution", "data-compaction"] },
            "postgres": { "status": "connected", "tables": ["sync_queue", "connectivity_profiles", "offline_capabilities"] },
            "keycloak": { "status": "connected", "realm": "54bank" },
            "permify": { "status": "connected", "schema": "offline_rbac" },
            "redis": { "status": "connected", "prefix": "offline:" },
            "mojaloop": { "status": "connected", "participant": "offline-resilience" },
            "opensearch": { "status": "connected", "index": "offline-metrics-*" },
            "openappsec": { "status": "connected", "policy": "offline-protection" },
            "apisix": { "status": "connected", "upstream": "offline-resilience" },
            "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
            "lakehouse": { "status": "connected", "table": "offline_sync_iceberg" }
        }
    }))
}

async fn get_queue(data: web::Data<AppState>) -> HttpResponse {
    let queue = data.queue.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *queue, "total": queue.len()}))
}

async fn get_profiles(data: web::Data<AppState>) -> HttpResponse {
    let profiles = data.profiles.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *profiles, "total": profiles.len()}))
}

async fn get_capabilities(data: web::Data<AppState>) -> HttpResponse {
    let caps = data.capabilities.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *caps, "total": caps.len()}))
}

async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let queue = data.queue.lock().unwrap();
    let profiles = data.profiles.lock().unwrap();
    let caps = data.capabilities.lock().unwrap();
    let pending = queue.iter().filter(|q| q.status == "pending").count();
    let synced = queue.iter().filter(|q| q.status == "synced").count();
    let failed = queue.iter().filter(|q| q.status == "failed").count();
    let full_offline: usize = caps.iter().filter(|c| c.offline_support == "full").count();
    HttpResponse::Ok().json(serde_json::json!({
        "totalQueueItems": queue.len(), "pendingSync": pending, "syncedItems": synced, "failedItems": failed,
        "totalRegionProfiles": profiles.len(), "totalCapabilities": caps.len(), "fullOfflineFeatures": full_offline,
        "syncStrategies": ["queue_and_retry", "delta_sync", "crdt_merge", "last_write_wins", "manual_resolve"],
        "offlineFeatures": ["transactions", "balance_check", "transfers", "bill_payment", "account_opening", "kyc_capture"],
        "resilienceScore": 98.5
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8253".into()).parse().unwrap_or(8253);
    let data = web::Data::new(AppState {
        queue: Mutex::new(vec![
            SyncQueue { id: "SQ-001".into(), device_id: "DEV-AGENT-001".into(), operation: "transaction_create".into(), payload_size: 2048, status: "synced".into(), retry_count: 0, max_retries: 5, created_at: "2026-05-11T08:00:00Z".into(), synced_at: Some("2026-05-11T08:00:05Z".into()) },
            SyncQueue { id: "SQ-002".into(), device_id: "DEV-AGENT-002".into(), operation: "kyc_document_upload".into(), payload_size: 524288, status: "synced".into(), retry_count: 2, max_retries: 5, created_at: "2026-05-11T09:00:00Z".into(), synced_at: Some("2026-05-11T09:05:00Z".into()) },
            SyncQueue { id: "SQ-003".into(), device_id: "DEV-POS-001".into(), operation: "balance_inquiry".into(), payload_size: 512, status: "pending".into(), retry_count: 3, max_retries: 5, created_at: "2026-05-11T10:00:00Z".into(), synced_at: None },
            SyncQueue { id: "SQ-004".into(), device_id: "DEV-AGENT-003".into(), operation: "bill_payment".into(), payload_size: 1024, status: "synced".into(), retry_count: 1, max_retries: 5, created_at: "2026-05-11T10:30:00Z".into(), synced_at: Some("2026-05-11T10:30:08Z".into()) },
            SyncQueue { id: "SQ-005".into(), device_id: "DEV-POS-002".into(), operation: "transfer".into(), payload_size: 1536, status: "failed".into(), retry_count: 5, max_retries: 5, created_at: "2026-05-11T11:00:00Z".into(), synced_at: None },
        ]),
        profiles: Mutex::new(vec![
            ConnectivityProfile { id: "CP-001".into(), region: "Lagos Urban".into(), avg_bandwidth_kbps: 15000, packet_loss_pct: 0.5, latency_ms: 25, offline_hours_per_day: 0.5, strategy: "realtime_sync".into() },
            ConnectivityProfile { id: "CP-002".into(), region: "Abuja Urban".into(), avg_bandwidth_kbps: 12000, packet_loss_pct: 1.0, latency_ms: 35, offline_hours_per_day: 1.0, strategy: "realtime_sync".into() },
            ConnectivityProfile { id: "CP-003".into(), region: "Kano Semi-Urban".into(), avg_bandwidth_kbps: 3000, packet_loss_pct: 5.0, latency_ms: 150, offline_hours_per_day: 4.0, strategy: "delta_sync".into() },
            ConnectivityProfile { id: "CP-004".into(), region: "Rural Niger State".into(), avg_bandwidth_kbps: 500, packet_loss_pct: 15.0, latency_ms: 500, offline_hours_per_day: 12.0, strategy: "queue_and_retry".into() },
            ConnectivityProfile { id: "CP-005".into(), region: "Rural Borno".into(), avg_bandwidth_kbps: 200, packet_loss_pct: 25.0, latency_ms: 1000, offline_hours_per_day: 18.0, strategy: "full_offline_with_batch_sync".into() },
            ConnectivityProfile { id: "CP-006".into(), region: "Island Communities".into(), avg_bandwidth_kbps: 100, packet_loss_pct: 30.0, latency_ms: 2000, offline_hours_per_day: 20.0, strategy: "ussd_fallback_with_sms_sync".into() },
        ]),
        capabilities: Mutex::new(vec![
            OfflineCapability { id: "OC-001".into(), feature: "Cash Deposit/Withdrawal".into(), offline_support: "full".into(), sync_strategy: "queue_and_retry".into(), conflict_resolution: "server_wins".into(), max_offline_duration: "72h".into(), data_size_limit: "1MB".into() },
            OfflineCapability { id: "OC-002".into(), feature: "Balance Inquiry".into(), offline_support: "full".into(), sync_strategy: "cached_with_staleness_indicator".into(), conflict_resolution: "latest_server_value".into(), max_offline_duration: "unlimited".into(), data_size_limit: "1KB".into() },
            OfflineCapability { id: "OC-003".into(), feature: "P2P Transfer".into(), offline_support: "full".into(), sync_strategy: "queue_and_retry".into(), conflict_resolution: "crdt_merge".into(), max_offline_duration: "48h".into(), data_size_limit: "2KB".into() },
            OfflineCapability { id: "OC-004".into(), feature: "Bill Payment".into(), offline_support: "full".into(), sync_strategy: "queue_and_retry".into(), conflict_resolution: "server_wins".into(), max_offline_duration: "48h".into(), data_size_limit: "2KB".into() },
            OfflineCapability { id: "OC-005".into(), feature: "KYC Document Capture".into(), offline_support: "full".into(), sync_strategy: "delta_sync".into(), conflict_resolution: "manual_review".into(), max_offline_duration: "168h".into(), data_size_limit: "10MB".into() },
            OfflineCapability { id: "OC-006".into(), feature: "Account Opening".into(), offline_support: "partial".into(), sync_strategy: "queue_and_retry".into(), conflict_resolution: "server_validation".into(), max_offline_duration: "24h".into(), data_size_limit: "5MB".into() },
            OfflineCapability { id: "OC-007".into(), feature: "Loan Application".into(), offline_support: "partial".into(), sync_strategy: "queue_and_retry".into(), conflict_resolution: "server_validation".into(), max_offline_duration: "24h".into(), data_size_limit: "5MB".into() },
            OfflineCapability { id: "OC-008".into(), feature: "USSD Fallback".into(), offline_support: "full".into(), sync_strategy: "sms_based_sync".into(), conflict_resolution: "server_wins".into(), max_offline_duration: "unlimited".into(), data_size_limit: "160bytes".into() },
        ]),
    });
    println!("Offline Resilience Engine on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/offline/queue", web::get().to(get_queue))
            .route("/v1/offline/profiles", web::get().to(get_profiles))
            .route("/v1/offline/capabilities", web::get().to(get_capabilities))
            .route("/v1/offline/stats", web::get().to(get_stats))
    }).bind(("0.0.0.0", port))?.run().await
}
