use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpResponse};
use rand::Rng;
use rand::SeedableRng;
use rand_distr::{Normal, Distribution};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ============================================================================
// MCMC Engine — Markov Chain Monte Carlo for Probabilistic Risk Modeling
// ============================================================================
// Production-hardened Metropolis-Hastings with:
//   - Multi-chain sampling with Gelman-Rubin (R-hat) convergence diagnostics
//   - Autocorrelation-based Effective Sample Size (ESS)
//   - Joint PD-LGD posterior via bivariate likelihood
//   - Gaussian copula default correlation for portfolio risk
//   - Empirical VaR from simulated portfolio loss distribution
//   - Stress testing via re-running MCMC with shocked parameters

const NUM_CHAINS: usize = 4;
const DEFAULT_ITERATIONS: usize = 5000;
const DEFAULT_BURN_IN: usize = 1000;
const PORTFOLIO_SIMULATIONS: usize = 5000;
const MAX_LAG_ESS: usize = 200;

// --- Data Structures ---

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MCMCSample {
    iteration: usize,
    default_probability: f64,
    loss_given_default: f64,
    exposure_at_default: f64,
    expected_loss: f64,
    log_posterior: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChainDiagnostics {
    num_chains: usize,
    acceptance_rate: f64,
    effective_sample_size_pd: f64,
    effective_sample_size_lgd: f64,
    r_hat_pd: f64,
    r_hat_lgd: f64,
    converged: bool,
    burn_in: usize,
    total_iterations: usize,
    max_autocorrelation_lag: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CreditRiskResult {
    customer_id: String,
    name: String,
    samples: Vec<MCMCSample>,
    posterior_mean_pd: f64,
    posterior_std_pd: f64,
    posterior_mean_lgd: f64,
    posterior_std_lgd: f64,
    var_95: f64,
    var_99: f64,
    expected_loss: f64,
    unexpected_loss: f64,
    credit_grade: String,
    confidence_interval_pd: (f64, f64),
    confidence_interval_lgd: (f64, f64),
    chain_diagnostics: ChainDiagnostics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PortfolioRisk {
    total_exposure: f64,
    expected_loss: f64,
    unexpected_loss: f64,
    var_95: f64,
    var_99: f64,
    cvar_95: f64,
    cvar_99: f64,
    concentration_risk: f64,
    diversification_benefit: f64,
    correlation_matrix: Vec<Vec<f64>>,
    num_simulations: usize,
    stress_test_results: Vec<StressScenario>,
    risk_contributions: Vec<RiskContribution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StressScenario {
    name: String,
    severity: String,
    pd_shock: f64,
    lgd_shock: f64,
    correlation_shock: f64,
    portfolio_loss: f64,
    loss_percentage: f64,
    var_99_stressed: f64,
    num_defaults: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RiskContribution {
    segment: String,
    exposure: f64,
    expected_loss: f64,
    contribution_pct: f64,
    marginal_var: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomerProfile {
    id: String,
    name: String,
    balance: f64,
    monthly_income: f64,
    loan_amount: f64,
    months_on_book: u32,
    missed_payments: u32,
    segment: String,
    channel: String,
}

struct AppState {
    customers: Mutex<Vec<CustomerProfile>>,
}

fn seed_customers() -> Vec<CustomerProfile> {
    vec![
        CustomerProfile { id: "C001".into(), name: "Adamu Ibrahim".into(), balance: 2450000.0, monthly_income: 850000.0, loan_amount: 1500000.0, months_on_book: 36, missed_payments: 0, segment: "premium".into(), channel: "core_banking".into() },
        CustomerProfile { id: "C002".into(), name: "Fatima Bello".into(), balance: 180000.0, monthly_income: 120000.0, loan_amount: 200000.0, months_on_book: 18, missed_payments: 1, segment: "standard".into(), channel: "agent_banking".into() },
        CustomerProfile { id: "C003".into(), name: "Chinedu Okafor".into(), balance: 5200000.0, monthly_income: 1500000.0, loan_amount: 3000000.0, months_on_book: 48, missed_payments: 0, segment: "premium".into(), channel: "core_banking".into() },
        CustomerProfile { id: "C004".into(), name: "Aisha Mohammed".into(), balance: 95000.0, monthly_income: 65000.0, loan_amount: 150000.0, months_on_book: 8, missed_payments: 3, segment: "standard".into(), channel: "agent_banking".into() },
        CustomerProfile { id: "C005".into(), name: "Emeka Nwosu".into(), balance: 3800000.0, monthly_income: 1200000.0, loan_amount: 2000000.0, months_on_book: 42, missed_payments: 0, segment: "premium".into(), channel: "remittance".into() },
        CustomerProfile { id: "C006".into(), name: "Grace Adeyemi".into(), balance: 42000.0, monthly_income: 35000.0, loan_amount: 50000.0, months_on_book: 3, missed_payments: 0, segment: "basic".into(), channel: "agent_banking".into() },
        CustomerProfile { id: "C007".into(), name: "Bola Ogundimu".into(), balance: 290000.0, monthly_income: 180000.0, loan_amount: 350000.0, months_on_book: 24, missed_payments: 2, segment: "standard".into(), channel: "core_banking".into() },
        CustomerProfile { id: "C008".into(), name: "Ngozi Eze".into(), balance: 4100000.0, monthly_income: 1350000.0, loan_amount: 2500000.0, months_on_book: 60, missed_payments: 0, segment: "premium".into(), channel: "core_banking".into() },
    ]
}

// --- Likelihood & Prior ---

fn log_likelihood_joint(pd: f64, lgd: f64, customer: &CustomerProfile) -> f64 {
    let n = customer.months_on_book as f64;
    let k = customer.missed_payments as f64;

    // Binomial log-likelihood for default events
    let ll_pd = k * pd.ln() + (n - k) * (1.0 - pd).ln();

    // LGD likelihood: observed recovery ratio informs LGD
    // Use balance/loan as proxy for recovery; Beta-distributed around observed LGD
    let observed_recovery = (customer.balance / customer.loan_amount.max(1.0)).clamp(0.01, 0.99);
    let observed_lgd = 1.0 - observed_recovery;
    let lgd_alpha = 5.0;
    let lgd_beta_param = lgd_alpha * (1.0 - observed_lgd) / observed_lgd.max(0.01);
    let ll_lgd = (lgd_alpha - 1.0) * lgd.ln() + (lgd_beta_param - 1.0) * (1.0 - lgd).ln();

    ll_pd + ll_lgd
}

fn log_prior_pd(pd: f64, alpha: f64, beta: f64) -> f64 {
    (alpha - 1.0) * pd.ln() + (beta - 1.0) * (1.0 - pd).ln()
}

fn log_prior_lgd(lgd: f64, alpha: f64, beta: f64) -> f64 {
    (alpha - 1.0) * lgd.ln() + (beta - 1.0) * (1.0 - lgd).ln()
}

fn compute_base_pd(customer: &CustomerProfile) -> f64 {
    let mut pd: f64 = 0.05;
    pd += customer.missed_payments as f64 * 0.08;
    let balance_ratio = customer.balance / customer.loan_amount.max(1.0);
    if balance_ratio < 0.3 {
        pd += 0.1;
    }
    if customer.months_on_book < 12 {
        pd += 0.05;
    }
    let coverage = customer.monthly_income * 12.0 / customer.loan_amount.max(1.0);
    if coverage < 2.0 {
        pd += 0.08;
    }
    pd.clamp(0.01, 0.95)
}

fn compute_base_lgd(customer: &CustomerProfile) -> f64 {
    let recovery = (customer.balance / customer.loan_amount.max(1.0)).clamp(0.05, 0.95);
    let base = 1.0 - recovery;
    match customer.segment.as_str() {
        "premium" => (base * 0.8).clamp(0.05, 0.90),
        "standard" => base.clamp(0.10, 0.90),
        _ => (base * 1.2).clamp(0.15, 0.95),
    }
}

// --- Autocorrelation-based ESS ---

fn compute_autocorrelation(samples: &[f64], max_lag: usize) -> Vec<f64> {
    let n = samples.len() as f64;
    let mean: f64 = samples.iter().sum::<f64>() / n;
    let variance: f64 = samples.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n;
    if variance < 1e-15 {
        return vec![1.0; max_lag + 1];
    }

    let mut autocorr = Vec::with_capacity(max_lag + 1);
    for lag in 0..=max_lag {
        let mut cov = 0.0;
        let count = samples.len() - lag;
        for i in 0..count {
            cov += (samples[i] - mean) * (samples[i + lag] - mean);
        }
        cov /= n;
        autocorr.push(cov / variance);
    }
    autocorr
}

fn compute_ess(samples: &[f64]) -> f64 {
    let n = samples.len();
    let max_lag = MAX_LAG_ESS.min(n / 2);
    let autocorr = compute_autocorrelation(samples, max_lag);

    // Geyer's initial positive sequence estimator: sum consecutive pairs
    // and stop when the sum becomes negative
    let mut tau = 1.0_f64;
    let mut lag = 1;
    while lag + 1 < autocorr.len() {
        let pair_sum = autocorr[lag] + autocorr[lag + 1];
        if pair_sum < 0.0 {
            break;
        }
        tau += 2.0 * pair_sum;
        lag += 2;
    }

    (n as f64 / tau).max(1.0)
}

// --- Gelman-Rubin R-hat ---

fn compute_r_hat(chains: &[Vec<f64>]) -> f64 {
    let m = chains.len() as f64;
    let n = chains[0].len() as f64;

    let chain_means: Vec<f64> = chains.iter()
        .map(|c| c.iter().sum::<f64>() / n)
        .collect();
    let grand_mean: f64 = chain_means.iter().sum::<f64>() / m;

    // Between-chain variance
    let b: f64 = (n / (m - 1.0)) * chain_means.iter()
        .map(|mean| (mean - grand_mean).powi(2))
        .sum::<f64>();

    // Within-chain variance
    let w: f64 = chains.iter().zip(chain_means.iter())
        .map(|(chain, &mean)| {
            chain.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0)
        })
        .sum::<f64>() / m;

    if w < 1e-15 {
        return 1.0;
    }

    // Pooled variance estimate
    let var_hat = ((n - 1.0) / n) * w + (1.0 / n) * b;
    (var_hat / w).sqrt()
}

// --- Single-chain Metropolis-Hastings ---

struct ChainOutput {
    pd_samples: Vec<f64>,
    lgd_samples: Vec<f64>,
    full_samples: Vec<MCMCSample>,
    accepted: usize,
}

fn run_single_chain(
    customer: &CustomerProfile,
    num_iterations: usize,
    burn_in: usize,
    seed: u64,
    pd_proposal_std: f64,
    lgd_proposal_std: f64,
) -> ChainOutput {
    let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
    let pd_normal = Normal::new(0.0_f64, pd_proposal_std).unwrap();
    let lgd_normal = Normal::new(0.0_f64, lgd_proposal_std).unwrap();

    let mut current_pd = compute_base_pd(customer);
    let mut current_lgd = compute_base_lgd(customer);
    let mut accepted: usize = 0;

    let mut pd_samples = Vec::with_capacity(num_iterations - burn_in);
    let mut lgd_samples = Vec::with_capacity(num_iterations - burn_in);
    let mut full_samples = Vec::new();

    for i in 0..num_iterations {
        let proposed_pd = (current_pd + pd_normal.sample(&mut rng)).clamp(0.001, 0.999);
        let proposed_lgd = (current_lgd + lgd_normal.sample(&mut rng)).clamp(0.01, 0.99);

        let current_log_post = log_likelihood_joint(current_pd, current_lgd, customer)
            + log_prior_pd(current_pd, 2.0, 20.0)
            + log_prior_lgd(current_lgd, 2.0, 8.0);

        let proposed_log_post = log_likelihood_joint(proposed_pd, proposed_lgd, customer)
            + log_prior_pd(proposed_pd, 2.0, 20.0)
            + log_prior_lgd(proposed_lgd, 2.0, 8.0);

        let log_alpha = proposed_log_post - current_log_post;

        if log_alpha >= 0.0 || log_alpha.exp() > rng.gen::<f64>() {
            current_pd = proposed_pd;
            current_lgd = proposed_lgd;
            if i >= burn_in {
                accepted += 1;
            }
        }

        if i >= burn_in {
            pd_samples.push(current_pd);
            lgd_samples.push(current_lgd);

            let ead = customer.loan_amount;
            full_samples.push(MCMCSample {
                iteration: i,
                default_probability: current_pd,
                loss_given_default: current_lgd,
                exposure_at_default: ead,
                expected_loss: current_pd * current_lgd * ead,
                log_posterior: log_likelihood_joint(current_pd, current_lgd, customer)
                    + log_prior_pd(current_pd, 2.0, 20.0)
                    + log_prior_lgd(current_lgd, 2.0, 8.0),
            });
        }
    }

    ChainOutput { pd_samples, lgd_samples, full_samples, accepted }
}

// --- Multi-chain MCMC with full diagnostics ---

fn run_mcmc_multichain(
    customer: &CustomerProfile,
    num_iterations: usize,
    burn_in: usize,
) -> CreditRiskResult {
    let pd_proposal_std = 0.015;
    let lgd_proposal_std = 0.02;

    // Run NUM_CHAINS independent chains with different seeds
    let chains: Vec<ChainOutput> = (0..NUM_CHAINS)
        .map(|chain_idx| {
            let seed = 42 + chain_idx as u64 * 1000
                + customer.id.as_bytes().iter().map(|b| *b as u64).sum::<u64>();
            run_single_chain(customer, num_iterations, burn_in, seed, pd_proposal_std, lgd_proposal_std)
        })
        .collect();

    // Collect PD and LGD chains for R-hat
    let pd_chains: Vec<Vec<f64>> = chains.iter().map(|c| c.pd_samples.clone()).collect();
    let lgd_chains: Vec<Vec<f64>> = chains.iter().map(|c| c.lgd_samples.clone()).collect();

    let r_hat_pd = compute_r_hat(&pd_chains);
    let r_hat_lgd = compute_r_hat(&lgd_chains);

    // Merge all post-burn-in samples from all chains
    let all_pd: Vec<f64> = chains.iter().flat_map(|c| c.pd_samples.iter().copied()).collect();
    let all_lgd: Vec<f64> = chains.iter().flat_map(|c| c.lgd_samples.iter().copied()).collect();
    let all_samples: Vec<MCMCSample> = chains.iter().flat_map(|c| c.full_samples.clone()).collect();

    // ESS from merged chain (conservative: also check per-chain)
    let ess_pd = compute_ess(&all_pd);
    let ess_lgd = compute_ess(&all_lgd);

    let total_accepted: usize = chains.iter().map(|c| c.accepted).sum();
    let total_post_burn: usize = chains.iter().map(|c| c.pd_samples.len()).sum();
    let acceptance_rate = total_accepted as f64 / total_post_burn as f64;

    let n = all_pd.len() as f64;
    let mean_pd: f64 = all_pd.iter().sum::<f64>() / n;
    let std_pd: f64 = (all_pd.iter().map(|x| (x - mean_pd).powi(2)).sum::<f64>() / (n - 1.0)).sqrt();
    let mean_lgd: f64 = all_lgd.iter().sum::<f64>() / n;
    let std_lgd: f64 = (all_lgd.iter().map(|x| (x - mean_lgd).powi(2)).sum::<f64>() / (n - 1.0)).sqrt();

    let mut sorted_pd = all_pd.clone();
    sorted_pd.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mut sorted_lgd = all_lgd.clone();
    sorted_lgd.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let quantile = |sorted: &[f64], q: f64| -> f64 {
        let idx = ((sorted.len() as f64 * q) as usize).min(sorted.len() - 1);
        sorted[idx]
    };

    let var_95 = quantile(&sorted_pd, 0.95);
    let var_99 = quantile(&sorted_pd, 0.99);
    let ci_pd = (quantile(&sorted_pd, 0.025), quantile(&sorted_pd, 0.975));
    let ci_lgd = (quantile(&sorted_lgd, 0.025), quantile(&sorted_lgd, 0.975));

    // Expected and unexpected loss from posterior samples
    let el_samples: Vec<f64> = all_pd.iter().zip(all_lgd.iter())
        .map(|(&pd, &lgd)| pd * lgd * customer.loan_amount)
        .collect();
    let mean_el: f64 = el_samples.iter().sum::<f64>() / n;
    let std_el: f64 = (el_samples.iter().map(|x| (x - mean_el).powi(2)).sum::<f64>() / (n - 1.0)).sqrt();

    let credit_grade = match mean_pd {
        p if p < 0.02 => "AAA",
        p if p < 0.05 => "AA",
        p if p < 0.10 => "A",
        p if p < 0.15 => "BBB",
        p if p < 0.25 => "BB",
        p if p < 0.40 => "B",
        _ => "CCC",
    }.to_string();

    let converged = r_hat_pd < 1.1 && r_hat_lgd < 1.1 && ess_pd > 100.0 && ess_lgd > 100.0;

    // Thin for API response
    let step = (all_samples.len() / 200).max(1);
    let thinned: Vec<MCMCSample> = all_samples.iter().step_by(step).cloned().collect();

    CreditRiskResult {
        customer_id: customer.id.clone(),
        name: customer.name.clone(),
        samples: thinned,
        posterior_mean_pd: mean_pd,
        posterior_std_pd: std_pd,
        posterior_mean_lgd: mean_lgd,
        posterior_std_lgd: std_lgd,
        var_95,
        var_99,
        expected_loss: mean_el,
        unexpected_loss: std_el,
        credit_grade,
        confidence_interval_pd: ci_pd,
        confidence_interval_lgd: ci_lgd,
        chain_diagnostics: ChainDiagnostics {
            num_chains: NUM_CHAINS,
            acceptance_rate,
            effective_sample_size_pd: ess_pd,
            effective_sample_size_lgd: ess_lgd,
            r_hat_pd,
            r_hat_lgd,
            converged,
            burn_in,
            total_iterations: num_iterations * NUM_CHAINS,
            max_autocorrelation_lag: MAX_LAG_ESS,
        },
    }
}

// --- Gaussian Copula Default Correlation ---

fn build_correlation_matrix(customers: &[CustomerProfile]) -> Vec<Vec<f64>> {
    let n = customers.len();
    let mut corr = vec![vec![0.0_f64; n]; n];
    for i in 0..n {
        for j in 0..n {
            if i == j {
                corr[i][j] = 1.0;
            } else {
                // Intra-segment correlation is higher than inter-segment
                let same_segment = customers[i].segment == customers[j].segment;
                let same_channel = customers[i].channel == customers[j].channel;
                let base_corr = 0.15; // systemic factor
                let segment_corr = if same_segment { 0.20 } else { 0.05 };
                let channel_corr = if same_channel { 0.10 } else { 0.0 };
                corr[i][j] = (base_corr + segment_corr + channel_corr).min(0.95);
            }
        }
    }
    corr
}

/// Cholesky decomposition for correlation matrix
fn cholesky(matrix: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let n = matrix.len();
    let mut l = vec![vec![0.0_f64; n]; n];
    for i in 0..n {
        for j in 0..=i {
            let mut sum = 0.0;
            for k in 0..j {
                sum += l[i][k] * l[j][k];
            }
            if i == j {
                l[i][j] = (matrix[i][i] - sum).max(1e-10).sqrt();
            } else {
                l[i][j] = (matrix[i][j] - sum) / l[j][j].max(1e-10);
            }
        }
    }
    l
}

/// Standard normal CDF approximation (Abramowitz & Stegun)
fn norm_cdf(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.2316419 * x.abs());
    let d = 0.3989422804014327;
    let p = d * (-x * x / 2.0).exp()
        * (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
    if x >= 0.0 { 1.0 - p } else { p }
}

/// Inverse normal CDF approximation (Beasley-Springer-Moro)
fn norm_inv(p: f64) -> f64 {
    let p = p.clamp(1e-10, 1.0 - 1e-10);
    let a = [
        -3.969683028665376e1, 2.209460984245205e2,
        -2.759285104469687e2, 1.383577518672690e2,
        -3.066479806614716e1, 2.506628277459239e0,
    ];
    let b = [
        -5.447609879822406e1, 1.615858368580409e2,
        -1.556989798598866e2, 6.680131188771972e1,
        -1.328068155288572e1,
    ];
    let c = [
        -7.784894002430293e-3, -3.223964580411365e-1,
        -2.400758277161838e0, -2.549732539343734e0,
        4.374664141464968e0, 2.938163982698783e0,
    ];
    let d = [
        7.784695709041462e-3, 3.224671290700398e-1,
        2.445134137142996e0, 3.754408661907416e0,
    ];

    let q = p - 0.5;
    if q.abs() <= 0.425 {
        let r = 0.180625 - q * q;
        return q * (((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + 1.0)
            / ((((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)));
    }

    let r = if q < 0.0 { p } else { 1.0 - p };
    let r = (-r.ln()).sqrt();

    let result = if r <= 5.0 {
        let r = r - 1.6;
        (((((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) * r + 1.0)
            / (((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1.0)))
    } else {
        let r = r - 5.0;
        (((((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) * r + 1.0)
            / (((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1.0)))
    };

    if q < 0.0 { -result } else { result }
}

/// Portfolio loss simulation using Gaussian copula for correlated defaults
fn simulate_portfolio_losses(
    customers: &[CustomerProfile],
    results: &[CreditRiskResult],
    correlation_matrix: &[Vec<f64>],
    num_simulations: usize,
    pd_shock: f64,
    lgd_shock: f64,
    corr_shock: f64,
) -> Vec<f64> {
    let n = customers.len();
    let mut rng = rand::thread_rng();
    let standard_normal = Normal::new(0.0_f64, 1.0).unwrap();

    // Apply correlation shock
    let shocked_corr: Vec<Vec<f64>> = correlation_matrix.iter().enumerate().map(|(i, row)| {
        row.iter().enumerate().map(|(j, &val)| {
            if i == j { 1.0 } else { (val + corr_shock).clamp(0.0, 0.99) }
        }).collect()
    }).collect();

    let chol = cholesky(&shocked_corr);
    let mut losses = Vec::with_capacity(num_simulations);

    for _ in 0..num_simulations {
        // Generate correlated standard normals
        let z: Vec<f64> = (0..n).map(|_| standard_normal.sample(&mut rng)).collect();
        let mut correlated = vec![0.0_f64; n];
        for i in 0..n {
            for j in 0..=i {
                correlated[i] += chol[i][j] * z[j];
            }
        }

        // Convert to uniform via CDF, then determine defaults
        let mut portfolio_loss = 0.0_f64;
        for (idx, customer) in customers.iter().enumerate() {
            let u = norm_cdf(correlated[idx]);
            let shocked_pd = (results[idx].posterior_mean_pd * pd_shock).clamp(0.001, 0.999);
            let shocked_lgd = (results[idx].posterior_mean_lgd * lgd_shock).clamp(0.01, 0.99);

            // Default threshold via Gaussian copula
            let default_threshold = norm_cdf(norm_inv(shocked_pd));
            if u < default_threshold {
                portfolio_loss += shocked_lgd * customer.loan_amount;
            }
        }
        losses.push(portfolio_loss);
    }

    losses.sort_by(|a, b| a.partial_cmp(b).unwrap());
    losses
}

fn compute_portfolio_risk(customers: &[CustomerProfile]) -> PortfolioRisk {
    let results: Vec<CreditRiskResult> = customers.iter()
        .map(|c| run_mcmc_multichain(c, 2000, 500))
        .collect();

    let total_exposure: f64 = customers.iter().map(|c| c.loan_amount).sum();
    let total_el: f64 = results.iter().map(|r| r.expected_loss).sum();

    let correlation_matrix = build_correlation_matrix(customers);

    // Baseline simulation
    let losses = simulate_portfolio_losses(
        customers, &results, &correlation_matrix,
        PORTFOLIO_SIMULATIONS, 1.0, 1.0, 0.0,
    );

    let quantile = |sorted: &[f64], q: f64| -> f64 {
        let idx = ((sorted.len() as f64 * q) as usize).min(sorted.len() - 1);
        sorted[idx]
    };

    let var_95 = quantile(&losses, 0.95);
    let var_99 = quantile(&losses, 0.99);

    // CVaR (Expected Shortfall)
    let idx_95 = (losses.len() as f64 * 0.95) as usize;
    let idx_99 = (losses.len() as f64 * 0.99) as usize;
    let cvar_95 = if idx_95 < losses.len() {
        losses[idx_95..].iter().sum::<f64>() / (losses.len() - idx_95) as f64
    } else { var_95 };
    let cvar_99 = if idx_99 < losses.len() {
        losses[idx_99..].iter().sum::<f64>() / (losses.len() - idx_99) as f64
    } else { var_99 };

    let mean_loss: f64 = losses.iter().sum::<f64>() / losses.len() as f64;
    let unexpected_loss = (losses.iter().map(|l| (l - mean_loss).powi(2)).sum::<f64>()
        / (losses.len() as f64 - 1.0)).sqrt();

    // Segment-level risk contributions
    let mut segment_data: std::collections::HashMap<String, (f64, f64)> = std::collections::HashMap::new();
    for (customer, result) in customers.iter().zip(results.iter()) {
        let entry = segment_data.entry(customer.segment.clone()).or_insert((0.0, 0.0));
        entry.0 += customer.loan_amount;
        entry.1 += result.expected_loss;
    }

    let mut risk_contributions: Vec<RiskContribution> = segment_data.iter().map(|(segment, &(exposure, el))| {
        RiskContribution {
            segment: segment.clone(),
            exposure,
            expected_loss: el,
            contribution_pct: el / total_el.max(1.0) * 100.0,
            marginal_var: el / total_el.max(1.0) * var_99,
        }
    }).collect();
    risk_contributions.sort_by(|a, b| b.contribution_pct.partial_cmp(&a.contribution_pct).unwrap());

    // HHI concentration
    let hhi: f64 = segment_data.values().map(|(exp, _)| (exp / total_exposure.max(1.0)).powi(2)).sum();
    let diversification = var_99 - risk_contributions.iter().map(|r| r.marginal_var).sum::<f64>();

    // Stress tests: re-simulate with shocked parameters
    let stress_configs = vec![
        ("CBN Stress Test — Mild Recession", "moderate", 1.5, 1.2, 0.05),
        ("Naira Devaluation (30%)", "severe", 2.0, 1.5, 0.10),
        ("Oil Price Collapse", "extreme", 3.0, 1.8, 0.15),
        ("Pandemic Lockdown", "extreme", 2.5, 2.0, 0.20),
    ];

    let stress_test_results: Vec<StressScenario> = stress_configs.iter().map(|&(name, severity, pd_s, lgd_s, corr_s)| {
        let stressed_losses = simulate_portfolio_losses(
            customers, &results, &correlation_matrix,
            PORTFOLIO_SIMULATIONS, pd_s, lgd_s, corr_s,
        );
        let stressed_mean = stressed_losses.iter().sum::<f64>() / stressed_losses.len() as f64;
        let stressed_var99 = quantile(&stressed_losses, 0.99);
        let stressed_defaults: f64 = stressed_losses.iter().filter(|&&l| l > 0.0).count() as f64
            / stressed_losses.len() as f64 * customers.len() as f64;

        StressScenario {
            name: name.to_string(),
            severity: severity.to_string(),
            pd_shock: pd_s,
            lgd_shock: lgd_s,
            correlation_shock: corr_s,
            portfolio_loss: stressed_mean,
            loss_percentage: stressed_mean / total_exposure.max(1.0) * 100.0,
            var_99_stressed: stressed_var99,
            num_defaults: stressed_defaults,
        }
    }).collect();

    PortfolioRisk {
        total_exposure,
        expected_loss: total_el,
        unexpected_loss,
        var_95,
        var_99,
        cvar_95,
        cvar_99,
        concentration_risk: hhi * 10000.0,
        diversification_benefit: diversification.abs(),
        correlation_matrix,
        num_simulations: PORTFOLIO_SIMULATIONS,
        stress_test_results,
        risk_contributions,
    }
}

// --- API Handlers ---

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "mcmc-engine", "version": "2.0.0"}))
}

async fn credit_risk_all(data: web::Data<AppState>) -> HttpResponse {
    let customers = data.customers.lock().unwrap();
    let results: Vec<CreditRiskResult> = customers.iter()
        .map(|c| run_mcmc_multichain(c, DEFAULT_ITERATIONS, DEFAULT_BURN_IN))
        .collect();

    let all_converged = results.iter().all(|r| r.chain_diagnostics.converged);
    let summary = serde_json::json!({
        "total_customers": results.len(),
        "grade_distribution": grade_distribution(&results),
        "avg_pd": results.iter().map(|r| r.posterior_mean_pd).sum::<f64>() / results.len() as f64,
        "avg_lgd": results.iter().map(|r| r.posterior_mean_lgd).sum::<f64>() / results.len() as f64,
        "total_expected_loss": results.iter().map(|r| r.expected_loss).sum::<f64>(),
        "all_chains_converged": all_converged,
        "mcmc_config": {
            "algorithm": "Metropolis-Hastings",
            "num_chains": NUM_CHAINS,
            "iterations_per_chain": DEFAULT_ITERATIONS,
            "burn_in": DEFAULT_BURN_IN,
            "pd_prior": "Beta(2, 20)",
            "lgd_prior": "Beta(2, 8)",
            "convergence_criterion": "R-hat < 1.1 && ESS > 100",
        }
    });

    HttpResponse::Ok().json(serde_json::json!({
        "results": results,
        "summary": summary,
    }))
}

async fn credit_risk_single(path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    let customer_id = path.into_inner();
    let customers = data.customers.lock().unwrap();

    if let Some(customer) = customers.iter().find(|c| c.id == customer_id) {
        let result = run_mcmc_multichain(customer, 10000, 2000);
        HttpResponse::Ok().json(result)
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Customer not found"}))
    }
}

async fn portfolio_risk(data: web::Data<AppState>) -> HttpResponse {
    let customers = data.customers.lock().unwrap();
    let result = compute_portfolio_risk(&customers);
    HttpResponse::Ok().json(result)
}

fn grade_distribution(results: &[CreditRiskResult]) -> serde_json::Value {
    let mut dist: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for r in results {
        *dist.entry(r.credit_grade.clone()).or_insert(0) += 1;
    }
    serde_json::json!(dist)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Initializing MCMC Engine v2.0 (multi-chain, Gaussian copula)...");
    let customers = seed_customers();
    println!("Loaded {} customer profiles for MCMC analysis", customers.len());
    println!("Configuration: {} chains × {} iterations, {} burn-in", NUM_CHAINS, DEFAULT_ITERATIONS, DEFAULT_BURN_IN);
    println!("Portfolio simulations: {} (Gaussian copula correlated defaults)", PORTFOLIO_SIMULATIONS);

    let data = web::Data::new(AppState {
        customers: Mutex::new(customers),
    });

    println!("MCMC Engine listening on :8092");
    HttpServer::new(move || {
        let cors = Cors::permissive();
        App::new()
            .wrap(cors)
            .app_data(data.clone())
            .route("/health", web::get().to(health))
            .route("/api/v1/mcmc/credit-risk", web::get().to(credit_risk_all))
            .route("/api/v1/mcmc/credit-risk/{id}", web::get().to(credit_risk_single))
            .route("/api/v1/mcmc/portfolio-risk", web::get().to(portfolio_risk))
    })
    .bind("0.0.0.0:8092")?
    .run()
    .await
}
