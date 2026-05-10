use std::collections::HashMap;
use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, RwLock};

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "product.created,product.updated,product.activated,product.sunset"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "product-cache,eligibility-rules-cache"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "products,product_versions,product_rules,gl_mappings,pricing_tiers"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "product-catalog"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "product-manager"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "product:create,product:approve,product:activate,product:sunset"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "product-events"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "product-lifecycle"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "ProductApprovalWorkflow"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-product-registration"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "gl-account-mapping-validation"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "product_history,product_performance"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/products/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "product-config-protection"}
    })
}

#[derive(Clone)]
struct Product {
    id: String,
    name: String,
    product_type: String,
    category: String,
    status: String,
    version: i32,
    currency: String,
    interest_config: InterestConfig,
    fee_config: Vec<FeeRule>,
    gl_mappings: Vec<GLMapping>,
    eligibility: Vec<EligibilityRule>,
    lifecycle_stage: String,
    created_by: String,
    approved_by: String,
    effective_date: String,
    sunset_date: String,
}

#[derive(Clone)]
struct InterestConfig {
    rate_type: String,
    base_rate: f64,
    spread: f64,
    effective_rate: f64,
    accrual_basis: String,
    compounding: String,
    tiers: Vec<RateTier>,
}

#[derive(Clone)]
struct RateTier {
    min_balance: f64,
    max_balance: f64,
    rate: f64,
}

#[derive(Clone)]
struct FeeRule {
    name: String,
    fee_type: String,
    amount: f64,
    percentage: f64,
    frequency: String,
    gl_code: String,
}

#[derive(Clone)]
struct GLMapping {
    event: String,
    debit_gl: String,
    credit_gl: String,
    description: String,
}

#[derive(Clone)]
struct EligibilityRule {
    field: String,
    operator: String,
    value: String,
}

fn seed_products() -> Vec<Product> {
    vec![
        Product {
            id: "PROD-SAV-001".into(), name: "54Bank Premium Savings".into(),
            product_type: "savings".into(), category: "retail".into(),
            status: "active".into(), version: 3, currency: "NGN".into(),
            interest_config: InterestConfig {
                rate_type: "tiered".into(), base_rate: 0.0, spread: 0.0,
                effective_rate: 0.0, accrual_basis: "365-day".into(),
                compounding: "monthly".into(),
                tiers: vec![
                    RateTier { min_balance: 0.0, max_balance: 500000.0, rate: 1.5 },
                    RateTier { min_balance: 500000.01, max_balance: 5000000.0, rate: 3.0 },
                    RateTier { min_balance: 5000000.01, max_balance: 50000000.0, rate: 4.5 },
                    RateTier { min_balance: 50000000.01, max_balance: f64::MAX, rate: 6.0 },
                ],
            },
            fee_config: vec![
                FeeRule { name: "Monthly Maintenance".into(), fee_type: "flat".into(), amount: 50.0, percentage: 0.0, frequency: "monthly".into(), gl_code: "GL-FEE-001".into() },
                FeeRule { name: "SMS Alert".into(), fee_type: "flat".into(), amount: 4.0, percentage: 0.0, frequency: "per-transaction".into(), gl_code: "GL-FEE-002".into() },
            ],
            gl_mappings: vec![
                GLMapping { event: "deposit".into(), debit_gl: "GL-1001-CASH".into(), credit_gl: "GL-2001-SAVINGS".into(), description: "Customer deposit to savings".into() },
                GLMapping { event: "withdrawal".into(), debit_gl: "GL-2001-SAVINGS".into(), credit_gl: "GL-1001-CASH".into(), description: "Customer withdrawal from savings".into() },
                GLMapping { event: "interest_accrual".into(), debit_gl: "GL-5001-INT-EXP".into(), credit_gl: "GL-2010-INT-PAYABLE".into(), description: "Daily interest accrual".into() },
                GLMapping { event: "interest_payment".into(), debit_gl: "GL-2010-INT-PAYABLE".into(), credit_gl: "GL-2001-SAVINGS".into(), description: "Interest capitalization".into() },
                GLMapping { event: "fee_charge".into(), debit_gl: "GL-2001-SAVINGS".into(), credit_gl: "GL-4001-FEE-INCOME".into(), description: "Fee debit from account".into() },
            ],
            eligibility: vec![
                EligibilityRule { field: "customer_type".into(), operator: "in".into(), value: "individual,sole-proprietor".into() },
                EligibilityRule { field: "kyc_tier".into(), operator: "gte".into(), value: "1".into() },
                EligibilityRule { field: "age".into(), operator: "gte".into(), value: "18".into() },
            ],
            lifecycle_stage: "mature".into(), created_by: "product-team".into(),
            approved_by: "head-of-retail".into(), effective_date: "2025-01-15".into(),
            sunset_date: "".into(),
        },
        Product {
            id: "PROD-FD-001".into(), name: "54Bank Fixed Deposit".into(),
            product_type: "term_deposit".into(), category: "retail".into(),
            status: "active".into(), version: 2, currency: "NGN".into(),
            interest_config: InterestConfig {
                rate_type: "fixed".into(), base_rate: 12.5, spread: 0.0,
                effective_rate: 12.5, accrual_basis: "365-day".into(),
                compounding: "at_maturity".into(),
                tiers: vec![
                    RateTier { min_balance: 100000.0, max_balance: 10000000.0, rate: 12.5 },
                    RateTier { min_balance: 10000000.01, max_balance: 100000000.0, rate: 14.0 },
                    RateTier { min_balance: 100000000.01, max_balance: f64::MAX, rate: 15.5 },
                ],
            },
            fee_config: vec![
                FeeRule { name: "Early Termination".into(), fee_type: "percentage".into(), amount: 0.0, percentage: 1.0, frequency: "one-time".into(), gl_code: "GL-FEE-003".into() },
            ],
            gl_mappings: vec![
                GLMapping { event: "placement".into(), debit_gl: "GL-2001-SAVINGS".into(), credit_gl: "GL-2050-TERM-DEP".into(), description: "FD placement from savings".into() },
                GLMapping { event: "interest_accrual".into(), debit_gl: "GL-5002-INT-EXP-FD".into(), credit_gl: "GL-2051-FD-INT-PAYABLE".into(), description: "FD interest accrual".into() },
                GLMapping { event: "maturity_payout".into(), debit_gl: "GL-2050-TERM-DEP".into(), credit_gl: "GL-2001-SAVINGS".into(), description: "FD maturity payout".into() },
            ],
            eligibility: vec![
                EligibilityRule { field: "customer_type".into(), operator: "in".into(), value: "individual,corporate,sole-proprietor".into() },
                EligibilityRule { field: "min_deposit".into(), operator: "gte".into(), value: "100000".into() },
            ],
            lifecycle_stage: "mature".into(), created_by: "product-team".into(),
            approved_by: "head-of-treasury".into(), effective_date: "2025-03-01".into(),
            sunset_date: "".into(),
        },
        Product {
            id: "PROD-LN-001".into(), name: "54Bank Personal Loan".into(),
            product_type: "loan".into(), category: "retail".into(),
            status: "active".into(), version: 4, currency: "NGN".into(),
            interest_config: InterestConfig {
                rate_type: "floating".into(), base_rate: 18.5, spread: 2.5,
                effective_rate: 21.0, accrual_basis: "365-day".into(),
                compounding: "monthly".into(),
                tiers: vec![
                    RateTier { min_balance: 50000.0, max_balance: 5000000.0, rate: 21.0 },
                    RateTier { min_balance: 5000000.01, max_balance: 50000000.0, rate: 19.5 },
                ],
            },
            fee_config: vec![
                FeeRule { name: "Processing Fee".into(), fee_type: "percentage".into(), amount: 0.0, percentage: 1.5, frequency: "one-time".into(), gl_code: "GL-FEE-010".into() },
                FeeRule { name: "Insurance".into(), fee_type: "percentage".into(), amount: 0.0, percentage: 0.5, frequency: "one-time".into(), gl_code: "GL-FEE-011".into() },
                FeeRule { name: "Late Payment".into(), fee_type: "percentage".into(), amount: 0.0, percentage: 2.0, frequency: "per-occurrence".into(), gl_code: "GL-FEE-012".into() },
            ],
            gl_mappings: vec![
                GLMapping { event: "disbursement".into(), debit_gl: "GL-1200-LOAN-ASSET".into(), credit_gl: "GL-2001-SAVINGS".into(), description: "Loan disbursement to customer".into() },
                GLMapping { event: "interest_accrual".into(), debit_gl: "GL-1210-INT-RECEIVABLE".into(), credit_gl: "GL-4010-INT-INCOME".into(), description: "Loan interest accrual".into() },
                GLMapping { event: "repayment".into(), debit_gl: "GL-2001-SAVINGS".into(), credit_gl: "GL-1200-LOAN-ASSET".into(), description: "Loan principal repayment".into() },
                GLMapping { event: "provisioning".into(), debit_gl: "GL-5100-PROVISION-EXP".into(), credit_gl: "GL-1220-LOAN-PROVISION".into(), description: "Loan loss provisioning".into() },
            ],
            eligibility: vec![
                EligibilityRule { field: "customer_type".into(), operator: "eq".into(), value: "individual".into() },
                EligibilityRule { field: "employment_status".into(), operator: "in".into(), value: "employed,self-employed".into() },
                EligibilityRule { field: "min_salary".into(), operator: "gte".into(), value: "50000".into() },
                EligibilityRule { field: "credit_score".into(), operator: "gte".into(), value: "600".into() },
            ],
            lifecycle_stage: "mature".into(), created_by: "credit-team".into(),
            approved_by: "chief-risk-officer".into(), effective_date: "2025-02-01".into(),
            sunset_date: "".into(),
        },
        Product {
            id: "PROD-CA-001".into(), name: "54Bank Business Current Account".into(),
            product_type: "current_account".into(), category: "corporate".into(),
            status: "active".into(), version: 2, currency: "NGN".into(),
            interest_config: InterestConfig {
                rate_type: "fixed".into(), base_rate: 0.0, spread: 0.0,
                effective_rate: 0.0, accrual_basis: "365-day".into(),
                compounding: "none".into(), tiers: vec![],
            },
            fee_config: vec![
                FeeRule { name: "Account Maintenance".into(), fee_type: "flat".into(), amount: 500.0, percentage: 0.0, frequency: "monthly".into(), gl_code: "GL-FEE-020".into() },
                FeeRule { name: "COT".into(), fee_type: "percentage".into(), amount: 0.0, percentage: 0.5, frequency: "per-transaction".into(), gl_code: "GL-FEE-021".into() },
                FeeRule { name: "Cheque Book".into(), fee_type: "flat".into(), amount: 2500.0, percentage: 0.0, frequency: "per-request".into(), gl_code: "GL-FEE-022".into() },
            ],
            gl_mappings: vec![
                GLMapping { event: "deposit".into(), debit_gl: "GL-1001-CASH".into(), credit_gl: "GL-2100-CURRENT".into(), description: "Current account deposit".into() },
                GLMapping { event: "withdrawal".into(), debit_gl: "GL-2100-CURRENT".into(), credit_gl: "GL-1001-CASH".into(), description: "Current account withdrawal".into() },
                GLMapping { event: "cot_charge".into(), debit_gl: "GL-2100-CURRENT".into(), credit_gl: "GL-4020-COT-INCOME".into(), description: "COT charge on turnover".into() },
            ],
            eligibility: vec![
                EligibilityRule { field: "customer_type".into(), operator: "in".into(), value: "corporate,sme,ngo".into() },
                EligibilityRule { field: "registration_doc".into(), operator: "eq".into(), value: "CAC_CERTIFICATE".into() },
            ],
            lifecycle_stage: "mature".into(), created_by: "product-team".into(),
            approved_by: "head-of-corporate".into(), effective_date: "2025-01-01".into(),
            sunset_date: "".into(),
        },
        Product {
            id: "PROD-DOM-001".into(), name: "54Bank Domiciliary Account (USD)".into(),
            product_type: "domiciliary".into(), category: "retail".into(),
            status: "active".into(), version: 1, currency: "USD".into(),
            interest_config: InterestConfig {
                rate_type: "fixed".into(), base_rate: 0.5, spread: 0.0,
                effective_rate: 0.5, accrual_basis: "360-day".into(),
                compounding: "quarterly".into(), tiers: vec![],
            },
            fee_config: vec![
                FeeRule { name: "Monthly Maintenance".into(), fee_type: "flat".into(), amount: 5.0, percentage: 0.0, frequency: "monthly".into(), gl_code: "GL-FEE-030".into() },
            ],
            gl_mappings: vec![
                GLMapping { event: "deposit".into(), debit_gl: "GL-1002-CASH-USD".into(), credit_gl: "GL-2200-DOM-USD".into(), description: "USD deposit".into() },
                GLMapping { event: "revaluation".into(), debit_gl: "GL-2200-DOM-USD".into(), credit_gl: "GL-5200-REVAL-PNL".into(), description: "FX revaluation".into() },
            ],
            eligibility: vec![
                EligibilityRule { field: "kyc_tier".into(), operator: "gte".into(), value: "2".into() },
            ],
            lifecycle_stage: "growth".into(), created_by: "product-team".into(),
            approved_by: "head-of-treasury".into(), effective_date: "2025-06-01".into(),
            sunset_date: "".into(),
        },
        Product {
            id: "PROD-MUR-001".into(), name: "54Bank Murabaha Financing".into(),
            product_type: "islamic_financing".into(), category: "islamic".into(),
            status: "active".into(), version: 1, currency: "NGN".into(),
            interest_config: InterestConfig {
                rate_type: "murabaha_profit".into(), base_rate: 0.0, spread: 0.0,
                effective_rate: 15.0, accrual_basis: "360-day".into(),
                compounding: "none".into(), tiers: vec![],
            },
            fee_config: vec![
                FeeRule { name: "Documentation Fee".into(), fee_type: "flat".into(), amount: 25000.0, percentage: 0.0, frequency: "one-time".into(), gl_code: "GL-FEE-040".into() },
            ],
            gl_mappings: vec![
                GLMapping { event: "asset_purchase".into(), debit_gl: "GL-1300-ISLAMIC-ASSET".into(), credit_gl: "GL-1001-CASH".into(), description: "Murabaha asset purchase".into() },
                GLMapping { event: "profit_accrual".into(), debit_gl: "GL-1310-PROFIT-RECEIVABLE".into(), credit_gl: "GL-4100-ISLAMIC-INCOME".into(), description: "Murabaha profit accrual".into() },
            ],
            eligibility: vec![
                EligibilityRule { field: "product_preference".into(), operator: "eq".into(), value: "islamic".into() },
            ],
            lifecycle_stage: "growth".into(), created_by: "islamic-banking-team".into(),
            approved_by: "sharia-board".into(), effective_date: "2025-04-01".into(),
            sunset_date: "".into(),
        },
    ]
}

fn product_to_json(p: &Product) -> serde_json::Value {
    let tiers: Vec<serde_json::Value> = p.interest_config.tiers.iter().map(|t| {
        serde_json::json!({"minBalance": t.min_balance, "maxBalance": t.max_balance, "rate": t.rate})
    }).collect();
    let fees: Vec<serde_json::Value> = p.fee_config.iter().map(|f| {
        serde_json::json!({"name": f.name, "type": f.fee_type, "amount": f.amount, "percentage": f.percentage, "frequency": f.frequency, "glCode": f.gl_code})
    }).collect();
    let gl: Vec<serde_json::Value> = p.gl_mappings.iter().map(|g| {
        serde_json::json!({"event": g.event, "debitGL": g.debit_gl, "creditGL": g.credit_gl, "description": g.description})
    }).collect();
    let elig: Vec<serde_json::Value> = p.eligibility.iter().map(|e| {
        serde_json::json!({"field": e.field, "operator": e.operator, "value": e.value})
    }).collect();

    serde_json::json!({
        "id": p.id, "name": p.name, "productType": p.product_type, "category": p.category,
        "status": p.status, "version": p.version, "currency": p.currency,
        "interestConfig": {
            "rateType": p.interest_config.rate_type, "baseRate": p.interest_config.base_rate,
            "spread": p.interest_config.spread, "effectiveRate": p.interest_config.effective_rate,
            "accrualBasis": p.interest_config.accrual_basis, "compounding": p.interest_config.compounding,
            "tiers": tiers
        },
        "feeConfig": fees, "glMappings": gl, "eligibility": elig,
        "lifecycleStage": p.lifecycle_stage, "createdBy": p.created_by,
        "approvedBy": p.approved_by, "effectiveDate": p.effective_date, "sunsetDate": p.sunset_date
    })
}

fn handle_request(request: &str, products: &Arc<RwLock<Vec<Product>>>) -> (u16, String) {
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 { return (400, r#"{"error":"Bad request"}"#.to_string()); }
    let path = parts[1];

    let prods = products.read().unwrap();

    if path == "/healthz" {
        let mw = middleware_config();
        return (200, serde_json::json!({
            "status": "healthy", "service": "product-factory",
            "catalog": {"products": prods.len(), "active": prods.iter().filter(|p| p.status == "active").count()},
            "middleware": mw
        }).to_string());
    }

    if path == "/v1/products" {
        let items: Vec<serde_json::Value> = prods.iter().map(|p| product_to_json(p)).collect();
        return (200, serde_json::json!({"items": items, "total": items.len()}).to_string());
    }

    if path == "/v1/stats" {
        let total = prods.len();
        let active = prods.iter().filter(|p| p.status == "active").count();
        let by_type: HashMap<String, usize> = {
            let mut m = HashMap::new();
            for p in prods.iter() { *m.entry(p.product_type.clone()).or_insert(0) += 1; }
            m
        };
        let by_category: HashMap<String, usize> = {
            let mut m = HashMap::new();
            for p in prods.iter() { *m.entry(p.category.clone()).or_insert(0) += 1; }
            m
        };
        let total_gl_mappings: usize = prods.iter().map(|p| p.gl_mappings.len()).sum();
        let total_fee_rules: usize = prods.iter().map(|p| p.fee_config.len()).sum();
        let total_eligibility_rules: usize = prods.iter().map(|p| p.eligibility.len()).sum();

        return (200, serde_json::json!({
            "totalProducts": total, "activeProducts": active,
            "byType": by_type, "byCategory": by_category,
            "totalGLMappings": total_gl_mappings,
            "totalFeeRules": total_fee_rules,
            "totalEligibilityRules": total_eligibility_rules,
        }).to_string());
    }

    if path.starts_with("/v1/products/") {
        let id = &path[13..];
        for p in prods.iter() {
            if p.id == id {
                return (200, product_to_json(p).to_string());
            }
        }
        return (404, r#"{"error":"Product not found"}"#.to_string());
    }

    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8208");
    let products = Arc::new(RwLock::new(seed_products()));

    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    let prods = products.read().unwrap();
    let active = prods.iter().filter(|p| p.status == "active").count();
    eprintln!("[product-factory] Listening on :{} with {} products ({} active), {} GL mappings",
        port, prods.len(), active, prods.iter().map(|p| p.gl_mappings.len()).sum::<usize>());
    drop(prods);

    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let products = Arc::clone(&products);
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();
                let (status, body) = handle_request(&request, &products);
                let status_text = match status { 200 => "OK", 201 => "Created", 404 => "Not Found", _ => "Error" };
                let response = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nX-Service: product-factory\r\n\r\n{}",
                    status, status_text, body.len(), body
                );
                let _ = stream.write_all(response.as_bytes());
            });
        }
    }
}
