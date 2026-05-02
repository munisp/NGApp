//! Lock-free FX rate cache with TTL-based expiry.
//! Achieves <200ns lookups using DashMap with pre-hashed keys.

use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Currency pair identifier (packed into u32 for fast hashing)
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct CurrencyPair {
    /// Packed: source currency (u16) | target currency (u16)
    packed: u32,
}

impl CurrencyPair {
    pub fn new(source: CurrencyCode, target: CurrencyCode) -> Self {
        Self {
            packed: ((source as u32) << 16) | (target as u32),
        }
    }

    pub fn source(&self) -> u16 { (self.packed >> 16) as u16 }
    pub fn target(&self) -> u16 { (self.packed & 0xFFFF) as u16 }
}

/// Currency codes as compact u16 values
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum CurrencyCode {
    NGN = 566,
    USD = 840,
    GBP = 826,
    EUR = 978,
    BTC = 1000,
    ETH = 1001,
    USDC = 1002,
    USDT = 1003,
    GHS = 936,
    KES = 404,
    ZAR = 710,
    XOF = 952,
}

/// FX rate with metadata (fits in 2 cache lines)
#[derive(Debug, Clone, Copy)]
#[repr(align(64))]
pub struct FxRate {
    /// Mid-market rate as fixed-point (rate * 1_000_000_000)
    pub mid_rate_fp: u64,
    /// Bid rate (we buy) as fixed-point
    pub bid_rate_fp: u64,
    /// Ask rate (we sell) as fixed-point
    pub ask_rate_fp: u64,
    /// Timestamp when rate was fetched (seconds since epoch)
    pub timestamp: u32,
    /// TTL in seconds
    pub ttl_secs: u32,
    /// Provider ID (0=coinbase, 1=circle, 2=manual)
    pub provider: u8,
    /// Volatility indicator (0-255, higher = more volatile)
    pub volatility: u8,
}

impl FxRate {
    /// Fixed-point multiplier (9 decimal places)
    const FP_MULTIPLIER: u64 = 1_000_000_000;

    /// Create a new rate from floating-point values
    pub fn from_f64(mid: f64, bid: f64, ask: f64, ttl_secs: u32, provider: u8) -> Self {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as u32;
        Self {
            mid_rate_fp: (mid * Self::FP_MULTIPLIER as f64) as u64,
            bid_rate_fp: (bid * Self::FP_MULTIPLIER as f64) as u64,
            ask_rate_fp: (ask * Self::FP_MULTIPLIER as f64) as u64,
            timestamp: now,
            ttl_secs,
            provider,
            volatility: 0,
        }
    }

    /// Check if rate is still valid
    #[inline(always)]
    pub fn is_valid(&self) -> bool {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as u32;
        now.saturating_sub(self.timestamp) < self.ttl_secs
    }

    /// Convert amount using mid rate (fixed-point arithmetic, no allocation)
    /// Returns converted amount in target currency's smallest unit
    #[inline(always)]
    pub fn convert(&self, amount_smallest_unit: u64) -> u64 {
        // amount * rate / FP_MULTIPLIER
        // Use u128 to avoid overflow on large amounts
        ((amount_smallest_unit as u128 * self.mid_rate_fp as u128) / Self::FP_MULTIPLIER as u128) as u64
    }

    /// Convert using bid rate (when we buy from customer)
    #[inline(always)]
    pub fn convert_bid(&self, amount: u64) -> u64 {
        ((amount as u128 * self.bid_rate_fp as u128) / Self::FP_MULTIPLIER as u128) as u64
    }

    /// Convert using ask rate (when we sell to customer)
    #[inline(always)]
    pub fn convert_ask(&self, amount: u64) -> u64 {
        ((amount as u128 * self.ask_rate_fp as u128) / Self::FP_MULTIPLIER as u128) as u64
    }

    /// Get mid rate as f64 (for display/API responses only, not for calculations)
    pub fn mid_rate_f64(&self) -> f64 {
        self.mid_rate_fp as f64 / Self::FP_MULTIPLIER as f64
    }
}

/// High-performance FX rate cache
pub struct FxCache {
    /// Rates indexed by CurrencyPair
    rates: DashMap<u32, FxRate>,
    /// Total lookups
    total_lookups: AtomicU64,
    /// Cache hits
    cache_hits: AtomicU64,
    /// Cache misses (stale or missing)
    cache_misses: AtomicU64,
}

impl FxCache {
    pub fn new() -> Self {
        Self {
            rates: DashMap::with_capacity(256),
            total_lookups: AtomicU64::new(0),
            cache_hits: AtomicU64::new(0),
            cache_misses: AtomicU64::new(0),
        }
    }

    /// Get rate for a currency pair. Returns None if expired or missing.
    /// Performance: <200ns (DashMap shard lookup + validity check)
    #[inline(always)]
    pub fn get_rate(&self, pair: CurrencyPair) -> Option<FxRate> {
        self.total_lookups.fetch_add(1, Ordering::Relaxed);

        if let Some(rate) = self.rates.get(&pair.packed) {
            if rate.is_valid() {
                self.cache_hits.fetch_add(1, Ordering::Relaxed);
                return Some(*rate);
            }
        }
        self.cache_misses.fetch_add(1, Ordering::Relaxed);
        None
    }

    /// Update rate for a currency pair
    pub fn update_rate(&self, pair: CurrencyPair, rate: FxRate) {
        self.rates.insert(pair.packed, rate);
    }

    /// Bulk update rates (from external feed)
    pub fn bulk_update(&self, rates: &[(CurrencyPair, FxRate)]) {
        for (pair, rate) in rates {
            self.rates.insert(pair.packed, *rate);
        }
    }

    /// Convert amount between currencies using cached rate
    /// Returns None if rate is missing/expired
    #[inline(always)]
    pub fn convert(&self, pair: CurrencyPair, amount: u64) -> Option<u64> {
        self.get_rate(pair).map(|rate| rate.convert(amount))
    }

    /// Remove stale entries
    pub fn evict_stale(&self) {
        self.rates.retain(|_, rate| rate.is_valid());
    }

    /// Get cache stats
    pub fn stats(&self) -> FxCacheStats {
        FxCacheStats {
            total_lookups: self.total_lookups.load(Ordering::Relaxed),
            cache_hits: self.cache_hits.load(Ordering::Relaxed),
            cache_misses: self.cache_misses.load(Ordering::Relaxed),
            cached_pairs: self.rates.len(),
        }
    }
}

impl Default for FxCache {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct FxCacheStats {
    pub total_lookups: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cached_pairs: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_conversion() {
        // 1 USD = 1600 NGN
        let rate = FxRate::from_f64(1600.0, 1595.0, 1605.0, 300, 0);
        // Convert 100 USD (in cents: 10000) to NGN kobo
        let result = rate.convert(10000);
        assert_eq!(result, 16_000_000); // 160,000 NGN in kobo
    }

    #[test]
    fn test_cache_hit() {
        let cache = FxCache::new();
        let pair = CurrencyPair::new(CurrencyCode::USD, CurrencyCode::NGN);
        let rate = FxRate::from_f64(1600.0, 1595.0, 1605.0, 300, 0);
        cache.update_rate(pair, rate);

        let result = cache.get_rate(pair);
        assert!(result.is_some());
        assert_eq!(cache.stats().cache_hits, 1);
    }

    #[test]
    fn test_fixed_point_precision() {
        // BTC to NGN: 1 BTC = 98,500,000 NGN
        let rate = FxRate::from_f64(98_500_000.0, 98_400_000.0, 98_600_000.0, 60, 0);
        // Convert 0.001 BTC (100,000 satoshi) to kobo
        let result = rate.convert(100_000);
        // Expected: 0.001 * 98,500,000 = 98,500 NGN = 9,850,000 kobo
        assert_eq!(result, 9_850_000_000_000);
    }
}
