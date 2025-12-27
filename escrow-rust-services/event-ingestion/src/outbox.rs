//! Transactional outbox pattern for reliable event processing

use chrono::Utc;
use sqlx::PgPool;
use tracing::{debug, info};
use uuid::Uuid;

use escrow_common::{
    redis_client::RedisClient,
    types::WebhookEventType,
    Result,
};

use crate::enrichment::EnrichedEvent;

#[derive(Clone)]
pub struct OutboxProcessor {
    db: PgPool,
    redis: RedisClient,
}

impl OutboxProcessor {
    pub fn new(db: PgPool, redis: RedisClient) -> Self {
        Self { db, redis }
    }

    pub async fn process_event(&self, event: &EnrichedEvent) -> Result<()> {
        let outbox_id = Uuid::new_v4();

        sqlx::query!(
            r#"
            INSERT INTO event_outbox (id, event_id, event_type, aggregate_id, aggregate_type, payload, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
            "#,
            outbox_id,
            event.event.id,
            event.event.event_type.to_string(),
            event.event.aggregate_id,
            event.event.aggregate_type,
            serde_json::to_value(event)?,
            Utc::now(),
        )
        .execute(&self.db)
        .await?;

        debug!("Created outbox entry {} for event {}", outbox_id, event.event.id);

        if let Some(merchant_id) = &event.event.metadata.merchant_id {
            self.trigger_webhooks(*merchant_id, &event.event.event_type, event).await?;
        }

        sqlx::query!(
            "UPDATE event_outbox SET status = 'processed', processed_at = $2 WHERE id = $1",
            outbox_id,
            Utc::now(),
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    async fn trigger_webhooks(
        &self,
        merchant_id: Uuid,
        event_type: &WebhookEventType,
        event: &EnrichedEvent,
    ) -> Result<()> {
        let endpoints = sqlx::query!(
            r#"
            SELECT id FROM webhook_endpoints
            WHERE merchant_id = $1 AND enabled = true AND $2 = ANY(events)
            "#,
            merchant_id,
            event_type.to_string(),
        )
        .fetch_all(&self.db)
        .await?;

        for endpoint in endpoints {
            let delivery_id = Uuid::new_v4();
            
            sqlx::query!(
                r#"
                INSERT INTO webhook_deliveries (
                    id, endpoint_id, event_type, payload, status, attempts, max_attempts, created_at
                )
                VALUES ($1, $2, $3, $4, 'pending', 0, 5, $5)
                "#,
                delivery_id,
                endpoint.id,
                event_type.to_string(),
                serde_json::to_value(&event.event.payload)?,
                Utc::now(),
            )
            .execute(&self.db)
            .await?;

            let mut redis = self.redis.clone();
            redis
                .zadd(
                    "webhook:pending:queue",
                    Utc::now().timestamp() as f64,
                    &delivery_id.to_string(),
                )
                .await?;

            debug!(
                "Queued webhook delivery {} for endpoint {}",
                delivery_id, endpoint.id
            );
        }

        info!(
            "Triggered {} webhooks for event {} (merchant {})",
            endpoints.len(),
            event.event.id,
            merchant_id
        );

        Ok(())
    }
}
