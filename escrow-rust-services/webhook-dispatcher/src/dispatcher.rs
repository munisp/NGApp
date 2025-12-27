//! Core webhook dispatcher logic

use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use reqwest::Client;
use sqlx::PgPool;
use tokio::sync::Semaphore;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use escrow_common::{
    crypto::generate_webhook_signature,
    redis_client::RedisClient,
    types::{DeliveryStatus, WebhookDelivery, WebhookEndpoint},
    Error, Result,
};

use crate::repository::WebhookRepository;
use crate::retry::RetryPolicy;

const MAX_CONCURRENT_DELIVERIES: usize = 100;
const RETRY_QUEUE_KEY: &str = "webhook:retry:queue";

pub struct WebhookDispatcher {
    http_client: Client,
    repository: WebhookRepository,
    redis: RedisClient,
    semaphore: Arc<Semaphore>,
    retry_policy: RetryPolicy,
}

impl WebhookDispatcher {
    pub async fn new(db: PgPool, redis: RedisClient) -> Result<Self> {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .pool_max_idle_per_host(20)
            .build()
            .map_err(|e| Error::HttpClient(e.to_string()))?;

        Ok(Self {
            http_client,
            repository: WebhookRepository::new(db),
            redis,
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_DELIVERIES)),
            retry_policy: RetryPolicy::default(),
        })
    }

    pub async fn deliver(
        &self,
        endpoint: &WebhookEndpoint,
        delivery: &mut WebhookDelivery,
    ) -> Result<()> {
        let _permit = self.semaphore.acquire().await.map_err(|e| {
            Error::Internal(format!("Failed to acquire semaphore: {}", e))
        })?;

        let payload_bytes = serde_json::to_vec(&delivery.payload)?;
        let timestamp = Utc::now().timestamp();
        let signature = generate_webhook_signature(
            &payload_bytes,
            endpoint.secret.as_bytes(),
            timestamp,
        );

        debug!(
            "Delivering webhook {} to {} (attempt {})",
            delivery.id, endpoint.url, delivery.attempts + 1
        );

        delivery.attempts += 1;
        delivery.last_attempt_at = Some(Utc::now());

        let result = self
            .http_client
            .post(&endpoint.url)
            .header("Content-Type", "application/json")
            .header("X-Escrow-Signature", &signature)
            .header("X-Escrow-Timestamp", timestamp.to_string())
            .header("X-Escrow-Event", delivery.event_type.to_string())
            .header("X-Escrow-Delivery-Id", delivery.id.to_string())
            .body(payload_bytes)
            .send()
            .await;

        match result {
            Ok(response) => {
                let status = response.status().as_u16() as i32;
                delivery.response_status = Some(status);

                if response.status().is_success() {
                    delivery.status = DeliveryStatus::Delivered;
                    info!(
                        "Webhook {} delivered successfully (status {})",
                        delivery.id, status
                    );
                } else {
                    let body = response
                        .text()
                        .await
                        .unwrap_or_else(|_| "Failed to read response".to_string());
                    delivery.response_body = Some(body.chars().take(1000).collect());
                    
                    self.handle_failure(delivery, &format!("HTTP {}", status)).await?;
                }
            }
            Err(e) => {
                let error_msg = e.to_string();
                delivery.error_message = Some(error_msg.clone());
                self.handle_failure(delivery, &error_msg).await?;
            }
        }

        self.repository.update_delivery(delivery).await?;
        Ok(())
    }

    async fn handle_failure(&self, delivery: &mut WebhookDelivery, error: &str) -> Result<()> {
        if delivery.attempts >= delivery.max_attempts {
            delivery.status = DeliveryStatus::Exhausted;
            warn!(
                "Webhook {} exhausted after {} attempts: {}",
                delivery.id, delivery.attempts, error
            );
        } else {
            delivery.status = DeliveryStatus::Retrying;
            let next_retry = self.retry_policy.next_retry_time(delivery.attempts);
            delivery.next_retry_at = Some(next_retry);

            let mut redis = self.redis.clone();
            redis
                .zadd(
                    RETRY_QUEUE_KEY,
                    next_retry.timestamp() as f64,
                    &delivery.id.to_string(),
                )
                .await?;

            debug!(
                "Webhook {} scheduled for retry at {} (attempt {})",
                delivery.id, next_retry, delivery.attempts
            );
        }
        Ok(())
    }

    pub async fn start_retry_processor(&self) {
        info!("Starting webhook retry processor");
        
        loop {
            if let Err(e) = self.process_retries().await {
                error!("Error processing retries: {}", e);
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }

    async fn process_retries(&self) -> Result<()> {
        let now = Utc::now().timestamp() as f64;
        let mut redis = self.redis.clone();
        
        let delivery_ids = redis
            .zrangebyscore(RETRY_QUEUE_KEY, 0.0, now, 100)
            .await?;

        if delivery_ids.is_empty() {
            return Ok(());
        }

        debug!("Processing {} webhook retries", delivery_ids.len());

        for id_str in &delivery_ids {
            let id = match Uuid::parse_str(id_str) {
                Ok(id) => id,
                Err(_) => continue,
            };

            if let Some(mut delivery) = self.repository.get_delivery(id).await? {
                if let Some(endpoint) = self.repository.get_endpoint(delivery.endpoint_id).await? {
                    if endpoint.enabled {
                        if let Err(e) = self.deliver(&endpoint, &mut delivery).await {
                            error!("Failed to deliver webhook {}: {}", id, e);
                        }
                    }
                }
            }
        }

        redis.zrem(RETRY_QUEUE_KEY, &delivery_ids).await?;
        Ok(())
    }

    pub async fn queue_delivery(
        &self,
        endpoint_id: Uuid,
        event_type: escrow_common::types::WebhookEventType,
        payload: serde_json::Value,
    ) -> Result<WebhookDelivery> {
        let delivery = WebhookDelivery {
            id: Uuid::new_v4(),
            endpoint_id,
            event_type,
            payload,
            status: DeliveryStatus::Pending,
            attempts: 0,
            max_attempts: 5,
            last_attempt_at: None,
            next_retry_at: None,
            response_status: None,
            response_body: None,
            error_message: None,
            created_at: Utc::now(),
        };

        self.repository.create_delivery(&delivery).await?;

        if let Some(endpoint) = self.repository.get_endpoint(endpoint_id).await? {
            if endpoint.enabled {
                let mut delivery = delivery.clone();
                let _ = self.deliver(&endpoint, &mut delivery).await;
                return Ok(delivery);
            }
        }

        Ok(delivery)
    }
}
