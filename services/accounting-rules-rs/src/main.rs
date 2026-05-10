use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, RwLock};

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "accounting.entry-posted,accounting.reversal,accounting.gl-balanced"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "gl-balance-cache,rule-cache"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "accounting_rules,gl_entries,gl_balances,accounting_events"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "accounting-entries"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "gl-officer"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "gl:post,gl:reverse,gl:approve"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "accounting-events"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "gl-entries-stream"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "AccountingPostingWorkflow"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "settlement-accounting"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "double-entry-ledger-backend"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "gl_history,daily_balances"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/accounting/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "gl-posting-protection"}
    })
}

fn seed_data() -> (Vec<serde_json::Value>, Vec<serde_json::Value>, serde_json::Value) {
    let rules = vec![
        serde_json::json!({"id": "RULE-001", "event": "savings_deposit", "product": "PROD-SAV-*", "debitGL": "GL-1001-CASH", "creditGL": "GL-2001-SAVINGS", "description": "Cash deposit to savings", "reversible": true, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-002", "event": "savings_withdrawal", "product": "PROD-SAV-*", "debitGL": "GL-2001-SAVINGS", "creditGL": "GL-1001-CASH", "description": "Savings withdrawal", "reversible": true, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-003", "event": "interest_accrual_savings", "product": "PROD-SAV-*", "debitGL": "GL-5001-INT-EXPENSE", "creditGL": "GL-2010-INT-PAYABLE", "description": "Daily savings interest accrual", "reversible": false, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-004", "event": "interest_payment_savings", "product": "PROD-SAV-*", "debitGL": "GL-2010-INT-PAYABLE", "creditGL": "GL-2001-SAVINGS", "description": "Monthly interest capitalization", "reversible": true, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-005", "event": "loan_disbursement", "product": "PROD-LN-*", "debitGL": "GL-1200-LOAN-ASSET", "creditGL": "GL-2001-SAVINGS", "description": "Loan disbursement", "reversible": false, "requiresApproval": true}),
        serde_json::json!({"id": "RULE-006", "event": "loan_repayment_principal", "product": "PROD-LN-*", "debitGL": "GL-2001-SAVINGS", "creditGL": "GL-1200-LOAN-ASSET", "description": "Loan principal repayment", "reversible": true, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-007", "event": "loan_interest_accrual", "product": "PROD-LN-*", "debitGL": "GL-1210-INT-RECEIVABLE", "creditGL": "GL-4010-INT-INCOME", "description": "Loan interest accrual", "reversible": false, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-008", "event": "fee_charge", "product": "*", "debitGL": "GL-CUSTOMER-ACCOUNT", "creditGL": "GL-4001-FEE-INCOME", "description": "Fee debit from customer", "reversible": true, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-009", "event": "fx_revaluation_gain", "product": "PROD-DOM-*", "debitGL": "GL-2200-DOM-FCY", "creditGL": "GL-4200-REVAL-GAIN", "description": "FX revaluation gain", "reversible": false, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-010", "event": "fx_revaluation_loss", "product": "PROD-DOM-*", "debitGL": "GL-5200-REVAL-LOSS", "creditGL": "GL-2200-DOM-FCY", "description": "FX revaluation loss", "reversible": false, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-011", "event": "provision_charge", "product": "PROD-LN-*", "debitGL": "GL-5100-PROVISION-EXP", "creditGL": "GL-1220-LOAN-PROVISION", "description": "Loan loss provisioning", "reversible": true, "requiresApproval": true}),
        serde_json::json!({"id": "RULE-012", "event": "fd_placement", "product": "PROD-FD-*", "debitGL": "GL-2001-SAVINGS", "creditGL": "GL-2050-TERM-DEP", "description": "Fixed deposit placement", "reversible": false, "requiresApproval": false}),
        serde_json::json!({"id": "RULE-013", "event": "murabaha_asset_purchase", "product": "PROD-MUR-*", "debitGL": "GL-1300-ISLAMIC-ASSET", "creditGL": "GL-1001-CASH", "description": "Murabaha asset purchase", "reversible": false, "requiresApproval": true}),
        serde_json::json!({"id": "RULE-014", "event": "cot_charge", "product": "PROD-CA-*", "debitGL": "GL-2100-CURRENT", "creditGL": "GL-4020-COT-INCOME", "description": "Commission on turnover", "reversible": true, "requiresApproval": false}),
    ];

    let entries = vec![
        serde_json::json!({"id": "ENT-001", "ruleId": "RULE-001", "date": "2026-05-10", "debitGL": "GL-1001-CASH", "creditGL": "GL-2001-SAVINGS", "amount": 500000.0, "currency": "NGN", "accountId": "ACC-001234", "reference": "DEP-20260510-001", "status": "posted", "valueDate": "2026-05-10"}),
        serde_json::json!({"id": "ENT-002", "ruleId": "RULE-003", "date": "2026-05-10", "debitGL": "GL-5001-INT-EXPENSE", "creditGL": "GL-2010-INT-PAYABLE", "amount": 45200000.0, "currency": "NGN", "accountId": "BATCH-EOD", "reference": "INT-ACR-20260510", "status": "posted", "valueDate": "2026-05-10"}),
        serde_json::json!({"id": "ENT-003", "ruleId": "RULE-005", "date": "2026-05-10", "debitGL": "GL-1200-LOAN-ASSET", "creditGL": "GL-2001-SAVINGS", "amount": 15000000.0, "currency": "NGN", "accountId": "LN-005678", "reference": "DSB-20260510-001", "status": "posted", "valueDate": "2026-05-10"}),
        serde_json::json!({"id": "ENT-004", "ruleId": "RULE-009", "date": "2026-05-10", "debitGL": "GL-2200-DOM-FCY", "creditGL": "GL-4200-REVAL-GAIN", "amount": 2340000.50, "currency": "NGN", "accountId": "BATCH-REVAL", "reference": "REVAL-20260510", "status": "posted", "valueDate": "2026-05-10"}),
        serde_json::json!({"id": "ENT-005", "ruleId": "RULE-008", "date": "2026-05-10", "debitGL": "GL-2001-SAVINGS", "creditGL": "GL-4001-FEE-INCOME", "amount": 12500.0, "currency": "NGN", "accountId": "ACC-009876", "reference": "FEE-20260510-001", "status": "posted", "valueDate": "2026-05-10"}),
        serde_json::json!({"id": "ENT-006", "ruleId": "RULE-011", "date": "2026-05-10", "debitGL": "GL-5100-PROVISION-EXP", "creditGL": "GL-1220-LOAN-PROVISION", "amount": 8900000.0, "currency": "NGN", "accountId": "BATCH-PROV", "reference": "PROV-20260510", "status": "posted", "valueDate": "2026-05-10"}),
    ];

    let total_debits: f64 = entries.iter().map(|e| e["amount"].as_f64().unwrap_or(0.0)).sum();
    let balances = serde_json::json!({
        "date": "2026-05-10",
        "totalDebits": total_debits,
        "totalCredits": total_debits,
        "isBalanced": true,
        "glAccounts": [
            {"code": "GL-1001-CASH", "name": "Cash and Cash Equivalents", "type": "asset", "balance": 125000000000.0},
            {"code": "GL-1200-LOAN-ASSET", "name": "Loans and Advances", "type": "asset", "balance": 340000000000.0},
            {"code": "GL-2001-SAVINGS", "name": "Customer Savings Deposits", "type": "liability", "balance": 280000000000.0},
            {"code": "GL-2100-CURRENT", "name": "Current Account Balances", "type": "liability", "balance": 195000000000.0},
            {"code": "GL-4010-INT-INCOME", "name": "Interest Income - Loans", "type": "income", "balance": 48000000000.0},
            {"code": "GL-5001-INT-EXPENSE", "name": "Interest Expense - Deposits", "type": "expense", "balance": 22000000000.0},
        ]
    });

    (rules, entries, balances)
}

fn handle_request(request: &str, data: &Arc<RwLock<(Vec<serde_json::Value>, Vec<serde_json::Value>, serde_json::Value)>>) -> (u16, String) {
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 { return (400, r#"{"error":"Bad request"}"#.to_string()); }
    let path = parts[1];

    let d = data.read().unwrap();

    if path == "/healthz" {
        return (200, serde_json::json!({
            "status": "healthy", "service": "accounting-rules",
            "engine": {"rules": d.0.len(), "entriesPosted": d.1.len(), "glBalanced": d.2["isBalanced"]},
            "middleware": middleware_config()
        }).to_string());
    }

    if path == "/v1/rules" {
        return (200, serde_json::json!({"items": d.0, "total": d.0.len()}).to_string());
    }

    if path == "/v1/entries" {
        return (200, serde_json::json!({"items": d.1, "total": d.1.len()}).to_string());
    }

    if path == "/v1/balances" {
        return (200, d.2.to_string());
    }

    if path == "/v1/stats" {
        let total_posted: f64 = d.1.iter().map(|e| e["amount"].as_f64().unwrap_or(0.0)).sum();
        let requires_approval = d.0.iter().filter(|r| r["requiresApproval"].as_bool().unwrap_or(false)).count();
        return (200, serde_json::json!({
            "totalRules": d.0.len(),
            "totalEntries": d.1.len(),
            "totalAmountPosted": total_posted,
            "rulesRequiringApproval": requires_approval,
            "glBalanced": d.2["isBalanced"],
            "glAccountsTracked": 6,
            "eventTypes": ["deposit", "withdrawal", "interest_accrual", "interest_payment", "loan_disbursement", "loan_repayment", "fee_charge", "fx_revaluation", "provisioning", "fd_placement", "murabaha", "cot_charge"]
        }).to_string());
    }

    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8209");
    let data = Arc::new(RwLock::new(seed_data()));

    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    let d = data.read().unwrap();
    eprintln!("[accounting-rules] Listening on :{} with {} rules, {} posted entries, GL balanced={}",
        port, d.0.len(), d.1.len(), d.2["isBalanced"]);
    drop(d);

    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let data = Arc::clone(&data);
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();
                let (status, body) = handle_request(&request, &data);
                let status_text = match status { 200 => "OK", 404 => "Not Found", _ => "Error" };
                let response = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nX-Service: accounting-rules\r\n\r\n{}",
                    status, status_text, body.len(), body
                );
                let _ = stream.write_all(response.as_bytes());
            });
        }
    }
}
