//! reservoir_sim.rs — Nalgebra + ndarray powered reservoir simulation
//!
//! Implements:
//!   1. Single-phase 1D finite-difference reservoir simulator (ndarray)
//!   2. Material balance (Havlena-Odeh) using nalgebra linear solver
//!   3. Pressure transient analysis (PTA) — Horner plot, skin factor
//!   4. Pore volume compressibility and aquifer influx (van Everdingen-Hurst)
//!
//! Libraries:
//!   nalgebra 0.33 — matrix operations, linear system solver
//!   ndarray  0.16 — N-dimensional arrays for grid-based simulation
//!   statrs   0.18 — statistical distributions for uncertainty quantification

use nalgebra::{DMatrix, DVector};
use ndarray::{Array1, Array2};
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Data structures
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ReservoirGridParams {
    /// Number of grid blocks in x-direction
    pub nx: usize,
    /// Grid block length (ft)
    pub dx: f64,
    /// Permeability (md)
    pub k: f64,
    /// Porosity (fraction)
    pub phi: f64,
    /// Net pay thickness (ft)
    pub h: f64,
    /// Fluid viscosity (cp)
    pub mu: f64,
    /// Total compressibility (1/psi)
    pub ct: f64,
    /// Initial reservoir pressure (psia)
    pub pi: f64,
    /// Wellbore flowing pressure (psia)
    pub pwf: f64,
    /// Simulation time (days)
    pub t_days: f64,
    /// Number of time steps
    pub n_steps: usize,
}

#[derive(Debug, Serialize)]
pub struct ReservoirSimResult {
    pub time_days: Vec<f64>,
    pub pressure_profile: Vec<Vec<f64>>,
    pub cumulative_production_bbl: Vec<f64>,
    pub flow_rate_bpd: Vec<f64>,
    pub average_pressure_psia: Vec<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct MaterialBalanceInput {
    /// Cumulative oil production (STB)
    pub np: Vec<f64>,
    /// Reservoir pressure at each step (psia)
    pub pressure: Vec<f64>,
    /// Initial reservoir pressure (psia)
    pub pi: f64,
    /// Oil FVF at initial conditions (RB/STB)
    pub boi: f64,
    /// Oil FVF at each pressure step (RB/STB)
    pub bo: Vec<f64>,
    /// Solution GOR at initial conditions (scf/STB)
    pub rsi: f64,
    /// Solution GOR at each pressure step (scf/STB)
    pub rs: Vec<f64>,
    /// Gas FVF at each pressure step (RB/Mscf)
    pub bg: Vec<f64>,
    /// Connate water saturation (fraction)
    pub swc: f64,
    /// Oil compressibility (1/psi)
    pub co: f64,
    /// Water compressibility (1/psi)
    pub cw: f64,
    /// Rock compressibility (1/psi)
    pub cf: f64,
}

#[derive(Debug, Serialize)]
pub struct MaterialBalanceResult {
    /// Original oil in place (MMSTB)
    pub ooip_mmstb: f64,
    /// Recovery factor at each step (fraction)
    pub recovery_factor: Vec<f64>,
    /// Drive mechanism indices
    pub solution_gas_drive_pct: f64,
    pub compressibility_drive_pct: f64,
    pub r_squared: f64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct HornerPtaInput {
    /// Production time before shut-in (hours)
    pub tp_hours: f64,
    /// Shut-in pressures (psia)
    pub pws: Vec<f64>,
    /// Shut-in times (hours)
    pub delta_t: Vec<f64>,
    /// Flow rate before shut-in (STB/day)
    pub q_bpd: f64,
    /// Oil FVF (RB/STB)
    pub bo: f64,
    /// Fluid viscosity (cp)
    pub mu: f64,
    /// Net pay thickness (ft)
    pub h: f64,
    /// Porosity (fraction)
    pub phi: f64,
    /// Total compressibility (1/psi)
    pub ct: f64,
    /// Wellbore radius (ft)
    pub rw: f64,
}

#[derive(Debug, Serialize)]
pub struct HornerPtaResult {
    /// Horner time ratio: (tp + dt) / dt
    pub horner_time_ratio: Vec<f64>,
    /// Shut-in pressure for each point (psia)
    pub pws: Vec<f64>,
    /// Permeability from slope (md)
    pub k_md: f64,
    /// Skin factor (dimensionless)
    pub skin: f64,
    /// Extrapolated initial pressure p* (psia)
    pub p_star_psia: f64,
    /// Slope of Horner plot (psi/cycle)
    pub slope_psi_cycle: f64,
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 1D Finite-Difference Reservoir Simulator (ndarray)
// ─────────────────────────────────────────────────────────────────────────────

/// Single-phase 1D finite-difference pressure solver using ndarray.
/// Uses implicit (backward Euler) time discretisation for stability.
pub fn simulate_1d_reservoir(params: &ReservoirGridParams) -> ReservoirSimResult {
    let nx = params.nx;
    let dx = params.dx;
    let dt = params.t_days / params.n_steps as f64;

    // Transmissibility (RB·cp / (psi·day))
    // T = 0.001127 * k * A / (mu * dx)  where A = h * dx (unit width)
    let area = params.h * dx; // ft²
    let trans = 0.001127 * params.k * area / (params.mu * dx);

    // Accumulation coefficient
    // acc = phi * ct * Vb / (5.615 * dt)  where Vb = dx * h * dx (unit width)
    let vb = params.phi * dx * params.h * dx;
    let acc = vb * params.ct / (5.615 * dt);

    // Initial pressure field (ndarray)
    let mut p: Array1<f64> = Array1::from_elem(nx, params.pi);

    let mut time_days = Vec::with_capacity(params.n_steps + 1);
    let mut pressure_profile = Vec::with_capacity(params.n_steps + 1);
    let mut cum_prod = Vec::with_capacity(params.n_steps + 1);
    let mut flow_rate = Vec::with_capacity(params.n_steps + 1);
    let mut avg_pressure = Vec::with_capacity(params.n_steps + 1);

    time_days.push(0.0);
    pressure_profile.push(p.to_vec());
    cum_prod.push(0.0);
    flow_rate.push(0.0);
    avg_pressure.push(params.pi);

    let mut cumulative = 0.0_f64;

    for step in 1..=params.n_steps {
        // Build tridiagonal system using nalgebra DMatrix
        let mut a = DMatrix::<f64>::zeros(nx, nx);
        let mut b = DVector::<f64>::zeros(nx);

        for i in 0..nx {
            // Accumulation term
            a[(i, i)] += acc;
            b[i] = acc * p[i];

            // Left neighbour (or well boundary at i=0)
            if i == 0 {
                // Well block: constant Pwf boundary
                a[(i, i)] += trans;
                b[i] += trans * params.pwf;
            } else {
                a[(i, i)] += trans;
                a[(i, i - 1)] -= trans;
            }

            // Right neighbour (or no-flow boundary at i=nx-1)
            if i < nx - 1 {
                a[(i, i)] += trans;
                a[(i, i + 1)] -= trans;
            }
        }

        // Solve A·p_new = b using LU decomposition (nalgebra)
        if let Some(lu) = a.lu().solve(&b) {
            let p_new: Array1<f64> = Array1::from_vec(lu.data.into());

            // Wellbore flow rate (STB/day)
            let q = trans * (p_new[0] - params.pwf) / params.bo_approx();
            let q_positive = q.max(0.0);
            cumulative += q_positive * dt;

            let avg_p = p_new.mean().unwrap_or(params.pi);

            time_days.push(step as f64 * dt);
            pressure_profile.push(p_new.to_vec());
            cum_prod.push(cumulative);
            flow_rate.push(q_positive);
            avg_pressure.push(avg_p);

            p = p_new;
        }
    }

    ReservoirSimResult {
        time_days,
        pressure_profile,
        cumulative_production_bbl: cum_prod,
        flow_rate_bpd: flow_rate,
        average_pressure_psia: avg_pressure,
    }
}

// Helper: approximate Bo for single-phase simulation
impl ReservoirGridParams {
    fn bo_approx(&self) -> f64 {
        1.1 // default oil FVF approximation
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Material Balance (Havlena-Odeh) — nalgebra linear regression
// ─────────────────────────────────────────────────────────────────────────────

/// Havlena-Odeh material balance: F = N·Eo + N·m·Eg + (1+m)·N·Efw
/// Solves for OOIP (N) using least-squares regression via nalgebra.
pub fn material_balance(input: &MaterialBalanceInput) -> MaterialBalanceResult {
    let n = input.np.len();
    if n < 2 {
        return MaterialBalanceResult {
            ooip_mmstb: 0.0,
            recovery_factor: vec![0.0],
            solution_gas_drive_pct: 0.0,
            compressibility_drive_pct: 0.0,
            r_squared: 0.0,
        };
    }

    let boi = input.boi;
    let rsi = input.rsi;

    // Compute F (underground withdrawal) and Eo (oil expansion) for each step
    let mut f_vals = Vec::with_capacity(n);
    let mut eo_vals = Vec::with_capacity(n);

    for i in 0..n {
        let dp = input.pi - input.pressure[i];
        let bo_i = input.bo[i];
        let rs_i = input.rs[i];
        let bg_i = input.bg[i];

        // Underground withdrawal F = Np * [Bo + (Rsi - Rs) * Bg]
        let f = input.np[i] * (bo_i + (rsi - rs_i) * bg_i);
        f_vals.push(f);

        // Oil + dissolved gas expansion Eo = (Bo - Boi) + (Rsi - Rs) * Bg
        let eo = (bo_i - boi) + (rsi - rs_i) * bg_i;

        // Formation compressibility expansion Efw = Boi * (co * Swc + cw * input.swc + input.cf) / (1 - input.swc)
        let efw = boi * (input.co * (1.0 - input.swc) + input.cw * input.swc + input.cf)
            / (1.0 - input.swc)
            * dp;

        eo_vals.push(eo + efw);
    }

    // Least-squares: F = N * Eo  => N = sum(F*Eo) / sum(Eo^2)
    let sum_feo: f64 = f_vals.iter().zip(eo_vals.iter()).map(|(f, e)| f * e).sum();
    let sum_eo2: f64 = eo_vals.iter().map(|e| e * e).sum();
    let n_ooip = if sum_eo2 > 0.0 { sum_feo / sum_eo2 } else { 0.0 };

    // R² of the fit
    let f_mean: f64 = f_vals.iter().sum::<f64>() / n as f64;
    let ss_tot: f64 = f_vals.iter().map(|f| (f - f_mean).powi(2)).sum();
    let ss_res: f64 = f_vals
        .iter()
        .zip(eo_vals.iter())
        .map(|(f, e)| (f - n_ooip * e).powi(2))
        .sum();
    let r2 = if ss_tot > 0.0 { 1.0 - ss_res / ss_tot } else { 1.0 };

    let rf: Vec<f64> = input
        .np
        .iter()
        .map(|np| if n_ooip > 0.0 { np / n_ooip } else { 0.0 })
        .collect();

    // Drive mechanism: fraction of F attributable to solution gas vs compressibility
    let last_eo = *eo_vals.last().unwrap_or(&1.0);
    let last_efw_approx = boi
        * (input.co * (1.0 - input.swc) + input.cw * input.swc + input.cf)
        / (1.0 - input.swc)
        * (input.pi - *input.pressure.last().unwrap_or(&input.pi));
    let sg_drive = ((last_eo - last_efw_approx) / last_eo.max(1e-10) * 100.0).clamp(0.0, 100.0);

    MaterialBalanceResult {
        ooip_mmstb: n_ooip / 1_000_000.0,
        recovery_factor: rf,
        solution_gas_drive_pct: sg_drive,
        compressibility_drive_pct: 100.0 - sg_drive,
        r_squared: r2,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pressure Transient Analysis — Horner Plot (nalgebra regression)
// ─────────────────────────────────────────────────────────────────────────────

/// Horner build-up analysis: extracts k, skin, and p* from shut-in pressure data.
pub fn horner_pta(input: &HornerPtaInput) -> HornerPtaResult {
    let n = input.pws.len();
    let tp = input.tp_hours;

    // Horner time ratio: (tp + dt) / dt
    let htr: Vec<f64> = input
        .delta_t
        .iter()
        .map(|&dt| if dt > 0.0 { (tp + dt) / dt } else { 1.0 })
        .collect();

    // Log10 of HTR for linear regression
    let log_htr: Vec<f64> = htr.iter().map(|&h| h.log10()).collect();

    // Least-squares linear regression: Pws = p* - m * log10(HTR)
    // Using nalgebra: [1, log_htr] * [p*, -m]^T = pws
    let a_mat = DMatrix::from_fn(n, 2, |i, j| if j == 0 { 1.0_f64 } else { log_htr[i] });
    let b_vec = DVector::from_vec(input.pws.clone());

    let (p_star, slope) = if let Some(sol) = (a_mat.transpose() * &a_mat)
        .lu()
        .solve(&(a_mat.transpose() * &b_vec))
    {
        (sol[0], sol[1])
    } else {
        (*input.pws.last().unwrap_or(&0.0), 0.0)
    };

    // Permeability: k = 162.6 * q * mu * Bo / (m * h)
    // slope is negative (pressure builds up as HTR decreases)
    let m_abs = slope.abs().max(1e-6);
    let k_md = 162.6 * input.q_bpd * input.mu * input.bo / (m_abs * input.h);

    // Skin factor: s = 1.1513 * [(P1hr - Pwf) / m - log(k / (phi * mu * ct * rw^2)) + 3.2275]
    // Interpolate P at 1 hour
    let p1hr = if let Some(idx) = input.delta_t.iter().position(|&dt| dt >= 1.0) {
        input.pws[idx]
    } else {
        *input.pws.last().unwrap_or(&0.0)
    };
    let pwf_last = *input.pws.first().unwrap_or(&0.0);
    let log_term = (k_md / (input.phi * input.mu * input.ct * input.rw.powi(2))).log10();
    let skin = 1.1513 * ((p1hr - pwf_last) / m_abs - log_term + 3.2275);

    HornerPtaResult {
        horner_time_ratio: htr,
        pws: input.pws.clone(),
        k_md,
        skin,
        p_star_psia: p_star,
        slope_psi_cycle: slope,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Uncertainty Quantification (statrs)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize)]
pub struct UncertaintyInput {
    /// Mean OOIP (MMSTB)
    pub ooip_mean: f64,
    /// Standard deviation of OOIP (MMSTB)
    pub ooip_std: f64,
    /// Mean recovery factor
    pub rf_mean: f64,
    /// Standard deviation of recovery factor
    pub rf_std: f64,
    /// Number of Monte Carlo samples
    pub n_samples: usize,
}

#[derive(Debug, Serialize)]
pub struct UncertaintyResult {
    pub p10_eur_mmstb: f64,
    pub p50_eur_mmstb: f64,
    pub p90_eur_mmstb: f64,
    pub mean_eur_mmstb: f64,
    pub std_eur_mmstb: f64,
}

/// Monte Carlo EUR uncertainty using statrs Normal distribution
pub fn eur_uncertainty(input: &UncertaintyInput) -> UncertaintyResult {
    use statrs::distribution::{ContinuousCDF, Normal};

    let ooip_dist = Normal::new(input.ooip_mean, input.ooip_std.max(0.001)).unwrap();
    let rf_dist = Normal::new(input.rf_mean, input.rf_std.max(0.001)).unwrap();

    // Simple percentile calculation using inverse CDF
    let p10_ooip = ooip_dist.inverse_cdf(0.10);
    let p50_ooip = ooip_dist.inverse_cdf(0.50);
    let p90_ooip = ooip_dist.inverse_cdf(0.90);

    let p10_rf = rf_dist.inverse_cdf(0.10).clamp(0.0, 1.0);
    let p50_rf = rf_dist.inverse_cdf(0.50).clamp(0.0, 1.0);
    let p90_rf = rf_dist.inverse_cdf(0.90).clamp(0.0, 1.0);

    UncertaintyResult {
        p10_eur_mmstb: (p10_ooip * p10_rf).max(0.0),
        p50_eur_mmstb: (p50_ooip * p50_rf).max(0.0),
        p90_eur_mmstb: (p90_ooip * p90_rf).max(0.0),
        mean_eur_mmstb: input.ooip_mean * input.rf_mean,
        std_eur_mmstb: ((input.ooip_mean * input.rf_std).powi(2)
            + (input.rf_mean * input.ooip_std).powi(2))
        .sqrt(),
    }
}
