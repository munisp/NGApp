use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub protocols: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct P2PTransferRequest {
    pub sender_id: String,
    pub recipient_public_key: String,
    pub amount: f64,
    pub currency: String,
    pub memo: Option<String>,
    pub offline_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2PTransferResponse {
    pub transfer_id: String,
    pub status: TransferStatus,
    pub sender_id: String,
    pub recipient_id: String,
    pub amount: f64,
    pub currency: String,
    pub connection_type: ConnectionType,
    pub created_at: DateTime<Utc>,
    pub estimated_confirmation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2PTransferStatus {
    pub transfer_id: String,
    pub status: TransferStatus,
    pub confirmations: u32,
    pub connection_type: ConnectionType,
    pub latency_ms: Option<u64>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TransferStatus {
    Pending,
    InTransit,
    Confirmed,
    Failed,
    Queued,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionType {
    Direct,
    Relay,
    Offline,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PeersResponse {
    pub connected_peers: Vec<PeerInfo>,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub public_key: String,
    pub node_id: String,
    pub connection_type: ConnectionType,
    pub latency_ms: Option<u64>,
    pub last_seen: DateTime<Utc>,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscoverPeerRequest {
    pub public_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalletSyncRequest {
    pub device_id: String,
    pub wallet_data: WalletData,
    pub sync_type: SyncType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletData {
    pub balances: Vec<BalanceEntry>,
    pub recent_transactions: Vec<TransactionEntry>,
    pub settings: serde_json::Value,
    pub last_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceEntry {
    pub account_id: String,
    pub currency: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionEntry {
    pub id: String,
    pub amount: f64,
    pub currency: String,
    pub description: String,
    pub category: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncType {
    Full,
    Incremental,
    ConflictResolve,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalletSyncResponse {
    pub sync_id: String,
    pub status: String,
    pub conflicts_resolved: u32,
    pub entries_synced: u32,
    pub sync_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletState {
    pub wallet_data: Option<WalletData>,
    pub synced_devices: usize,
    pub last_sync: Option<DateTime<Utc>>,
    pub version: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub last_sync: DateTime<Utc>,
    pub is_online: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentTransaction {
    pub agent_id: String,
    pub customer_id: String,
    pub transaction_type: AgentTransactionType,
    pub amount: f64,
    pub currency: String,
    pub location: Option<GeoLocation>,
    pub documents: Vec<String>,
    pub offline: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentTransactionType {
    CashDeposit,
    CashWithdrawal,
    AccountOpening,
    KycSubmission,
    BillPayment,
    AirtimePurchase,
    LoanRepayment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy_meters: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentTransactionResponse {
    pub transaction_id: String,
    pub status: String,
    pub queued: bool,
    pub queue_position: Option<u32>,
    pub estimated_sync: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OfflineQueueResponse {
    pub queued_transactions: Vec<QueuedTransaction>,
    pub total_amount: f64,
    pub oldest_entry: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedTransaction {
    pub id: String,
    pub transaction_type: String,
    pub amount: f64,
    pub currency: String,
    pub queued_at: DateTime<Utc>,
    pub retry_count: u32,
    pub last_error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub synced_count: u32,
    pub failed_count: u32,
    pub remaining: u32,
    pub sync_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudAlert {
    pub alert_id: Option<String>,
    pub alert_type: FraudAlertType,
    pub severity: AlertSeverity,
    pub transaction_id: Option<String>,
    pub user_id: Option<String>,
    pub description: String,
    pub indicators: Vec<FraudIndicator>,
    pub confidence_score: f64,
    pub source_node: Option<String>,
    pub timestamp: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FraudAlertType {
    SuspiciousTransaction,
    AccountTakeover,
    IdentityTheft,
    MoneyLaundering,
    CardSkimming,
    PhishingAttempt,
    UnusualPattern,
    VelocityAbuse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudIndicator {
    pub indicator_type: String,
    pub value: String,
    pub weight: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FraudAlertResponse {
    pub alert_id: String,
    pub broadcast_to: usize,
    pub acknowledged_by: usize,
    pub propagation_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FraudSubscribeRequest {
    pub topic: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FraudSubscribeResponse {
    pub topic: String,
    pub subscribed: bool,
    pub peer_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KycUploadRequest {
    pub user_id: String,
    pub document_type: KycDocumentType,
    pub document_data: String,
    pub filename: String,
    pub mime_type: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KycDocumentType {
    NationalId,
    Passport,
    DriversLicense,
    VotersCard,
    Bvn,
    Nin,
    UtilityBill,
    ProofOfAddress,
    Selfie,
    VideoLiveness,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KycUploadResponse {
    pub transfer_id: String,
    pub document_hash: String,
    pub status: String,
    pub resumable: bool,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransferProgress {
    pub transfer_id: String,
    pub status: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub speed_bps: u64,
    pub eta_seconds: Option<u64>,
    pub is_resumable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentVerification {
    pub document_hash: String,
    pub verified: bool,
    pub integrity_check: String,
    pub upload_timestamp: DateTime<Utc>,
    pub verified_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerchantRegistration {
    pub merchant_id: String,
    pub business_name: String,
    pub business_type: String,
    pub location: GeoLocation,
    pub supported_currencies: Vec<String>,
    pub services: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerchantInfo {
    pub merchant_id: String,
    pub public_key: String,
    pub business_name: String,
    pub business_type: String,
    pub location: GeoLocation,
    pub supported_currencies: Vec<String>,
    pub services: Vec<String>,
    pub rating: f64,
    pub transaction_count: u64,
    pub is_online: bool,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerchantTransaction {
    pub sender_merchant_id: String,
    pub recipient_merchant_id: String,
    pub amount: f64,
    pub currency: String,
    pub description: String,
    pub invoice_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerchantTransactionResponse {
    pub transaction_id: String,
    pub status: String,
    pub connection_type: ConnectionType,
    pub settlement_time_ms: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModuleStats {
    pub total_operations: u64,
    pub successful: u64,
    pub failed: u64,
    pub avg_latency_ms: f64,
    pub active_connections: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceMetrics {
    pub p2p_transfers: ModuleStats,
    pub wallet_syncs: ModuleStats,
    pub agent_transactions: ModuleStats,
    pub fraud_alerts: ModuleStats,
    pub kyc_transfers: ModuleStats,
    pub merchant_transactions: ModuleStats,
}
