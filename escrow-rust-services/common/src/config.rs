//! Configuration management for EscrowProtect services

use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub service_name: String,
    pub host: String,
    pub port: u16,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub kafka: KafkaConfig,
    pub rustfs: RustFSConfig,
    pub telemetry: TelemetryConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connect_timeout_secs: u64,
    pub idle_timeout_secs: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub pool_size: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct KafkaConfig {
    pub bootstrap_servers: String,
    pub group_id: String,
    pub auto_offset_reset: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RustFSConfig {
    pub endpoint: String,
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
    pub bucket: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TelemetryConfig {
    pub otlp_endpoint: Option<String>,
    pub metrics_port: u16,
    pub log_level: String,
}

impl AppConfig {
    pub fn from_env(service_name: &str) -> Result<Self, config::ConfigError> {
        let config = config::Config::builder()
            .set_default("service_name", service_name)?
            .set_default("host", "0.0.0.0")?
            .set_default("port", 8080)?
            .set_default("database.url", "postgres://localhost/escrow")?
            .set_default("database.max_connections", 10)?
            .set_default("database.min_connections", 2)?
            .set_default("database.connect_timeout_secs", 30)?
            .set_default("database.idle_timeout_secs", 600)?
            .set_default("redis.url", "redis://localhost:6379")?
            .set_default("redis.pool_size", 10)?
            .set_default("kafka.bootstrap_servers", "localhost:9092")?
            .set_default("kafka.group_id", service_name)?
            .set_default("kafka.auto_offset_reset", "earliest")?
            .set_default("rustfs.endpoint", "http://localhost:9000")?
            .set_default("rustfs.access_key", "escrowprotect")?
            .set_default("rustfs.secret_key", "escrowprotect-secret-key")?
            .set_default("rustfs.region", "af-south-1")?
            .set_default("rustfs.bucket", "escrow-documents")?
            .set_default("telemetry.metrics_port", 9090)?
            .set_default("telemetry.log_level", "info")?
            .add_source(config::Environment::with_prefix("ESCROW").separator("__"))
            .build()?;

        config.try_deserialize()
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self::from_env("escrow-service").expect("Failed to load default config")
    }
}
