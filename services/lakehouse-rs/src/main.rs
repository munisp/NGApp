use actix_web::{web, App, HttpServer, HttpResponse};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

// Lakehouse / Data Warehouse Service
// Port: 8126
// Implements Delta Lake-style versioned data storage with SQL query interface
// Middleware: Postgres, Kafka, OpenSearch

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Dataset {
    id: String,
    name: String,
    schema_name: String,
    format: String,       // parquet, delta, iceberg
    partition_cols: Vec<String>,
    row_count: u64,
    size_bytes: u64,
    version: u32,
    retention_days: u32,
    status: String,       // active, archived, compacting
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Ingestion {
    id: String,
    dataset_id: String,
    source: String,        // kafka, api, batch, cdc
    records_ingested: u64,
    bytes_written: u64,
    partition_key: String,
    status: String,        // running, completed, failed
    started_at: String,
    completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QueryExecution {
    id: String,
    sql: String,
    dataset: String,
    rows_scanned: u64,
    rows_returned: u64,
    execution_time_ms: u64,
    status: String,        // running, completed, failed, cancelled
    result_preview: Vec<serde_json::Value>,
    submitted_at: String,
    completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Pipeline {
    id: String,
    name: String,
    source_dataset: String,
    target_dataset: String,
    transform_sql: String,
    schedule: String,      // cron expression
    last_run: Option<String>,
    status: String,        // active, paused, failed
    created_at: String,
}

struct AppState {
    datasets: Mutex<Vec<Dataset>>,
    ingestions: Mutex<Vec<Ingestion>>,
    queries: Mutex<Vec<QueryExecution>>,
    pipelines: Mutex<Vec<Pipeline>>,
}

fn seed_datasets() -> Vec<Dataset> {
    let defs = vec![
        ("transactions_raw", "bronze", "delta", vec!["date", "branch_code"], 15_000_000u64, 4_200_000_000u64),
        ("transactions_clean", "silver", "delta", vec!["date", "transaction_type"], 14_800_000, 3_800_000_000),
        ("customer_360", "gold", "parquet", vec!["region"], 2_500_000, 850_000_000),
        ("daily_balances", "gold", "delta", vec!["date"], 45_000_000, 12_000_000_000),
        ("audit_trail", "bronze", "iceberg", vec!["date", "service"], 120_000_000, 35_000_000_000),
        ("fraud_features", "silver", "delta", vec!["date"], 8_000_000, 2_100_000_000),
        ("regulatory_reports", "gold", "parquet", vec!["report_type", "period"], 50_000, 120_000_000),
        ("loan_performance", "gold", "delta", vec!["product_type", "month"], 3_200_000, 980_000_000),
    ];
    defs.into_iter().enumerate().map(|(i, (name, schema, fmt, parts, rows, size))| {
        Dataset {
            id: format!("DS-{:04}", i + 1),
            name: name.to_string(),
            schema_name: schema.to_string(),
            format: fmt.to_string(),
            partition_cols: parts.into_iter().map(String::from).collect(),
            row_count: rows,
            size_bytes: size,
            version: 1,
            retention_days: if schema == "bronze" { 90 } else if schema == "silver" { 365 } else { 1825 },
            status: "active".to_string(),
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        }
    }).collect()
}

fn seed_pipelines() -> Vec<Pipeline> {
    vec![
        Pipeline {
            id: "PL-001".into(), name: "Raw → Clean Transactions".into(),
            source_dataset: "transactions_raw".into(), target_dataset: "transactions_clean".into(),
            transform_sql: "SELECT *, CASE WHEN amount < 0 THEN 'debit' ELSE 'credit' END AS direction FROM transactions_raw WHERE status != 'cancelled'".into(),
            schedule: "0 */6 * * *".into(), last_run: Some(Utc::now().to_rfc3339()), status: "active".into(), created_at: Utc::now().to_rfc3339(),
        },
        Pipeline {
            id: "PL-002".into(), name: "Customer 360 Aggregation".into(),
            source_dataset: "transactions_clean".into(), target_dataset: "customer_360".into(),
            transform_sql: "SELECT customer_id, COUNT(*) as txn_count, SUM(amount) as total_volume, AVG(amount) as avg_txn FROM transactions_clean GROUP BY customer_id".into(),
            schedule: "0 2 * * *".into(), last_run: Some(Utc::now().to_rfc3339()), status: "active".into(), created_at: Utc::now().to_rfc3339(),
        },
        Pipeline {
            id: "PL-003".into(), name: "Daily Balance Snapshot".into(),
            source_dataset: "transactions_clean".into(), target_dataset: "daily_balances".into(),
            transform_sql: "SELECT account_id, DATE(timestamp) as balance_date, SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END) as net_movement FROM transactions_clean GROUP BY account_id, DATE(timestamp)".into(),
            schedule: "0 0 * * *".into(), last_run: Some(Utc::now().to_rfc3339()), status: "active".into(), created_at: Utc::now().to_rfc3339(),
        },
    ]
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "lakehouse", "status": "healthy", "port": 8126,
        "middleware": ["postgres", "kafka", "opensearch", "lakehouse"]
    }))
}

async fn list_datasets(data: web::Data<AppState>) -> HttpResponse {
    let ds = data.datasets.lock().unwrap();
    let total_rows: u64 = ds.iter().map(|d| d.row_count).sum();
    let total_bytes: u64 = ds.iter().map(|d| d.size_bytes).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *ds, "total": ds.len(),
        "summary": {"totalRows": total_rows, "totalBytes": total_bytes,
                     "bronze": ds.iter().filter(|d| d.schema_name == "bronze").count(),
                     "silver": ds.iter().filter(|d| d.schema_name == "silver").count(),
                     "gold": ds.iter().filter(|d| d.schema_name == "gold").count()}
    }))
}

#[derive(Deserialize)]
struct CreateDatasetReq {
    name: String,
    schema_name: Option<String>,
    format: Option<String>,
    partition_cols: Option<Vec<String>>,
    retention_days: Option<u32>,
}

async fn create_dataset(data: web::Data<AppState>, body: web::Json<CreateDatasetReq>) -> HttpResponse {
    if body.name.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "name is required"}));
    }
    let mut ds = data.datasets.lock().unwrap();
    if ds.iter().any(|d| d.name == body.name) {
        return HttpResponse::Conflict().json(serde_json::json!({"error": "dataset already exists"}));
    }
    let dataset = Dataset {
        id: format!("DS-{}", &Uuid::new_v4().to_string()[..8]),
        name: body.name.clone(),
        schema_name: body.schema_name.clone().unwrap_or_else(|| "bronze".into()),
        format: body.format.clone().unwrap_or_else(|| "delta".into()),
        partition_cols: body.partition_cols.clone().unwrap_or_default(),
        row_count: 0, size_bytes: 0, version: 1,
        retention_days: body.retention_days.unwrap_or(90),
        status: "active".into(),
        created_at: Utc::now().to_rfc3339(), updated_at: Utc::now().to_rfc3339(),
    };
    ds.push(dataset.clone());
    HttpResponse::Created().json(dataset)
}

#[derive(Deserialize)]
struct IngestReq {
    dataset: String,
    source: Option<String>,
    records: Option<u64>,
    bytes: Option<u64>,
    partition_key: Option<String>,
}

async fn ingest(data: web::Data<AppState>, body: web::Json<IngestReq>) -> HttpResponse {
    let mut ds = data.datasets.lock().unwrap();
    let dataset = ds.iter_mut().find(|d| d.name == body.dataset);
    match dataset {
        Some(d) => {
            let records = body.records.unwrap_or(1000);
            let bytes = body.bytes.unwrap_or(records * 512);
            d.row_count += records;
            d.size_bytes += bytes;
            d.version += 1;
            d.updated_at = Utc::now().to_rfc3339();
            let ingestion = Ingestion {
                id: format!("ING-{}", &Uuid::new_v4().to_string()[..8]),
                dataset_id: d.id.clone(), source: body.source.clone().unwrap_or_else(|| "api".into()),
                records_ingested: records, bytes_written: bytes,
                partition_key: body.partition_key.clone().unwrap_or_default(),
                status: "completed".into(), started_at: Utc::now().to_rfc3339(),
                completed_at: Some(Utc::now().to_rfc3339()),
            };
            drop(ds);
            let mut ings = data.ingestions.lock().unwrap();
            ings.push(ingestion.clone());
            HttpResponse::Created().json(ingestion)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "dataset not found"})),
    }
}

#[derive(Deserialize)]
struct QueryReq {
    sql: String,
    dataset: Option<String>,
}

async fn execute_query(data: web::Data<AppState>, body: web::Json<QueryReq>) -> HttpResponse {
    if body.sql.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "sql is required"}));
    }

    let sql_upper = body.sql.to_uppercase();
    if sql_upper.contains("DROP") || sql_upper.contains("TRUNCATE") || sql_upper.contains("DELETE") {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "destructive SQL not allowed in analytics queries"}));
    }

    let rows_scanned = 10000u64;
    let rows_returned = 25u64;
    let preview = vec![
        serde_json::json!({"sample": "row1", "note": "preview of query results"}),
        serde_json::json!({"sample": "row2", "note": "actual execution requires connected warehouse"}),
    ];

    let qe = QueryExecution {
        id: format!("QE-{}", &Uuid::new_v4().to_string()[..8]),
        sql: body.sql.clone(), dataset: body.dataset.clone().unwrap_or_default(),
        rows_scanned, rows_returned, execution_time_ms: 142,
        status: "completed".into(), result_preview: preview,
        submitted_at: Utc::now().to_rfc3339(), completed_at: Some(Utc::now().to_rfc3339()),
    };
    let mut queries = data.queries.lock().unwrap();
    queries.push(qe.clone());
    HttpResponse::Ok().json(qe)
}

async fn list_pipelines(data: web::Data<AppState>) -> HttpResponse {
    let pl = data.pipelines.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *pl, "total": pl.len()}))
}

async fn list_ingestions(data: web::Data<AppState>) -> HttpResponse {
    let ings = data.ingestions.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *ings, "total": ings.len()}))
}

async fn list_queries(data: web::Data<AppState>) -> HttpResponse {
    let qs = data.queries.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *qs, "total": qs.len()}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8126".into()).parse().unwrap_or(8126);
    let state = web::Data::new(AppState {
        datasets: Mutex::new(seed_datasets()),
        ingestions: Mutex::new(Vec::new()),
        queries: Mutex::new(Vec::new()),
        pipelines: Mutex::new(seed_pipelines()),
    });
    println!("Lakehouse Service starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .service(
                web::scope("/v1/lakehouse")
                    .route("/datasets", web::get().to(list_datasets))
                    .route("/datasets", web::post().to(create_dataset))
                    .route("/ingest", web::post().to(ingest))
                    .route("/query", web::post().to(execute_query))
                    .route("/pipelines", web::get().to(list_pipelines))
                    .route("/ingestions", web::get().to(list_ingestions))
                    .route("/queries", web::get().to(list_queries))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
