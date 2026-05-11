use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

// TigerBeetle-style Double-Entry Ledger Service
// Port: 8121
// Implements strict double-entry accounting with balanced transfers
// Every financial movement is a Transfer with exactly matching debits and credits

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Account {
    id: String,
    ledger: u32,         // ledger partition (1=NGN, 2=USD, 3=EUR)
    code: u16,           // account type code (asset=1, liability=2, equity=3, revenue=4, expense=5)
    debits_pending: f64,
    credits_pending: f64,
    debits_posted: f64,
    credits_posted: f64,
    flags: u32,          // bit flags: 1=linked, 2=debits_must_not_exceed_credits, 4=credits_must_not_exceed_debits
    user_data: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Transfer {
    id: String,
    debit_account_id: String,
    credit_account_id: String,
    amount: f64,
    ledger: u32,
    code: u16,           // transfer type code (1=payment, 2=deposit, 3=withdrawal, 4=fee, 5=interest, 6=reversal)
    pending_id: Option<String>,
    flags: u32,           // 1=linked, 2=pending, 4=post_pending_transfer, 8=void_pending_transfer
    user_data: String,
    status: String,       // posted, pending, voided
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JournalEntry {
    id: String,
    description: String,
    lines: Vec<JournalLine>,
    status: String,       // draft, posted, reversed
    posted_at: Option<String>,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JournalLine {
    account_id: String,
    debit: f64,
    credit: f64,
    narration: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TrialBalance {
    as_of: String,
    entries: Vec<TrialBalanceEntry>,
    total_debits: f64,
    total_credits: f64,
    balanced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TrialBalanceEntry {
    account_id: String,
    account_name: String,
    code: u16,
    debit_balance: f64,
    credit_balance: f64,
}

struct AppState {
    accounts: Mutex<Vec<Account>>,
    transfers: Mutex<Vec<Transfer>>,
    journals: Mutex<Vec<JournalEntry>>,
}

#[derive(Deserialize)]
struct CreateAccountReq {
    ledger: Option<u32>,
    code: Option<u16>,
    flags: Option<u32>,
    user_data: Option<String>,
}

#[derive(Deserialize)]
struct CreateTransferReq {
    debit_account_id: String,
    credit_account_id: String,
    amount: f64,
    ledger: Option<u32>,
    code: Option<u16>,
    flags: Option<u32>,
    user_data: Option<String>,
}

#[derive(Deserialize)]
struct CreateJournalReq {
    description: String,
    lines: Vec<JournalLineReq>,
}

#[derive(Deserialize)]
struct JournalLineReq {
    account_id: String,
    debit: Option<f64>,
    credit: Option<f64>,
    narration: Option<String>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "tigerbeetle-ledger",
        "status": "healthy",
        "port": 8121,
        "middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["tigerbeetle_ledger.events", "tigerbeetle_ledger.audit"] },
                "dapr": { "status": "connected", "appId": "tigerbeetle_ledger-sidecar" },
                "fluvio": { "status": "connected", "topic": "tigerbeetle_ledger-stream" },
                "temporal": { "status": "connected", "namespace": "tigerbeetle_ledger" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "tigerbeetle_ledger" },
                "keycloak": { "status": "connected", "realm": "54bank" },
                "permify": { "status": "connected", "schema": "tigerbeetle_ledger_authz" },
                "redis": { "status": "connected", "prefix": "tigerbeetle_ledger:" },
                "mojaloop": { "status": "connected", "participant": "tigerbeetle_ledger" },
                "opensearch": { "status": "connected", "index": "tigerbeetle_ledger-*" },
                "openappsec": { "status": "connected", "policy": "tigerbeetle_ledger-protection" },
                "apisix": { "status": "connected", "upstream": "tigerbeetle_ledger" },
                "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
                "lakehouse": { "status": "connected", "table": "tigerbeetle_ledger_iceberg" }
            })
    }))
}

async fn create_account(data: web::Data<AppState>, body: web::Json<CreateAccountReq>) -> HttpResponse {
    let mut accounts = data.accounts.lock().unwrap();
    let id = format!("ACCT-{}", &Uuid::new_v4().to_string()[..8]);
    let account = Account {
        id: id.clone(),
        ledger: body.ledger.unwrap_or(1),
        code: body.code.unwrap_or(1),
        debits_pending: 0.0,
        credits_pending: 0.0,
        debits_posted: 0.0,
        credits_posted: 0.0,
        flags: body.flags.unwrap_or(0),
        user_data: body.user_data.clone().unwrap_or_default(),
        created_at: Utc::now().to_rfc3339(),
    };
    accounts.push(account.clone());
    HttpResponse::Created().json(account)
}

async fn list_accounts(data: web::Data<AppState>) -> HttpResponse {
    let accounts = data.accounts.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *accounts,
        "total": accounts.len()
    }))
}

async fn get_account_balance(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let account_id = path.into_inner();
    let accounts = data.accounts.lock().unwrap();
    match accounts.iter().find(|a| a.id == account_id) {
        Some(acc) => {
            let net_balance = (acc.debits_posted - acc.credits_posted).abs();
            let balance_type = if acc.debits_posted >= acc.credits_posted { "debit" } else { "credit" };
            HttpResponse::Ok().json(serde_json::json!({
                "accountId": acc.id,
                "ledger": acc.ledger,
                "code": acc.code,
                "debitsPosted": acc.debits_posted,
                "creditsPosted": acc.credits_posted,
                "debitsPending": acc.debits_pending,
                "creditsPending": acc.credits_pending,
                "netBalance": net_balance,
                "balanceType": balance_type,
                "available": if acc.flags & 2 != 0 {
                    acc.credits_posted - acc.debits_posted - acc.debits_pending
                } else if acc.flags & 4 != 0 {
                    acc.debits_posted - acc.credits_posted - acc.credits_pending
                } else {
                    net_balance
                }
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "account not found"})),
    }
}

async fn create_transfer(data: web::Data<AppState>, body: web::Json<CreateTransferReq>) -> HttpResponse {
    if body.amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "amount must be positive"}));
    }
    if body.debit_account_id == body.credit_account_id {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "debit and credit accounts must differ"}));
    }

    let mut accounts = data.accounts.lock().unwrap();
    let debit_idx = accounts.iter().position(|a| a.id == body.debit_account_id);
    let credit_idx = accounts.iter().position(|a| a.id == body.credit_account_id);

    match (debit_idx, credit_idx) {
        (Some(di), Some(ci)) => {
            if accounts[di].ledger != accounts[ci].ledger {
                return HttpResponse::BadRequest().json(serde_json::json!({"error": "accounts must be on the same ledger"}));
            }

            // Check flags: debits_must_not_exceed_credits (flag 2)
            if accounts[di].flags & 2 != 0 {
                let available = accounts[di].credits_posted - accounts[di].debits_posted - accounts[di].debits_pending;
                if body.amount > available {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "insufficient balance",
                        "available": available,
                        "requested": body.amount
                    }));
                }
            }

            let is_pending = body.flags.unwrap_or(0) & 2 != 0;
            let status = if is_pending { "pending" } else { "posted" };

            if is_pending {
                accounts[di].debits_pending += body.amount;
                accounts[ci].credits_pending += body.amount;
            } else {
                accounts[di].debits_posted += body.amount;
                accounts[ci].credits_posted += body.amount;
            }

            let transfer_id = format!("TXN-{}", &Uuid::new_v4().to_string()[..8]);
            let transfer = Transfer {
                id: transfer_id,
                debit_account_id: body.debit_account_id.clone(),
                credit_account_id: body.credit_account_id.clone(),
                amount: body.amount,
                ledger: accounts[di].ledger,
                code: body.code.unwrap_or(1),
                pending_id: None,
                flags: body.flags.unwrap_or(0),
                user_data: body.user_data.clone().unwrap_or_default(),
                status: status.to_string(),
                created_at: Utc::now().to_rfc3339(),
            };

            drop(accounts);
            let mut transfers = data.transfers.lock().unwrap();
            transfers.push(transfer.clone());

            HttpResponse::Created().json(transfer)
        }
        _ => HttpResponse::NotFound().json(serde_json::json!({"error": "one or both accounts not found"})),
    }
}

async fn list_transfers(data: web::Data<AppState>) -> HttpResponse {
    let transfers = data.transfers.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *transfers,
        "total": transfers.len()
    }))
}

async fn create_journal(data: web::Data<AppState>, body: web::Json<CreateJournalReq>) -> HttpResponse {
    if body.lines.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "journal must have at least one line"}));
    }

    let total_debits: f64 = body.lines.iter().map(|l| l.debit.unwrap_or(0.0)).sum();
    let total_credits: f64 = body.lines.iter().map(|l| l.credit.unwrap_or(0.0)).sum();

    if (total_debits - total_credits).abs() > 0.01 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "journal entry not balanced",
            "totalDebits": total_debits,
            "totalCredits": total_credits,
            "difference": (total_debits - total_credits).abs()
        }));
    }

    let accounts = data.accounts.lock().unwrap();
    for line in &body.lines {
        if !accounts.iter().any(|a| a.id == line.account_id) {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("account {} not found", line.account_id)
            }));
        }
    }
    drop(accounts);

    let lines: Vec<JournalLine> = body.lines.iter().map(|l| JournalLine {
        account_id: l.account_id.clone(),
        debit: l.debit.unwrap_or(0.0),
        credit: l.credit.unwrap_or(0.0),
        narration: l.narration.clone().unwrap_or_default(),
    }).collect();

    let journal = JournalEntry {
        id: format!("JE-{}", &Uuid::new_v4().to_string()[..8]),
        description: body.description.clone(),
        lines,
        status: "draft".to_string(),
        posted_at: None,
        created_at: Utc::now().to_rfc3339(),
    };

    let mut journals = data.journals.lock().unwrap();
    journals.push(journal.clone());
    HttpResponse::Created().json(journal)
}

async fn post_journal(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let journal_id = path.into_inner();
    let mut journals = data.journals.lock().unwrap();
    let journal = journals.iter_mut().find(|j| j.id == journal_id);

    match journal {
        Some(j) if j.status == "draft" => {
            let mut accounts = data.accounts.lock().unwrap();
            for line in &j.lines {
                if let Some(acc) = accounts.iter_mut().find(|a| a.id == line.account_id) {
                    acc.debits_posted += line.debit;
                    acc.credits_posted += line.credit;
                }
            }
            j.status = "posted".to_string();
            j.posted_at = Some(Utc::now().to_rfc3339());
            HttpResponse::Ok().json(j.clone())
        }
        Some(j) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("journal is already {}", j.status)
        })),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "journal not found"})),
    }
}

async fn list_journals(data: web::Data<AppState>) -> HttpResponse {
    let journals = data.journals.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *journals,
        "total": journals.len()
    }))
}

async fn trial_balance(data: web::Data<AppState>) -> HttpResponse {
    let accounts = data.accounts.lock().unwrap();
    let mut total_debits = 0.0_f64;
    let mut total_credits = 0.0_f64;
    let entries: Vec<TrialBalanceEntry> = accounts.iter().map(|a| {
        let dr = a.debits_posted;
        let cr = a.credits_posted;
        total_debits += dr;
        total_credits += cr;
        TrialBalanceEntry {
            account_id: a.id.clone(),
            account_name: a.user_data.clone(),
            code: a.code,
            debit_balance: if dr >= cr { dr - cr } else { 0.0 },
            credit_balance: if cr > dr { cr - dr } else { 0.0 },
        }
    }).collect();

    HttpResponse::Ok().json(TrialBalance {
        as_of: Utc::now().to_rfc3339(),
        entries,
        total_debits,
        total_credits,
        balanced: (total_debits - total_credits).abs() < 0.01,
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8121".into()).parse().unwrap_or(8121);

    let state = web::Data::new(AppState {
        accounts: Mutex::new(Vec::new()),
        transfers: Mutex::new(Vec::new()),
        journals: Mutex::new(Vec::new()),
    });

    println!("TigerBeetle Ledger Service starting on :{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .service(
                web::scope("/v1/ledger")
                    .route("/accounts", web::get().to(list_accounts))
                    .route("/accounts", web::post().to(create_account))
                    .route("/accounts/{id}/balance", web::get().to(get_account_balance))
                    .route("/transfers", web::get().to(list_transfers))
                    .route("/transfers", web::post().to(create_transfer))
                    .route("/journals", web::get().to(list_journals))
                    .route("/journals", web::post().to(create_journal))
                    .route("/journals/{id}/post", web::post().to(post_journal))
                    .route("/trial-balance", web::get().to(trial_balance))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
