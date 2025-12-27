//! Redis client for caching and rate limiting

use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use tracing::info;

use crate::config::RedisConfig;
use crate::error::{Error, Result};

/// Redis client wrapper with connection management
#[derive(Clone)]
pub struct RedisClient {
    conn: ConnectionManager,
}

impl RedisClient {
    /// Create a new Redis client
    pub async fn new(config: &RedisConfig) -> Result<Self> {
        info!("Connecting to Redis at {}", config.url);
        
        let client = redis::Client::open(config.url.as_str())
            .map_err(|e| Error::Redis(e))?;
        
        let conn = ConnectionManager::new(client)
            .await
            .map_err(|e| Error::Redis(e))?;
        
        info!("Redis connection established");
        Ok(Self { conn })
    }

    /// Get a value from Redis
    pub async fn get(&mut self, key: &str) -> Result<Option<String>> {
        let value: Option<String> = self.conn.get(key).await?;
        Ok(value)
    }

    /// Set a value in Redis with optional expiration
    pub async fn set(&mut self, key: &str, value: &str, ttl_secs: Option<u64>) -> Result<()> {
        if let Some(ttl) = ttl_secs {
            self.conn.set_ex(key, value, ttl).await?;
        } else {
            self.conn.set(key, value).await?;
        }
        Ok(())
    }

    /// Delete a key from Redis
    pub async fn delete(&mut self, key: &str) -> Result<bool> {
        let deleted: i32 = self.conn.del(key).await?;
        Ok(deleted > 0)
    }

    /// Increment a counter with expiration (for rate limiting)
    pub async fn incr_with_expiry(&mut self, key: &str, ttl_secs: u64) -> Result<i64> {
        let count: i64 = redis::pipe()
            .atomic()
            .incr(key, 1i64)
            .expire(key, ttl_secs as i64)
            .ignore()
            .query_async(&mut self.conn)
            .await?;
        Ok(count)
    }

    /// Check rate limit (returns true if allowed)
    pub async fn check_rate_limit(
        &mut self,
        key: &str,
        max_requests: i64,
        window_secs: u64,
    ) -> Result<bool> {
        let count = self.incr_with_expiry(key, window_secs).await?;
        Ok(count <= max_requests)
    }

    /// Add to a sorted set (for retry scheduling)
    pub async fn zadd(&mut self, key: &str, score: f64, member: &str) -> Result<()> {
        self.conn.zadd(key, member, score).await?;
        Ok(())
    }

    /// Get items from sorted set by score range
    pub async fn zrangebyscore(
        &mut self,
        key: &str,
        min: f64,
        max: f64,
        limit: isize,
    ) -> Result<Vec<String>> {
        let items: Vec<String> = self.conn
            .zrangebyscore_limit(key, min, max, 0, limit)
            .await?;
        Ok(items)
    }

    /// Remove items from sorted set
    pub async fn zrem(&mut self, key: &str, members: &[String]) -> Result<i64> {
        if members.is_empty() {
            return Ok(0);
        }
        let removed: i64 = self.conn.zrem(key, members).await?;
        Ok(removed)
    }

    /// Health check
    pub async fn health_check(&mut self) -> bool {
        let result: redis::RedisResult<String> = redis::cmd("PING")
            .query_async(&mut self.conn)
            .await;
        result.is_ok()
    }
}
