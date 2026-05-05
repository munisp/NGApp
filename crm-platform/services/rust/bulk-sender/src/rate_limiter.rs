use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::Arc;

use governor::{Quota, RateLimiter as GovRateLimiter};
use governor::clock::DefaultClock;
use governor::state::{InMemoryState, NotKeyed};
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::models::Channel;

type Limiter = GovRateLimiter<NotKeyed, InMemoryState, DefaultClock>;

/// Per-channel rate limiter with dynamic configuration
pub struct ChannelRateLimiter {
    limiters: Arc<RwLock<HashMap<Channel, Arc<Limiter>>>>,
    default_rate: u32,
}

impl ChannelRateLimiter {
    /// Create a new rate limiter with a default rate per second
    pub fn new(default_rate: u32) -> Self {
        Self {
            limiters: Arc::new(RwLock::new(HashMap::new())),
            default_rate,
        }
    }

    /// Get or create a rate limiter for a channel
    async fn get_or_create(&self, channel: &Channel) -> Arc<Limiter> {
        {
            let limiters = self.limiters.read().await;
            if let Some(limiter) = limiters.get(channel) {
                return limiter.clone();
            }
        }

        let rate = self.get_channel_rate(channel);
        let quota = Quota::per_second(NonZeroU32::new(rate).unwrap_or(NonZeroU32::new(1).unwrap()));
        let limiter = Arc::new(GovRateLimiter::direct(quota));

        let mut limiters = self.limiters.write().await;
        limiters.insert(channel.clone(), limiter.clone());

        info!("Created rate limiter for {}: {} msg/sec", channel, rate);
        limiter
    }

    /// Check if sending is allowed for a channel
    pub async fn check(&self, channel: &Channel) -> bool {
        let limiter = self.get_or_create(channel).await;
        limiter.check().is_ok()
    }

    /// Wait until sending is allowed for a channel
    pub async fn wait(&self, channel: &Channel) {
        let limiter = self.get_or_create(channel).await;
        limiter.until_ready().await;
    }

    /// Update the rate limit for a specific channel
    pub async fn set_rate(&self, channel: Channel, rate: u32) {
        let quota = Quota::per_second(NonZeroU32::new(rate).unwrap_or(NonZeroU32::new(1).unwrap()));
        let limiter = Arc::new(GovRateLimiter::direct(quota));

        let mut limiters = self.limiters.write().await;
        limiters.insert(channel.clone(), limiter);

        info!("Updated rate limit for {}: {} msg/sec", channel, rate);
    }

    /// Get the configured rate for a channel
    fn get_channel_rate(&self, channel: &Channel) -> u32 {
        // Provider-specific limits (messages per second)
        match channel {
            Channel::Sms => self.default_rate.min(50),      // SMS provider limits
            Channel::Whatsapp => self.default_rate.min(80),  // WhatsApp Business API limit
            Channel::Telegram => self.default_rate.min(30),  // Telegram Bot API: 30 msg/sec
            Channel::Voice => self.default_rate.min(10),     // Voice calls are slow
            Channel::Email => self.default_rate.min(200),    // Email can be high throughput
            Channel::Ussd => self.default_rate.min(20),      // USSD session limits
        }
    }

    /// Get current limiter stats
    pub async fn stats(&self) -> HashMap<String, u32> {
        let limiters = self.limiters.read().await;
        let mut stats = HashMap::new();
        for (channel, _) in limiters.iter() {
            stats.insert(channel.to_string(), self.get_channel_rate(channel));
        }
        stats
    }
}
