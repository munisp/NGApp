//! Fluvio streaming pipeline integration for CRM platform.
//! Provides high-throughput event streaming for real-time analytics.

use serde::{Deserialize, Serialize};
use std::env;

/// CRM event envelope for Fluvio streams.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrmEvent {
    pub id: String,
    pub event_type: EventType,
    pub tenant_id: String,
    pub timestamp: i64,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    CustomerCreated,
    CustomerUpdated,
    InteractionLogged,
    CampaignSent,
    TradeExecuted,
    PaymentProcessed,
    SubscriberActivated,
    MessageDelivered,
    AuditEntry,
}

/// Fluvio topic definitions for CRM platform.
pub mod topics {
    pub const CUSTOMER_EVENTS: &str = "crm-customer-events";
    pub const ANALYTICS_STREAM: &str = "crm-analytics-stream";
    pub const AUDIT_TRAIL: &str = "crm-audit-trail";
    pub const REAL_TIME_METRICS: &str = "crm-realtime-metrics";
    pub const TELCO_EVENTS: &str = "crm-telco-events";
    pub const COMMODITY_TRADES: &str = "crm-commodity-trades";
    pub const CPAAS_MESSAGES: &str = "crm-cpaas-messages";
    pub const PAYMENT_EVENTS: &str = "crm-payment-events";
}

/// Configuration for Fluvio connection.
pub struct FluvioConfig {
    pub endpoint: String,
    pub tls_enabled: bool,
}

impl Default for FluvioConfig {
    fn default() -> Self {
        Self {
            endpoint: env::var("FLUVIO_ENDPOINT").unwrap_or_else(|_| "localhost:9003".to_string()),
            tls_enabled: env::var("FLUVIO_TLS").unwrap_or_else(|_| "false".to_string()) == "true",
        }
    }
}

/// SmartModule filter for CRM events — filters by tenant_id.
pub fn tenant_filter(event: &CrmEvent, tenant_id: &str) -> bool {
    event.tenant_id == tenant_id
}

/// SmartModule map for enriching events with computed fields.
pub fn enrich_event(mut event: CrmEvent) -> CrmEvent {
    if let Some(obj) = event.payload.as_object_mut() {
        obj.insert("processed_at".to_string(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
        obj.insert("pipeline".to_string(), serde_json::json!("fluvio-crm"));
    }
    event
}
