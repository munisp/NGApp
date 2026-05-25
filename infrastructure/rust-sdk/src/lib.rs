//! NGApp Infrastructure SDK — unified async clients for all 12 platform components.

pub mod postgres;
pub mod redis;
pub mod kafka;
pub mod tigerbeetle;
pub mod mojaloop;
pub mod apisix;
pub mod keycloak;
pub mod openappsec;
pub mod permify;
pub mod opensearch;
pub mod fluvio;
pub mod dapr;
pub mod platform;

pub use platform::{Platform, PlatformConfig};
