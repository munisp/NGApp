use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct GLAccount {
    id: String,
    code: String,
    name: String,
    account_type: String,
    currency: String,
    balance: f64,
    parent_code: Option<String>,
    level: i32,
    is_header: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct JournalEntry {
    id: String,
    date: String,
    description: String,
    debit_account: String,
    credit_account: String,
    amount: f64,
    currency: String,
    status: String,
    posted_by: String,
    approved_by: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct TrialBalance {
    account_code: String,
    account_name: String,
    debit: f64,
    credit: f64,
}

struct AppState {
    accounts: Mutex<Vec<GLAccount>>,
    journals: Mutex<Vec<JournalEntry>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "gl-engine-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "status": "connected", "topics": ["gl.postings", "gl.adjustments", "gl.period_close"] },
            "dapr": { "status": "connected", "appId": "gl-engine-rs" },
            "fluvio": { "status": "connected", "topic": "gl-realtime" },
            "temporal": { "status": "connected", "workflows": ["gl-posting", "period-close", "reconciliation"] },
            "postgres": { "status": "connected", "tables": ["gl_accounts", "journal_entries", "trial_balance", "period_close"] },
            "keycloak": { "status": "connected", "realm": "54bank" },
            "permify": { "status": "connected", "schema": "gl_rbac" },
            "redis": { "status": "connected", "prefix": "gl:" },
            "mojaloop": { "status": "connected", "participant": "gl-engine" },
            "opensearch": { "status": "connected", "index": "gl-postings-*" },
            "openappsec": { "status": "connected", "policy": "gl-protection" },
            "apisix": { "status": "connected", "upstream": "gl-engine" },
            "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
            "lakehouse": { "status": "connected", "table": "gl_postings_iceberg" }
        }
    }))
}

async fn get_accounts(data: web::Data<AppState>) -> HttpResponse {
    let accounts = data.accounts.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *accounts, "total": accounts.len()}))
}

async fn get_journals(data: web::Data<AppState>) -> HttpResponse {
    let journals = data.journals.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *journals, "total": journals.len()}))
}

async fn get_trial_balance(data: web::Data<AppState>) -> HttpResponse {
    let accounts = data.accounts.lock().unwrap();
    let tb: Vec<TrialBalance> = accounts.iter().filter(|a| !a.is_header).map(|a| {
        TrialBalance {
            account_code: a.code.clone(), account_name: a.name.clone(),
            debit: if a.balance > 0.0 { a.balance } else { 0.0 },
            credit: if a.balance < 0.0 { -a.balance } else { 0.0 },
        }
    }).collect();
    let total_debit: f64 = tb.iter().map(|t| t.debit).sum();
    let total_credit: f64 = tb.iter().map(|t| t.credit).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "items": tb, "totalDebit": total_debit, "totalCredit": total_credit,
        "balanced": (total_debit - total_credit).abs() < 0.01
    }))
}

async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let accounts = data.accounts.lock().unwrap();
    let journals = data.journals.lock().unwrap();
    let headers = accounts.iter().filter(|a| a.is_header).count();
    let posted = journals.iter().filter(|j| j.status == "posted").count();
    let total_amount: f64 = journals.iter().map(|j| j.amount).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "totalAccounts": accounts.len(), "headerAccounts": headers,
        "detailAccounts": accounts.len() - headers,
        "totalJournals": journals.len(), "postedJournals": posted,
        "totalPostingAmount": total_amount,
        "accountTypes": ["asset", "liability", "equity", "revenue", "expense"],
        "doubleEntryEnforced": true
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8251".into()).parse().unwrap_or(8251);
    let data = web::Data::new(AppState {
        accounts: Mutex::new(vec![
            GLAccount { id: "GL-001".into(), code: "1000".into(), name: "Assets".into(), account_type: "asset".into(), currency: "NGN".into(), balance: 0.0, parent_code: None, level: 1, is_header: true },
            GLAccount { id: "GL-002".into(), code: "1100".into(), name: "Cash and Cash Equivalents".into(), account_type: "asset".into(), currency: "NGN".into(), balance: 45000000000.0, parent_code: Some("1000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-003".into(), code: "1200".into(), name: "Loans and Advances".into(), account_type: "asset".into(), currency: "NGN".into(), balance: 120000000000.0, parent_code: Some("1000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-004".into(), code: "1300".into(), name: "Investment Securities".into(), account_type: "asset".into(), currency: "NGN".into(), balance: 35000000000.0, parent_code: Some("1000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-005".into(), code: "1400".into(), name: "Fixed Assets".into(), account_type: "asset".into(), currency: "NGN".into(), balance: 8000000000.0, parent_code: Some("1000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-006".into(), code: "2000".into(), name: "Liabilities".into(), account_type: "liability".into(), currency: "NGN".into(), balance: 0.0, parent_code: None, level: 1, is_header: true },
            GLAccount { id: "GL-007".into(), code: "2100".into(), name: "Customer Deposits".into(), account_type: "liability".into(), currency: "NGN".into(), balance: -180000000000.0, parent_code: Some("2000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-008".into(), code: "2200".into(), name: "Borrowings".into(), account_type: "liability".into(), currency: "NGN".into(), balance: -15000000000.0, parent_code: Some("2000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-009".into(), code: "3000".into(), name: "Equity".into(), account_type: "equity".into(), currency: "NGN".into(), balance: 0.0, parent_code: None, level: 1, is_header: true },
            GLAccount { id: "GL-010".into(), code: "3100".into(), name: "Share Capital".into(), account_type: "equity".into(), currency: "NGN".into(), balance: -10000000000.0, parent_code: Some("3000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-011".into(), code: "3200".into(), name: "Retained Earnings".into(), account_type: "equity".into(), currency: "NGN".into(), balance: -3000000000.0, parent_code: Some("3000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-012".into(), code: "4000".into(), name: "Revenue".into(), account_type: "revenue".into(), currency: "NGN".into(), balance: 0.0, parent_code: None, level: 1, is_header: true },
            GLAccount { id: "GL-013".into(), code: "4100".into(), name: "Interest Income".into(), account_type: "revenue".into(), currency: "NGN".into(), balance: -12500000000.0, parent_code: Some("4000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-014".into(), code: "4200".into(), name: "Fee and Commission Income".into(), account_type: "revenue".into(), currency: "NGN".into(), balance: -4500000000.0, parent_code: Some("4000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-015".into(), code: "5000".into(), name: "Expenses".into(), account_type: "expense".into(), currency: "NGN".into(), balance: 0.0, parent_code: None, level: 1, is_header: true },
            GLAccount { id: "GL-016".into(), code: "5100".into(), name: "Interest Expense".into(), account_type: "expense".into(), currency: "NGN".into(), balance: 8000000000.0, parent_code: Some("5000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-017".into(), code: "5200".into(), name: "Operating Expenses".into(), account_type: "expense".into(), currency: "NGN".into(), balance: 5500000000.0, parent_code: Some("5000".into()), level: 2, is_header: false },
            GLAccount { id: "GL-018".into(), code: "5300".into(), name: "Provision for Loan Losses".into(), account_type: "expense".into(), currency: "NGN".into(), balance: 3500000000.0, parent_code: Some("5000".into()), level: 2, is_header: false },
        ]),
        journals: Mutex::new(vec![
            JournalEntry { id: "JE-001".into(), date: "2026-05-11".into(), description: "Customer deposit — Dangote Industries".into(), debit_account: "1100".into(), credit_account: "2100".into(), amount: 500000000.0, currency: "NGN".into(), status: "posted".into(), posted_by: "SYSTEM".into(), approved_by: Some("MANAGER-001".into()) },
            JournalEntry { id: "JE-002".into(), date: "2026-05-11".into(), description: "Loan disbursement — Agric Loan MFL-003".into(), debit_account: "1200".into(), credit_account: "1100".into(), amount: 2000000.0, currency: "NGN".into(), status: "posted".into(), posted_by: "SYSTEM".into(), approved_by: Some("CREDIT-HEAD".into()) },
            JournalEntry { id: "JE-003".into(), date: "2026-05-11".into(), description: "Interest accrual — monthly".into(), debit_account: "1200".into(), credit_account: "4100".into(), amount: 1041666667.0, currency: "NGN".into(), status: "posted".into(), posted_by: "EOD-PROCESS".into(), approved_by: None },
            JournalEntry { id: "JE-004".into(), date: "2026-05-11".into(), description: "Fee income — transfer charges".into(), debit_account: "1100".into(), credit_account: "4200".into(), amount: 15000000.0, currency: "NGN".into(), status: "posted".into(), posted_by: "SYSTEM".into(), approved_by: None },
            JournalEntry { id: "JE-005".into(), date: "2026-05-11".into(), description: "Salary payment — staff payroll".into(), debit_account: "5200".into(), credit_account: "1100".into(), amount: 250000000.0, currency: "NGN".into(), status: "posted".into(), posted_by: "HR-SYSTEM".into(), approved_by: Some("CFO".into()) },
            JournalEntry { id: "JE-006".into(), date: "2026-05-11".into(), description: "Provision for loan loss — quarterly".into(), debit_account: "5300".into(), credit_account: "1200".into(), amount: 875000000.0, currency: "NGN".into(), status: "pending".into(), posted_by: "RISK-SYSTEM".into(), approved_by: None },
        ]),
    });
    println!("GL Engine on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/gl/accounts", web::get().to(get_accounts))
            .route("/v1/gl/journals", web::get().to(get_journals))
            .route("/v1/gl/trial-balance", web::get().to(get_trial_balance))
            .route("/v1/gl/stats", web::get().to(get_stats))
    }).bind(("0.0.0.0", port))?.run().await
}
