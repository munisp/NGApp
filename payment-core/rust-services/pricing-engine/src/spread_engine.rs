//! Spread calculation engine for FX transactions.
//! Dynamically adjusts bid/ask spread based on volatility, volume, and time of day.

use crate::fx_cache::{CurrencyPair, FxRate};

/// Spread configuration
#[derive(Debug, Clone, Copy)]
pub struct SpreadConfig {
    /// Base spread in basis points (e.g., 50 = 0.50%)
    pub base_spread_bps: u32,
    /// Minimum spread (floor)
    pub min_spread_bps: u32,
    /// Maximum spread (ceiling)
    pub max_spread_bps: u32,
    /// Volatility multiplier (spread increases with volatility)
    /// Fixed-point: actual multiplier = value / 100
    pub volatility_multiplier: u32,
    /// Volume discount: reduce spread for large transactions
    /// Amount threshold for discount (in smallest unit)
    pub volume_discount_threshold: u64,
    /// Discount in basis points for volumes above threshold
    pub volume_discount_bps: u32,
}

impl Default for SpreadConfig {
    fn default() -> Self {
        Self {
            base_spread_bps: 100, // 1.00%
            min_spread_bps: 25,   // 0.25%
            max_spread_bps: 500,  // 5.00%
            volatility_multiplier: 150, // 1.5x
            volume_discount_threshold: 100_000_000, // ₦1,000,000
            volume_discount_bps: 25, // 0.25% discount for large volumes
        }
    }
}

/// Quote for a specific transaction
#[derive(Debug, Clone, Copy)]
pub struct Quote {
    /// Currency pair
    pub pair: CurrencyPair,
    /// Amount in source currency (smallest unit)
    pub source_amount: u64,
    /// Amount in target currency (smallest unit)
    pub target_amount: u64,
    /// Applied rate (fixed-point * 1_000_000_000)
    pub applied_rate_fp: u64,
    /// Spread applied in basis points
    pub spread_bps: u32,
    /// Quote validity in seconds
    pub valid_for_secs: u32,
    /// Quote timestamp
    pub timestamp: u64,
}

/// Spread calculation engine
pub struct SpreadEngine {
    configs: Vec<SpreadConfig>,
}

impl SpreadEngine {
    pub fn new() -> Self {
        // Pre-allocate configs for all currency pairs
        Self {
            configs: vec![SpreadConfig::default(); 256],
        }
    }

    /// Set spread config for a specific corridor
    pub fn set_config(&mut self, corridor_id: u8, config: SpreadConfig) {
        self.configs[corridor_id as usize] = config;
    }

    /// Calculate spread and generate a quote.
    /// Performance: <50ns (pure integer arithmetic)
    #[inline(always)]
    pub fn generate_quote(
        &self,
        pair: CurrencyPair,
        amount: u64,
        rate: &FxRate,
        corridor_id: u8,
        is_buy: bool,
    ) -> Quote {
        let config = &self.configs[corridor_id as usize];

        // Calculate dynamic spread
        let spread_bps = self.calculate_spread(config, rate.volatility, amount);

        // Apply spread to rate
        // For buy (customer sends crypto, gets fiat): use bid (lower rate for us)
        // For sell (customer buys crypto with fiat): use ask (higher rate for us)
        let half_spread_fp = (rate.mid_rate_fp as u128 * spread_bps as u128 / 20000) as u64;

        let applied_rate_fp = if is_buy {
            rate.mid_rate_fp.saturating_sub(half_spread_fp) // Bid
        } else {
            rate.mid_rate_fp.saturating_add(half_spread_fp) // Ask
        };

        // Calculate target amount
        let target_amount = ((amount as u128 * applied_rate_fp as u128) / 1_000_000_000) as u64;

        // Quote validity based on volatility
        let valid_for = if rate.volatility > 200 {
            15 // High volatility: 15 seconds
        } else if rate.volatility > 100 {
            30 // Medium volatility: 30 seconds
        } else {
            60 // Low volatility: 60 seconds
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Quote {
            pair,
            source_amount: amount,
            target_amount,
            applied_rate_fp,
            spread_bps,
            valid_for_secs: valid_for,
            timestamp: now,
        }
    }

    /// Calculate dynamic spread based on conditions
    #[inline(always)]
    fn calculate_spread(&self, config: &SpreadConfig, volatility: u8, amount: u64) -> u32 {
        let mut spread = config.base_spread_bps;

        // Volatility adjustment: spread * (1 + volatility/255 * multiplier/100)
        let vol_adjustment = (spread as u64 * volatility as u64 * config.volatility_multiplier as u64)
            / (255 * 100);
        spread = spread.saturating_add(vol_adjustment as u32);

        // Volume discount for large transactions
        if amount >= config.volume_discount_threshold {
            spread = spread.saturating_sub(config.volume_discount_bps);
        }

        // Clamp to configured bounds
        spread.max(config.min_spread_bps).min(config.max_spread_bps)
    }
}

impl Default for SpreadEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fx_cache::CurrencyCode;

    #[test]
    fn test_spread_applies_correctly() {
        let engine = SpreadEngine::new();
        let pair = CurrencyPair::new(CurrencyCode::USD, CurrencyCode::NGN);
        let rate = FxRate::from_f64(1600.0, 1592.0, 1608.0, 300, 0);

        let buy_quote = engine.generate_quote(pair, 100_000, &rate, 0, true);
        let sell_quote = engine.generate_quote(pair, 100_000, &rate, 0, false);

        // Buy should get lower rate (bid)
        assert!(buy_quote.applied_rate_fp < rate.mid_rate_fp);
        // Sell should get higher rate (ask)
        assert!(sell_quote.applied_rate_fp > rate.mid_rate_fp);
        // Customer gets less when buying
        assert!(buy_quote.target_amount < sell_quote.target_amount);
    }

    #[test]
    fn test_volume_discount() {
        let engine = SpreadEngine::new();
        let pair = CurrencyPair::new(CurrencyCode::USD, CurrencyCode::NGN);
        let rate = FxRate::from_f64(1600.0, 1592.0, 1608.0, 300, 0);

        let small = engine.generate_quote(pair, 10_000, &rate, 0, true);
        let large = engine.generate_quote(pair, 200_000_000, &rate, 0, true);

        // Large volume should get tighter spread
        assert!(large.spread_bps < small.spread_bps);
    }
}
