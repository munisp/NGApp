//! Common types used across EscrowProtect services

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Webhook event types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEventType {
    TransactionCreated,
    TransactionFunded,
    TransactionCompleted,
    TransactionCancelled,
    TransactionDisputed,
    DisputeCreated,
    DisputeResolved,
    PayoutInitiated,
    PayoutCompleted,
    PayoutFailed,
    KycVerified,
    KycFailed,
    SellerOnboarded,
    BuyerRegistered,
}

impl std::fmt::Display for WebhookEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = serde_json::to_string(self).unwrap_or_default();
        write!(f, "{}", s.trim_matches('"'))
    }
}

/// Webhook delivery status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryStatus {
    Pending,
    Delivered,
    Failed,
    Retrying,
    Exhausted,
}

/// Webhook endpoint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEndpoint {
    pub id: Uuid,
    pub merchant_id: Uuid,
    pub url: String,
    pub secret: String,
    pub events: Vec<WebhookEventType>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Webhook delivery attempt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookDelivery {
    pub id: Uuid,
    pub endpoint_id: Uuid,
    pub event_type: WebhookEventType,
    pub payload: serde_json::Value,
    pub status: DeliveryStatus,
    pub attempts: i32,
    pub max_attempts: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub response_status: Option<i32>,
    pub response_body: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Event from Kafka for processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformEvent {
    pub id: Uuid,
    pub event_type: WebhookEventType,
    pub aggregate_id: Uuid,
    pub aggregate_type: String,
    pub payload: serde_json::Value,
    pub metadata: EventMetadata,
    pub created_at: DateTime<Utc>,
}

/// Event metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventMetadata {
    pub correlation_id: Option<Uuid>,
    pub causation_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub merchant_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

/// Transaction summary for events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionSummary {
    pub id: Uuid,
    pub reference: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub description: Option<String>,
}

/// Payout summary for events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutSummary {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    pub bank_name: Option<String>,
    pub account_number_masked: Option<String>,
}
