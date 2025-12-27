//! Kafka consumer for platform events

use std::sync::Arc;
use std::time::Duration;

use rdkafka::{
    config::ClientConfig,
    consumer::{Consumer, StreamConsumer},
    message::Message,
    TopicPartitionList,
};
use sqlx::PgPool;
use tokio::sync::Semaphore;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use escrow_common::{
    config::KafkaConfig,
    redis_client::RedisClient,
    types::PlatformEvent,
    Result,
};

use crate::enrichment::EventEnricher;
use crate::outbox::OutboxProcessor;
use crate::storage::RustFSClient;

const TOPICS: &[&str] = &[
    "escrow.transactions",
    "escrow.disputes",
    "escrow.payouts",
    "escrow.kyc",
    "escrow.users",
];

const MAX_CONCURRENT_PROCESSING: usize = 50;
const DEDUP_TTL_SECS: u64 = 86400;

pub struct EventConsumer {
    consumer: StreamConsumer,
    db: PgPool,
    redis: RedisClient,
    rustfs: RustFSClient,
    semaphore: Arc<Semaphore>,
    enricher: EventEnricher,
    outbox: OutboxProcessor,
}

impl EventConsumer {
    pub async fn new(
        config: &KafkaConfig,
        db: PgPool,
        redis: RedisClient,
        rustfs: RustFSClient,
    ) -> Result<Self> {
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", &config.bootstrap_servers)
            .set("group.id", &config.group_id)
            .set("auto.offset.reset", &config.auto_offset_reset)
            .set("enable.auto.commit", "false")
            .set("session.timeout.ms", "30000")
            .set("max.poll.interval.ms", "300000")
            .create()
            .map_err(|e| escrow_common::Error::Kafka(e.to_string()))?;

        let topics: Vec<&str> = TOPICS.to_vec();
        consumer
            .subscribe(&topics)
            .map_err(|e| escrow_common::Error::Kafka(e.to_string()))?;

        info!("Subscribed to topics: {:?}", topics);

        Ok(Self {
            consumer,
            db: db.clone(),
            redis: redis.clone(),
            rustfs: rustfs.clone(),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_PROCESSING)),
            enricher: EventEnricher::new(db.clone()),
            outbox: OutboxProcessor::new(db, redis),
        })
    }

    pub async fn start(&self) {
        info!("Starting Kafka consumer loop");

        loop {
            match self.consumer.recv().await {
                Ok(message) => {
                    let permit = match self.semaphore.clone().acquire_owned().await {
                        Ok(p) => p,
                        Err(_) => continue,
                    };

                    let payload = match message.payload() {
                        Some(p) => p.to_vec(),
                        None => continue,
                    };

                    let topic = message.topic().to_string();
                    let partition = message.partition();
                    let offset = message.offset();

                    let db = self.db.clone();
                    let mut redis = self.redis.clone();
                    let rustfs = self.rustfs.clone();
                    let enricher = self.enricher.clone();
                    let outbox = self.outbox.clone();

                    tokio::spawn(async move {
                        let _permit = permit;

                        if let Err(e) = process_message(
                            &payload,
                            &topic,
                            partition,
                            offset,
                            &db,
                            &mut redis,
                            &rustfs,
                            &enricher,
                            &outbox,
                        )
                        .await
                        {
                            error!(
                                "Failed to process message from {}[{}]@{}: {}",
                                topic, partition, offset, e
                            );
                        }
                    });

                    if let Err(e) = self.consumer.commit_message(&message, rdkafka::consumer::CommitMode::Async) {
                        warn!("Failed to commit offset: {}", e);
                    }
                }
                Err(e) => {
                    error!("Kafka consumer error: {}", e);
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }
}

async fn process_message(
    payload: &[u8],
    topic: &str,
    partition: i32,
    offset: i64,
    db: &PgPool,
    redis: &mut RedisClient,
    rustfs: &RustFSClient,
    enricher: &EventEnricher,
    outbox: &OutboxProcessor,
) -> Result<()> {
    let event: PlatformEvent = serde_json::from_slice(payload)?;

    let dedup_key = format!("event:dedup:{}", event.id);
    if let Some(_) = redis.get(&dedup_key).await? {
        debug!("Skipping duplicate event: {}", event.id);
        return Ok(());
    }

    debug!(
        "Processing event {} from {}[{}]@{}",
        event.id, topic, partition, offset
    );

    let enriched_event = enricher.enrich(&event).await?;

    let archive_key = format!(
        "events/{}/{}/{}.json",
        event.created_at.format("%Y/%m/%d"),
        event.aggregate_type,
        event.id
    );
    rustfs
        .put_object(
            "escrow-documents",
            &archive_key,
            serde_json::to_vec(&enriched_event)?,
        )
        .await?;

    outbox.process_event(&enriched_event).await?;

    redis.set(&dedup_key, "1", Some(DEDUP_TTL_SECS)).await?;

    debug!("Successfully processed event: {}", event.id);
    Ok(())
}
