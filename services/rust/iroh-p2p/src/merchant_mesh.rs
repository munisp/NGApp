use anyhow::Result;
use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;
use uuid::Uuid;

use crate::persistence::{LocalStore, RecordType};
use crate::types::*;

pub struct MerchantMeshService {
    merchants: Arc<DashMap<String, MerchantInfo>>,
    stats: Arc<RwLock<ModuleStats>>,
    store: Arc<LocalStore>,
}

impl MerchantMeshService {
    pub async fn new(store: Arc<LocalStore>) -> Result<Self> {
        info!("Initializing Merchant Mesh Network with persistence, offline limits, and idempotency");
        let merchants = DashMap::new();
        let seed_merchants = vec![
            MerchantInfo {
                merchant_id: "merchant-001".to_string(),
                public_key: "pk_merchant_shoprite_001".to_string(),
                business_name: "Shoprite Victoria Island".to_string(),
                business_type: "retail".to_string(),
                location: GeoLocation { latitude: 6.4281, longitude: 3.4219, accuracy_meters: 10.0 },
                supported_currencies: vec!["NGN".to_string(), "USD".to_string()],
                services: vec!["retail".to_string(), "cashback".to_string(), "b2b_supply".to_string()],
                rating: 4.7, transaction_count: 15420, is_online: true, last_seen: Utc::now(),
            },
            MerchantInfo {
                merchant_id: "merchant-002".to_string(),
                public_key: "pk_merchant_jumia_002".to_string(),
                business_name: "Jumia Warehouse Ikeja".to_string(),
                business_type: "ecommerce".to_string(),
                location: GeoLocation { latitude: 6.6018, longitude: 3.3515, accuracy_meters: 15.0 },
                supported_currencies: vec!["NGN".to_string()],
                services: vec!["ecommerce".to_string(), "delivery".to_string(), "b2b_wholesale".to_string()],
                rating: 4.3, transaction_count: 28950, is_online: true, last_seen: Utc::now(),
            },
            MerchantInfo {
                merchant_id: "merchant-003".to_string(),
                public_key: "pk_merchant_dangote_003".to_string(),
                business_name: "Dangote Cement Distributor".to_string(),
                business_type: "manufacturing".to_string(),
                location: GeoLocation { latitude: 6.5244, longitude: 3.3792, accuracy_meters: 20.0 },
                supported_currencies: vec!["NGN".to_string(), "USD".to_string(), "GHS".to_string()],
                services: vec!["b2b_supply".to_string(), "credit".to_string(), "bulk_payments".to_string()],
                rating: 4.8, transaction_count: 5230, is_online: true, last_seen: Utc::now(),
            },
            MerchantInfo {
                merchant_id: "merchant-004".to_string(),
                public_key: "pk_merchant_konga_004".to_string(),
                business_name: "Konga Digital".to_string(),
                business_type: "ecommerce".to_string(),
                location: GeoLocation { latitude: 6.4541, longitude: 3.3947, accuracy_meters: 12.0 },
                supported_currencies: vec!["NGN".to_string()],
                services: vec!["ecommerce".to_string(), "fintech".to_string(), "pay_on_delivery".to_string()],
                rating: 4.1, transaction_count: 18760, is_online: false, last_seen: Utc::now() - chrono::Duration::hours(2),
            },
            MerchantInfo {
                merchant_id: "merchant-005".to_string(),
                public_key: "pk_merchant_mtn_005".to_string(),
                business_name: "MTN Agent - Lekki".to_string(),
                business_type: "telecom_agent".to_string(),
                location: GeoLocation { latitude: 6.4698, longitude: 3.5852, accuracy_meters: 8.0 },
                supported_currencies: vec!["NGN".to_string()],
                services: vec!["airtime".to_string(), "data".to_string(), "mobile_money".to_string(), "cash_in_out".to_string()],
                rating: 4.5, transaction_count: 42100, is_online: true, last_seen: Utc::now(),
            },
        ];
        for m in seed_merchants { merchants.insert(m.merchant_id.clone(), m); }
        Ok(Self {
            merchants: Arc::new(merchants),
            stats: Arc::new(RwLock::new(ModuleStats {
                total_operations: 5, successful: 5, avg_latency_ms: 22.0, active_connections: 4, ..Default::default()
            })),
            store,
        })
    }

    pub async fn register(&self, req: MerchantRegistration) -> Result<MerchantInfo> {
        let idempotency_key = LocalStore::generate_idempotency_key(&req.merchant_id, &req.business_name, 0.0, &Utc::now());
        if let Some(_existing) = self.store.check_idempotency(&idempotency_key).await {
            if let Some(existing) = self.merchants.get(&req.merchant_id) {
                info!("Idempotent merchant registration hit: {}", req.merchant_id);
                return Ok(existing.clone());
            }
        }
        let info = MerchantInfo {
            merchant_id: req.merchant_id.clone(),
            public_key: format!("pk_merchant_{}_{}", req.business_name.to_lowercase().replace(' ', "_"), Uuid::new_v4().to_string().split('-').next().unwrap_or("000")),
            business_name: req.business_name, business_type: req.business_type, location: req.location,
            supported_currencies: req.supported_currencies, services: req.services,
            rating: 0.0, transaction_count: 0, is_online: true, last_seen: Utc::now(),
        };
        self.merchants.insert(info.merchant_id.clone(), info.clone());
        self.store.persist_record(RecordType::MerchantTransaction, serde_json::to_value(&info)?, idempotency_key).await?;
        let mut stats = self.stats.write().await;
        stats.total_operations += 1; stats.successful += 1; stats.active_connections += 1;
        info!("Merchant registered on mesh: {} ({})", info.business_name, info.merchant_id);
        Ok(info)
    }

    pub async fn discover(&self) -> Vec<MerchantInfo> {
        self.merchants.iter().map(|entry| entry.value().clone()).collect()
    }

    pub async fn transact(&self, req: MerchantTransaction) -> Result<MerchantTransactionResponse> {
        let _sender = self.merchants.get(&req.sender_merchant_id).ok_or_else(|| anyhow::anyhow!("Sender merchant not found"))?;
        let _recipient = self.merchants.get(&req.recipient_merchant_id).ok_or_else(|| anyhow::anyhow!("Recipient merchant not found"))?;
        let idempotency_key = LocalStore::generate_idempotency_key(&req.sender_merchant_id, &req.recipient_merchant_id, req.amount, &Utc::now());
        if let Some(existing_id) = self.store.check_idempotency(&idempotency_key).await {
            info!("Idempotent merchant transaction hit: {}", existing_id);
            return Ok(MerchantTransactionResponse { transaction_id: existing_id, status: "duplicate_prevented".to_string(), connection_type: ConnectionType::Direct, settlement_time_ms: 0 });
        }
        let tx_id = Uuid::new_v4().to_string();
        let connection_type = if _sender.is_online && _recipient.is_online { ConnectionType::Direct } else if _sender.is_online || _recipient.is_online { ConnectionType::Relay } else { ConnectionType::Offline };
        if matches!(connection_type, ConnectionType::Offline) {
            if !self.store.check_offline_limit("merchant_mesh", req.amount).await? {
                return Err(anyhow::anyhow!("Offline limit exceeded: max single NGN 500,000, daily NGN 5,000,000"));
            }
        }
        let reservation = self.store.reserve_balance(&req.sender_merchant_id, req.amount, &req.currency, &tx_id).await?;
        let settlement_ms = match &connection_type {
            ConnectionType::Direct => { self.store.commit_reservation(&reservation.reservation_id).await?; 45 }
            ConnectionType::Relay => 180,
            ConnectionType::Offline => 0,
        };
        self.store.persist_record(RecordType::MerchantTransaction, serde_json::json!({
            "tx_id": tx_id, "sender": req.sender_merchant_id, "recipient": req.recipient_merchant_id,
            "amount": req.amount, "currency": req.currency, "connection_type": format!("{:?}", connection_type),
            "reservation_id": reservation.reservation_id,
        }), idempotency_key).await?;
        if matches!(connection_type, ConnectionType::Offline) { self.store.record_offline_usage("merchant_mesh", req.amount).await; }
        if let Some(mut sender) = self.merchants.get_mut(&req.sender_merchant_id) { sender.transaction_count += 1; }
        if let Some(mut recipient) = self.merchants.get_mut(&req.recipient_merchant_id) { recipient.transaction_count += 1; }
        let mut stats = self.stats.write().await;
        stats.total_operations += 1; stats.successful += 1; stats.avg_latency_ms = settlement_ms as f64;
        info!("Merchant B2B transaction: {} -> {}, {} {} via {:?}, reservation: {}",
            req.sender_merchant_id, req.recipient_merchant_id, req.amount, req.currency, connection_type, reservation.reservation_id);
        Ok(MerchantTransactionResponse { transaction_id: tx_id, status: "settled".to_string(), connection_type, settlement_time_ms: settlement_ms })
    }

    pub async fn get_stats(&self) -> ModuleStats { self.stats.read().await.clone() }
}
