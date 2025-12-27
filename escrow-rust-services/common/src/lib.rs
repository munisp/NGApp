//! Common utilities and types for EscrowProtect Rust services
//!
//! This crate provides shared functionality across all Rust microservices:
//! - Configuration management
//! - Database connection pooling
//! - Redis client
//! - Cryptographic utilities (HMAC signing)
//! - Common data types

pub mod config;
pub mod crypto;
pub mod db;
pub mod error;
pub mod redis_client;
pub mod types;

pub use config::AppConfig;
pub use error::{Error, Result};
