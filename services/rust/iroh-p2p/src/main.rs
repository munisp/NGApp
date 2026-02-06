use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};

mod p2p_payments;
mod wallet_sync;
mod agent_banking;
mod fraud_detection;
mod kyc_transfer;
mod merchant_mesh;
mod persistence;
mod types;

use persistence::{LocalStore, PersistenceStats};
use types::*;

struct AppState {
    p2p_payments: p2p_payments::P2PPaymentService,
    wallet_sync: wallet_sync::WalletSyncService,
    agent_banking: agent_banking::AgentBankingService,
    fraud_detection: fraud_detection::FraudDetectionService,
    kyc_transfer: kyc_transfer::KycTransferService,
    merchant_mesh: merchant_mesh::MerchantMeshService,
    store: Arc<LocalStore>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "iroh_p2p=info".into()),
        )
        .init();

    info!("Starting Iroh P2P Fintech Service with robustness layer...");
    info!("Features: persistent storage, balance reservation, CRDT conflict resolution, offline limits, idempotency");

    let store = Arc::new(LocalStore::new(10_000));

    let p2p_payments = p2p_payments::P2PPaymentService::new(store.clone()).await?;
    let wallet_sync = wallet_sync::WalletSyncService::new(store.clone()).await?;
    let agent_banking = agent_banking::AgentBankingService::new(store.clone()).await?;
    let fraud_detection = fraud_detection::FraudDetectionService::new(store.clone()).await?;
    let kyc_transfer = kyc_transfer::KycTransferService::new(store.clone()).await?;
    let merchant_mesh = merchant_mesh::MerchantMeshService::new(store.clone()).await?;

    let state = Arc::new(AppState {
        p2p_payments,
        wallet_sync,
        agent_banking,
        fraud_detection,
        kyc_transfer,
        merchant_mesh,
        store,
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/p2p/transfer", post(initiate_p2p_transfer))
        .route("/api/v1/p2p/transfer/status/:id", get(get_transfer_status))
        .route("/api/v1/p2p/peers", get(list_connected_peers))
        .route("/api/v1/p2p/peers/discover", post(discover_peer))
        .route("/api/v1/wallet/sync", post(sync_wallet))
        .route("/api/v1/wallet/state", get(get_wallet_state))
        .route("/api/v1/wallet/devices", get(list_synced_devices))
        .route("/api/v1/agent/submit", post(agent_submit_transaction))
        .route("/api/v1/agent/queue", get(get_offline_queue))
        .route("/api/v1/agent/sync", post(force_agent_sync))
        .route("/api/v1/fraud/alert", post(broadcast_fraud_alert))
        .route("/api/v1/fraud/alerts", get(get_fraud_alerts))
        .route("/api/v1/fraud/subscribe", post(subscribe_fraud_topic))
        .route("/api/v1/kyc/upload", post(upload_kyc_document))
        .route("/api/v1/kyc/transfer/:id", get(get_transfer_progress))
        .route("/api/v1/kyc/verify/:hash", get(verify_document))
        .route("/api/v1/merchant/register", post(register_merchant))
        .route("/api/v1/merchant/discover", get(discover_merchants))
        .route("/api/v1/merchant/transact", post(merchant_transact))
        .route("/api/v1/metrics", get(get_metrics))
        .route("/api/v1/persistence/stats", get(get_persistence_stats))
        .route("/api/v1/persistence/pending", get(get_pending_sync))
        .route("/api/v1/persistence/limits", get(get_offline_limits))
        .route("/api/v1/persistence/reservations", get(get_active_reservations))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8121".to_string());
    let addr = format!("0.0.0.0:{}", port);
    info!("Iroh P2P service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "iroh-p2p-fintech".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        protocols: vec![
            "p2p-payments".to_string(),
            "wallet-sync".to_string(),
            "agent-banking".to_string(),
            "fraud-detection".to_string(),
            "kyc-transfer".to_string(),
            "merchant-mesh".to_string(),
        ],
    })
}

async fn initiate_p2p_transfer(
    State(state): State<Arc<AppState>>,
    Json(req): Json<P2PTransferRequest>,
) -> Result<Json<P2PTransferResponse>, StatusCode> {
    state.p2p_payments.initiate_transfer(req).await
        .map(Json)
        .map_err(|e| { warn!("P2P transfer failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn get_transfer_status(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<P2PTransferStatus>, StatusCode> {
    state.p2p_payments.get_status(&id).await.map(Json).map_err(|_| StatusCode::NOT_FOUND)
}

async fn list_connected_peers(State(state): State<Arc<AppState>>) -> Json<PeersResponse> {
    Json(state.p2p_payments.list_peers().await)
}

async fn discover_peer(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DiscoverPeerRequest>,
) -> Result<Json<PeerInfo>, StatusCode> {
    state.p2p_payments.discover_peer(&req.public_key).await.map(Json).map_err(|_| StatusCode::NOT_FOUND)
}

async fn sync_wallet(
    State(state): State<Arc<AppState>>,
    Json(req): Json<WalletSyncRequest>,
) -> Result<Json<WalletSyncResponse>, StatusCode> {
    state.wallet_sync.sync(req).await
        .map(Json)
        .map_err(|e| { warn!("Wallet sync failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn get_wallet_state(State(state): State<Arc<AppState>>) -> Json<WalletState> {
    Json(state.wallet_sync.get_state().await)
}

async fn list_synced_devices(State(state): State<Arc<AppState>>) -> Json<Vec<DeviceInfo>> {
    Json(state.wallet_sync.list_devices().await)
}

async fn agent_submit_transaction(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AgentTransaction>,
) -> Result<Json<AgentTransactionResponse>, StatusCode> {
    state.agent_banking.submit_transaction(req).await
        .map(Json)
        .map_err(|e| { warn!("Agent transaction failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn get_offline_queue(State(state): State<Arc<AppState>>) -> Json<OfflineQueueResponse> {
    Json(state.agent_banking.get_queue().await)
}

async fn force_agent_sync(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SyncResult>, StatusCode> {
    state.agent_banking.force_sync().await
        .map(Json)
        .map_err(|e| { warn!("Agent sync failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn broadcast_fraud_alert(
    State(state): State<Arc<AppState>>,
    Json(req): Json<FraudAlert>,
) -> Result<Json<FraudAlertResponse>, StatusCode> {
    state.fraud_detection.broadcast_alert(req).await
        .map(Json)
        .map_err(|e| { warn!("Fraud alert broadcast failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn get_fraud_alerts(State(state): State<Arc<AppState>>) -> Json<Vec<FraudAlert>> {
    Json(state.fraud_detection.get_alerts().await)
}

async fn subscribe_fraud_topic(
    State(state): State<Arc<AppState>>,
    Json(req): Json<FraudSubscribeRequest>,
) -> Result<Json<FraudSubscribeResponse>, StatusCode> {
    state.fraud_detection.subscribe(&req.topic).await
        .map(Json)
        .map_err(|e| { warn!("Fraud topic subscribe failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn upload_kyc_document(
    State(state): State<Arc<AppState>>,
    Json(req): Json<KycUploadRequest>,
) -> Result<Json<KycUploadResponse>, StatusCode> {
    state.kyc_transfer.upload_document(req).await
        .map(Json)
        .map_err(|e| { warn!("KYC upload failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn get_transfer_progress(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<TransferProgress>, StatusCode> {
    state.kyc_transfer.get_progress(&id).await.map(Json).map_err(|_| StatusCode::NOT_FOUND)
}

async fn verify_document(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(hash): axum::extract::Path<String>,
) -> Result<Json<DocumentVerification>, StatusCode> {
    state.kyc_transfer.verify_document(&hash).await.map(Json).map_err(|_| StatusCode::NOT_FOUND)
}

async fn register_merchant(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MerchantRegistration>,
) -> Result<Json<MerchantInfo>, StatusCode> {
    state.merchant_mesh.register(req).await
        .map(Json)
        .map_err(|e| { warn!("Merchant registration failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn discover_merchants(State(state): State<Arc<AppState>>) -> Json<Vec<MerchantInfo>> {
    Json(state.merchant_mesh.discover().await)
}

async fn merchant_transact(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MerchantTransaction>,
) -> Result<Json<MerchantTransactionResponse>, StatusCode> {
    state.merchant_mesh.transact(req).await
        .map(Json)
        .map_err(|e| { warn!("Merchant transaction failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })
}

async fn get_metrics(State(state): State<Arc<AppState>>) -> Json<ServiceMetrics> {
    Json(ServiceMetrics {
        p2p_transfers: state.p2p_payments.get_stats().await,
        wallet_syncs: state.wallet_sync.get_stats().await,
        agent_transactions: state.agent_banking.get_stats().await,
        fraud_alerts: state.fraud_detection.get_stats().await,
        kyc_transfers: state.kyc_transfer.get_stats().await,
        merchant_transactions: state.merchant_mesh.get_stats().await,
    })
}

async fn get_persistence_stats(State(state): State<Arc<AppState>>) -> Json<PersistenceStats> {
    Json(state.store.get_stats().await)
}

async fn get_pending_sync(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let pending = state.store.get_pending_sync().await;
    Json(serde_json::json!({ "pending_count": pending.len(), "records": pending }))
}

async fn get_offline_limits(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "limits": state.store.get_offline_limits() }))
}

async fn get_active_reservations(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let reservations = state.store.get_active_reservations();
    Json(serde_json::json!({ "active_count": reservations.len(), "reservations": reservations }))
}
