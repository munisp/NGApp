use anyhow::Result;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedRecord {
    pub id: String,
    pub record_type: RecordType,
    pub data: serde_json::Value,
    pub idempotency_key: String,
    pub created_at: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
    pub retry_count: u32,
    pub status: PersistenceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RecordType {
    P2PTransfer,
    WalletSync,
    AgentTransaction,
    FraudAlert,
    KycDocument,
    MerchantTransaction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PersistenceStatus {
    Pending,
    Synced,
    Failed,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceReservation {
    pub reservation_id: String,
    pub account_id: String,
    pub amount: f64,
    pub currency: String,
    pub transfer_id: String,
    pub phase: ReservationPhase,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ReservationPhase {
    Reserved,
    Committed,
    Released,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrdtEntry {
    pub key: String,
    pub value: serde_json::Value,
    pub vector_clock: Vec<(String, u64)>,
    pub origin_device: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLimit {
    pub protocol: String,
    pub max_single_amount: f64,
    pub max_daily_amount: f64,
    pub max_daily_count: u32,
    pub current_daily_amount: f64,
    pub current_daily_count: u32,
    pub reset_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PersistenceStats {
    pub total_records: usize,
    pub pending_sync: usize,
    pub synced: usize,
    pub failed: usize,
    pub active_reservations: usize,
    pub storage_bytes: u64,
}

pub struct LocalStore {
    records: Arc<DashMap<String, PersistedRecord>>,
    idempotency_keys: Arc<DashMap<String, String>>,
    reservations: Arc<DashMap<String, BalanceReservation>>,
    crdt_state: Arc<RwLock<Vec<CrdtEntry>>>,
    offline_limits: Arc<DashMap<String, OfflineLimit>>,
    sync_queue: Arc<RwLock<VecDeque<String>>>,
    max_queue_size: usize,
}

impl LocalStore {
    pub fn new(max_queue_size: usize) -> Self {
        let limits = DashMap::new();
        let now = Utc::now();
        let tomorrow = now + chrono::Duration::days(1);

        limits.insert("p2p_payments".to_string(), OfflineLimit {
            protocol: "p2p_payments".to_string(),
            max_single_amount: 50_000.0,
            max_daily_amount: 200_000.0,
            max_daily_count: 20,
            current_daily_amount: 0.0,
            current_daily_count: 0,
            reset_at: tomorrow,
        });
        limits.insert("agent_banking".to_string(), OfflineLimit {
            protocol: "agent_banking".to_string(),
            max_single_amount: 100_000.0,
            max_daily_amount: 500_000.0,
            max_daily_count: 50,
            current_daily_amount: 0.0,
            current_daily_count: 0,
            reset_at: tomorrow,
        });
        limits.insert("merchant_mesh".to_string(), OfflineLimit {
            protocol: "merchant_mesh".to_string(),
            max_single_amount: 500_000.0,
            max_daily_amount: 5_000_000.0,
            max_daily_count: 100,
            current_daily_amount: 0.0,
            current_daily_count: 0,
            reset_at: tomorrow,
        });
        limits.insert("kyc_transfer".to_string(), OfflineLimit {
            protocol: "kyc_transfer".to_string(),
            max_single_amount: 52_428_800.0,
            max_daily_amount: 524_288_000.0,
            max_daily_count: 50,
            current_daily_amount: 0.0,
            current_daily_count: 0,
            reset_at: tomorrow,
        });

        info!("Local persistence store initialized with max queue size: {}", max_queue_size);

        Self {
            records: Arc::new(DashMap::new()),
            idempotency_keys: Arc::new(DashMap::new()),
            reservations: Arc::new(DashMap::new()),
            crdt_state: Arc::new(RwLock::new(Vec::new())),
            offline_limits: Arc::new(limits),
            sync_queue: Arc::new(RwLock::new(VecDeque::new())),
            max_queue_size,
        }
    }

    pub fn generate_idempotency_key(sender: &str, recipient: &str, amount: f64, timestamp: &DateTime<Utc>) -> String {
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}:{}:{}", sender, recipient, amount, timestamp.timestamp_millis()));
        hex::encode(hasher.finalize())
    }

    pub async fn check_idempotency(&self, key: &str) -> Option<String> {
        self.idempotency_keys.get(key).map(|v| v.clone())
    }

    pub async fn persist_record(&self, record_type: RecordType, data: serde_json::Value, idempotency_key: String) -> Result<PersistedRecord> {
        if let Some(existing_id) = self.check_idempotency(&idempotency_key).await {
            if let Some(record) = self.records.get(&existing_id) {
                info!("Idempotency hit: key={}, returning existing record {}", &idempotency_key[..16], existing_id);
                return Ok(record.clone());
            }
        }

        let mut queue = self.sync_queue.write().await;
        if queue.len() >= self.max_queue_size {
            let oldest = queue.pop_front();
            if let Some(id) = oldest {
                if let Some(mut record) = self.records.get_mut(&id) {
                    record.status = PersistenceStatus::Expired;
                    warn!("Queue overflow: expired record {}", id);
                }
            }
        }

        let record = PersistedRecord {
            id: Uuid::new_v4().to_string(),
            record_type,
            data,
            idempotency_key: idempotency_key.clone(),
            created_at: Utc::now(),
            synced_at: None,
            retry_count: 0,
            status: PersistenceStatus::Pending,
        };

        self.records.insert(record.id.clone(), record.clone());
        self.idempotency_keys.insert(idempotency_key, record.id.clone());
        queue.push_back(record.id.clone());

        Ok(record)
    }

    pub async fn mark_synced(&self, id: &str) -> Result<()> {
        if let Some(mut record) = self.records.get_mut(id) {
            record.status = PersistenceStatus::Synced;
            record.synced_at = Some(Utc::now());
        }
        Ok(())
    }

    pub async fn mark_failed(&self, id: &str, retry: bool) -> Result<()> {
        if let Some(mut record) = self.records.get_mut(id) {
            if retry {
                record.retry_count += 1;
            } else {
                record.status = PersistenceStatus::Failed;
            }
        }
        Ok(())
    }

    pub async fn reserve_balance(&self, account_id: &str, amount: f64, currency: &str, transfer_id: &str) -> Result<BalanceReservation> {
        let reservation = BalanceReservation {
            reservation_id: Uuid::new_v4().to_string(),
            account_id: account_id.to_string(),
            amount,
            currency: currency.to_string(),
            transfer_id: transfer_id.to_string(),
            phase: ReservationPhase::Reserved,
            created_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::minutes(30),
        };

        self.reservations.insert(reservation.reservation_id.clone(), reservation.clone());
        info!("Balance reserved: {} {} for transfer {}", amount, currency, transfer_id);
        Ok(reservation)
    }

    pub async fn commit_reservation(&self, reservation_id: &str) -> Result<()> {
        if let Some(mut res) = self.reservations.get_mut(reservation_id) {
            if res.phase == ReservationPhase::Reserved {
                res.phase = ReservationPhase::Committed;
                info!("Reservation committed: {}", reservation_id);
                Ok(())
            } else {
                Err(anyhow::anyhow!("Reservation {} not in reserved phase", reservation_id))
            }
        } else {
            Err(anyhow::anyhow!("Reservation not found: {}", reservation_id))
        }
    }

    pub async fn release_reservation(&self, reservation_id: &str) -> Result<()> {
        if let Some(mut res) = self.reservations.get_mut(reservation_id) {
            res.phase = ReservationPhase::Released;
            info!("Reservation released: {}", reservation_id);
        }
        Ok(())
    }

    pub async fn expire_stale_reservations(&self) -> u32 {
        let now = Utc::now();
        let mut expired = 0;
        for mut entry in self.reservations.iter_mut() {
            if entry.phase == ReservationPhase::Reserved && entry.expires_at < now {
                entry.phase = ReservationPhase::Expired;
                expired += 1;
            }
        }
        if expired > 0 {
            info!("Expired {} stale balance reservations", expired);
        }
        expired
    }

    pub async fn check_offline_limit(&self, protocol: &str, amount: f64) -> Result<bool> {
        let now = Utc::now();

        if let Some(mut limit) = self.offline_limits.get_mut(protocol) {
            if now >= limit.reset_at {
                limit.current_daily_amount = 0.0;
                limit.current_daily_count = 0;
                limit.reset_at = now + chrono::Duration::days(1);
            }

            if amount > limit.max_single_amount {
                warn!("Offline limit exceeded: single amount {} > {} for {}", amount, limit.max_single_amount, protocol);
                return Ok(false);
            }
            if limit.current_daily_amount + amount > limit.max_daily_amount {
                warn!("Offline limit exceeded: daily amount {} + {} > {} for {}", 
                    limit.current_daily_amount, amount, limit.max_daily_amount, protocol);
                return Ok(false);
            }
            if limit.current_daily_count + 1 > limit.max_daily_count {
                warn!("Offline limit exceeded: daily count {} >= {} for {}", 
                    limit.current_daily_count, limit.max_daily_count, protocol);
                return Ok(false);
            }

            Ok(true)
        } else {
            Ok(true)
        }
    }

    pub async fn record_offline_usage(&self, protocol: &str, amount: f64) {
        if let Some(mut limit) = self.offline_limits.get_mut(protocol) {
            limit.current_daily_amount += amount;
            limit.current_daily_count += 1;
        }
    }

    pub async fn crdt_merge(&self, entry: CrdtEntry) -> Result<CrdtEntry> {
        let mut state = self.crdt_state.write().await;

        if let Some(existing) = state.iter_mut().find(|e| e.key == entry.key) {
            let existing_max = existing.vector_clock.iter().map(|(_, v)| *v).max().unwrap_or(0);
            let incoming_max = entry.vector_clock.iter().map(|(_, v)| *v).max().unwrap_or(0);

            if incoming_max > existing_max {
                *existing = entry.clone();
                info!("CRDT merge: key '{}' updated (incoming clock {} > existing {})", entry.key, incoming_max, existing_max);
            } else if incoming_max == existing_max {
                if entry.timestamp > existing.timestamp {
                    *existing = entry.clone();
                    info!("CRDT merge: key '{}' tie-broken by timestamp", entry.key);
                }
            }

            Ok(existing.clone())
        } else {
            state.push(entry.clone());
            info!("CRDT merge: new key '{}' added", entry.key);
            Ok(entry)
        }
    }

    pub async fn crdt_get_all(&self) -> Vec<CrdtEntry> {
        self.crdt_state.read().await.clone()
    }

    pub async fn get_pending_sync(&self) -> Vec<PersistedRecord> {
        let queue = self.sync_queue.read().await;
        queue.iter()
            .filter_map(|id| {
                self.records.get(id)
                    .filter(|r| r.status == PersistenceStatus::Pending)
                    .map(|r| r.clone())
            })
            .collect()
    }

    pub async fn drain_sync_queue(&self) -> Vec<PersistedRecord> {
        let mut queue = self.sync_queue.write().await;
        let records: Vec<PersistedRecord> = queue.iter()
            .filter_map(|id| {
                self.records.get(id)
                    .filter(|r| r.status == PersistenceStatus::Pending)
                    .map(|r| r.clone())
            })
            .collect();

        for record in &records {
            if let Some(mut r) = self.records.get_mut(&record.id) {
                r.status = PersistenceStatus::Synced;
                r.synced_at = Some(Utc::now());
            }
        }
        queue.clear();

        info!("Drained sync queue: {} records synced", records.len());
        records
    }

    pub async fn get_stats(&self) -> PersistenceStats {
        let total = self.records.len();
        let pending = self.records.iter().filter(|r| r.status == PersistenceStatus::Pending).count();
        let synced = self.records.iter().filter(|r| r.status == PersistenceStatus::Synced).count();
        let failed = self.records.iter().filter(|r| r.status == PersistenceStatus::Failed).count();
        let active_res = self.reservations.iter().filter(|r| r.phase == ReservationPhase::Reserved).count();

        PersistenceStats {
            total_records: total,
            pending_sync: pending,
            synced,
            failed,
            active_reservations: active_res,
            storage_bytes: (total * 512) as u64,
        }
    }

    pub fn get_offline_limits(&self) -> Vec<OfflineLimit> {
        self.offline_limits.iter().map(|e| e.value().clone()).collect()
    }

    pub fn get_active_reservations(&self) -> Vec<BalanceReservation> {
        self.reservations.iter()
            .filter(|r| r.phase == ReservationPhase::Reserved)
            .map(|r| r.value().clone())
            .collect()
    }
}
