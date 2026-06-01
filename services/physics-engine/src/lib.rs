//! OG-RMM Physics Engine
//!
//! Implements petroleum engineering correlations used in the Digital Twin:
//!   - IPR: Vogel inflow performance relationship
//!   - VLP: Beggs-Brill vertical lift performance (simplified)
//!   - Arps: Exponential, hyperbolic, and harmonic decline curves
//!   - Sensitivity: Tornado analysis via ±N% parameter sweeps
//!   - Turner: Critical velocity model for gas well liquid loading
//!   - HeavyOil: Beggs-Robinson viscosity, thermal recovery (SAGD/CSS)
//!   - Geomechanics: 1D MEM, mud weight window, wellbore stability
//!   - SandOnset: Critical drawdown pressure, sanding risk assessment

pub mod models;
pub mod ipr;
pub mod vlp;
pub mod arps;
pub mod sensitivity;
pub mod nodal;
pub mod turner_loading;
pub mod heavy_oil;
pub mod geomechanics;
pub mod sand_onset;
pub mod reservoir_sim;
pub mod coupled;

pub use models::*;
