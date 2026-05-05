use std::sync::Arc;

use anyhow::Result;
use chrono::Utc;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::{ClientConfig, Message as KafkaMessage};
use tokio::sync::Semaphore;
use tracing::{info, warn, error};

use crate::channels::ChannelDispatcher;
use crate::metrics::MetricsCollector;
use crate::models::{DeliveryStatus, RetryPolicy, SendBatch, SendRequest, SendResult};
use crate::rate_limiter::ChannelRateLimiter;
use crate::retry::{RetryEntry, RetryQueue};

/// The core bulk send engine that orchestrates message dispatch
pub struct BulkSendEngine {
    redis: redis::aio::ConnectionManager,
    kafka_producer: FutureProducer,
    kafka_consumer: StreamConsumer,
    dispatcher: ChannelDispatcher,
    rate_limiter: ChannelRateLimiter,
    retry_queue: RetryQueue,
    metrics: Arc<MetricsCollector>,
    worker_semaphore: Arc<Semaphore>,
    worker_count: usize,
}

impl BulkSendEngine {
    pub async fn new(
        redis_url: &str,
        kafka_brokers: &str,
        default_rate_limit: u32,
        worker_count: usize,
    ) -> Result<Self> {
        let redis_client = redis::Client::open(redis_url)?;
        let redis_conn = redis::aio::ConnectionManager::new(redis_client).await?;

        let kafka_producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", kafka_brokers)
            .set("message.timeout.ms", "5000")
            .set("queue.buffering.max.messages", "100000")
            .set("batch.num.messages", "1000")
            .set("linger.ms", "10")
            .create()?;

        let kafka_consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", kafka_brokers)
            .set("group.id", "bulk-sender-engine")
            .set("auto.offset.reset", "latest")
            .set("enable.auto.commit", "true")
            .set("auto.commit.interval.ms", "1000")
            .create()?;

        kafka_consumer.subscribe(&["campaign.send_requests", "campaign.send_batches"])?;

        let retry_queue = RetryQueue::new(redis_conn.clone());

        Ok(Self {
            redis: redis_conn,
            kafka_producer,
            kafka_consumer,
            dispatcher: ChannelDispatcher::new(),
            rate_limiter: ChannelRateLimiter::new(default_rate_limit),
            retry_queue,
            metrics: Arc::new(MetricsCollector::new()),
            worker_semaphore: Arc::new(Semaphore::new(worker_count)),
            worker_count,
        })
    }

    /// Start consuming messages from Kafka and dispatching them
    pub async fn start_consuming(&self) -> Result<()> {
        use rdkafka::consumer::StreamConsumer;
        use futures::StreamExt;

        info!("Starting Kafka consumer for campaign send requests");

        let stream = self.kafka_consumer.stream();
        tokio::pin!(stream);

        while let Some(result) = stream.next().await {
            match result {
                Ok(msg) => {
                    if let Some(payload) = msg.payload() {
                        let payload_str = String::from_utf8_lossy(payload);

                        // Try to parse as a batch first
                        if let Ok(batch) = serde_json::from_str::<SendBatch>(&payload_str) {
                            info!(
                                "Received batch: campaign={} messages={}",
                                batch.campaign_id,
                                batch.messages.len()
                            );
                            self.process_batch(batch).await;
                        }
                        // Then try as a single request
                        else if let Ok(request) = serde_json::from_str::<SendRequest>(&payload_str)
                        {
                            self.process_single(request).await;
                        } else {
                            warn!("Failed to parse Kafka message as SendBatch or SendRequest");
                        }
                    }
                }
                Err(e) => {
                    warn!("Kafka consumer error: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Process a batch of messages with rate limiting and concurrency control
    async fn process_batch(&self, batch: SendBatch) {
        let policy = batch.retry_policy.clone();

        // Apply campaign-specific rate limit if provided
        if let Some(rate) = batch.rate_limit {
            for msg in &batch.messages {
                self.rate_limiter
                    .set_rate(msg.channel.clone(), rate)
                    .await;
            }
        }

        let mut handles = Vec::new();

        for request in batch.messages {
            let permit = self.worker_semaphore.clone().acquire_owned().await.unwrap();
            let dispatcher = &self.dispatcher;
            let rate_limiter = &self.rate_limiter;
            let metrics = self.metrics.clone();
            let retry_queue = &self.retry_queue;
            let policy = policy.clone();
            let kafka_producer = &self.kafka_producer;

            let channel = request.channel.clone();

            // Wait for rate limiter
            rate_limiter.wait(&channel).await;

            // This is a simplified version; in production you'd spawn tasks properly
            let result = dispatcher.send(&request).await;

            match result.status {
                DeliveryStatus::Sent => {
                    metrics.record_sent(&result.channel, result.latency_ms);
                }
                DeliveryStatus::Failed => {
                    metrics.record_failed(&result.channel);

                    // Enqueue for retry if policy allows
                    let entry = RetryEntry::new(
                        request,
                        result.error_message.clone().unwrap_or_default(),
                        policy.clone(),
                    );
                    if entry.should_retry() {
                        if let Err(e) = retry_queue.enqueue(entry).await {
                            error!("Failed to enqueue retry: {}", e);
                        }
                    }
                }
                _ => {}
            }

            // Publish result to Kafka
            self.publish_result(&result).await;

            drop(permit);
        }
    }

    /// Process a single message
    async fn process_single(&self, request: SendRequest) {
        let channel = request.channel.clone();

        // Wait for rate limiter
        self.rate_limiter.wait(&channel).await;

        let result = self.dispatcher.send(&request).await;

        match result.status {
            DeliveryStatus::Sent => {
                self.metrics.record_sent(&result.channel, result.latency_ms);
            }
            DeliveryStatus::Failed => {
                self.metrics.record_failed(&result.channel);

                let entry = RetryEntry::new(
                    request,
                    result.error_message.clone().unwrap_or_default(),
                    RetryPolicy::default(),
                );
                if entry.should_retry() {
                    if let Err(e) = self.retry_queue.enqueue(entry).await {
                        error!("Failed to enqueue retry: {}", e);
                    }
                }
            }
            _ => {}
        }

        self.publish_result(&result).await;
    }

    /// Process entries in the retry queue
    pub async fn process_retry_queue(&self) -> Result<()> {
        let entries = self.retry_queue.dequeue_ready(50).await?;

        if entries.is_empty() {
            return Ok(());
        }

        info!("Processing {} retry entries", entries.len());

        for mut entry in entries {
            self.metrics.record_retry();

            let channel = entry.request.channel.clone();
            self.rate_limiter.wait(&channel).await;

            let result = self.dispatcher.send(&entry.request).await;

            match result.status {
                DeliveryStatus::Sent => {
                    self.metrics.record_sent(&result.channel, result.latency_ms);
                    self.publish_result(&result).await;
                }
                DeliveryStatus::Failed => {
                    entry.increment(result.error_message.clone().unwrap_or_default());

                    if entry.should_retry() {
                        if let Err(e) = self.retry_queue.enqueue(entry).await {
                            error!("Failed to re-enqueue retry: {}", e);
                        }
                    } else {
                        // Permanently failed
                        let failed_result = entry.to_failed_result();
                        self.metrics.record_failed(&failed_result.channel);
                        self.publish_result(&failed_result).await;
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Publish a send result to Kafka for downstream processing
    async fn publish_result(&self, result: &SendResult) {
        let payload = match serde_json::to_string(result) {
            Ok(p) => p,
            Err(e) => {
                error!("Failed to serialize send result: {}", e);
                return;
            }
        };

        let record = FutureRecord::to("campaign.send_results")
            .key(&result.campaign_id)
            .payload(&payload);

        if let Err((e, _)) = self.kafka_producer.send(record, std::time::Duration::from_secs(5)).await {
            warn!("Failed to publish send result to Kafka: {}", e);
        }
    }

    /// Report current metrics
    pub async fn report_metrics(&self) {
        let retry_depth = self.retry_queue.depth().await.unwrap_or(0);
        self.metrics
            .publish_to_redis(&mut self.redis.clone(), 0, retry_depth)
            .await;
    }
}
