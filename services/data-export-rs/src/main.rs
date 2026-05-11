use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
struct ExportJob {
    id: String,
    name: String,
    export_type: String,
    format: String,
    source: String,
    filters: serde_json::Value,
    status: String,
    row_count: u64,
    file_size_bytes: u64,
    requested_by: String,
    requested_at: String,
    completed_at: Option<String>,
    download_url: Option<String>,
    schedule: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ExportSchedule {
    id: String,
    name: String,
    export_type: String,
    format: String,
    source: String,
    cron: String,
    recipients: Vec<String>,
    last_run: String,
    next_run: String,
    status: String,
    run_count: u32,
}

#[derive(Deserialize)]
struct ExportRequest {
    name: String,
    export_type: String,
    format: String,
    source: String,
    requested_by: String,
}

struct AppState {
    jobs: Mutex<Vec<ExportJob>>,
    schedules: Mutex<Vec<ExportSchedule>>,
    next_job_id: Mutex<u32>,
}

fn seed_jobs() -> Vec<ExportJob> {
    vec![
        ExportJob { id: "EXP-001".into(), name: "Daily Transaction Report".into(), export_type: "report".into(), format: "csv".into(), source: "transactions".into(), filters: serde_json::json!({"date": "2026-05-09", "minAmount": 1000000}), status: "completed".into(), row_count: 45230, file_size_bytes: 12_450_000, requested_by: "a.ogundimu@54bank.ng".into(), requested_at: "2026-05-09T06:00:00Z".into(), completed_at: Some("2026-05-09T06:02:15Z".into()), download_url: Some("/exports/EXP-001.csv".into()), schedule: Some("0 6 * * *".into()) },
        ExportJob { id: "EXP-002".into(), name: "CBN Monthly Return — April 2026".into(), export_type: "regulatory".into(), format: "xlsx".into(), source: "gl_accounts".into(), filters: serde_json::json!({"period": "2026-04"}), status: "completed".into(), row_count: 1250, file_size_bytes: 2_800_000, requested_by: "n.eze@54bank.ng".into(), requested_at: "2026-05-02T08:00:00Z".into(), completed_at: Some("2026-05-02T08:05:30Z".into()), download_url: Some("/exports/EXP-002.xlsx".into()), schedule: None },
        ExportJob { id: "EXP-003".into(), name: "Customer Data Extract — Segment Analysis".into(), export_type: "analytics".into(), format: "json".into(), source: "customers".into(), filters: serde_json::json!({"segment": ["premium_retail", "hnw"]}), status: "completed".into(), row_count: 85000, file_size_bytes: 45_000_000, requested_by: "o.adeleke@54bank.ng".into(), requested_at: "2026-05-09T09:00:00Z".into(), completed_at: Some("2026-05-09T09:08:45Z".into()), download_url: Some("/exports/EXP-003.json".into()), schedule: None },
        ExportJob { id: "EXP-004".into(), name: "Loan Portfolio — NPL Extract".into(), export_type: "report".into(), format: "csv".into(), source: "loans".into(), filters: serde_json::json!({"status": "non_performing", "daysPastDue": {"gte": 90}}), status: "in_progress".into(), row_count: 0, file_size_bytes: 0, requested_by: "a.bello@54bank.ng".into(), requested_at: "2026-05-09T14:00:00Z".into(), completed_at: None, download_url: None, schedule: None },
        ExportJob { id: "EXP-005".into(), name: "AML/CTR Filing — May Week 1".into(), export_type: "regulatory".into(), format: "xml".into(), source: "transactions".into(), filters: serde_json::json!({"type": "ctr", "period": "2026-W19", "threshold": 5000000}), status: "completed".into(), row_count: 342, file_size_bytes: 890_000, requested_by: "n.eze@54bank.ng".into(), requested_at: "2026-05-05T07:00:00Z".into(), completed_at: Some("2026-05-05T07:01:00Z".into()), download_url: Some("/exports/EXP-005.xml".into()), schedule: Some("0 7 * * 1".into()) },
    ]
}

fn seed_schedules() -> Vec<ExportSchedule> {
    vec![
        ExportSchedule { id: "SCH-001".into(), name: "Daily Transaction Summary".into(), export_type: "report".into(), format: "csv".into(), source: "transactions".into(), cron: "0 6 * * *".into(), recipients: vec!["ops-team@54bank.ng".into()], last_run: "2026-05-09T06:00:00Z".into(), next_run: "2026-05-10T06:00:00Z".into(), status: "active".into(), run_count: 130 },
        ExportSchedule { id: "SCH-002".into(), name: "Weekly AML/CTR Filing".into(), export_type: "regulatory".into(), format: "xml".into(), source: "transactions".into(), cron: "0 7 * * 1".into(), recipients: vec!["compliance@54bank.ng".into(), "n.eze@54bank.ng".into()], last_run: "2026-05-05T07:00:00Z".into(), next_run: "2026-05-12T07:00:00Z".into(), status: "active".into(), run_count: 19 },
        ExportSchedule { id: "SCH-003".into(), name: "Monthly CBN eFASS Return".into(), export_type: "regulatory".into(), format: "xlsx".into(), source: "gl_accounts".into(), cron: "0 8 2 * *".into(), recipients: vec!["compliance@54bank.ng".into(), "cfo@54bank.ng".into()], last_run: "2026-05-02T08:00:00Z".into(), next_run: "2026-06-02T08:00:00Z".into(), status: "active".into(), run_count: 5 },
        ExportSchedule { id: "SCH-004".into(), name: "Daily Data Warehouse Feed".into(), export_type: "etl".into(), format: "parquet".into(), source: "all_tables".into(), cron: "0 2 * * *".into(), recipients: vec!["data-team@54bank.ng".into()], last_run: "2026-05-09T02:00:00Z".into(), next_run: "2026-05-10T02:00:00Z".into(), status: "active".into(), run_count: 130 },
    ]
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "data-export-engine",
            "middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["data_export.events", "data_export.audit"] },
                "dapr": { "status": "connected", "appId": "data_export-sidecar" },
                "fluvio": { "status": "connected", "topic": "data_export-stream" },
                "temporal": { "status": "connected", "namespace": "data_export" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "data_export" },
                "keycloak": { "status": "connected", "realm": "54bank" },
                "permify": { "status": "connected", "schema": "data_export_authz" },
                "redis": { "status": "connected", "prefix": "data_export:" },
                "mojaloop": { "status": "connected", "participant": "data_export" },
                "opensearch": { "status": "connected", "index": "data_export-*" },
                "openappsec": { "status": "connected", "policy": "data_export-protection" },
                "apisix": { "status": "connected", "upstream": "data_export" },
                "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
                "lakehouse": { "status": "connected", "table": "data_export_iceberg" }
            }),,
        "formats": ["csv", "xlsx", "json", "xml", "parquet", "pdf"],
    }))
}

async fn list_jobs(data: web::Data<AppState>) -> HttpResponse {
    let jobs = data.jobs.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *jobs, "total": jobs.len() }))
}

async fn create_job(body: web::Json<ExportRequest>, data: web::Data<AppState>) -> HttpResponse {
    let req = body.into_inner();
    if req.name.is_empty() || req.source.is_empty() || req.format.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "name, source, and format required"}));
    }
    let valid_formats = ["csv", "xlsx", "json", "xml", "parquet", "pdf"];
    if !valid_formats.contains(&req.format.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("invalid format '{}'; must be one of: csv, xlsx, json, xml, parquet, pdf", req.format)
        }));
    }

    let mut jobs = data.jobs.lock().unwrap();
    let mut next_id = data.next_job_id.lock().unwrap();
    let job = ExportJob {
        id: format!("EXP-{:03}", *next_id),
        name: req.name,
        export_type: req.export_type,
        format: req.format,
        source: req.source,
        filters: serde_json::json!({}),
        status: "queued".into(),
        row_count: 0,
        file_size_bytes: 0,
        requested_by: req.requested_by,
        requested_at: "2026-05-09T15:00:00Z".into(),
        completed_at: None,
        download_url: None,
        schedule: None,
    };
    *next_id += 1;
    jobs.push(job.clone());
    HttpResponse::Accepted().json(job)
}

async fn list_schedules(data: web::Data<AppState>) -> HttpResponse {
    let schedules = data.schedules.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *schedules, "total": schedules.len() }))
}

async fn export_stats(data: web::Data<AppState>) -> HttpResponse {
    let jobs = data.jobs.lock().unwrap();
    let mut by_format: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut by_status: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut total_rows: u64 = 0;
    let mut total_bytes: u64 = 0;
    for j in jobs.iter() {
        *by_format.entry(j.format.clone()).or_insert(0) += 1;
        *by_status.entry(j.status.clone()).or_insert(0) += 1;
        total_rows += j.row_count;
        total_bytes += j.file_size_bytes;
    }
    HttpResponse::Ok().json(serde_json::json!({
        "totalJobs": jobs.len(),
        "totalRowsExported": total_rows,
        "totalBytesExported": total_bytes,
        "byFormat": by_format,
        "byStatus": by_status
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let addr = std::env::var("ADDR").unwrap_or_else(|_| "0.0.0.0:8148".to_string());
    let jobs = seed_jobs();
    let next_id = (jobs.len() + 1) as u32;
    let state = web::Data::new(AppState {
        jobs: Mutex::new(jobs),
        schedules: Mutex::new(seed_schedules()),
        next_job_id: Mutex::new(next_id),
    });
    println!("data-export-engine listening on {addr}");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/exports/jobs", web::get().to(list_jobs))
            .route("/v1/exports/jobs", web::post().to(create_job))
            .route("/v1/exports/schedules", web::get().to(list_schedules))
            .route("/v1/exports/stats", web::get().to(export_stats))
    })
    .bind(&addr)?
    .run()
    .await
}
