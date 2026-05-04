// ============================================================
// Rust High-Performance Services for Domestic Payments
// NIP Monitor, Deduplication, Sanctions Screening, Fee Engine
// ============================================================

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime};

// ============================================================
// 1. Real-Time NIP Monitoring Dashboard
// ============================================================

/// Per-bank metrics tracked in real-time with atomic counters
pub struct BankMetrics {
    pub bank_code: String,
    pub bank_name: String,
    pub total_requests: AtomicU64,
    pub successful: AtomicU64,
    pub failed: AtomicU64,
    pub total_latency_us: AtomicU64,  // microseconds
    pub min_latency_us: AtomicU64,
    pub max_latency_us: AtomicU64,
    pub total_amount: AtomicU64,      // kobo
}

impl BankMetrics {
    pub fn new(code: &str, name: &str) -> Self {
        Self {
            bank_code: code.to_string(),
            bank_name: name.to_string(),
            total_requests: AtomicU64::new(0),
            successful: AtomicU64::new(0),
            failed: AtomicU64::new(0),
            total_latency_us: AtomicU64::new(0),
            min_latency_us: AtomicU64::new(u64::MAX),
            max_latency_us: AtomicU64::new(0),
            total_amount: AtomicU64::new(0),
        }
    }

    pub fn record(&self, success: bool, latency_us: u64, amount_kobo: u64) {
        self.total_requests.fetch_add(1, Ordering::Relaxed);
        if success {
            self.successful.fetch_add(1, Ordering::Relaxed);
        } else {
            self.failed.fetch_add(1, Ordering::Relaxed);
        }
        self.total_latency_us.fetch_add(latency_us, Ordering::Relaxed);
        self.total_amount.fetch_add(amount_kobo, Ordering::Relaxed);

        // Update min
        let mut current = self.min_latency_us.load(Ordering::Relaxed);
        while latency_us < current {
            match self.min_latency_us.compare_exchange_weak(
                current, latency_us, Ordering::Relaxed, Ordering::Relaxed
            ) {
                Ok(_) => break,
                Err(c) => current = c,
            }
        }

        // Update max
        current = self.max_latency_us.load(Ordering::Relaxed);
        while latency_us > current {
            match self.max_latency_us.compare_exchange_weak(
                current, latency_us, Ordering::Relaxed, Ordering::Relaxed
            ) {
                Ok(_) => break,
                Err(c) => current = c,
            }
        }
    }

    pub fn success_rate(&self) -> f64 {
        let total = self.total_requests.load(Ordering::Relaxed);
        if total == 0 { return 100.0; }
        let success = self.successful.load(Ordering::Relaxed);
        (success as f64 / total as f64) * 100.0
    }

    pub fn avg_latency_us(&self) -> f64 {
        let total = self.total_requests.load(Ordering::Relaxed);
        if total == 0 { return 0.0; }
        self.total_latency_us.load(Ordering::Relaxed) as f64 / total as f64
    }

    pub fn tps(&self, window: Duration) -> f64 {
        let total = self.total_requests.load(Ordering::Relaxed);
        total as f64 / window.as_secs_f64()
    }
}

/// Global NIP monitoring dashboard aggregating all bank metrics
pub struct NipMonitorDashboard {
    pub banks: HashMap<String, BankMetrics>,
    pub start_time: Instant,
    // Fluvio stream for real-time metrics emission
    pub fluvio_topic: String,
    // Redis for caching latest snapshot
    pub redis_cache_key: String,
    // OpenSearch for historical metrics
    pub opensearch_index: String,
}

impl NipMonitorDashboard {
    pub fn new() -> Self {
        let mut banks = HashMap::new();
        for (code, name) in [
            ("044", "Access Bank"), ("058", "GTBank"), ("057", "Zenith Bank"),
            ("011", "First Bank"), ("033", "UBA"), ("050", "Ecobank"),
            ("035", "Wema Bank"), ("215", "Unity Bank"), ("232", "Sterling Bank"),
            ("076", "Polaris Bank"), ("214", "FCMB"), ("221", "Stanbic IBTC"),
        ] {
            banks.insert(code.to_string(), BankMetrics::new(code, name));
        }

        Self {
            banks,
            start_time: Instant::now(),
            fluvio_topic: "nibss-nip-metrics".to_string(),
            redis_cache_key: "nibss:nip:dashboard:latest".to_string(),
            opensearch_index: "nibss-nip-realtime-metrics".to_string(),
        }
    }

    pub fn record_transaction(&self, bank_code: &str, success: bool, latency_us: u64, amount_kobo: u64) {
        if let Some(metrics) = self.banks.get(bank_code) {
            metrics.record(success, latency_us, amount_kobo);
        }
    }

    pub fn global_tps(&self) -> f64 {
        let elapsed = self.start_time.elapsed();
        if elapsed.is_zero() { return 0.0; }
        let total: u64 = self.banks.values()
            .map(|b| b.total_requests.load(Ordering::Relaxed))
            .sum();
        total as f64 / elapsed.as_secs_f64()
    }

    pub fn global_success_rate(&self) -> f64 {
        let total: u64 = self.banks.values()
            .map(|b| b.total_requests.load(Ordering::Relaxed))
            .sum();
        if total == 0 { return 100.0; }
        let success: u64 = self.banks.values()
            .map(|b| b.successful.load(Ordering::Relaxed))
            .sum();
        (success as f64 / total as f64) * 100.0
    }

    pub fn top_error_codes(&self) -> Vec<(String, u64)> {
        // In production, this would aggregate from Fluvio stream
        vec![
            ("00 - Approved".to_string(), 0),
            ("09 - Request in progress".to_string(), 0),
            ("51 - Insufficient funds".to_string(), 0),
            ("96 - System malfunction".to_string(), 0),
            ("12 - Invalid transaction".to_string(), 0),
        ]
    }
}

// ============================================================
// 6. PEP/Sanctions Screening
// ============================================================

#[derive(Debug, Clone)]
pub struct SanctionsEntry {
    pub list_name: String,      // OFAC, UN, EU, EFCC
    pub entity_name: String,
    pub entity_type: String,    // INDIVIDUAL, ENTITY, VESSEL
    pub aliases: Vec<String>,
    pub country: String,
    pub score: f64,             // Match confidence 0-100
}

pub struct SanctionsScreener {
    // In production: DashMap for concurrent access
    entries: Vec<SanctionsEntry>,
    // Redis cache for recent screening results
    pub redis_ttl_seconds: u64,
    // TigerBeetle for fee posting (₦25 per screening)
    pub tigerbeetle_fee_code: u16,
    // Kafka for screening events
    pub kafka_topic: String,
}

impl SanctionsScreener {
    pub fn new() -> Self {
        Self {
            entries: vec![
                SanctionsEntry {
                    list_name: "OFAC_SDN".to_string(),
                    entity_name: "Sample Sanctioned Entity".to_string(),
                    entity_type: "ENTITY".to_string(),
                    aliases: vec!["SSE Ltd".to_string()],
                    country: "NG".to_string(),
                    score: 0.0,
                },
                SanctionsEntry {
                    list_name: "EFCC_WATCHLIST".to_string(),
                    entity_name: "Sample PEP Individual".to_string(),
                    entity_type: "INDIVIDUAL".to_string(),
                    aliases: vec![],
                    country: "NG".to_string(),
                    score: 0.0,
                },
            ],
            redis_ttl_seconds: 3600, // 1 hour cache
            tigerbeetle_fee_code: 800,
            kafka_topic: "nibss-sanctions-screening".to_string(),
        }
    }

    /// Screen a name against all sanctions lists
    /// Returns matches with confidence scores
    pub fn screen(&self, name: &str, _country: &str) -> Vec<SanctionsEntry> {
        let name_lower = name.to_lowercase();
        let mut matches = Vec::new();

        for entry in &self.entries {
            let score = Self::fuzzy_match_score(&name_lower, &entry.entity_name.to_lowercase());
            if score >= 80.0 {
                let mut m = entry.clone();
                m.score = score;
                matches.push(m);
                continue;
            }
            // Check aliases
            for alias in &entry.aliases {
                let alias_score = Self::fuzzy_match_score(&name_lower, &alias.to_lowercase());
                if alias_score >= 80.0 {
                    let mut m = entry.clone();
                    m.score = alias_score;
                    matches.push(m);
                    break;
                }
            }
        }
        matches
    }

    fn fuzzy_match_score(query: &str, target: &str) -> f64 {
        if query == target { return 100.0; }
        if target.contains(query) || query.contains(target) { return 90.0; }

        // Simple Jaccard similarity on character bigrams
        let q_bigrams: Vec<String> = query.chars().collect::<Vec<_>>()
            .windows(2).map(|w| w.iter().collect()).collect();
        let t_bigrams: Vec<String> = target.chars().collect::<Vec<_>>()
            .windows(2).map(|w| w.iter().collect()).collect();

        if q_bigrams.is_empty() || t_bigrams.is_empty() { return 0.0; }

        let intersection = q_bigrams.iter()
            .filter(|b| t_bigrams.contains(b))
            .count();
        let union = q_bigrams.len() + t_bigrams.len() - intersection;

        if union == 0 { return 0.0; }
        (intersection as f64 / union as f64) * 100.0
    }
}

// ============================================================
// 13. Request Deduplication (Bloom Filter)
// ============================================================

/// Simple counting bloom filter for idempotency detection
pub struct DeduplicationFilter {
    bits: Vec<bool>,
    size: usize,
    hash_count: usize,
    // Redis for distributed dedup across instances
    pub redis_key_prefix: String,
    pub redis_ttl_seconds: u64,
}

impl DeduplicationFilter {
    pub fn new(expected_items: usize, false_positive_rate: f64) -> Self {
        let size = Self::optimal_size(expected_items, false_positive_rate);
        let hash_count = Self::optimal_hash_count(size, expected_items);
        Self {
            bits: vec![false; size],
            size,
            hash_count,
            redis_key_prefix: "nibss:dedup:bloom".to_string(),
            redis_ttl_seconds: 86400, // 24h
        }
    }

    fn optimal_size(n: usize, p: f64) -> usize {
        let ln2 = std::f64::consts::LN_2;
        (-(n as f64) * p.ln() / (ln2 * ln2)).ceil() as usize
    }

    fn optimal_hash_count(m: usize, n: usize) -> usize {
        let ln2 = std::f64::consts::LN_2;
        ((m as f64 / n as f64) * ln2).ceil() as usize
    }

    fn hash_indices(&self, key: &str) -> Vec<usize> {
        let mut indices = Vec::with_capacity(self.hash_count);
        let base = Self::fnv1a_hash(key.as_bytes());
        let secondary = Self::fnv1a_hash(&base.to_le_bytes());

        for i in 0..self.hash_count {
            let idx = (base.wrapping_add((i as u64).wrapping_mul(secondary))) as usize % self.size;
            indices.push(idx);
        }
        indices
    }

    fn fnv1a_hash(data: &[u8]) -> u64 {
        let mut hash: u64 = 0xcbf29ce484222325;
        for &byte in data {
            hash ^= byte as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash
    }

    /// Check if a key might be a duplicate. Returns true if possibly duplicate.
    pub fn check_and_add(&mut self, key: &str) -> bool {
        let indices = self.hash_indices(key);

        // Check first
        let possibly_exists = indices.iter().all(|&i| self.bits[i]);

        // Add
        for &i in &indices {
            self.bits[i] = true;
        }

        possibly_exists
    }

    /// Check without adding
    pub fn might_contain(&self, key: &str) -> bool {
        let indices = self.hash_indices(key);
        indices.iter().all(|&i| self.bits[i])
    }
}

// ============================================================
// 17. Dynamic Fee Engine
// ============================================================

#[derive(Debug, Clone)]
pub struct FeeRule {
    pub id: String,
    pub product: String,
    pub channel: String,        // ALL, NIP, USSD, POS, WEB
    pub min_amount: u64,        // kobo
    pub max_amount: u64,        // kobo
    pub fee_type: String,       // FLAT, PERCENTAGE, TIERED, CAPPED_PERCENTAGE
    pub flat_fee: u64,          // kobo
    pub percentage: f64,        // e.g., 0.005 for 0.5%
    pub cap: u64,               // max fee in kobo
    pub floor: u64,             // min fee in kobo
    pub time_multiplier: f64,   // 1.0 normal, 1.5 peak hours
    pub is_active: bool,
    pub priority: u32,          // Higher = checked first
}

pub struct DynamicFeeEngine {
    rules: Vec<FeeRule>,
    // TigerBeetle for fee posting
    pub tigerbeetle_fee_account: u128,
    // Kafka for fee events
    pub kafka_topic: String,
}

impl DynamicFeeEngine {
    pub fn new() -> Self {
        Self {
            rules: vec![
                FeeRule { id: "FEE-NIP-1".to_string(), product: "NIP".to_string(), channel: "ALL".to_string(), min_amount: 0, max_amount: 500_000, fee_type: "FLAT".to_string(), flat_fee: 1000, percentage: 0.0, cap: 0, floor: 0, time_multiplier: 1.0, is_active: true, priority: 10 },
                FeeRule { id: "FEE-NIP-2".to_string(), product: "NIP".to_string(), channel: "ALL".to_string(), min_amount: 500_001, max_amount: 5_000_000, fee_type: "FLAT".to_string(), flat_fee: 2500, percentage: 0.0, cap: 0, floor: 0, time_multiplier: 1.0, is_active: true, priority: 10 },
                FeeRule { id: "FEE-NIP-3".to_string(), product: "NIP".to_string(), channel: "ALL".to_string(), min_amount: 5_000_001, max_amount: 50_000_000, fee_type: "FLAT".to_string(), flat_fee: 5000, percentage: 0.0, cap: 0, floor: 0, time_multiplier: 1.0, is_active: true, priority: 10 },
                FeeRule { id: "FEE-NIP-4".to_string(), product: "NIP".to_string(), channel: "ALL".to_string(), min_amount: 50_000_001, max_amount: u64::MAX, fee_type: "CAPPED_PERCENTAGE".to_string(), flat_fee: 0, percentage: 0.005, cap: 25000, floor: 5000, time_multiplier: 1.0, is_active: true, priority: 10 },
                FeeRule { id: "FEE-NEFT-1".to_string(), product: "NEFT".to_string(), channel: "ALL".to_string(), min_amount: 0, max_amount: u64::MAX, fee_type: "TIERED".to_string(), flat_fee: 500, percentage: 0.001, cap: 10000, floor: 500, time_multiplier: 1.0, is_active: true, priority: 5 },
                FeeRule { id: "FEE-BVN-1".to_string(), product: "BVN".to_string(), channel: "ALL".to_string(), min_amount: 0, max_amount: u64::MAX, fee_type: "FLAT".to_string(), flat_fee: 5000, percentage: 0.0, cap: 0, floor: 0, time_multiplier: 1.0, is_active: true, priority: 10 },
                FeeRule { id: "FEE-NQR-1".to_string(), product: "NQR".to_string(), channel: "ALL".to_string(), min_amount: 0, max_amount: u64::MAX, fee_type: "CAPPED_PERCENTAGE".to_string(), flat_fee: 0, percentage: 0.0075, cap: 200000, floor: 100, time_multiplier: 1.0, is_active: true, priority: 10 },
            ],
            tigerbeetle_fee_account: 0xFEE0_0000_0000_0001,
            kafka_topic: "nibss-fee-events".to_string(),
        }
    }

    /// Calculate fee for a transaction
    pub fn calculate_fee(&self, product: &str, channel: &str, amount_kobo: u64, is_peak_hour: bool) -> u64 {
        let mut matching_rules: Vec<&FeeRule> = self.rules.iter()
            .filter(|r| {
                r.is_active
                && r.product == product
                && (r.channel == "ALL" || r.channel == channel)
                && amount_kobo >= r.min_amount
                && amount_kobo <= r.max_amount
            })
            .collect();

        matching_rules.sort_by(|a, b| b.priority.cmp(&a.priority));

        if let Some(rule) = matching_rules.first() {
            let multiplier = if is_peak_hour { rule.time_multiplier.max(1.0) } else { 1.0 };

            let base_fee = match rule.fee_type.as_str() {
                "FLAT" => rule.flat_fee,
                "PERCENTAGE" => (amount_kobo as f64 * rule.percentage) as u64,
                "CAPPED_PERCENTAGE" => {
                    let pct_fee = (amount_kobo as f64 * rule.percentage) as u64;
                    let capped = if rule.cap > 0 { pct_fee.min(rule.cap) } else { pct_fee };
                    if rule.floor > 0 { capped.max(rule.floor) } else { capped }
                },
                "TIERED" => {
                    rule.flat_fee + (amount_kobo as f64 * rule.percentage) as u64
                },
                _ => 0,
            };

            (base_fee as f64 * multiplier) as u64
        } else {
            0
        }
    }
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nip_monitor_records_transactions() {
        let dashboard = NipMonitorDashboard::new();
        dashboard.record_transaction("044", true, 1500, 25000000);
        dashboard.record_transaction("044", true, 2000, 50000000);
        dashboard.record_transaction("044", false, 5000, 10000000);

        let metrics = dashboard.banks.get("044").unwrap();
        assert_eq!(metrics.total_requests.load(Ordering::Relaxed), 3);
        assert_eq!(metrics.successful.load(Ordering::Relaxed), 2);
        assert_eq!(metrics.failed.load(Ordering::Relaxed), 1);
        assert!((metrics.success_rate() - 66.67).abs() < 1.0);
    }

    #[test]
    fn test_dedup_filter_detects_duplicates() {
        let mut filter = DeduplicationFilter::new(10000, 0.01);
        assert!(!filter.check_and_add("NIP-001"));  // New
        assert!(filter.check_and_add("NIP-001"));   // Duplicate
        assert!(!filter.check_and_add("NIP-002"));  // New
    }

    #[test]
    fn test_fee_engine_nip_flat() {
        let engine = DynamicFeeEngine::new();
        assert_eq!(engine.calculate_fee("NIP", "ALL", 250_000, false), 1000);  // ₦10
        assert_eq!(engine.calculate_fee("NIP", "ALL", 1_000_000, false), 2500); // ₦25
        assert_eq!(engine.calculate_fee("NIP", "ALL", 10_000_000, false), 5000); // ₦50
    }

    #[test]
    fn test_fee_engine_bvn_flat() {
        let engine = DynamicFeeEngine::new();
        assert_eq!(engine.calculate_fee("BVN", "ALL", 0, false), 5000); // ₦50
    }

    #[test]
    fn test_sanctions_screening_no_match() {
        let screener = SanctionsScreener::new();
        let results = screener.screen("Adebayo Ogunlade", "NG");
        assert!(results.is_empty());
    }

    #[test]
    fn test_sanctions_screening_exact_match() {
        let screener = SanctionsScreener::new();
        let results = screener.screen("Sample Sanctioned Entity", "NG");
        assert!(!results.is_empty());
        assert!(results[0].score >= 80.0);
    }
}
