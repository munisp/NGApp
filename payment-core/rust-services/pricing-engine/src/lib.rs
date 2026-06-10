//! Payment Switch Pricing Engine
//! Zero-allocation FX rate lookup and fee calculation.
//! All computations use fixed-point arithmetic (no floating point on hot path).

pub mod fx_cache;
pub mod fee_calculator;
pub mod spread_engine;

pub use fx_cache::{FxCache, FxRate, CurrencyPair};
pub use fee_calculator::{FeeCalculator, FeeConfig, FeeResult, FeeTier};
pub use spread_engine::{SpreadEngine, SpreadConfig, Quote};
