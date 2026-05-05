use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A single message to be sent through a channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendRequest {
    pub id: String,
    pub campaign_id: String,
    pub recipient_id: String,
    pub customer_id: String,
    pub channel: Channel,
    pub recipient: String,
    pub content: String,
    pub template_id: Option<String>,
    pub template_params: Option<serde_json::Value>,
    pub variant: Option<String>,
    pub priority: Priority,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Delivery result for a single message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendResult {
    pub request_id: String,
    pub campaign_id: String,
    pub recipient_id: String,
    pub channel: Channel,
    pub status: DeliveryStatus,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
    pub latency_ms: u64,
    pub timestamp: DateTime<Utc>,
}

/// Supported communication channels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Channel {
    Sms,
    Whatsapp,
    Telegram,
    Voice,
    Email,
    Ussd,
}

impl std::fmt::Display for Channel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Channel::Sms => write!(f, "sms"),
            Channel::Whatsapp => write!(f, "whatsapp"),
            Channel::Telegram => write!(f, "telegram"),
            Channel::Voice => write!(f, "voice"),
            Channel::Email => write!(f, "email"),
            Channel::Ussd => write!(f, "ussd"),
        }
    }
}

/// Message priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

/// Delivery status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryStatus {
    Queued,
    Sending,
    Sent,
    Delivered,
    Failed,
    RateLimited,
    Retrying,
    OptedOut,
}

/// Batch of messages for processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendBatch {
    pub campaign_id: String,
    pub messages: Vec<SendRequest>,
    pub rate_limit: Option<u32>,
    pub retry_policy: RetryPolicy,
}

/// Retry policy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub base_delay_ms: u64,
    pub backoff_factor: f64,
    pub max_delay_ms: u64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_retries: 3,
            base_delay_ms: 1000,
            backoff_factor: 2.0,
            max_delay_ms: 30000,
        }
    }
}

/// Channel-level throughput metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelMetrics {
    pub sent: u64,
    pub delivered: u64,
    pub failed: u64,
    pub retried: u64,
    pub rate_limited: u64,
    pub avg_latency_ms: f64,
    pub p99_latency_ms: u64,
}

/// Overall engine metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineMetrics {
    pub total_processed: u64,
    pub total_sent: u64,
    pub total_failed: u64,
    pub total_retried: u64,
    pub queue_depth: u64,
    pub retry_queue_depth: u64,
    pub throughput_per_sec: f64,
    pub channels: std::collections::HashMap<String, ChannelMetrics>,
    pub uptime_seconds: u64,
}
