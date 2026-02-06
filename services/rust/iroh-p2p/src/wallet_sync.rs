use anyhow::Result;
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;
use uuid::Uuid;

use crate::persistence::{CrdtEntry, LocalStore, RecordType};
use crate::types::*;

pub struct WalletSyncService {
    state: Arc<RwLock<WalletState>>,
    devices: Arc<RwLock<Vec<DeviceInfo>>>,
    stats: Arc<RwLock<ModuleStats>>,
    version: Arc<RwLock<u64>>,
    store: Arc<LocalStore>,
}

impl WalletSyncService {
    pub async fn new(store: Arc<LocalStore>) -> Result<Self> {
        info!("Initializing Wallet Sync Service with CRDT conflict resolution and persistence");

        let initial_state = WalletState {
            wallet_data: Some(WalletData {
                balances: vec![
                    BalanceEntry {
                        account_id: "acc-checking-001".to_string(),
                        currency: "NGN".to_string(),
                        amount: 2_450_000.0,
                    },
                    BalanceEntry {
                        account_id: "acc-savings-002".to_string(),
                        currency: "NGN".to_string(),
                        amount: 5_200_000.0,
                    },
                ],
                recent_transactions: vec![
                    TransactionEntry {
                        id: "tx-001".to_string(),
                        amount: -45_000.0,
                        currency: "NGN".to_string(),
                        description: "Shoprite Groceries".to_string(),
                        category: "food".to_string(),
                        timestamp: Utc::now() - chrono::Duration::hours(2),
                    },
                    TransactionEntry {
                        id: "tx-002".to_string(),
                        amount: 850_000.0,
                        currency: "NGN".to_string(),
                        description: "Salary Credit".to_string(),
                        category: "income".to_string(),
                        timestamp: Utc::now() - chrono::Duration::days(1),
                    },
                ],
                settings: serde_json::json!({
                    "notifications": true,
                    "biometric_auth": true,
                    "default_currency": "NGN",
                    "theme": "system"
                }),
                last_modified: Utc::now(),
            }),
            synced_devices: 2,
            last_sync: Some(Utc::now()),
            version: 1,
        };

        let devices = vec![
            DeviceInfo {
                device_id: "dev-phone-001".to_string(),
                device_name: "iPhone 15 Pro".to_string(),
                platform: "ios".to_string(),
                last_sync: Utc::now(),
                is_online: true,
            },
            DeviceInfo {
                device_id: "dev-web-002".to_string(),
                device_name: "Chrome Browser".to_string(),
                platform: "web".to_string(),
                last_sync: Utc::now() - chrono::Duration::minutes(5),
                is_online: true,
            },
            DeviceInfo {
                device_id: "dev-tablet-003".to_string(),
                device_name: "iPad Air".to_string(),
                platform: "ios".to_string(),
                last_sync: Utc::now() - chrono::Duration::hours(3),
                is_online: false,
            },
        ];

        Ok(Self {
            state: Arc::new(RwLock::new(initial_state)),
            devices: Arc::new(RwLock::new(devices)),
            stats: Arc::new(RwLock::new(ModuleStats::default())),
            version: Arc::new(RwLock::new(1)),
            store,
        })
    }

    pub async fn sync(&self, req: WalletSyncRequest) -> Result<WalletSyncResponse> {
        let start = std::time::Instant::now();
        let sync_id = Uuid::new_v4().to_string();

        let idempotency_key = LocalStore::generate_idempotency_key(
            &req.device_id, "wallet_sync", 0.0, &Utc::now(),
        );

        let mut version = self.version.write().await;
        *version += 1;

        let mut conflicts_resolved = 0u32;

        for balance in &req.wallet_data.balances {
            let entry = CrdtEntry {
                key: format!("balance:{}", balance.account_id),
                value: serde_json::to_value(balance)?,
                vector_clock: vec![(req.device_id.clone(), *version)],
                origin_device: req.device_id.clone(),
                timestamp: Utc::now(),
            };
            let result = self.store.crdt_merge(entry).await?;
            if result.origin_device != req.device_id {
                conflicts_resolved += 1;
            }
        }

        let settings_entry = CrdtEntry {
            key: "settings".to_string(),
            value: req.wallet_data.settings.clone(),
            vector_clock: vec![(req.device_id.clone(), *version)],
            origin_device: req.device_id.clone(),
            timestamp: Utc::now(),
        };
        let settings_result = self.store.crdt_merge(settings_entry).await?;
        if settings_result.origin_device != req.device_id {
            conflicts_resolved += 1;
        }

        for tx in &req.wallet_data.recent_transactions {
            let tx_entry = CrdtEntry {
                key: format!("tx:{}", tx.id),
                value: serde_json::to_value(tx)?,
                vector_clock: vec![(req.device_id.clone(), *version)],
                origin_device: req.device_id.clone(),
                timestamp: tx.timestamp,
            };
            self.store.crdt_merge(tx_entry).await?;
        }

        let mut state = self.state.write().await;
        state.wallet_data = Some(req.wallet_data.clone());
        state.last_sync = Some(Utc::now());
        state.version = *version;

        let mut devices = self.devices.write().await;
        if let Some(dev) = devices.iter_mut().find(|d| d.device_id == req.device_id) {
            dev.last_sync = Utc::now();
            dev.is_online = true;
        } else {
            devices.push(DeviceInfo {
                device_id: req.device_id.clone(),
                device_name: format!("Device {}", req.device_id),
                platform: "unknown".to_string(),
                last_sync: Utc::now(),
                is_online: true,
            });
        }
        state.synced_devices = devices.len();

        let entries_synced = req.wallet_data.balances.len() as u32
            + req.wallet_data.recent_transactions.len() as u32
            + 1;

        self.store.persist_record(
            RecordType::WalletSync,
            serde_json::json!({
                "device_id": req.device_id,
                "version": *version,
                "entries_synced": entries_synced,
                "conflicts_resolved": conflicts_resolved,
            }),
            idempotency_key,
        ).await?;

        let duration = start.elapsed();

        let mut stats = self.stats.write().await;
        stats.total_operations += 1;
        stats.successful += 1;
        stats.avg_latency_ms = duration.as_millis() as f64;

        info!("Wallet synced: device={}, version={}, entries={}, conflicts_resolved={}",
            req.device_id, *version, entries_synced, conflicts_resolved);

        Ok(WalletSyncResponse {
            sync_id,
            status: "synced".to_string(),
            conflicts_resolved,
            entries_synced,
            sync_duration_ms: duration.as_millis() as u64,
        })
    }

    pub async fn get_state(&self) -> WalletState {
        self.state.read().await.clone()
    }

    pub async fn list_devices(&self) -> Vec<DeviceInfo> {
        self.devices.read().await.clone()
    }

    pub async fn get_stats(&self) -> ModuleStats {
        self.stats.read().await.clone()
    }
}
