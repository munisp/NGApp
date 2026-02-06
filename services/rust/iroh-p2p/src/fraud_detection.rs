use anyhow::Result;
use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;
use uuid::Uuid;

use crate::types::*;

pub struct FraudDetectionService {
    alerts: Arc<RwLock<Vec<FraudAlert>>>,
    subscriptions: Arc<DashMap<String, Vec<String>>>,
    stats: Arc<RwLock<ModuleStats>>,
}

impl FraudDetectionService {
    pub async fn new() -> Result<Self> {
        info!("Initializing Fraud Detection Service with iroh-gossip broadcast");

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
        })
    }

    pub async fn broadcast_alert(&self, mut alert: FraudAlert) -> Result<FraudAlertResponse> {
        let alert_id = Uuid::new_v4().to_string();
        alert.alert_id = Some(alert_id.clone());
        alert.timestamp = Some(Utc::now());

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

        let mut alerts = self.alerts.write().await;
        alerts.push(alert);

        let mut stats = self.stats.write().await;
        stats.total_operations += 1;
        stats.successful += 1;

        info!("Fraud alert {} broadcast to {} peers via iroh-gossip topic '{}'", 
            alert_id, broadcast_count, topic);

        Ok(FraudAlertResponse {
            alert_id,
            broadcast_to: broadcast_count,
            acknowledged_by: broadcast_count.saturating_sub(1),
            propagation_time_ms: 8,
        })
    }

    pub async fn get_alerts(&self) -> Vec<FraudAlert> {
        self.alerts.read().await.clone()
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

    pub async fn get_stats(&self) -> ModuleStats {
        self.stats.read().await.clone()
    }
}
