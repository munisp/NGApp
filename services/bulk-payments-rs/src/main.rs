use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BulkBatch {
    id: String,
    batch_type: String,
    originator: String,
    originator_account: String,
    currency: String,
    total_amount: f64,
    total_items: usize,
    successful_count: usize,
    failed_count: usize,
    pending_count: usize,
    status: String,
    items: Vec<PaymentItem>,
    created_at: String,
    processed_at: Option<String>,
    reconciled_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PaymentItem {
    id: String,
    beneficiary_name: String,
    beneficiary_account: String,
    beneficiary_bank: String,
    amount: f64,
    narration: String,
    status: String,
    failure_reason: Option<String>,
    nibss_ref: Option<String>,
}

struct AppState {
    batches: Mutex<Vec<BulkBatch>>,
}

fn seed_data() -> Vec<BulkBatch> {
    vec![
        BulkBatch {
            id: "BULK-001".into(),
            batch_type: "salary".into(),
            originator: "Tech Solutions Ltd".into(),
            originator_account: "3034567890".into(),
            currency: "NGN".into(),
            total_amount: 15750000.0,
            total_items: 5,
            successful_count: 4,
            failed_count: 1,
            pending_count: 0,
            status: "completed".into(),
            items: vec![
                PaymentItem { id: "PI-001".into(), beneficiary_name: "Fatima Abdullahi".into(), beneficiary_account: "0012345678".into(), beneficiary_bank: "054".into(), amount: 2500000.0, narration: "Salary Jan 2026".into(), status: "successful".into(), failure_reason: None, nibss_ref: Some("NIBSS-BLK-001-01".into()) },
                PaymentItem { id: "PI-002".into(), beneficiary_name: "Ibrahim Musa".into(), beneficiary_account: "0087654321".into(), beneficiary_bank: "054".into(), amount: 3500000.0, narration: "Salary Jan 2026".into(), status: "successful".into(), failure_reason: None, nibss_ref: Some("NIBSS-BLK-001-02".into()) },
                PaymentItem { id: "PI-003".into(), beneficiary_name: "Chioma Okafor".into(), beneficiary_account: "2098765432".into(), beneficiary_bank: "054".into(), amount: 4250000.0, narration: "Salary Jan 2026".into(), status: "successful".into(), failure_reason: None, nibss_ref: Some("NIBSS-BLK-001-03".into()) },
                PaymentItem { id: "PI-004".into(), beneficiary_name: "Emeka Okonkwo".into(), beneficiary_account: "1122334455".into(), beneficiary_bank: "058".into(), amount: 3000000.0, narration: "Salary Jan 2026".into(), status: "successful".into(), failure_reason: None, nibss_ref: Some("NIBSS-BLK-001-04".into()) },
                PaymentItem { id: "PI-005".into(), beneficiary_name: "Closed Account Test".into(), beneficiary_account: "0000000000".into(), beneficiary_bank: "011".into(), amount: 2500000.0, narration: "Salary Jan 2026".into(), status: "failed".into(), failure_reason: Some("Account closed".into()), nibss_ref: None },
            ],
            created_at: "2026-01-25T08:00:00Z".into(),
            processed_at: Some("2026-01-25T08:05:23Z".into()),
            reconciled_at: Some("2026-01-25T18:00:00Z".into()),
        },
        BulkBatch {
            id: "BULK-002".into(),
            batch_type: "vendor_payment".into(),
            originator: "54Bank Operations".into(),
            originator_account: "0099887766".into(),
            currency: "NGN".into(),
            total_amount: 8500000.0,
            total_items: 3,
            successful_count: 0,
            failed_count: 0,
            pending_count: 3,
            status: "pending".into(),
            items: vec![
                PaymentItem { id: "PI-010".into(), beneficiary_name: "MTN Nigeria".into(), beneficiary_account: "5566778899".into(), beneficiary_bank: "033".into(), amount: 3500000.0, narration: "SMS Service Feb 2026".into(), status: "pending".into(), failure_reason: None, nibss_ref: None },
                PaymentItem { id: "PI-011".into(), beneficiary_name: "Interswitch Ltd".into(), beneficiary_account: "6677889900".into(), beneficiary_bank: "011".into(), amount: 2500000.0, narration: "Gateway Fees Feb 2026".into(), status: "pending".into(), failure_reason: None, nibss_ref: None },
                PaymentItem { id: "PI-012".into(), beneficiary_name: "AWS Nigeria".into(), beneficiary_account: "7788990011".into(), beneficiary_bank: "058".into(), amount: 2500000.0, narration: "Cloud Hosting Feb 2026".into(), status: "pending".into(), failure_reason: None, nibss_ref: None },
            ],
            created_at: "2026-02-15T10:00:00Z".into(),
            processed_at: None,
            reconciled_at: None,
        },
    ]
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "bulk-payments",
            "middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["bulk_payments.events", "bulk_payments.audit"] },
                "dapr": { "status": "connected", "appId": "bulk_payments-sidecar" },
                "fluvio": { "status": "connected", "topic": "bulk_payments-stream" },
                "temporal": { "status": "connected", "namespace": "bulk_payments" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "bulk_payments" },
                "keycloak": { "status": "connected", "realm": "54bank" },
                "permify": { "status": "connected", "schema": "bulk_payments_authz" },
                "redis": { "status": "connected", "prefix": "bulk_payments:" },
                "mojaloop": { "status": "connected", "participant": "bulk_payments" },
                "opensearch": { "status": "connected", "index": "bulk_payments-*" },
                "openappsec": { "status": "connected", "policy": "bulk_payments-protection" },
                "apisix": { "status": "connected", "upstream": "bulk_payments" },
                "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
                "lakehouse": { "status": "connected", "table": "bulk_payments_iceberg" }
            }),
        "port": "8139",
    }))
}

async fn list_batches(data: web::Data<AppState>) -> HttpResponse {
    let batches = data.batches.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *batches,
        "total": batches.len()
    }))
}

#[derive(Deserialize)]
struct CreateBatchReq {
    batch_type: String,
    originator: String,
    originator_account: String,
    items: Vec<CreatePaymentItem>,
}

#[derive(Deserialize)]
struct CreatePaymentItem {
    beneficiary_name: String,
    beneficiary_account: String,
    beneficiary_bank: String,
    amount: f64,
    narration: String,
}

async fn create_batch(data: web::Data<AppState>, body: web::Json<CreateBatchReq>) -> HttpResponse {
    let valid_types = ["salary", "vendor_payment", "dividend", "pension", "tax_remittance"];
    if !valid_types.contains(&body.batch_type.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid batch_type",
            "valid": valid_types
        }));
    }
    if body.items.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "items array cannot be empty"}));
    }
    if body.items.len() > 1000 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "maximum 1000 items per batch"}));
    }

    let mut total = 0.0;
    let mut payment_items = Vec::new();
    for (i, item) in body.items.iter().enumerate() {
        if item.amount <= 0.0 {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("item {} has non-positive amount: {}", i, item.amount)
            }));
        }
        total += item.amount;
        payment_items.push(PaymentItem {
            id: format!("PI-{:04}", i + 1),
            beneficiary_name: item.beneficiary_name.clone(),
            beneficiary_account: item.beneficiary_account.clone(),
            beneficiary_bank: item.beneficiary_bank.clone(),
            amount: item.amount,
            narration: item.narration.clone(),
            status: "pending".into(),
            failure_reason: None,
            nibss_ref: None,
        });
    }

    let mut batches = data.batches.lock().unwrap();
    let batch = BulkBatch {
        id: format!("BULK-{:03}", batches.len() + 1),
        batch_type: body.batch_type.clone(),
        originator: body.originator.clone(),
        originator_account: body.originator_account.clone(),
        currency: "NGN".into(),
        total_amount: (total * 100.0).round() / 100.0,
        total_items: payment_items.len(),
        successful_count: 0,
        failed_count: 0,
        pending_count: payment_items.len(),
        status: "pending".into(),
        items: payment_items,
        created_at: Utc::now().to_rfc3339(),
        processed_at: None,
        reconciled_at: None,
    };
    batches.push(batch.clone());
    HttpResponse::Created().json(batch)
}

#[derive(Deserialize)]
struct ProcessReq {
    batch_id: String,
}

async fn process_batch(data: web::Data<AppState>, body: web::Json<ProcessReq>) -> HttpResponse {
    let mut batches = data.batches.lock().unwrap();
    for batch in batches.iter_mut() {
        if batch.id == body.batch_id {
            if batch.status != "pending" {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": format!("batch status is '{}', must be 'pending'", batch.status)
                }));
            }
            let mut success = 0;
            let mut failed = 0;
            for item in batch.items.iter_mut() {
                // Simulate: accounts starting with "000" fail
                if item.beneficiary_account.starts_with("000") {
                    item.status = "failed".into();
                    item.failure_reason = Some("Invalid account number".into());
                    failed += 1;
                } else {
                    item.status = "successful".into();
                    item.nibss_ref = Some(format!("NIBSS-{}-{}", batch.id, item.id));
                    success += 1;
                }
            }
            batch.successful_count = success;
            batch.failed_count = failed;
            batch.pending_count = 0;
            batch.status = if failed == 0 { "completed".into() } else { "partial".into() };
            batch.processed_at = Some(Utc::now().to_rfc3339());
            return HttpResponse::Ok().json(serde_json::json!({
                "batch": batch,
                "summary": {
                    "totalProcessed": batch.total_items,
                    "successful": success,
                    "failed": failed,
                    "successRate": format!("{:.1}%", success as f64 / batch.total_items as f64 * 100.0)
                }
            }));
        }
    }
    HttpResponse::NotFound().json(serde_json::json!({"error": "batch not found"}))
}

#[derive(Deserialize)]
struct ReconcileReq {
    batch_id: String,
}

async fn reconcile_batch(data: web::Data<AppState>, body: web::Json<ReconcileReq>) -> HttpResponse {
    let mut batches = data.batches.lock().unwrap();
    for batch in batches.iter_mut() {
        if batch.id == body.batch_id {
            if batch.status == "pending" {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "batch must be processed before reconciliation"
                }));
            }
            batch.reconciled_at = Some(Utc::now().to_rfc3339());
            let matched = batch.successful_count;
            let unmatched = batch.failed_count;
            return HttpResponse::Ok().json(serde_json::json!({
                "batchId": batch.id,
                "reconciled": true,
                "reconciledAt": batch.reconciled_at,
                "matched": matched,
                "unmatched": unmatched,
                "discrepancies": []
            }));
        }
    }
    HttpResponse::NotFound().json(serde_json::json!({"error": "batch not found"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8139".into()).parse().unwrap_or(8139);
    let data = web::Data::new(AppState {
        batches: Mutex::new(seed_data()),
    });
    println!("Bulk Payments Processor listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/bulk-payments/batches", web::get().to(list_batches))
            .route("/v1/bulk-payments/batches", web::post().to(create_batch))
            .route("/v1/bulk-payments/process", web::post().to(process_batch))
            .route("/v1/bulk-payments/reconcile", web::post().to(reconcile_batch))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
