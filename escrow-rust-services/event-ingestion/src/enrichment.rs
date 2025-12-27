//! Event enrichment with additional context

use sqlx::PgPool;
use tracing::debug;

use escrow_common::{
    types::PlatformEvent,
    Result,
};

#[derive(Clone)]
pub struct EventEnricher {
    db: PgPool,
}

impl EventEnricher {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn enrich(&self, event: &PlatformEvent) -> Result<EnrichedEvent> {
        let mut enriched = EnrichedEvent {
            event: event.clone(),
            merchant_name: None,
            user_name: None,
            transaction_reference: None,
            additional_context: serde_json::json!({}),
        };

        if let Some(merchant_id) = &event.metadata.merchant_id {
            if let Ok(Some(name)) = self.get_merchant_name(*merchant_id).await {
                enriched.merchant_name = Some(name);
            }
        }

        if let Some(user_id) = &event.metadata.user_id {
            if let Ok(Some(name)) = self.get_user_name(*user_id).await {
                enriched.user_name = Some(name);
            }
        }

        if event.aggregate_type == "transaction" {
            if let Ok(Some(reference)) = self.get_transaction_reference(event.aggregate_id).await {
                enriched.transaction_reference = Some(reference);
            }
        }

        debug!("Enriched event {} with additional context", event.id);
        Ok(enriched)
    }

    async fn get_merchant_name(&self, merchant_id: uuid::Uuid) -> Result<Option<String>> {
        let result = sqlx::query_scalar!(
            "SELECT business_name FROM merchants WHERE id = $1",
            merchant_id
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(result.flatten())
    }

    async fn get_user_name(&self, user_id: uuid::Uuid) -> Result<Option<String>> {
        let result = sqlx::query_scalar!(
            "SELECT COALESCE(first_name || ' ' || last_name, email) as name FROM users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(result.flatten())
    }

    async fn get_transaction_reference(&self, transaction_id: uuid::Uuid) -> Result<Option<String>> {
        let result = sqlx::query_scalar!(
            "SELECT reference FROM transactions WHERE id = $1",
            transaction_id
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(result)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnrichedEvent {
    #[serde(flatten)]
    pub event: PlatformEvent,
    pub merchant_name: Option<String>,
    pub user_name: Option<String>,
    pub transaction_reference: Option<String>,
    pub additional_context: serde_json::Value,
}
