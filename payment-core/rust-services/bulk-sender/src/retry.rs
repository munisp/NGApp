use std::time::Duration;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::models::{RetryPolicy, SendRequest, SendResult, DeliveryStatus};

/// A message queued for retry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryEntry {
    pub request: SendRequest,
    pub attempt: u32,
    pub next_retry_at: i64,
    pub last_error: String,
    pub policy: RetryPolicy,
}

impl RetryEntry {
    /// Create a new retry entry from a failed send
    pub fn new(request: SendRequest, error: String, policy: RetryPolicy) -> Self {
        let delay = Duration::from_millis(policy.base_delay_ms);
        let next_retry_at = Utc::now().timestamp() + delay.as_secs() as i64;

        Self {
            request,
            attempt: 1,
            next_retry_at,
            last_error: error,
            policy,
        }
    }

    /// Check if the entry should be retried
    pub fn should_retry(&self) -> bool {
        self.attempt < self.policy.max_retries
    }

    /// Check if it's time to retry
    pub fn is_ready(&self) -> bool {
        Utc::now().timestamp() >= self.next_retry_at
    }

    /// Increment the retry attempt and calculate next retry time
    pub fn increment(&mut self, error: String) {
        self.attempt += 1;
        self.last_error = error;

        let delay_ms = (self.policy.base_delay_ms as f64
            * self.policy.backoff_factor.powi(self.attempt as i32 - 1))
            as u64;
        let capped_delay = delay_ms.min(self.policy.max_delay_ms);

        self.next_retry_at = Utc::now().timestamp() + (capped_delay / 1000) as i64;

        info!(
            "Retry scheduled: request={} attempt={}/{} delay={}ms",
            self.request.id, self.attempt, self.policy.max_retries, capped_delay
        );
    }

    /// Mark as permanently failed
    pub fn to_failed_result(&self) -> SendResult {
        SendResult {
            request_id: self.request.id.clone(),
            campaign_id: self.request.campaign_id.clone(),
            recipient_id: self.request.recipient_id.clone(),
            channel: self.request.channel.clone(),
            status: DeliveryStatus::Failed,
            provider_message_id: None,
            error_message: Some(format!(
                "Max retries ({}) exceeded. Last error: {}",
                self.policy.max_retries, self.last_error
            )),
            latency_ms: 0,
            timestamp: Utc::now(),
        }
    }
}

/// Manages the retry queue backed by Redis sorted set
pub struct RetryQueue {
    redis: redis::aio::ConnectionManager,
    queue_key: String,
}

impl RetryQueue {
    pub fn new(redis: redis::aio::ConnectionManager) -> Self {
        Self {
            redis,
            queue_key: "bulk_sender:retry_queue".to_string(),
        }
    }

    /// Add a failed message to the retry queue
    pub async fn enqueue(&self, entry: RetryEntry) -> anyhow::Result<()> {
        let serialized = serde_json::to_string(&entry)?;
        let score = entry.next_retry_at as f64;

        redis::cmd("ZADD")
            .arg(&self.queue_key)
            .arg(score)
            .arg(&serialized)
            .query_async::<()>(&mut self.redis.clone())
            .await?;

        Ok(())
    }

    /// Get entries that are ready for retry
    pub async fn dequeue_ready(&self, limit: usize) -> anyhow::Result<Vec<RetryEntry>> {
        let now = Utc::now().timestamp() as f64;

        let entries: Vec<String> = redis::cmd("ZRANGEBYSCORE")
            .arg(&self.queue_key)
            .arg("-inf")
            .arg(now)
            .arg("LIMIT")
            .arg(0)
            .arg(limit)
            .query_async(&mut self.redis.clone())
            .await?;

        if entries.is_empty() {
            return Ok(vec![]);
        }

        // Remove retrieved entries atomically
        for entry in &entries {
            redis::cmd("ZREM")
                .arg(&self.queue_key)
                .arg(entry)
                .query_async::<()>(&mut self.redis.clone())
                .await?;
        }

        let mut result = Vec::new();
        for entry_str in entries {
            match serde_json::from_str::<RetryEntry>(&entry_str) {
                Ok(entry) => result.push(entry),
                Err(e) => warn!("Failed to parse retry entry: {}", e),
            }
        }

        Ok(result)
    }

    /// Get the current retry queue depth
    pub async fn depth(&self) -> anyhow::Result<u64> {
        let count: u64 = redis::cmd("ZCARD")
            .arg(&self.queue_key)
            .query_async(&mut self.redis.clone())
            .await?;
        Ok(count)
    }
}
