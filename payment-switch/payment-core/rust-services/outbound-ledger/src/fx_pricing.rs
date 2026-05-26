//! Corridor-specific FX pricing engine for outbound remittance.
//! Enforces CBN margin rules (spread caps) per corridor family.
//!
//! Corridor families:
//! - West Africa Labor (NG-GH/SN/CI/CM): 150-200 bps cap, lower-value/higher-frequency
//! - Education (NG-GB/US/CA): 100-120 bps cap, higher-value/document-heavy
//! - Medical (NG-IN/TR): 150-175 bps cap, evidence-based
//! - Premium Business (NG-CN/AE): 80-90 bps cap, highest-value
//! - General Personal (NG-KE/ZA): 130-150 bps cap

use serde::{Deserialize, Serialize};

/// Corridor FX configuration enforcing CBN spread caps.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CorridorConfig {
    pub corridor_id: u8,
    pub corridor_code: [u8; 5], // e.g., b"NGGBP" padded
    pub source_currency: u32,   // ISO 4217 numeric (NGN = 566)
    pub dest_currency: u32,     // ISO 4217 numeric
    /// CBN-mandated maximum spread in basis points
    pub max_spread_bps: u16,
    /// Minimum spread (platform floor)
    pub min_spread_bps: u16,
    /// Maximum single transaction in kobo (smallest NGN unit)
    pub max_txn_kobo: u64,
    /// Whether corridor requires enhanced documentation
    pub requires_documentation: bool,
    /// Whether corridor is in Wave 1 (lean pricing) or Wave 2/3
    pub launch_wave: u8,
}

/// A priced FX quote for a specific corridor transfer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CorridorQuote {
    pub corridor_id: u8,
    pub source_amount_kobo: u64,
    pub dest_amount_smallest: u64,
    pub mid_rate_fp: u64,       // Fixed-point * 1_000_000_000
    pub applied_rate_fp: u64,   // After spread
    pub spread_bps: u16,
    pub spread_amount_kobo: u64,
    pub valid_until_epoch_s: u64,
    pub quote_id: u64,
}

/// The corridor FX engine.
pub struct CorridorFxEngine {
    corridors: Vec<CorridorConfig>,
    /// Simulated mid-rates (in production: from Redis/external feed)
    /// Fixed-point * 1_000_000_000
    rates: Vec<u64>,
    quote_counter: u64,
}

impl CorridorFxEngine {
    pub fn new() -> Self {
        let corridors = vec![
            CorridorConfig { corridor_id: 1, corridor_code: *b"NG-GH", source_currency: 566, dest_currency: 936, max_spread_bps: 150, min_spread_bps: 50, max_txn_kobo: 750_000_000, requires_documentation: false, launch_wave: 1 },
            CorridorConfig { corridor_id: 2, corridor_code: *b"NG-SN", source_currency: 566, dest_currency: 952, max_spread_bps: 200, min_spread_bps: 75, max_txn_kobo: 750_000_000, requires_documentation: false, launch_wave: 1 },
            CorridorConfig { corridor_id: 3, corridor_code: *b"NG-CI", source_currency: 566, dest_currency: 952, max_spread_bps: 200, min_spread_bps: 75, max_txn_kobo: 750_000_000, requires_documentation: false, launch_wave: 1 },
            CorridorConfig { corridor_id: 4, corridor_code: *b"NG-CM", source_currency: 566, dest_currency: 950, max_spread_bps: 200, min_spread_bps: 75, max_txn_kobo: 750_000_000, requires_documentation: false, launch_wave: 1 },
            CorridorConfig { corridor_id: 5, corridor_code: *b"NG-GB", source_currency: 566, dest_currency: 826, max_spread_bps: 100, min_spread_bps: 30, max_txn_kobo: 75_000_000_000, requires_documentation: true, launch_wave: 2 },
            CorridorConfig { corridor_id: 6, corridor_code: *b"NG-US", source_currency: 566, dest_currency: 840, max_spread_bps: 100, min_spread_bps: 30, max_txn_kobo: 75_000_000_000, requires_documentation: true, launch_wave: 2 },
            CorridorConfig { corridor_id: 7, corridor_code: *b"NG-CA", source_currency: 566, dest_currency: 124, max_spread_bps: 120, min_spread_bps: 40, max_txn_kobo: 75_000_000_000, requires_documentation: true, launch_wave: 2 },
            CorridorConfig { corridor_id: 8, corridor_code: *b"NG-IN", source_currency: 566, dest_currency: 356, max_spread_bps: 150, min_spread_bps: 50, max_txn_kobo: 45_000_000_000, requires_documentation: true, launch_wave: 2 },
            CorridorConfig { corridor_id: 9, corridor_code: *b"NG-TR", source_currency: 566, dest_currency: 949, max_spread_bps: 175, min_spread_bps: 60, max_txn_kobo: 45_000_000_000, requires_documentation: true, launch_wave: 2 },
            CorridorConfig { corridor_id: 10, corridor_code: *b"NG-CN", source_currency: 566, dest_currency: 156, max_spread_bps: 80, min_spread_bps: 20, max_txn_kobo: 150_000_000_000, requires_documentation: true, launch_wave: 3 },
            CorridorConfig { corridor_id: 11, corridor_code: *b"NG-AE", source_currency: 566, dest_currency: 784, max_spread_bps: 90, min_spread_bps: 25, max_txn_kobo: 150_000_000_000, requires_documentation: true, launch_wave: 3 },
            CorridorConfig { corridor_id: 12, corridor_code: *b"NG-KE", source_currency: 566, dest_currency: 404, max_spread_bps: 150, min_spread_bps: 50, max_txn_kobo: 15_000_000_000, requires_documentation: false, launch_wave: 1 },
            CorridorConfig { corridor_id: 13, corridor_code: *b"NG-ZA", source_currency: 566, dest_currency: 710, max_spread_bps: 130, min_spread_bps: 40, max_txn_kobo: 15_000_000_000, requires_documentation: false, launch_wave: 1 },
        ];

        // Simulated mid-rates: NGN per 1 unit of dest currency * 1B
        // e.g., 1 GHS = 125 NGN → mid_rate = 125_000_000_000
        let rates = vec![
            0,                    // corridor 0 unused
            125_000_000_000,      // NG-GH: 1 GHS = ₦125
            2_500_000_000,        // NG-SN: 1 XOF = ₦2.50
            2_500_000_000,        // NG-CI: 1 XOF = ₦2.50
            2_500_000_000,        // NG-CM: 1 XAF = ₦2.50
            1_900_000_000_000,    // NG-GB: 1 GBP = ₦1,900
            1_500_000_000_000,    // NG-US: 1 USD = ₦1,500
            1_100_000_000_000,    // NG-CA: 1 CAD = ₦1,100
            18_000_000_000,       // NG-IN: 1 INR = ₦18
            45_000_000_000,       // NG-TR: 1 TRY = ₦45
            210_000_000_000,      // NG-CN: 1 CNY = ₦210
            410_000_000_000,      // NG-AE: 1 AED = ₦410
            9_500_000_000,        // NG-KE: 1 KES = ₦9.50
            85_000_000_000,       // NG-ZA: 1 ZAR = ₦85
        ];

        Self {
            corridors,
            rates,
            quote_counter: 1,
        }
    }

    /// Generate an FX quote for a corridor transfer.
    /// Enforces CBN spread caps. Performance target: <100ns.
    #[inline]
    pub fn generate_quote(&mut self, corridor_id: u8, source_amount_kobo: u64) -> Result<CorridorQuote, FxError> {
        let config = self.corridors.iter()
            .find(|c| c.corridor_id == corridor_id)
            .ok_or(FxError::UnknownCorridor)?;

        if source_amount_kobo > config.max_txn_kobo {
            return Err(FxError::ExceedsMaxTransaction);
        }

        if source_amount_kobo == 0 {
            return Err(FxError::ZeroAmount);
        }

        let mid_rate = *self.rates.get(corridor_id as usize)
            .ok_or(FxError::UnknownCorridor)?;

        // Apply spread (use max for now; in production: dynamic based on volatility)
        let spread_bps = config.max_spread_bps;

        // Applied rate = mid_rate * (1 - spread/2/10000) for sell-side
        let half_spread_fp = (mid_rate as u128 * spread_bps as u128 / 20_000) as u64;
        let applied_rate = mid_rate.saturating_sub(half_spread_fp);

        // Dest amount = source_kobo / applied_rate_per_dest_unit
        // Since rate is NGN_per_dest * 1B, dest = source * 1B / rate
        let dest_amount = (source_amount_kobo as u128 * 1_000_000_000 / applied_rate as u128) as u64;

        // Spread amount in kobo
        let spread_amount = (source_amount_kobo as u128 * spread_bps as u128 / 10_000) as u64;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let quote_id = self.quote_counter;
        self.quote_counter += 1;

        // Quote validity: Wave 1 corridors = 60s, Wave 2/3 = 30s
        let validity = if config.launch_wave == 1 { 60 } else { 30 };

        Ok(CorridorQuote {
            corridor_id,
            source_amount_kobo,
            dest_amount_smallest: dest_amount,
            mid_rate_fp: mid_rate,
            applied_rate_fp: applied_rate,
            spread_bps,
            spread_amount_kobo: spread_amount,
            valid_until_epoch_s: now + validity,
            quote_id,
        })
    }

    /// Get corridor config.
    pub fn get_corridor(&self, corridor_id: u8) -> Option<&CorridorConfig> {
        self.corridors.iter().find(|c| c.corridor_id == corridor_id)
    }

    /// List all active corridors.
    pub fn list_corridors(&self) -> &[CorridorConfig] {
        &self.corridors
    }
}

impl Default for CorridorFxEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// FX pricing errors.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FxError {
    UnknownCorridor,
    ExceedsMaxTransaction,
    ZeroAmount,
    RateUnavailable,
    SpreadExceedsCap,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quote_ng_gh() {
        let mut engine = CorridorFxEngine::new();
        let quote = engine.generate_quote(1, 75_000_000).unwrap(); // ₦750,000
        assert_eq!(quote.corridor_id, 1);
        assert_eq!(quote.source_amount_kobo, 75_000_000);
        assert!(quote.dest_amount_smallest > 0);
        assert_eq!(quote.spread_bps, 150); // CBN cap for NG-GH
        assert!(quote.spread_amount_kobo > 0);
    }

    #[test]
    fn test_quote_ng_gb_education() {
        let mut engine = CorridorFxEngine::new();
        let quote = engine.generate_quote(5, 1_800_000_000).unwrap(); // ₦18M
        assert_eq!(quote.spread_bps, 100); // CBN cap for education corridors
    }

    #[test]
    fn test_quote_ng_cn_premium() {
        let mut engine = CorridorFxEngine::new();
        let quote = engine.generate_quote(10, 6_750_000_000).unwrap(); // ₦67.5M
        assert_eq!(quote.spread_bps, 80); // Tight spread for premium business
    }

    #[test]
    fn test_exceeds_max_transaction() {
        let mut engine = CorridorFxEngine::new();
        // NG-GH max is 750M kobo (₦7.5M)
        let result = engine.generate_quote(1, 800_000_000);
        assert_eq!(result, Err(FxError::ExceedsMaxTransaction));
    }

    #[test]
    fn test_unknown_corridor() {
        let mut engine = CorridorFxEngine::new();
        let result = engine.generate_quote(99, 100_000);
        assert_eq!(result, Err(FxError::UnknownCorridor));
    }

    #[test]
    fn test_zero_amount() {
        let mut engine = CorridorFxEngine::new();
        let result = engine.generate_quote(1, 0);
        assert_eq!(result, Err(FxError::ZeroAmount));
    }

    #[test]
    fn test_all_corridors_have_rates() {
        let mut engine = CorridorFxEngine::new();
        for corridor_id in 1..=13u8 {
            let result = engine.generate_quote(corridor_id, 10_000_000);
            assert!(result.is_ok(), "Corridor {} failed", corridor_id);
        }
    }
}
