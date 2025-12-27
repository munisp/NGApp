//! Database repository for webhook endpoints and deliveries

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use escrow_common::{
    types::{DeliveryStatus, WebhookDelivery, WebhookEndpoint, WebhookEventType},
    Result,
};

pub struct WebhookRepository {
    db: PgPool,
}

impl WebhookRepository {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn create_endpoint(&self, endpoint: &WebhookEndpoint) -> Result<()> {
        let events: Vec<String> = endpoint.events.iter().map(|e| e.to_string()).collect();
        
        sqlx::query!(
            r#"
            INSERT INTO webhook_endpoints (id, merchant_id, url, secret, events, enabled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
            endpoint.id,
            endpoint.merchant_id,
            endpoint.url,
            endpoint.secret,
            &events,
            endpoint.enabled,
            endpoint.created_at,
            endpoint.updated_at,
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn get_endpoint(&self, id: Uuid) -> Result<Option<WebhookEndpoint>> {
        let row = sqlx::query!(
            r#"
            SELECT id, merchant_id, url, secret, events, enabled, created_at, updated_at
            FROM webhook_endpoints
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(row.map(|r| WebhookEndpoint {
            id: r.id,
            merchant_id: r.merchant_id,
            url: r.url,
            secret: r.secret,
            events: parse_events(&r.events),
            enabled: r.enabled,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }))
    }

    pub async fn list_endpoints(&self, merchant_id: Uuid) -> Result<Vec<WebhookEndpoint>> {
        let rows = sqlx::query!(
            r#"
            SELECT id, merchant_id, url, secret, events, enabled, created_at, updated_at
            FROM webhook_endpoints
            WHERE merchant_id = $1
            ORDER BY created_at DESC
            "#,
            merchant_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| WebhookEndpoint {
                id: r.id,
                merchant_id: r.merchant_id,
                url: r.url,
                secret: r.secret,
                events: parse_events(&r.events),
                enabled: r.enabled,
                created_at: r.created_at,
                updated_at: r.updated_at,
            })
            .collect())
    }

    pub async fn get_endpoints_for_event(
        &self,
        merchant_id: Uuid,
        event_type: &WebhookEventType,
    ) -> Result<Vec<WebhookEndpoint>> {
        let event_str = event_type.to_string();
        
        let rows = sqlx::query!(
            r#"
            SELECT id, merchant_id, url, secret, events, enabled, created_at, updated_at
            FROM webhook_endpoints
            WHERE merchant_id = $1 AND enabled = true AND $2 = ANY(events)
            "#,
            merchant_id,
            event_str
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| WebhookEndpoint {
                id: r.id,
                merchant_id: r.merchant_id,
                url: r.url,
                secret: r.secret,
                events: parse_events(&r.events),
                enabled: r.enabled,
                created_at: r.created_at,
                updated_at: r.updated_at,
            })
            .collect())
    }

    pub async fn delete_endpoint(&self, id: Uuid) -> Result<bool> {
        let result = sqlx::query!(
            "DELETE FROM webhook_endpoints WHERE id = $1",
            id
        )
        .execute(&self.db)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn create_delivery(&self, delivery: &WebhookDelivery) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO webhook_deliveries (
                id, endpoint_id, event_type, payload, status, attempts, max_attempts,
                last_attempt_at, next_retry_at, response_status, response_body,
                error_message, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
            delivery.id,
            delivery.endpoint_id,
            delivery.event_type.to_string(),
            delivery.payload,
            status_to_string(&delivery.status),
            delivery.attempts,
            delivery.max_attempts,
            delivery.last_attempt_at,
            delivery.next_retry_at,
            delivery.response_status,
            delivery.response_body,
            delivery.error_message,
            delivery.created_at,
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn get_delivery(&self, id: Uuid) -> Result<Option<WebhookDelivery>> {
        let row = sqlx::query!(
            r#"
            SELECT id, endpoint_id, event_type, payload, status, attempts, max_attempts,
                   last_attempt_at, next_retry_at, response_status, response_body,
                   error_message, created_at
            FROM webhook_deliveries
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(row.map(|r| WebhookDelivery {
            id: r.id,
            endpoint_id: r.endpoint_id,
            event_type: parse_event_type(&r.event_type),
            payload: r.payload,
            status: parse_status(&r.status),
            attempts: r.attempts,
            max_attempts: r.max_attempts,
            last_attempt_at: r.last_attempt_at,
            next_retry_at: r.next_retry_at,
            response_status: r.response_status,
            response_body: r.response_body,
            error_message: r.error_message,
            created_at: r.created_at,
        }))
    }

    pub async fn update_delivery(&self, delivery: &WebhookDelivery) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE webhook_deliveries
            SET status = $2, attempts = $3, last_attempt_at = $4, next_retry_at = $5,
                response_status = $6, response_body = $7, error_message = $8
            WHERE id = $1
            "#,
            delivery.id,
            status_to_string(&delivery.status),
            delivery.attempts,
            delivery.last_attempt_at,
            delivery.next_retry_at,
            delivery.response_status,
            delivery.response_body,
            delivery.error_message,
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn list_deliveries(
        &self,
        endpoint_id: Option<Uuid>,
        status: Option<DeliveryStatus>,
        limit: i64,
    ) -> Result<Vec<WebhookDelivery>> {
        let status_str = status.map(|s| status_to_string(&s));
        
        let rows = sqlx::query!(
            r#"
            SELECT id, endpoint_id, event_type, payload, status, attempts, max_attempts,
                   last_attempt_at, next_retry_at, response_status, response_body,
                   error_message, created_at
            FROM webhook_deliveries
            WHERE ($1::uuid IS NULL OR endpoint_id = $1)
              AND ($2::text IS NULL OR status = $2)
            ORDER BY created_at DESC
            LIMIT $3
            "#,
            endpoint_id,
            status_str,
            limit,
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| WebhookDelivery {
                id: r.id,
                endpoint_id: r.endpoint_id,
                event_type: parse_event_type(&r.event_type),
                payload: r.payload,
                status: parse_status(&r.status),
                attempts: r.attempts,
                max_attempts: r.max_attempts,
                last_attempt_at: r.last_attempt_at,
                next_retry_at: r.next_retry_at,
                response_status: r.response_status,
                response_body: r.response_body,
                error_message: r.error_message,
                created_at: r.created_at,
            })
            .collect())
    }
}

fn parse_events(events: &[String]) -> Vec<WebhookEventType> {
    events
        .iter()
        .filter_map(|e| serde_json::from_str(&format!("\"{}\"", e)).ok())
        .collect()
}

fn parse_event_type(s: &str) -> WebhookEventType {
    serde_json::from_str(&format!("\"{}\"", s)).unwrap_or(WebhookEventType::TransactionCreated)
}

fn parse_status(s: &str) -> DeliveryStatus {
    serde_json::from_str(&format!("\"{}\"", s)).unwrap_or(DeliveryStatus::Pending)
}

fn status_to_string(status: &DeliveryStatus) -> String {
    serde_json::to_string(status)
        .unwrap_or_default()
        .trim_matches('"')
        .to_string()
}
