//! Middleware Integration for NIBSS Identity & Transaction Services (Rust)
//!
//! Tightly integrates high-performance Rust NIBSS services with:
//! - **TigerBeetle**: Double-entry ledger postings for identity verification fees,
//!   NEFT settlement, NDD mandate debits, reversal entries
//! - **Fluvio**: Real-time stream processing for identity verification events,
//!   TSQ results, ISO 20022 message parsing pipeline
//! - **Redis**: Sub-microsecond caching for BVN/NIN lookups, name enquiry results,
//!   TSQ result caching, rate limiting per bank/client
//! - **OpenAppSec**: WAF integration for request validation, BVN format checks,
//!   XML entity injection prevention on ISO 20022 payloads

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

// ======================== TigerBeetle Ledger Integration ========================

/// TigerBeetle account family IDs for NIBSS domestic operations.
/// Each account family uses u64 IDs compatible with TigerBeetle's 128-bit ID space.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NIBSSTigerBeetleAccounts {
    /// Identity verification fee collection account
    pub identity_fee_income: u64,
    /// NEFT clearing house intermediate account
    pub neft_clearing_house: u64,
    /// NEFT settlement suspense (pending confirmation)
    pub neft_settlement_suspense: u64,
    /// NACS cheque clearing float
    pub nacs_clearing_float: u64,
    /// NDD direct debit collection account
    pub ndd_collection: u64,
    /// GSI recovery cross-bank account
    pub gsi_recovery: u64,
    /// Reversal suspense account
    pub reversal_suspense: u64,
    /// NIBSS switch fee income
    pub nibss_fee_income: u64,
    /// PayDirect collection pool
    pub paydirect_pool: u64,
    /// ISO 20022 message processing fee
    pub iso20022_processing_fee: u64,
}

impl Default for NIBSSTigerBeetleAccounts {
    fn default() -> Self {
        Self {
            identity_fee_income: 7001,
            neft_clearing_house: 7002,
            neft_settlement_suspense: 7003,
            nacs_clearing_float: 7004,
            ndd_collection: 7005,
            gsi_recovery: 7006,
            reversal_suspense: 7007,
            nibss_fee_income: 7008,
            paydirect_pool: 7009,
            iso20022_processing_fee: 7010,
        }
    }
}

/// A TigerBeetle transfer command for NIBSS operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TigerBeetleTransfer {
    pub id: u64,
    pub debit_account_id: u64,
    pub credit_account_id: u64,
    pub amount: u64,        // Kobo (smallest unit)
    pub ledger: u32,        // 1 = NGN, 2 = USD
    pub code: u16,          // Operation type code
    pub flags: u16,
    pub user_data: u64,     // Reference to source operation
}

/// Generates TigerBeetle postings for BVN/NIN verification fee collection.
/// Fee: ₦50 per BVN lookup, ₦30 per NIN lookup (NIBSS standard fees).
pub fn identity_verification_postings(
    id_type: &str,
    requesting_bank_account: u64,
    accounts: &NIBSSTigerBeetleAccounts,
) -> Vec<TigerBeetleTransfer> {
    let fee_kobo: u64 = match id_type {
        "BVN" => 5000,  // ₦50
        "NIN" => 3000,  // ₦30
        _ => 2000,      // ₦20 default
    };

    vec![
        // Debit requesting bank → Credit NIBSS identity fee income
        TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: requesting_bank_account,
            credit_account_id: accounts.identity_fee_income,
            amount: fee_kobo,
            ledger: 1, // NGN
            code: 701, // Identity verification fee
            flags: 0,
            user_data: 0,
        },
    ]
}

/// Generates TigerBeetle postings for name enquiry fee.
/// Fee: ₦10 per name enquiry (NIBSS standard).
pub fn name_enquiry_postings(
    requesting_bank_account: u64,
    accounts: &NIBSSTigerBeetleAccounts,
) -> Vec<TigerBeetleTransfer> {
    vec![
        TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: requesting_bank_account,
            credit_account_id: accounts.nibss_fee_income,
            amount: 1000, // ₦10 in kobo
            ledger: 1,
            code: 702, // Name enquiry fee
            flags: 0,
            user_data: 0,
        },
    ]
}

/// Generates TigerBeetle postings for NDD mandate debit execution.
pub fn ndd_debit_postings(
    subscriber_account: u64,
    biller_account: u64,
    amount_kobo: u64,
    is_gsi: bool,
    accounts: &NIBSSTigerBeetleAccounts,
) -> Vec<TigerBeetleTransfer> {
    let mut transfers = vec![
        // Debit subscriber → Credit collection account
        TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: subscriber_account,
            credit_account_id: accounts.ndd_collection,
            amount: amount_kobo,
            ledger: 1,
            code: if is_gsi { 711 } else { 710 }, // GSI vs regular NDD
            flags: 0,
            user_data: 0,
        },
        // Debit collection account → Credit biller
        TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: accounts.ndd_collection,
            credit_account_id: biller_account,
            amount: amount_kobo,
            ledger: 1,
            code: if is_gsi { 712 } else { 713 },
            flags: 0,
            user_data: 0,
        },
        // NIBSS fee: 0.5% of amount, capped at ₦500
        TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: biller_account,
            credit_account_id: accounts.nibss_fee_income,
            amount: std::cmp::min(amount_kobo / 200, 50000), // 0.5% capped at ₦500
            ledger: 1,
            code: 714,
            flags: 0,
            user_data: 0,
        },
    ];

    if is_gsi {
        // GSI: Additional CBN levy (0.1%)
        transfers.push(TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: biller_account,
            credit_account_id: accounts.nibss_fee_income,
            amount: amount_kobo / 1000, // 0.1%
            ledger: 1,
            code: 715, // GSI CBN levy
            flags: 0,
            user_data: 0,
        });
    }

    transfers
}

/// Generates TigerBeetle postings for a NIP reversal.
pub fn reversal_postings(
    receiver_bank_account: u64,
    sender_bank_account: u64,
    amount_kobo: u64,
    accounts: &NIBSSTigerBeetleAccounts,
) -> Vec<TigerBeetleTransfer> {
    vec![
        // Debit receiver bank → Credit reversal suspense
        TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: receiver_bank_account,
            credit_account_id: accounts.reversal_suspense,
            amount: amount_kobo,
            ledger: 1,
            code: 720, // Reversal debit
            flags: 0,
            user_data: 0,
        },
        // Debit reversal suspense → Credit sender bank (complete reversal)
        TigerBeetleTransfer {
            id: generate_transfer_id(),
            debit_account_id: accounts.reversal_suspense,
            credit_account_id: sender_bank_account,
            amount: amount_kobo,
            ledger: 1,
            code: 721, // Reversal credit
            flags: 0,
            user_data: 0,
        },
    ]
}

static TRANSFER_ID_COUNTER: AtomicU64 = AtomicU64::new(70000);

fn generate_transfer_id() -> u64 {
    TRANSFER_ID_COUNTER.fetch_add(1, Ordering::Relaxed)
}

// ======================== Fluvio Stream Processing ========================

/// Fluvio topic configuration for NIBSS real-time event streams.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FluvioTopicConfig {
    pub topic_name: String,
    pub partitions: u32,
    pub replication_factor: u32,
    pub retention_ms: u64,
    pub description: String,
}

/// Returns all Fluvio topic configurations for NIBSS domestic services.
pub fn nibss_fluvio_topics() -> Vec<FluvioTopicConfig> {
    vec![
        FluvioTopicConfig {
            topic_name: "nibss-identity-verifications".into(),
            partitions: 8,
            replication_factor: 3,
            retention_ms: 7 * 24 * 3600 * 1000, // 7 days
            description: "BVN/NIN verification events with response times".into(),
        },
        FluvioTopicConfig {
            topic_name: "nibss-name-enquiry-stream".into(),
            partitions: 12,
            replication_factor: 3,
            retention_ms: 24 * 3600 * 1000, // 1 day
            description: "Real-time account name enquiry events".into(),
        },
        FluvioTopicConfig {
            topic_name: "nibss-tsq-stream".into(),
            partitions: 8,
            replication_factor: 3,
            retention_ms: 3600 * 1000, // 1 hour
            description: "Transaction status query results for monitoring".into(),
        },
        FluvioTopicConfig {
            topic_name: "nibss-iso20022-ingest".into(),
            partitions: 4,
            replication_factor: 3,
            retention_ms: 30 * 24 * 3600 * 1000, // 30 days
            description: "Incoming ISO 20022 messages for parsing and validation".into(),
        },
        FluvioTopicConfig {
            topic_name: "nibss-neft-settlement-stream".into(),
            partitions: 6,
            replication_factor: 3,
            retention_ms: 7 * 24 * 3600 * 1000,
            description: "NEFT batch settlement events".into(),
        },
        FluvioTopicConfig {
            topic_name: "nibss-ndd-debit-stream".into(),
            partitions: 8,
            replication_factor: 3,
            retention_ms: 30 * 24 * 3600 * 1000,
            description: "NDD mandate debit execution events".into(),
        },
        FluvioTopicConfig {
            topic_name: "nibss-reversal-stream".into(),
            partitions: 4,
            replication_factor: 3,
            retention_ms: 90 * 24 * 3600 * 1000, // 90 days
            description: "NIP reversal request and resolution events".into(),
        },
        FluvioTopicConfig {
            topic_name: "nibss-dispute-stream".into(),
            partitions: 4,
            replication_factor: 3,
            retention_ms: 365 * 24 * 3600 * 1000, // 1 year
            description: "Inter-bank dispute lifecycle events".into(),
        },
    ]
}

/// Fluvio SmartModule filter for identity verification events.
/// Filters events where response time exceeds SLA threshold (>500μs).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FluvioSmartModuleConfig {
    pub name: String,
    pub module_type: String,  // filter, map, filter-map, aggregate
    pub description: String,
    pub config: HashMap<String, String>,
}

/// Returns SmartModule configurations for NIBSS Fluvio processing.
pub fn nibss_fluvio_smartmodules() -> Vec<FluvioSmartModuleConfig> {
    vec![
        FluvioSmartModuleConfig {
            name: "identity-sla-monitor".into(),
            module_type: "filter".into(),
            description: "Filters identity verification events exceeding 500μs SLA".into(),
            config: HashMap::from([
                ("threshold_us".into(), "500".into()),
                ("alert_topic".into(), "nibss-sla-breaches".into()),
            ]),
        },
        FluvioSmartModuleConfig {
            name: "iso20022-validator".into(),
            module_type: "filter-map".into(),
            description: "Validates and enriches incoming ISO 20022 messages".into(),
            config: HashMap::from([
                ("schema_version".into(), "2019".into()),
                ("reject_topic".into(), "nibss-iso20022-rejected".into()),
            ]),
        },
        FluvioSmartModuleConfig {
            name: "tsq-anomaly-detector".into(),
            module_type: "filter".into(),
            description: "Detects anomalous TSQ patterns (repeated queries on same ref)".into(),
            config: HashMap::from([
                ("window_seconds".into(), "60".into()),
                ("max_queries_per_ref".into(), "5".into()),
            ]),
        },
        FluvioSmartModuleConfig {
            name: "ndd-debit-aggregator".into(),
            module_type: "aggregate".into(),
            description: "Aggregates NDD debits per biller per window for settlement".into(),
            config: HashMap::from([
                ("window_minutes".into(), "15".into()),
                ("output_topic".into(), "nibss-ndd-settlement-batches".into()),
            ]),
        },
    ]
}

// ======================== Redis Caching ========================

/// Redis cache key patterns for NIBSS identity services.
/// All keys use the `nibss:` prefix for namespace isolation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisCacheEntry {
    pub key_pattern: String,
    pub ttl_seconds: u64,
    pub description: String,
    pub eviction_policy: String,
}

/// Returns Redis cache configuration for all NIBSS services.
pub fn nibss_redis_cache_config() -> Vec<RedisCacheEntry> {
    vec![
        RedisCacheEntry {
            key_pattern: "nibss:bvn:{bvn}".into(),
            ttl_seconds: 259200, // 72 hours
            description: "BVN verification result cache".into(),
            eviction_policy: "allkeys-lru".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:nin:{nin}".into(),
            ttl_seconds: 259200, // 72 hours
            description: "NIN verification result cache".into(),
            eviction_policy: "allkeys-lru".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:name:{bank_code}:{account_number}".into(),
            ttl_seconds: 86400, // 24 hours
            description: "Account name enquiry result cache".into(),
            eviction_policy: "allkeys-lru".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:tsq:{nip_ref}".into(),
            ttl_seconds: 300, // 5 minutes
            description: "TSQ result cache (short-lived for real-time accuracy)".into(),
            eviction_policy: "volatile-ttl".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:iso20022:msg:{message_id}".into(),
            ttl_seconds: 3600, // 1 hour
            description: "Parsed ISO 20022 message cache".into(),
            eviction_policy: "allkeys-lru".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:ratelimit:{service}:{client_id}".into(),
            ttl_seconds: 60, // 1 minute sliding window
            description: "Per-client rate limiting counter".into(),
            eviction_policy: "volatile-ttl".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:idempotency:{operation}:{key}".into(),
            ttl_seconds: 86400, // 24 hours
            description: "Idempotency key for mutation operations".into(),
            eviction_policy: "volatile-ttl".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:neft:batch:{batch_ref}".into(),
            ttl_seconds: 3600,
            description: "NEFT batch status cache".into(),
            eviction_policy: "allkeys-lru".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:mandate:{mandate_ref}".into(),
            ttl_seconds: 1800, // 30 minutes
            description: "NDD mandate status cache".into(),
            eviction_policy: "allkeys-lru".into(),
        },
        RedisCacheEntry {
            key_pattern: "nibss:merchant:{merchant_code}".into(),
            ttl_seconds: 3600,
            description: "Merchant registry cache".into(),
            eviction_policy: "allkeys-lru".into(),
        },
    ]
}

// ======================== OpenAppSec WAF Integration ========================

/// OpenAppSec WAF rule for NIBSS API protection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WafRule {
    pub rule_id: String,
    pub name: String,
    pub description: String,
    pub action: String,       // BLOCK, LOG, CHALLENGE
    pub pattern: String,
    pub target: String,       // BODY, HEADER, URI, QUERY
    pub severity: String,     // CRITICAL, HIGH, MEDIUM, LOW
}

/// Returns OpenAppSec WAF rules specific to NIBSS identity and transaction APIs.
pub fn nibss_waf_rules() -> Vec<WafRule> {
    vec![
        WafRule {
            rule_id: "NIBSS-RS-001".into(),
            name: "BVN Injection Prevention".into(),
            description: "Blocks BVN fields containing non-numeric characters".into(),
            action: "BLOCK".into(),
            pattern: r#"bvn.*[^0-9]"#.into(),
            target: "BODY".into(),
            severity: "CRITICAL".into(),
        },
        WafRule {
            rule_id: "NIBSS-RS-002".into(),
            name: "NIN Format Validation".into(),
            description: "Ensures NIN is exactly 11 digits".into(),
            action: "BLOCK".into(),
            pattern: r#"nin.*(?!\d{11})"#.into(),
            target: "BODY".into(),
            severity: "HIGH".into(),
        },
        WafRule {
            rule_id: "NIBSS-RS-003".into(),
            name: "Account Number Validation".into(),
            description: "Blocks account numbers with invalid format".into(),
            action: "BLOCK".into(),
            pattern: r#"account_number.*[^0-9A-Z\-]"#.into(),
            target: "BODY".into(),
            severity: "HIGH".into(),
        },
        WafRule {
            rule_id: "NIBSS-RS-004".into(),
            name: "ISO 20022 XXE Prevention".into(),
            description: "Blocks XML external entity injection in ISO 20022 payloads".into(),
            action: "BLOCK".into(),
            pattern: r#"<!ENTITY|<!DOCTYPE.*\[|SYSTEM\s+[\"']"#.into(),
            target: "BODY".into(),
            severity: "CRITICAL".into(),
        },
        WafRule {
            rule_id: "NIBSS-RS-005".into(),
            name: "TSQ Enumeration Prevention".into(),
            description: "Rate-limits TSQ queries to prevent NIP reference enumeration".into(),
            action: "CHALLENGE".into(),
            pattern: r#"nip_ref=NIP-[A-Z]+-\d{3,}"#.into(),
            target: "QUERY".into(),
            severity: "MEDIUM".into(),
        },
        WafRule {
            rule_id: "NIBSS-RS-006".into(),
            name: "Mandate Amount Overflow".into(),
            description: "Blocks NDD mandate amounts exceeding ₦100B (overflow attack)".into(),
            action: "BLOCK".into(),
            pattern: r#"amount.*\d{14,}"#.into(),
            target: "BODY".into(),
            severity: "HIGH".into(),
        },
    ]
}

// ======================== Middleware Metrics ========================

/// Aggregated metrics for NIBSS middleware integration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NIBSSMiddlewareMetrics {
    pub tigerbeetle_postings_total: u64,
    pub tigerbeetle_postings_failed: u64,
    pub fluvio_events_produced: u64,
    pub fluvio_events_consumed: u64,
    pub redis_cache_hits: u64,
    pub redis_cache_misses: u64,
    pub waf_requests_blocked: u64,
    pub waf_requests_logged: u64,
    pub identity_verifications_total: u64,
    pub avg_verification_latency_us: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_verification_postings() {
        let accounts = NIBSSTigerBeetleAccounts::default();
        let postings = identity_verification_postings("BVN", 1001, &accounts);
        assert_eq!(postings.len(), 1);
        assert_eq!(postings[0].amount, 5000); // ₦50 in kobo
        assert_eq!(postings[0].credit_account_id, accounts.identity_fee_income);
    }

    #[test]
    fn test_ndd_debit_postings() {
        let accounts = NIBSSTigerBeetleAccounts::default();
        let postings = ndd_debit_postings(1001, 2001, 5_000_000, false, &accounts);
        assert_eq!(postings.len(), 3); // debit, credit, fee
        assert_eq!(postings[0].amount, 5_000_000);
    }

    #[test]
    fn test_gsi_debit_postings() {
        let accounts = NIBSSTigerBeetleAccounts::default();
        let postings = ndd_debit_postings(1001, 2001, 25_000_000, true, &accounts);
        assert_eq!(postings.len(), 4); // debit, credit, fee, GSI levy
    }

    #[test]
    fn test_reversal_postings() {
        let accounts = NIBSSTigerBeetleAccounts::default();
        let postings = reversal_postings(2001, 1001, 50_000_000, &accounts);
        assert_eq!(postings.len(), 2);
        assert_eq!(postings[0].amount, 50_000_000);
    }

    #[test]
    fn test_fluvio_topics() {
        let topics = nibss_fluvio_topics();
        assert_eq!(topics.len(), 8);
        assert!(topics.iter().any(|t| t.topic_name == "nibss-identity-verifications"));
    }

    #[test]
    fn test_redis_cache_config() {
        let config = nibss_redis_cache_config();
        assert!(config.len() >= 10);
        let bvn_cache = config.iter().find(|c| c.key_pattern.contains("bvn")).unwrap();
        assert_eq!(bvn_cache.ttl_seconds, 259200);
    }

    #[test]
    fn test_waf_rules() {
        let rules = nibss_waf_rules();
        assert!(rules.len() >= 6);
        assert!(rules.iter().any(|r| r.rule_id == "NIBSS-RS-004")); // XXE prevention
    }
}
