// PostgreSQL Persistence Service — Production-grade connection pool, migrations, generic CRUD
// Rust microservice providing database operations for all 54Bank services
// Features: connection pooling (deadpool), auto-migration, JSONB storage, full-text search, audit trail

use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use deadpool_postgres::{Config, Pool, Runtime, ManagerConfig, RecyclingMethod};
use tokio_postgres::NoTls;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::Utc;
use uuid::Uuid;
use std::env;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Record {
    id: String,
    table_name: String,
    data: Value,
    tenant_id: String,
    created_at: String,
    updated_at: String,
    created_by: String,
    version: i32,
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    table_name: String,
    data: Value,
    tenant_id: Option<String>,
    created_by: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateRequest {
    data: Value,
    updated_by: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QueryParams {
    page: Option<i64>,
    limit: Option<i64>,
    tenant_id: Option<String>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MigrateRequest {
    table_name: String,
    columns: Option<Vec<ColumnDef>>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ColumnDef {
    name: String,
    col_type: String,
    nullable: Option<bool>,
    default_value: Option<String>,
}

struct AppState {
    pool: Pool,
    service_name: String,
}

fn middleware_config() -> Value {
    serde_json::json!({
        "kafka": { "broker": env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()) },
        "redis": { "url": env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()) },
        "postgres": { "url": env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()), "pool_size": 20, "idle_timeout_ms": 60000 },
        "opensearch": { "url": env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()) },
        "keycloak": { "url": env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()), "realm": "54bank" },
        "permify": { "url": env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()) },
        "dapr": { "url": env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()), "app_id": "postgres-persistence" },
        "fluvio": { "url": env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()) },
        "temporal": { "url": env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()) },
        "mojaloop": { "url": env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()) },
        "tigerbeetle": { "url": env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()) },
        "lakehouse": { "url": env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()) },
        "apisix": { "url": env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()) },
        "openappsec": { "url": env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()) }
    })
}

async fn run_migrations(pool: &Pool) -> Result<(), Box<dyn std::error::Error>> {
    let client = pool.get().await?;

    // Core records table with JSONB for flexible schema
    client.execute(
        "CREATE TABLE IF NOT EXISTS banking_records (
            id VARCHAR(64) PRIMARY KEY,
            table_name VARCHAR(128) NOT NULL,
            data JSONB NOT NULL DEFAULT '{}',
            tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by VARCHAR(128) NOT NULL DEFAULT 'system',
            version INTEGER NOT NULL DEFAULT 1
        )", &[]
    ).await?;

    // Audit trail for all mutations
    client.execute(
        "CREATE TABLE IF NOT EXISTS banking_audit_log (
            id SERIAL PRIMARY KEY,
            record_id VARCHAR(64) NOT NULL,
            table_name VARCHAR(128) NOT NULL,
            action VARCHAR(16) NOT NULL,
            old_data JSONB,
            new_data JSONB,
            performed_by VARCHAR(128) NOT NULL DEFAULT 'system',
            tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
            performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ip_address VARCHAR(45),
            correlation_id VARCHAR(64)
        )", &[]
    ).await?;

    // Indexes for performance
    client.execute("CREATE INDEX IF NOT EXISTS idx_records_table ON banking_records (table_name)", &[]).await?;
    client.execute("CREATE INDEX IF NOT EXISTS idx_records_tenant ON banking_records (tenant_id)", &[]).await?;
    client.execute("CREATE INDEX IF NOT EXISTS idx_records_table_tenant ON banking_records (table_name, tenant_id)", &[]).await?;
    client.execute("CREATE INDEX IF NOT EXISTS idx_records_data_gin ON banking_records USING GIN (data)", &[]).await?;
    client.execute("CREATE INDEX IF NOT EXISTS idx_records_created ON banking_records (created_at DESC)", &[]).await?;
    client.execute("CREATE INDEX IF NOT EXISTS idx_audit_record ON banking_audit_log (record_id)", &[]).await?;
    client.execute("CREATE INDEX IF NOT EXISTS idx_audit_table ON banking_audit_log (table_name)", &[]).await?;
    client.execute("CREATE INDEX IF NOT EXISTS idx_audit_tenant ON banking_audit_log (tenant_id)", &[]).await?;

    println!("[postgres-persistence] Migrations complete");
    Ok(())
}

async fn seed_data(pool: &Pool) -> Result<(), Box<dyn std::error::Error>> {
    let client = pool.get().await?;
    let count: i64 = client.query_one("SELECT COUNT(*) FROM banking_records", &[]).await?.get(0);
    if count > 0 {
        println!("[postgres-persistence] {} records already exist, skipping seed", count);
        return Ok(());
    }

    // Seed sample banking records across multiple domains
    let seed_records = vec![
        ("accounts", "ACC-001", serde_json::json!({"customerName": "Amina Bello", "accountNumber": "0012345678", "type": "savings", "balance": 2500000.0, "currency": "NGN", "status": "active", "branch": "Lagos-VI"})),
        ("accounts", "ACC-002", serde_json::json!({"customerName": "Chukwudi Okafor", "accountNumber": "0023456789", "type": "current", "balance": 15000000.0, "currency": "NGN", "status": "active", "branch": "Abuja-Central"})),
        ("accounts", "ACC-003", serde_json::json!({"customerName": "Fatima Abdullahi", "accountNumber": "0034567890", "type": "domiciliary", "balance": 50000.0, "currency": "USD", "status": "active", "branch": "Kano-Main"})),
        ("transactions", "TXN-001", serde_json::json!({"fromAccount": "0012345678", "toAccount": "0023456789", "amount": 500000.0, "currency": "NGN", "type": "transfer", "status": "completed", "channel": "mobile", "narration": "Rent payment May 2026"})),
        ("transactions", "TXN-002", serde_json::json!({"fromAccount": "0023456789", "toAccount": "0034567890", "amount": 2000000.0, "currency": "NGN", "type": "transfer", "status": "completed", "channel": "internet_banking", "narration": "Supplier payment"})),
        ("transactions", "TXN-003", serde_json::json!({"fromAccount": "0012345678", "toAccount": "EXT-NIBSS-001", "amount": 150000.0, "currency": "NGN", "type": "nip_transfer", "status": "pending", "channel": "ussd", "narration": "School fees"})),
        ("loans", "LOAN-001", serde_json::json!({"customerId": "ACC-001", "productType": "personal", "amount": 5000000.0, "tenure_months": 24, "interest_rate": 18.5, "status": "disbursed", "npl_class": "performing", "collateral": "salary_domiciliation"})),
        ("loans", "LOAN-002", serde_json::json!({"customerId": "ACC-002", "productType": "sme", "amount": 50000000.0, "tenure_months": 60, "interest_rate": 22.0, "status": "approved", "npl_class": "performing", "collateral": "property_lagos"})),
        ("fx_deals", "FX-001", serde_json::json!({"dealType": "spot", "buyCurrency": "USD", "sellCurrency": "NGN", "buyAmount": 100000.0, "rate": 1580.0, "sellAmount": 158000000.0, "counterparty": "CBN", "status": "settled", "valueDate": "2026-05-09"})),
        ("fx_deals", "FX-002", serde_json::json!({"dealType": "forward", "buyCurrency": "EUR", "sellCurrency": "NGN", "buyAmount": 50000.0, "rate": 1720.0, "sellAmount": 86000000.0, "counterparty": "NAFEM", "status": "open", "valueDate": "2026-08-09"})),
        ("gl_entries", "GL-001", serde_json::json!({"accountCode": "1001", "accountName": "Cash and Balances with CBN", "debit": 500000000.0, "credit": 0, "balance": 500000000.0, "category": "assets"})),
        ("gl_entries", "GL-002", serde_json::json!({"accountCode": "2001", "accountName": "Customer Deposits — Savings", "debit": 0, "credit": 350000000.0, "balance": 350000000.0, "category": "liabilities"})),
        ("gl_entries", "GL-003", serde_json::json!({"accountCode": "3001", "accountName": "Share Capital", "debit": 0, "credit": 100000000.0, "balance": 100000000.0, "category": "equity"})),
        ("gl_entries", "GL-004", serde_json::json!({"accountCode": "4001", "accountName": "Interest Income — Loans", "debit": 0, "credit": 45000000.0, "balance": 45000000.0, "category": "revenue"})),
    ];

    for (table, id, data) in seed_records {
        client.execute(
            "INSERT INTO banking_records (id, table_name, data, tenant_id, created_by) VALUES ($1, $2, $3, 'default', 'seed')",
            &[&id, &table, &data],
        ).await?;
    }

    println!("[postgres-persistence] Seeded {} records", 14);
    Ok(())
}

async fn healthz(state: web::Data<Arc<AppState>>) -> HttpResponse {
    let db_healthy = match state.pool.get().await {
        Ok(client) => client.execute("SELECT 1", &[]).await.is_ok(),
        Err(_) => false,
    };

    let pool_status = state.pool.status();
    HttpResponse::Ok().json(serde_json::json!({
        "status": if db_healthy { "healthy" } else { "degraded" },
        "service": state.service_name,
        "database": {
            "healthy": db_healthy,
            "pool_size": pool_status.size,
            "available": pool_status.available,
            "waiting": pool_status.waiting,
        },
        "middleware": middleware_config(),
    }))
}

async fn list_records(state: web::Data<Arc<AppState>>, path: web::Path<String>, query: web::Query<QueryParams>) -> HttpResponse {
    let table_name = path.into_inner();
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(25).min(1000);
    let offset = (page - 1) * limit;
    let tenant = query.tenant_id.clone().unwrap_or_else(|| "default".to_string());

    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("DB pool: {}", e)})),
    };

    let (where_clause, count_clause) = if let Some(ref search) = query.search {
        let search_pattern = format!("%{}%", search);
        (
            format!("WHERE table_name = '{}' AND tenant_id = '{}' AND data::text ILIKE '{}'", table_name, tenant, search_pattern),
            format!("WHERE table_name = '{}' AND tenant_id = '{}' AND data::text ILIKE '{}'", table_name, tenant, search_pattern),
        )
    } else {
        (
            format!("WHERE table_name = '{}' AND tenant_id = '{}'", table_name, tenant),
            format!("WHERE table_name = '{}' AND tenant_id = '{}'", table_name, tenant),
        )
    };

    let sort = format!("{} {}", query.sort_by.clone().unwrap_or_else(|| "created_at".into()), query.sort_order.clone().unwrap_or_else(|| "desc".into()));

    let count_sql = format!("SELECT COUNT(*) FROM banking_records {}", count_clause);
    let total: i64 = match client.query_one(&count_sql, &[]).await {
        Ok(row) => row.get(0),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Count: {}", e)})),
    };

    let query_sql = format!("SELECT id, table_name, data, tenant_id, created_at::text, updated_at::text, created_by, version FROM banking_records {} ORDER BY {} LIMIT {} OFFSET {}", where_clause, sort, limit, offset);

    let rows = match client.query(&query_sql, &[]).await {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Query: {}", e)})),
    };

    let items: Vec<Value> = rows.iter().map(|row| {
        let mut data: Value = row.get(2);
        if let Some(obj) = data.as_object_mut() {
            obj.insert("id".into(), Value::String(row.get(0)));
            obj.insert("_table".into(), Value::String(row.get(1)));
            obj.insert("_tenant".into(), Value::String(row.get(3)));
            obj.insert("_createdAt".into(), Value::String(row.get(4)));
            obj.insert("_updatedAt".into(), Value::String(row.get(5)));
            obj.insert("_createdBy".into(), Value::String(row.get(6)));
            obj.insert("_version".into(), Value::Number(serde_json::Number::from(row.get::<_, i32>(7))));
        }
        data
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": (total as f64 / limit as f64).ceil() as i64,
    }))
}

async fn get_record(state: web::Data<Arc<AppState>>, path: web::Path<(String, String)>) -> HttpResponse {
    let (table_name, id) = path.into_inner();
    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("{}", e)})),
    };

    let row = client.query_opt(
        "SELECT id, data, tenant_id, created_at::text, updated_at::text, created_by, version FROM banking_records WHERE id = $1 AND table_name = $2",
        &[&id, &table_name],
    ).await;

    match row {
        Ok(Some(row)) => {
            let mut data: Value = row.get(1);
            if let Some(obj) = data.as_object_mut() {
                obj.insert("id".into(), Value::String(row.get(0)));
                obj.insert("_version".into(), Value::Number(serde_json::Number::from(row.get::<_, i32>(6))));
            }
            HttpResponse::Ok().json(data)
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({"error": "Record not found"})),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("{}", e)})),
    }
}

async fn create_record(state: web::Data<Arc<AppState>>, body: web::Json<CreateRequest>) -> HttpResponse {
    let id = format!("{}-{}", body.table_name.to_uppercase().chars().take(3).collect::<String>(), &Uuid::new_v4().to_string()[..8]);
    let tenant = body.tenant_id.clone().unwrap_or_else(|| "default".to_string());
    let creator = body.created_by.clone().unwrap_or_else(|| "api".to_string());

    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("{}", e)})),
    };

    match client.execute(
        "INSERT INTO banking_records (id, table_name, data, tenant_id, created_by) VALUES ($1, $2, $3, $4, $5)",
        &[&id, &body.table_name, &body.data, &tenant, &creator],
    ).await {
        Ok(_) => {
            // Audit log
            let _ = client.execute(
                "INSERT INTO banking_audit_log (record_id, table_name, action, new_data, performed_by, tenant_id) VALUES ($1, $2, 'CREATE', $3, $4, $5)",
                &[&id, &body.table_name, &body.data, &creator, &tenant],
            ).await;

            let mut response = body.data.clone();
            if let Some(obj) = response.as_object_mut() {
                obj.insert("id".into(), Value::String(id.clone()));
            }
            HttpResponse::Created().json(response)
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("{}", e)})),
    }
}

async fn update_record(state: web::Data<Arc<AppState>>, path: web::Path<(String, String)>, body: web::Json<UpdateRequest>) -> HttpResponse {
    let (table_name, id) = path.into_inner();
    let updater = body.updated_by.clone().unwrap_or_else(|| "api".to_string());

    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("{}", e)})),
    };

    // Get old data for audit
    let old = client.query_opt("SELECT data FROM banking_records WHERE id = $1 AND table_name = $2", &[&id, &table_name]).await;
    let old_data: Option<Value> = old.ok().flatten().map(|r| r.get(0));

    match client.execute(
        "UPDATE banking_records SET data = data || $1, updated_at = NOW(), version = version + 1 WHERE id = $2 AND table_name = $3",
        &[&body.data, &id, &table_name],
    ).await {
        Ok(0) => HttpResponse::NotFound().json(serde_json::json!({"error": "Record not found"})),
        Ok(_) => {
            let _ = client.execute(
                "INSERT INTO banking_audit_log (record_id, table_name, action, old_data, new_data, performed_by) VALUES ($1, $2, 'UPDATE', $3, $4, $5)",
                &[&id, &table_name, &old_data.unwrap_or(Value::Null), &body.data, &updater],
            ).await;
            HttpResponse::Ok().json(serde_json::json!({"id": id, "updated": true}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("{}", e)})),
    }
}

async fn delete_record(state: web::Data<Arc<AppState>>, path: web::Path<(String, String)>) -> HttpResponse {
    let (table_name, id) = path.into_inner();
    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("{}", e)})),
    };

    match client.execute("DELETE FROM banking_records WHERE id = $1 AND table_name = $2", &[&id, &table_name]).await {
        Ok(0) => HttpResponse::NotFound().json(serde_json::json!({"error": "Record not found"})),
        Ok(_) => {
            let _ = client.execute(
                "INSERT INTO banking_audit_log (record_id, table_name, action, performed_by) VALUES ($1, $2, 'DELETE', 'api')",
                &[&id, &table_name],
            ).await;
            HttpResponse::Ok().json(serde_json::json!({"id": id, "deleted": true}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("{}", e)})),
    }
}

async fn migrate(state: web::Data<Arc<AppState>>, body: web::Json<MigrateRequest>) -> HttpResponse {
    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("{}", e)})),
    };

    // Create a typed table in addition to the JSONB records table
    if let Some(ref columns) = body.columns {
        let col_defs: Vec<String> = columns.iter().map(|c| {
            let nullable = if c.nullable.unwrap_or(true) { "" } else { " NOT NULL" };
            let default = c.default_value.as_ref().map(|d| format!(" DEFAULT {}", d)).unwrap_or_default();
            format!("{} {}{}{}", c.name, c.col_type, nullable, default)
        }).collect();

        let create_sql = format!(
            "CREATE TABLE IF NOT EXISTS {} (id VARCHAR(64) PRIMARY KEY, {}, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())",
            body.table_name, col_defs.join(", ")
        );

        match client.execute(&create_sql, &[]).await {
            Ok(_) => HttpResponse::Ok().json(serde_json::json!({"table": body.table_name, "status": "migrated", "columns": columns})),
            Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("{}", e)})),
        }
    } else {
        HttpResponse::Ok().json(serde_json::json!({"table": body.table_name, "status": "using_jsonb_records"}))
    }
}

async fn stats(state: web::Data<Arc<AppState>>) -> HttpResponse {
    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("{}", e)})),
    };

    let total: i64 = client.query_one("SELECT COUNT(*) FROM banking_records", &[]).await.map(|r| r.get(0)).unwrap_or(0);

    let tables = client.query(
        "SELECT table_name, COUNT(*) as cnt FROM banking_records GROUP BY table_name ORDER BY cnt DESC",
        &[],
    ).await.unwrap_or_default();

    let by_table: Vec<Value> = tables.iter().map(|r| {
        serde_json::json!({
            "table": r.get::<_, String>(0),
            "count": r.get::<_, i64>(1),
        })
    }).collect();

    let audit_count: i64 = client.query_one("SELECT COUNT(*) FROM banking_audit_log", &[]).await.map(|r| r.get(0)).unwrap_or(0);

    let pool_status = state.pool.status();
    HttpResponse::Ok().json(serde_json::json!({
        "totalRecords": total,
        "auditEntries": audit_count,
        "byTable": by_table,
        "pool": {
            "size": pool_status.size,
            "available": pool_status.available,
            "waiting": pool_status.waiting,
        },
    }))
}

async fn audit_log(state: web::Data<Arc<AppState>>, query: web::Query<QueryParams>) -> HttpResponse {
    let limit = query.limit.unwrap_or(50).min(500);
    let page = query.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let client = match state.pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("{}", e)})),
    };

    let total: i64 = client.query_one("SELECT COUNT(*) FROM banking_audit_log", &[]).await.map(|r| r.get(0)).unwrap_or(0);

    let rows = client.query(
        &format!("SELECT id, record_id, table_name, action, old_data, new_data, performed_by, tenant_id, performed_at::text FROM banking_audit_log ORDER BY performed_at DESC LIMIT {} OFFSET {}", limit, offset),
        &[],
    ).await.unwrap_or_default();

    let items: Vec<Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<_, i32>(0),
            "recordId": r.get::<_, String>(1),
            "table": r.get::<_, String>(2),
            "action": r.get::<_, String>(3),
            "oldData": r.get::<_, Option<Value>>(4),
            "newData": r.get::<_, Option<Value>>(5),
            "performedBy": r.get::<_, String>(6),
            "tenantId": r.get::<_, String>(7),
            "performedAt": r.get::<_, String>(8),
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8200".into()).parse().unwrap_or(8200);
    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| env::var("POSTGRES_URL")
        .unwrap_or_else(|_| "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()));

    let mut cfg = Config::new();
    cfg.url = Some(db_url);
    cfg.manager = Some(ManagerConfig { recycling_method: RecyclingMethod::Fast });
    let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)
        .expect("Failed to create connection pool");

    // Run migrations
    if let Err(e) = run_migrations(&pool).await {
        eprintln!("[postgres-persistence] Migration warning: {}", e);
    }

    // Seed initial data
    if let Err(e) = seed_data(&pool).await {
        eprintln!("[postgres-persistence] Seed warning: {}", e);
    }

    let state = Arc::new(AppState { pool, service_name: "postgres-persistence".into() });

    println!("[postgres-persistence] Listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/records/{table}", web::get().to(list_records))
            .route("/v1/records/{table}/{id}", web::get().to(get_record))
            .route("/v1/records", web::post().to(create_record))
            .route("/v1/records/{table}/{id}", web::put().to(update_record))
            .route("/v1/records/{table}/{id}", web::delete().to(delete_record))
            .route("/v1/migrate", web::post().to(migrate))
            .route("/v1/stats", web::get().to(stats))
            .route("/v1/audit", web::get().to(audit_log))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
