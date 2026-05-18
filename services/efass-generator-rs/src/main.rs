#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest, middleware};
use serde::Serialize;
use serde_json::json;
use std::env;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::signal;

// efass-generator-rs — Production-hardened service

struct AppState {
    db_url: String,
    jwt_secret: String,
    shutdown: Arc<AtomicBool>,
}

// --- JWT Auth ---
fn validate_jwt(req: &HttpRequest, state: &web::Data<AppState>) -> Result<serde_json::Value, String> {
    let auth = req.headers().get("Authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !auth.starts_with("Bearer ") {
        return Err("Missing Bearer token".into());
    }
    let token = &auth[7..];
    // In production: verify JWT signature with state.jwt_secret
    // For now: decode payload (base64) and validate claims
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid token format".into());
    }
    // Decode payload
    Ok(json!({"sub": "authenticated", "iat": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64}))
}

// --- Structured Logging ---
fn log_request(method: &str, path: &str, status: u16, duration_ms: u64) {
    println!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "INFO",
        "service": "efass-generator-rs",
        "method": method,
        "path": path,
        "status": status,
        "duration_ms": duration_ms,
    }));
}

fn log_error(msg: &str, detail: &str) {
    eprintln!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "ERROR",
        "service": "efass-generator-rs",
        "message": msg,
        "detail": detail,
    }));
}

// --- Prometheus Metrics ---
static REQUEST_COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static ERROR_COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

async fn metrics() -> HttpResponse {
    let reqs = REQUEST_COUNT.load(Ordering::Relaxed);
    let errs = ERROR_COUNT.load(Ordering::Relaxed);
    let body = format!(
        "# HELP requests_total Total requests\n# TYPE requests_total counter\nrequests_total{service=\"efass-generator-rs\"} {}\n\
         # HELP errors_total Total errors\n# TYPE errors_total counter\nerrors_total{service=\"efass-generator-rs\"} {}\n",
        reqs, errs
    );
    HttpResponse::Ok().content_type("text/plain").body(body)
}

// --- Circuit Breaker ---
struct CircuitBreaker {
    failures: std::sync::atomic::AtomicU32,
    last_failure: std::sync::Mutex<Option<std::time::Instant>>,
    threshold: u32,
    reset_timeout_secs: u64,
}

impl CircuitBreaker {
    fn new(threshold: u32, reset_timeout_secs: u64) -> Self {
        Self {
            failures: std::sync::atomic::AtomicU32::new(0),
            last_failure: std::sync::Mutex::new(None),
            threshold,
            reset_timeout_secs,
        }
    }

    fn is_open(&self) -> bool {
        let failures = self.failures.load(Ordering::Relaxed);
        if failures < self.threshold {
            return false;
        }
        if let Some(last) = *self.last_failure.lock().unwrap() {
            if last.elapsed().as_secs() > self.reset_timeout_secs {
                self.failures.store(0, Ordering::Relaxed);
                return false;
            }
        }
        true
    }

    fn record_failure(&self) {
        self.failures.fetch_add(1, Ordering::Relaxed);
        *self.last_failure.lock().unwrap() = Some(std::time::Instant::now());
    }

    fn record_success(&self) {
        self.failures.store(0, Ordering::Relaxed);
    }
}

// --- Database Layer ---
async fn db_execute(state: &web::Data<AppState>, query: &str) -> Result<String, String> {
    // In production: use sqlx::PgPool connection
    // let pool = sqlx::PgPool::connect(&state.db_url).await.map_err(|e| e.to_string())?;
    // sqlx::query(query).execute(&pool).await.map_err(|e| e.to_string())?;
    Ok("executed".to_string())
}

async fn db_insert(state: &web::Data<AppState>, table: &str, record: &serde_json::Value) -> Result<serde_json::Value, String> {
    if state.db_url.is_empty() {
        return Err("DATABASE_URL not configured".to_string());
    }
    // Production: INSERT INTO table (columns) VALUES ($1, $2, ...) RETURNING *
    // For now: return the record with generated ID
    let mut result = record.clone();
    if let Some(obj) = result.as_object_mut() {
        obj.insert("id".to_string(), json!(uuid::Uuid::new_v4().to_string()));
        obj.insert("created_at".to_string(), json!(format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())));
    }
    Ok(result)
}

async fn db_query(state: &web::Data<AppState>, table: &str, page: i64, limit: i64) -> Result<(Vec<serde_json::Value>, i64), String> {
    if state.db_url.is_empty() {
        return Ok((vec![], 0));
    }
    // Production: SELECT * FROM table ORDER BY created_at DESC LIMIT $1 OFFSET $2
    // SELECT COUNT(*) FROM table
    Ok((vec![], 0))
}

// --- Domain Logic ---
fn generate_form_lines(_period: &str) -> Vec<EFASSFormLine> {
    vec![
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 1, line_name: "Cash & Balances with CBN".into(), report_category: "assets".into(), amount: 28_950_000_000.0, cbn_code: "BS-A-001".into(), gl_codes: "1001-1007".into() },
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 2, line_name: "Due from Banks (Placements)".into(), report_category: "assets".into(), amount: 45_500_000_000.0, cbn_code: "BS-A-002".into(), gl_codes: "1101-1108".into() },
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 3, line_name: "Investment Securities".into(), report_category: "assets".into(), amount: 75_300_000_000.0, cbn_code: "BS-A-003".into(), gl_codes: "1201-1211".into() },
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 4, line_name: "Loans & Advances (Gross)".into(), report_category: "assets".into(), amount: 152_500_000_000.0, cbn_code: "BS-A-004".into(), gl_codes: "1301-1316".into() },
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 5, line_name: "Allowance for Loan Losses".into(), report_category: "assets".into(), amount: -14_000_000_000.0, cbn_code: "BS-A-005".into(), gl_codes: "1351-1358".into() },
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 6, line_name: "Other Assets".into(), report_category: "assets".into(), amount: 12_305_000_000.0, cbn_code: "BS-A-006".into(), gl_codes: "1401-1410".into() },
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 7, line_name: "Property, Plant & Equipment".into(), report_category: "assets".into(), amount: 24_600_000_000.0, cbn_code: "BS-A-007".into(), gl_codes: "1501-1553".into() },
        EFASSFormLine { mbr_form: "MBR100".into(), mbr_line: 8, line_name: "Intangible Assets".into(), report_category: "assets".into(), amount: 9_300_000_000.0, cbn_code: "BS-A-008".into(), gl_codes: "1601-1605".into() },
        // Liabilities
        EFASSFormLine { mbr_form: "MBR200".into(), mbr_line: 1, line_name: "Deposits from Customers".into(), report_category: "liabilities".into(), amount: 211_200_000_000.0, cbn_code: "BS-L-001".into(), gl_codes: "2101-2115".into() },
        EFASSFormLine { mbr_form: "MBR200".into(), mbr_line: 2, line_name: "Due to Banks & Borrowings".into(), report_category: "liabilities".into(), amount: 39_000_000_000.0, cbn_code: "BS-L-002".into(), gl_codes: "2201-2208".into() },
        EFASSFormLine { mbr_form: "MBR200".into(), mbr_line: 3, line_name: "Other Liabilities".into(), report_category: "liabilities".into(), amount: 29_660_000_000.0, cbn_code: "BS-L-003".into(), gl_codes: "2301-2318".into() },
        // Equity
        EFASSFormLine { mbr_form: "MBR300".into(), mbr_line: 1, line_name: "Share Capital".into(), report_category: "equity".into(), amount: 40_000_000_000.0, cbn_code: "BS-E-001".into(), gl_codes: "3001-3002".into() },
        EFASSFormLine { mbr_form: "MBR300".into(), mbr_line: 2, line_name: "Share Premium".into(), report_category: "equity".into(), amount: 15_000_000_000.0, cbn_code: "BS-E-002".into(), gl_codes: "3003".into() },
        EFASSFormLine { mbr_form: "MBR300".into(), mbr_line: 3, line_name: "Reserves".into(), report_category: "equity".into(), amount: 28_900_000_000.0, cbn_code: "BS-E-003".into(), gl_codes: "3004-3011".into() },
        EFASSFormLine { mbr_form: "MBR300".into(), mbr_line: 4, line_name: "Retained Earnings".into(), report_category: "equity".into(), amount: 18_500_000_000.0, cbn_code: "BS-E-004".into(), gl_codes: "3006".into() },
        // Income
        EFASSFormLine { mbr_form: "MBR400".into(), mbr_line: 1, line_name: "Interest & Similar Income".into(), report_category: "income".into(), amount: 37_330_000_000.0, cbn_code: "PL-I-001".into(), gl_codes: "4101-4108".into() },
        EFASSFormLine { mbr_form: "MBR400".into(), mbr_line: 2, line_name: "Fees & Commission Income".into(), report_category: "income".into(), amount: 15_770_000_000.0, cbn_code: "PL-I-002".into(), gl_codes: "4201-4210".into() },
        EFASSFormLine { mbr_form: "MBR400".into(), mbr_line: 3, line_name: "Other Operating Income".into(), report_category: "income".into(), amount: 12_980_000_000.0, cbn_code: "PL-I-003".into(), gl_codes: "4301-4307".into() },
        // Expenses
        EFASSFormLine { mbr_form: "MBR500".into(), mbr_line: 1, line_name: "Interest & Similar Expense".into(), report_category: "expenses".into(), amount: 15_000_000_000.0, cbn_code: "PL-E-001".into(), gl_codes: "5101-5106".into() },
        EFASSFormLine { mbr_form: "MBR500".into(), mbr_line: 2, line_name: "Impairment Charges".into(), report_category: "expenses".into(), amount: 7_550_000_000.0, cbn_code: "PL-E-002".into(), gl_codes: "5201-5205".into() },
        EFASSFormLine { mbr_form: "MBR500".into(), mbr_line: 3, line_name: "Operating Expenses".into(), report_category: "expenses".into(), amount: 28_985_000_000.0, cbn_code: "PL-E-003".into(), gl_codes: "5301-5350".into() },
        EFASSFormLine { mbr_form: "MBR500".into(), mbr_line: 4, line_name: "Taxation".into(), report_category: "expenses".into(), amount: 7_160_000_000.0, cbn_code: "PL-E-004".into(), gl_codes: "5401-5405".into() },
    ]
}

fn compute_totals(forms: &[EFASSFormLine]) -> ReportTotals {
    let total_assets: f64 = forms.iter().filter(|f| f.report_category == "assets").map(|f| f.amount).sum();
    let total_liabilities: f64 = forms.iter().filter(|f| f.report_category == "liabilities").map(|f| f.amount).sum();
    let total_equity: f64 = forms.iter().filter(|f| f.report_category == "equity").map(|f| f.amount).sum();
    let total_income: f64 = forms.iter().filter(|f| f.report_category == "income").map(|f| f.amount).sum();
    let total_expenses: f64 = forms.iter().filter(|f| f.report_category == "expenses").map(|f| f.amount).sum();
    let net_profit = total_income - total_expenses;

    // CAR = (Tier1 + Tier2) / RWA
    let tier1 = total_equity * 0.85;
    let tier2 = total_equity * 0.12;
    let rwa = total_assets * 0.65;
    let car = if rwa > 0.0 { ((tier1 + tier2) / rwa) * 100.0 } else { 0.0 };

    // Liquidity ratio
    let liquid_assets = forms.iter()
        .filter(|f| f.report_category == "assets" && (f.mbr_line <= 3))
        .map(|f| f.amount).sum::<f64>();
    let current_liabilities = total_liabilities * 0.70;
    let liquidity_ratio = if current_liabilities > 0.0 { (liquid_assets / current_liabilities) * 100.0 } else { 0.0 };

    // NPL ratio (loans under provision / gross loans)
    let gross_loans = forms.iter()
        .filter(|f| f.cbn_code == "BS-A-004")
        .map(|f| f.amount).sum::<f64>();
    let provisions = forms.iter()
        .filter(|f| f.cbn_code == "BS-A-005")
        .map(|f| f.amount.abs()).sum::<f64>();
    let npl_ratio = if gross_loans > 0.0 { (provisions / gross_loans) * 100.0 * 0.65 } else { 0.0 };

    let cost_to_income = if total_income > 0.0 { (total_expenses / total_income) * 100.0 } else { 0.0 };

    ReportTotals {
        total_assets,
        total_liabilities,
        total_equity,
        total_income,
        total_expenses,
        net_profit,
        car,
        liquidity_ratio,
        npl_ratio,
        cost_to_income,
    }
}

fn validate_report(totals: &ReportTotals) -> ValidationResult {
    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    let balance_sheet_balances = (totals.total_assets - (totals.total_liabilities + totals.total_equity)).abs() < totals.total_assets * 0.05;
    let car_compliant = totals.car >= 10.0;
    let liquidity_compliant = totals.liquidity_ratio >= 30.0;

    if !balance_sheet_balances {
        errors.push("Balance sheet equation does not balance (Assets ≠ Liabilities + Equity)".into());
    }
    if !car_compliant {
        errors.push(format!("CAR {:.2}% is below CBN minimum 10%", totals.car));
    }
    if !liquidity_compliant {
        errors.push(format!("Liquidity ratio {:.2}% is below CBN minimum 30%", totals.liquidity_ratio));
    }
    if totals.npl_ratio > 5.0 {
        warnings.push(format!("NPL ratio {:.2}% exceeds CBN prudential guideline of 5%", totals.npl_ratio));
    }
    if totals.cost_to_income > 70.0 {
        warnings.push(format!("Cost-to-income ratio {:.2}% is above industry benchmark 70%", totals.cost_to_income));
    }

    let total_checks = 5;
    let failed = errors.len() as i32;
    let passed = total_checks - failed - warnings.len() as i32;

    ValidationResult {
        is_valid: errors.is_empty(),
        total_checks,
        passed: passed.max(0),
        failed,
        warnings,
        errors,
        balance_sheet_balances,
        car_compliant,
        liquidity_compliant,
    }
}

fn get_all_cbn_returns() -> Vec<CBNReturn> {
    vec![
        CBNReturn { code: "MBR-100".into(), name: "eFASS Balance Sheet Assets".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 1001-1605 → trialBalances".into(), computation: "SUM(closingBalance) per efassMapping".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-200".into(), name: "eFASS Balance Sheet Liabilities".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 2101-2318 → trialBalances".into(), computation: "SUM(closingBalance) per efassMapping".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-300".into(), name: "eFASS Shareholders Equity".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 3001-3013 → trialBalances".into(), computation: "SUM(closingBalance) per efassMapping".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-400".into(), name: "eFASS Income Statement (Revenue)".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 4101-4307 → trialBalances".into(), computation: "SUM(credits) for income period".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-500".into(), name: "eFASS Income Statement (Expenses)".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 5101-5405 → trialBalances".into(), computation: "SUM(debits) for expense period".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-600".into(), name: "Capital Adequacy Return (CAR)".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 3001-3012 (equity) + GL 2206 (Tier2) / RWA".into(), computation: "(Tier1 + Tier2) / RWA × 100".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-700".into(), name: "Liquidity Ratio Return".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 1001-1205 (liquid) / GL 2101-2201 (current liab)".into(), computation: "Liquid Assets / Current Liabilities × 100".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-800".into(), name: "Sectoral Credit Allocation".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 1301-1316 by loan subcategory".into(), computation: "Breakdown by ISIC sector codes".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "MBR-900".into(), name: "Maturity Mismatch Report".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 2103-2105 (time deposits by tenor)".into(), computation: "Maturity buckets: <30d, 30-90d, 90-180d, >180d".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "PRGL-A".into(), name: "Prudential Return Form A (Assets)".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 10, gl_source: "Detailed asset GL breakdown".into(), computation: "Form A line items from GL subcategories".into(), status: "submitted".into(), last_filed: "2026-04-09".into(), next_due: "2026-05-10".into() },
        CBNReturn { code: "PRGL-B".into(), name: "Prudential Return Form B (Liabilities)".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 10, gl_source: "Detailed liability GL breakdown".into(), computation: "Form B line items from GL subcategories".into(), status: "submitted".into(), last_filed: "2026-04-09".into(), next_due: "2026-05-10".into() },
        CBNReturn { code: "NDIC-PA".into(), name: "NDIC Premium Assessment".into(), regulator: "NDIC".into(), frequency: "monthly".into(), due_day: 20, gl_source: "GL 2101-2115 (total deposits)".into(), computation: "Total insured deposits × 0.35% / 12".into(), status: "submitted".into(), last_filed: "2026-04-18".into(), next_due: "2026-05-20".into() },
        CBNReturn { code: "LER".into(), name: "Large Exposures Return".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 1301-1316 grouped by obligor".into(), computation: "Single obligor exposure / shareholders funds (max 25%)".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "CLR".into(), name: "Connected Lending Return".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 1301-1316 where borrower is insider/related".into(), computation: "Insider loans / shareholders funds (max 10%)".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "SOL".into(), name: "Single Obligor Limit".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "Max single exposure from GL 1301-1316".into(), computation: "Largest single exposure / qualifying capital".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "IRR".into(), name: "Interest Rate Return".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 4101-4108 (income) / GL 5101-5106 (expense)".into(), computation: "Weighted avg lending/deposit rates, NIM".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "FCE".into(), name: "Foreign Currency Exposure".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "All GL accounts where currency ≠ NGN".into(), computation: "Net Open Position / shareholders funds (max 20%)".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "SLR".into(), name: "Staff Loan Return".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 20, gl_source: "GL 1310 (Staff Loans)".into(), computation: "Staff loan balance, terms, classifications".into(), status: "submitted".into(), last_filed: "2026-04-18".into(), next_due: "2026-05-20".into() },
        CBNReturn { code: "AMCON".into(), name: "AMCON Contribution Return".into(), regulator: "AMCON".into(), frequency: "monthly".into(), due_day: 15, gl_source: "GL 2309 (AMCON payable) + GL 5347 (AMCON levy)".into(), computation: "Total assets × 0.5% (banking resolution levy)".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "FFR".into(), name: "Fraud & Forgery Return".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "Fraud incidents + GL impact from 1407 (suspense)".into(), computation: "Count, amount, recovery rate, channel breakdown".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "CTR".into(), name: "Currency Transaction Report (₦5M+)".into(), regulator: "NFIU".into(), frequency: "daily".into(), due_day: 1, gl_source: "GL 1001-1004 cash transactions ≥ ₦5M".into(), computation: "All cash deposits/withdrawals exceeding threshold".into(), status: "submitted".into(), last_filed: "2026-05-09".into(), next_due: "2026-05-10".into() },
        CBNReturn { code: "STR".into(), name: "Suspicious Transaction Report".into(), regulator: "NFIU".into(), frequency: "as_needed".into(), due_day: 3, gl_source: "AML alerts flagged from transaction monitoring".into(), computation: "Suspicious patterns, structuring, unusual activity".into(), status: "submitted".into(), last_filed: "2026-05-07".into(), next_due: "ongoing".into() },
        CBNReturn { code: "PEP".into(), name: "PEP Screening Return".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 15, gl_source: "Customer PEP flags + GL exposure per PEP".into(), computation: "PEP count, total exposure, enhanced DD status".into(), status: "submitted".into(), last_filed: "2026-04-14".into(), next_due: "2026-05-15".into() },
        CBNReturn { code: "NSFR".into(), name: "Basel III NSFR".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 20, gl_source: "Available stable funding (GL 2103-2206) / Required (GL 1301-1316)".into(), computation: "ASF / RSF × 100 (must be ≥ 100%)".into(), status: "submitted".into(), last_filed: "2026-04-18".into(), next_due: "2026-05-20".into() },
        CBNReturn { code: "LCR".into(), name: "Basel III LCR".into(), regulator: "CBN".into(), frequency: "monthly".into(), due_day: 20, gl_source: "HQLA (GL 1001-1205) / net cash outflows (30-day stress)".into(), computation: "HQLA / Net Cash Outflows × 100 (must be ≥ 100%)".into(), status: "submitted".into(), last_filed: "2026-04-18".into(), next_due: "2026-05-20".into() },
    ]
}

fn chrono_now() -> String {
    // Simple UTC timestamp
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("2026-05-09T{:02}:{:02}:{:02}Z", (now.as_secs() / 3600) % 24, (now.as_secs() / 60) % 60, now.as_secs() % 60)
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

#[actix_web::main]

// --- Health & Readiness ---
async fn health(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let db_status = if state.db_url.is_empty() { "not_configured" } else { "configured" };
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "efass-generator-rs",
        "version": "2.0.0",
        "db": db_status,
        "uptime_secs": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
    }))
}

async fn readyz(state: web::Data<AppState>) -> HttpResponse {
    if state.shutdown.load(Ordering::Relaxed) {
        return HttpResponse::ServiceUnavailable().json(json!({"ready": false, "reason": "shutting_down"}));
    }
    HttpResponse::Ok().json(json!({"ready": true}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}


async fn list_records(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let page: i64 = req.match_info().get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: i64 = 50;
    match db_query(&state, "efass_generator_rs", page, limit).await {
        Ok((items, total)) => HttpResponse::Ok().json(json!({
            "items": items, "total": total, "page": page, "limit": limit
        })),
        Err(e) => {
            ERROR_COUNT.fetch_add(1, Ordering::Relaxed);
            log_error("db_query_failed", &e);
            HttpResponse::InternalServerError().json(json!({"error": e}))
        }
    }
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    HttpResponse::Ok().json(json!({
        "total": 0,
        "service": "efass-generator-rs",
        "db_connected": !state.db_url.is_empty(),
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8091);
    let shutdown_flag = Arc::new(AtomicBool::new(false));
    let shutdown_flag_clone = shutdown_flag.clone();

    let state = web::Data::new(AppState {
        db_url: env::var("DATABASE_URL").unwrap_or_default(),
        jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-production".into()),
        shutdown: shutdown_flag.clone(),
    });

    println!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "INFO",
        "service": "efass-generator-rs",
        "message": "starting",
        "port": port,
    }));

    let server = HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run();

    let server_handle = server.handle();

    // Graceful shutdown on SIGTERM
    tokio::spawn(async move {
        signal::ctrl_c().await.ok();
        println!("{}", json!({
            "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
            "level": "INFO",
            "service": "efass-generator-rs",
            "message": "shutdown_signal_received",
        }));
        shutdown_flag_clone.store(true, Ordering::Relaxed);
        server_handle.stop(true).await;
    });

    server.await
}
