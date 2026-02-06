use anyhow::Result;
use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

use crate::persistence::{LocalStore, RecordType};
use crate::types::*;

pub struct P2PPaymentService {
    transfers: Arc<DashMap<String, P2PTransferResponse>>,
    peers: Arc<RwLock<Vec<PeerInfo>>>,
    stats: Arc<RwLock<ModuleStats>>,
    store: Arc<LocalStore>,
}

impl P2PPaymentService {
    pub async fn new(store: Arc<LocalStore>) -> Result<Self> {
        info!("Initializing P2P Payment Service with persistence, balance reservation, idempotency, and offline limits");

        let peers = vec![
            PeerInfo {
                public_key: "pk_node_lagos_001".to_string(),
                node_id: "node-lagos-primary".to_string(),
                connection_type: ConnectionType::Direct,
                latency_ms: Some(12),
                last_seen: Utc::now(),
                capabilities: vec!["payments".into(), "transfers".into()],
            },
            PeerInfo {
                public_key: "pk_node_abuja_002".to_string(),
                node_id: "node-abuja-relay".to_string(),
                connection_type: ConnectionType::Relay,
                latency_ms: Some(45),
                last_seen: Utc::now(),
                capabilities: vec!["payments".into(), "agent-banking".into()],
            },
            PeerInfo {
                public_key: "pk_node_nairobi_003".to_string(),
                node_id: "node-nairobi-direct".to_string(),
                connection_type: ConnectionType::Direct,
                latency_ms: Some(28),
                last_seen: Utc::now(),
                capabilities: vec!["payments".into(), "merchant".into()],
            },
        ];

        Ok(Self {
            transfers: Arc::new(DashMap::new()),
            peers: Arc::new(RwLock::new(peers)),
            stats: Arc::new(RwLock::new(ModuleStats::default())),
            store,
        })
    }

    pub async fn initiate_transfer(&self, req: P2PTransferRequest) -> Result<P2PTransferResponse> {
        let now = Utc::now();
        let idempotency_key = LocalStore::generate_idempotency_key(
            &req.sender_id, &req.recipient_public_key, req.amount, &now,
        );

        if let Some(existing_id) = self.store.check_idempotency(&idempotency_key).await {
            if let Some(existing) = self.transfers.get(&existing_id) {
                info!("Idempotent P2P transfer hit: {}", existing_id);
                return Ok(existing.clone());
            }
        }

        let connection_type = if req.offline_mode {
            ConnectionType::Offline
        } else {
            let peers = self.peers.read().await;
            if peers.iter().any(|p| p.public_key == req.recipient_public_key) {
                ConnectionType::Direct
            } else {
                ConnectionType::Relay
            }
        };

        if matches!(connection_type, ConnectionType::Offline) {
            if !self.store.check_offline_limit("p2p_payments", req.amount).await? {
                return Err(anyhow::anyhow!(
                    "Offline limit exceeded: max single NGN 50,000, daily NGN 200,000, 20 transactions/day"
                ));
            }
        }

        let transfer_id = Uuid::new_v4().to_string();

        let reservation = self.store.reserve_balance(
            &req.sender_id, req.amount, &req.currency, &transfer_id,
        ).await?;

        let status = match &connection_type {
            ConnectionType::Direct => {
                self.store.commit_reservation(&reservation.reservation_id).await?;
                TransferStatus::Confirmed
            }
            ConnectionType::Relay => TransferStatus::InTransit,
            ConnectionType::Offline => TransferStatus::Queued,
        };

        let response = P2PTransferResponse {
            transfer_id: transfer_id.clone(),
            status,
            sender_id: req.sender_id.clone(),
            recipient_id: req.recipient_public_key.clone(),
            amount: req.amount,
            currency: req.currency.clone(),
            connection_type: connection_type.clone(),
            created_at: now,
            estimated_confirmation: Some(match &connection_type {
                ConnectionType::Direct => "< 2 seconds".to_string(),
                ConnectionType::Relay => "< 10 seconds".to_string(),
                ConnectionType::Offline => "When connectivity restored via iroh relay".to_string(),
            }),
        };

        self.store.persist_record(
            RecordType::P2PTransfer,
            serde_json::to_value(&response)?,
            idempotency_key,
        ).await?;

        if matches!(connection_type, ConnectionType::Offline) {
            self.store.record_offline_usage("p2p_payments", req.amount).await;
        }

        self.transfers.insert(transfer_id, response.clone());

        let mut stats = self.stats.write().await;
        stats.total_operations += 1;
        stats.successful += 1;
        stats.avg_latency_ms = (stats.avg_latency_ms * (stats.total_operations - 1) as f64 + 15.0)
            / stats.total_operations as f64;

        info!("P2P transfer initiated: {} -> {}, {} {}, mode: {:?}, reservation: {}",
            response.sender_id, response.recipient_id, response.amount, response.currency,
            response.connection_type, reservation.reservation_id);

        Ok(response)
    }

    pub async fn get_status(&self, id: &str) -> Result<P2PTransferStatus> {
        let transfer = self.transfers.get(id)
            .ok_or_else(|| anyhow::anyhow!("Transfer not found"))?;

        Ok(P2PTransferStatus {
            transfer_id: transfer.transfer_id.clone(),
            status: transfer.status.clone(),
            confirmations: match transfer.status {
                TransferStatus::Confirmed => 3,
                TransferStatus::InTransit => 1,
                _ => 0,
            },
            connection_type: transfer.connection_type.clone(),
            latency_ms: Some(15),
            updated_at: Utc::now(),
        })
    }

    pub async fn list_peers(&self) -> PeersResponse {
        let peers = self.peers.read().await;
        PeersResponse {
            total_count: peers.len(),
            connected_peers: peers.clone(),
        }
    }

    pub async fn discover_peer(&self, public_key: &str) -> Result<PeerInfo> {
        let peers = self.peers.read().await;
        peers.iter()
            .find(|p| p.public_key == public_key)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Peer not found"))
    }

    pub async fn get_stats(&self) -> ModuleStats {
        let stats = self.stats.read().await;
        let peers = self.peers.read().await;
        ModuleStats {
            active_connections: peers.len() as u64,
            ..stats.clone()
        }
    }
}
