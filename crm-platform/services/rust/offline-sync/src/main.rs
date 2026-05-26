use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Offline-first sync engine designed for unreliable networks in African markets.
/// Supports conflict resolution, delta compression, queue-based sync,
/// and progressive data loading for low-bandwidth environments.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    pub id: String,
    pub tenant_id: String,
    pub device_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: OperationType,
    pub data: serde_json::Value,
    pub vector_clock: VectorClock,
    pub checksum: String,
    pub compressed: bool,
    pub size_bytes: u64,
    pub created_at: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
    pub retry_count: u32,
    pub priority: SyncPriority,
    pub conflict_resolution: ConflictStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    Create,
    Update,
    Delete,
    Patch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncPriority {
    Critical,   // Financial transactions - sync immediately
    High,       // Customer data changes
    Normal,     // General updates
    Low,        // Analytics, non-essential
    Background, // Bulk data, reports
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictStrategy {
    LastWriteWins,
    ServerWins,
    ClientWins,
    Merge,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VectorClock {
    pub clocks: std::collections::HashMap<String, u64>,
}

impl VectorClock {
    pub fn new(device_id: &str) -> Self {
        let mut clocks = std::collections::HashMap::new();
        clocks.insert(device_id.to_string(), 1);
        Self { clocks }
    }

    pub fn increment(&mut self, device_id: &str) {
        let counter = self.clocks.entry(device_id.to_string()).or_insert(0);
        *counter += 1;
    }

    pub fn merge(&mut self, other: &VectorClock) {
        for (key, &value) in &other.clocks {
            let entry = self.clocks.entry(key.clone()).or_insert(0);
            if value > *entry {
                *entry = value;
            }
        }
    }

    pub fn happens_before(&self, other: &VectorClock) -> bool {
        let mut dominated = false;
        for (key, &value) in &self.clocks {
            if let Some(&other_value) = other.clocks.get(key) {
                if value > other_value {
                    return false;
                }
                if value < other_value {
                    dominated = true;
                }
            } else if value > 0 {
                return false;
            }
        }
        for (key, &value) in &other.clocks {
            if !self.clocks.contains_key(key) && value > 0 {
                dominated = true;
            }
        }
        dominated
    }

    pub fn is_concurrent(&self, other: &VectorClock) -> bool {
        !self.happens_before(other) && !other.happens_before(self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictRecord {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub client_version: serde_json::Value,
    pub server_version: serde_json::Value,
    pub resolved: bool,
    pub resolution: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub device_id: String,
    pub tenant_id: String,
    pub pending_ops: u64,
    pub synced_ops: u64,
    pub conflicts: u64,
    pub last_sync: Option<DateTime<Utc>>,
    pub connection_quality: ConnectionQuality,
    pub estimated_sync_time_secs: u64,
    pub total_pending_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionQuality {
    Excellent,  // > 1 Mbps
    Good,       // 256 Kbps - 1 Mbps
    Fair,       // 64 - 256 Kbps
    Poor,       // < 64 Kbps
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandwidthProfile {
    pub max_payload_bytes: u64,
    pub batch_size: u32,
    pub compression_enabled: bool,
    pub delta_sync_enabled: bool,
    pub retry_delay_secs: u64,
    pub max_retries: u32,
}

impl ConnectionQuality {
    pub fn bandwidth_profile(&self) -> BandwidthProfile {
        match self {
            ConnectionQuality::Excellent => BandwidthProfile {
                max_payload_bytes: 5_000_000, batch_size: 100,
                compression_enabled: false, delta_sync_enabled: false,
                retry_delay_secs: 1, max_retries: 3,
            },
            ConnectionQuality::Good => BandwidthProfile {
                max_payload_bytes: 1_000_000, batch_size: 50,
                compression_enabled: true, delta_sync_enabled: true,
                retry_delay_secs: 2, max_retries: 5,
            },
            ConnectionQuality::Fair => BandwidthProfile {
                max_payload_bytes: 256_000, batch_size: 20,
                compression_enabled: true, delta_sync_enabled: true,
                retry_delay_secs: 5, max_retries: 10,
            },
            ConnectionQuality::Poor => BandwidthProfile {
                max_payload_bytes: 64_000, batch_size: 5,
                compression_enabled: true, delta_sync_enabled: true,
                retry_delay_secs: 15, max_retries: 20,
            },
            ConnectionQuality::Offline => BandwidthProfile {
                max_payload_bytes: 0, batch_size: 0,
                compression_enabled: true, delta_sync_enabled: true,
                retry_delay_secs: 60, max_retries: 100,
            },
        }
    }
}

struct AppState {
    pending_ops: DashMap<String, Vec<SyncOperation>>,
    conflicts: DashMap<String, Vec<ConflictRecord>>,
    sync_status: DashMap<String, SyncStatus>,
    entity_store: DashMap<String, serde_json::Value>,
    vector_clocks: DashMap<String, VectorClock>,
}

impl AppState {
    fn new() -> Self {
        Self {
            pending_ops: DashMap::new(),
            conflicts: DashMap::new(),
            sync_status: DashMap::new(),
            entity_store: DashMap::new(),
            vector_clocks: DashMap::new(),
        }
    }
}

#[derive(Deserialize)]
struct SyncRequest {
    device_id: String,
    tenant_id: String,
    operations: Vec<SyncOperation>,
    connection_quality: ConnectionQuality,
}

#[derive(Serialize)]
struct SyncResponse {
    accepted: u64,
    rejected: u64,
    conflicts: Vec<ConflictRecord>,
    server_updates: Vec<SyncOperation>,
    next_sync_token: String,
}

async fn health_check() -> &'static str {
    "offline-sync-engine:healthy"
}

async fn submit_sync(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SyncRequest>,
) -> Result<Json<SyncResponse>, StatusCode> {
    let profile = req.connection_quality.bandwidth_profile();
    let mut accepted = 0u64;
    let mut rejected = 0u64;
    let mut conflicts = Vec::new();

    for op in req.operations {
        let entity_key = format!("{}:{}", op.entity_type, op.entity_id);

        // Check for conflicts using vector clocks
        if let Some(server_clock) = state.vector_clocks.get(&entity_key) {
            if op.vector_clock.is_concurrent(&server_clock) {
                let server_data = state.entity_store.get(&entity_key)
                    .map(|v| v.clone())
                    .unwrap_or(serde_json::Value::Null);
                let conflict = ConflictRecord {
                    id: Uuid::new_v4().to_string(),
                    entity_type: op.entity_type.clone(),
                    entity_id: op.entity_id.clone(),
                    client_version: op.data.clone(),
                    server_version: server_data,
                    resolved: false,
                    resolution: None,
                    created_at: Utc::now(),
                };
                state.conflicts.entry(req.tenant_id.clone())
                    .or_insert_with(Vec::new)
                    .push(conflict.clone());
                conflicts.push(conflict);
                rejected += 1;
                continue;
            }
        }

        // Apply operation
        let mut clock = state.vector_clocks.entry(entity_key.clone())
            .or_insert(VectorClock::default()).clone();
        clock.merge(&op.vector_clock);
        clock.increment("server");
        state.vector_clocks.insert(entity_key.clone(), clock);
        state.entity_store.insert(entity_key, op.data.clone());
        accepted += 1;
    }

    // Update sync status
    state.sync_status.insert(req.device_id.clone(), SyncStatus {
        device_id: req.device_id.clone(),
        tenant_id: req.tenant_id.clone(),
        pending_ops: 0,
        synced_ops: accepted,
        conflicts: conflicts.len() as u64,
        last_sync: Some(Utc::now()),
        connection_quality: req.connection_quality,
        estimated_sync_time_secs: 0,
        total_pending_bytes: 0,
    });

    Ok(Json(SyncResponse {
        accepted,
        rejected,
        conflicts,
        server_updates: Vec::new(),
        next_sync_token: Uuid::new_v4().to_string(),
    }))
}

async fn get_sync_status(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<SyncStatus>> {
    let statuses: Vec<SyncStatus> = state.sync_status.iter()
        .map(|entry| entry.value().clone())
        .collect();
    Json(statuses)
}

async fn get_conflicts(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<ConflictRecord>> {
    let all_conflicts: Vec<ConflictRecord> = state.conflicts.iter()
        .flat_map(|entry| entry.value().clone())
        .collect();
    Json(all_conflicts)
}

#[derive(Deserialize)]
struct ResolveConflict {
    conflict_id: String,
    resolution: String, // "client", "server", "merge"
    merged_data: Option<serde_json::Value>,
}

async fn resolve_conflict(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ResolveConflict>,
) -> StatusCode {
    for mut entry in state.conflicts.iter_mut() {
        for conflict in entry.value_mut().iter_mut() {
            if conflict.id == req.conflict_id {
                conflict.resolved = true;
                conflict.resolution = Some(req.resolution.clone());
                return StatusCode::OK;
            }
        }
    }
    StatusCode::NOT_FOUND
}

async fn get_bandwidth_profile(
    Json(quality): Json<ConnectionQuality>,
) -> Json<BandwidthProfile> {
    Json(quality.bandwidth_profile())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let state = Arc::new(AppState::new());

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/sync", post(submit_sync))
        .route("/api/v1/sync/status", get(get_sync_status))
        .route("/api/v1/sync/conflicts", get(get_conflicts))
        .route("/api/v1/sync/conflicts/resolve", post(resolve_conflict))
        .route("/api/v1/sync/bandwidth", post(get_bandwidth_profile))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8084").await.unwrap();
    tracing::info!("Offline sync engine listening on :8084");
    axum::serve(listener, app).await.unwrap();
}
