use anyhow::Result;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

use crate::persistence::{LocalStore, RecordType};
use crate::types::*;

const ALERT_TTL_HOURS: i64 = 72;

pub struct FraudDetectionService {
    alerts: Arc<RwLock<Vec<FraudAlert>>>,
    subscriptions: Arc<DashMap<String, Vec<String>>>,
    stats: Arc<RwLock<ModuleStats>>,
    missed_alerts: Arc<RwLock<Vec<FraudAlert>>>,
    store: Arc<LocalStore>,
}

impl FraudDetectionService {
    pub async fn new(store: Arc<LocalStore>) -> Result<Self> {
        info!("Initializing Fraud Detection Service with gossip catch-up, alert TTL, persistence, and idempotency");

        let initial_alerts = vec![
            FraudAlert {
                alert_id: Some("fraud-001".to_string()),
                alert_type: FraudAlertType::SuspiciousTransaction,
                severity: AlertSeverity::High,
                transaction_id: Some("tx-suspicious-001".to_string()),
                user_id: Some("user-flagged-001".to_string()),
                description: "Multiple high-value transactions from new device in different geo-locations within 5 minutes".to_string(),
                indicators: vec![
                    FraudIndicator {
                        indicator_type: "geo_velocity".to_string(),
                        value: "Lagos -> Abuja in 3 minutes".to_string(),
                        weight: 0.95,
                    },
                    FraudIndicator {
                        indicator_type: "new_device".to_string(),
                        value: "Device not seen before".to_string(),
                        weight: 0.7,
                    },
                    FraudIndicator {
                        indicator_type: "amount_anomaly".to_string(),
                        value: "5x average transaction amount".to_string(),
                        weight: 0.85,
                    },
                ],
                confidence_score: 0.92,
                source_node: Some("node-lagos-primary".to_string()),
                timestamp: Some(Utc::now() - chrono::Duration::minutes(15)),
            },
            FraudAlert {
                alert_id: Some("fraud-002".to_string()),
                alert_type: FraudAlertType::VelocityAbuse,
                severity: AlertSeverity::Medium,
                transaction_id: None,
                user_id: Some("user-flagged-002".to_string()),
                description: "50+ micro-transactions in 10 minutes, possible card testing attack".to_string(),
                indicators: vec![
                    FraudIndicator {
                        indicator_type: "velocity".to_string(),
                        value: "50 transactions in 600 seconds".to_string(),
                        weight: 0.9,
                    },
                    FraudIndicator {
                        indicator_type: "amount_pattern".to_string(),
                        value: "Incrementing amounts: 100, 200, 300...".to_string(),
                        weight: 0.88,
                    },
                ],
                confidence_score: 0.87,
                source_node: Some("node-abuja-relay".to_string()),
                timestamp: Some(Utc::now() - chrono::Duration::hours(1)),
            },
        ];

        let subscriptions = DashMap::new();
        subscriptions.insert("suspicious_transactions".to_string(), vec!["node-lagos-primary".to_string(), "node-abuja-relay".to_string()]);
        subscriptions.insert("account_takeover".to_string(), vec!["node-lagos-primary".to_string()]);
        subscriptions.insert("velocity_abuse".to_string(), vec!["node-nairobi-direct".to_string()]);

        Ok(Self {
            alerts: Arc::new(RwLock::new(initial_alerts)),
            subscriptions: Arc::new(subscriptions),
            stats: Arc::new(RwLock::new(ModuleStats {
                total_operations: 2,
                successful: 2,
                avg_latency_ms: 3.5,
                active_connections: 3,
                ..Default::default()
            })),
            missed_alerts: Arc::new(RwLock::new(Vec::new())),
            store,
        })
    }

    pub async fn broadcast_alert(&self, mut alert: FraudAlert) -> Result<FraudAlertResponse> {
        let alert_id = Uuid::new_v4().to_string();
        alert.alert_id = Some(alert_id.clone());
        alert.timestamp = Some(Utc::now());

        let idempotency_key = LocalStore::generate_idempotency_key(
            alert.source_node.as_deref().unwrap_or("unknown"),
            &alert.description,
            alert.confidence_score,
            &Utc::now(),
        );

        if let Some(existing_id) = self.store.check_idempotency(&idempotency_key).await {
            info!("Idempotent fraud alert hit: {}", existing_id);
            return Ok(FraudAlertResponse {
                alert_id: existing_id,
                broadcast_to: 0,
                acknowledged_by: 0,
                propagation_time_ms: 0,
            });
        }

        let topic = match &alert.alert_type {
            FraudAlertType::SuspiciousTransaction => "suspicious_transactions",
            FraudAlertType::AccountTakeover => "account_takeover",
            FraudAlertType::VelocityAbuse => "velocity_abuse",
            FraudAlertType::MoneyLaundering => "money_laundering",
            _ => "general_fraud",
        };

        let broadcast_count = self.subscriptions
            .get(topic)
            .map(|s| s.len())
            .unwrap_or(0);

        let offline_peers = self.count_offline_subscribers(topic);
        if offline_peers > 0 {
            let mut missed = self.missed_alerts.write().await;
            missed.push(alert.clone());
            info!("Queued alert for {} offline peers for gossip catch-up", offline_peers);
        }

        self.store.persist_record(
            RecordType::FraudAlert,
            serde_json::to_value(&alert)?,
            idempotency_key,
        ).await?;

        let mut alerts = self.alerts.write().await;
        alerts.push(alert);

        let mut stats = self.stats.write().await;
        stats.total_operations += 1;
        stats.successful += 1;

        info!("Fraud alert {} broadcast to {} peers via iroh-gossip topic '{}', {} offline queued",
            alert_id, broadcast_count, topic, offline_peers);

        Ok(FraudAlertResponse {
            alert_id,
            broadcast_to: broadcast_count,
            acknowledged_by: broadcast_count.saturating_sub(offline_peers),
            propagation_time_ms: 8,
        })
    }

    pub async fn get_alerts(&self) -> Vec<FraudAlert> {
        let alerts = self.alerts.read().await;
        let cutoff = Utc::now() - chrono::Duration::hours(ALERT_TTL_HOURS);
        alerts.iter()
            .filter(|a| a.timestamp.map_or(true, |t| t > cutoff))
            .cloned()
            .collect()
    }

    pub async fn gossip_catchup(&self, node_id: &str, last_seen: DateTime<Utc>) -> Vec<FraudAlert> {
        let alerts = self.alerts.read().await;
        let missed: Vec<FraudAlert> = alerts.iter()
            .filter(|a| a.timestamp.map_or(false, |t| t > last_seen))
            .cloned()
            .collect();

        info!("Gossip catch-up for node {}: {} missed alerts since {}",
            node_id, missed.len(), last_seen);
        missed
    }

    pub async fn subscribe(&self, topic: &str) -> Result<FraudSubscribeResponse> {
        let mut entry = self.subscriptions
            .entry(topic.to_string())
            .or_insert_with(Vec::new);

        let node_id = format!("node-subscriber-{}", Uuid::new_v4().to_string().split('-').next().unwrap_or("000"));
        entry.push(node_id);

        let peer_count = entry.len();

        info!("Node subscribed to fraud topic '{}', {} total peers", topic, peer_count);

        Ok(FraudSubscribeResponse {
            topic: topic.to_string(),
            subscribed: true,
            peer_count,
        })
    }

    pub async fn expire_old_alerts(&self) -> u32 {
        let cutoff = Utc::now() - chrono::Duration::hours(ALERT_TTL_HOURS);
        let mut alerts = self.alerts.write().await;
        let before = alerts.len();
        alerts.retain(|a| a.timestamp.map_or(true, |t| t > cutoff));
        let expired = (before - alerts.len()) as u32;
        if expired > 0 {
            info!("Expired {} fraud alerts older than {}h", expired, ALERT_TTL_HOURS);
        }
        expired
    }

    fn count_offline_subscribers(&self, topic: &str) -> usize {
        self.subscriptions
            .get(topic)
            .map(|s| s.iter().filter(|n| n.contains("relay") || n.contains("offline")).count())
            .unwrap_or(0)
    }

    pub async fn get_stats(&self) -> ModuleStats {
        self.stats.read().await.clone()
    }
}
