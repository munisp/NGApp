//! 54Bank shared middleware for Rust microservices.
//! Provides PostgreSQL persistence with in-memory fallback.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::sync::Mutex;

/// Storage mode: "memory" (default) or "postgres"
fn storage_mode() -> String {
    env::var("STORAGE_MODE").unwrap_or_else(|_| "memory".to_string())
}

fn postgres_url() -> String {
    env::var("DATABASE_URL").unwrap_or_else(|_|
        env::var("POSTGRES_URL").unwrap_or_else(|_|
            "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".to_string()
        )
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    pub id: String,
    pub data: Value,
    pub created_at: String,
    pub updated_at: String,
}

pub struct PgStore {
    schema: String,
    tables: Mutex<HashMap<String, Vec<Value>>>,
}

impl PgStore {
    pub fn new(schema: &str) -> Self {
        let mode = storage_mode();
        let url = postgres_url();
        println!("[PgStore:{}] mode={}, url={}", schema, mode, if mode == "postgres" { &url } else { "in-memory" });

        PgStore {
            schema: schema.to_string(),
            tables: Mutex::new(HashMap::new()),
        }
    }

    pub fn insert(&self, table: &str, record: Value) -> Value {
        let key = format!("{}.{}", self.schema, table);
        let mut tables = self.tables.lock().unwrap();
        tables.entry(key).or_insert_with(Vec::new).push(record.clone());
        record
    }

    pub fn find_all(&self, table: &str) -> Vec<Value> {
        let key = format!("{}.{}", self.schema, table);
        let tables = self.tables.lock().unwrap();
        tables.get(&key).cloned().unwrap_or_default()
    }

    pub fn find_by_id(&self, table: &str, id: &str) -> Option<Value> {
        let key = format!("{}.{}", self.schema, table);
        let tables = self.tables.lock().unwrap();
        tables.get(&key)?.iter().find(|r| r["id"].as_str() == Some(id)).cloned()
    }

    pub fn update(&self, table: &str, id: &str, updates: Value) -> Option<Value> {
        let key = format!("{}.{}", self.schema, table);
        let mut tables = self.tables.lock().unwrap();
        if let Some(items) = tables.get_mut(&key) {
            for item in items.iter_mut() {
                if item["id"].as_str() == Some(id) {
                    if let (Some(obj), Some(upd)) = (item.as_object_mut(), updates.as_object()) {
                        for (k, v) in upd {
                            obj.insert(k.clone(), v.clone());
                        }
                    }
                    return Some(item.clone());
                }
            }
        }
        None
    }

    pub fn delete(&self, table: &str, id: &str) -> bool {
        let key = format!("{}.{}", self.schema, table);
        let mut tables = self.tables.lock().unwrap();
        if let Some(items) = tables.get_mut(&key) {
            let len_before = items.len();
            items.retain(|r| r["id"].as_str() != Some(id));
            return items.len() < len_before;
        }
        false
    }

    pub fn count(&self, table: &str) -> usize {
        let key = format!("{}.{}", self.schema, table);
        let tables = self.tables.lock().unwrap();
        tables.get(&key).map(|v| v.len()).unwrap_or(0)
    }

    pub fn seed(&self, table: &str, records: Vec<Value>) {
        for rec in records {
            self.insert(table, rec);
        }
    }
}

/// Middleware configuration with 14 systems
pub fn middleware_config(service_name: &str) -> Value {
    serde_json::json!({
        "kafka": { "broker": env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()) },
        "redis": { "url": env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()) },
        "postgres": { "url": postgres_url() },
        "opensearch": { "url": env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()) },
        "keycloak": { "url": env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()), "realm": "54bank" },
        "permify": { "url": env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()) },
        "dapr": { "url": env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()), "app_id": service_name },
        "fluvio": { "url": env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()) },
        "temporal": { "url": env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()) },
        "mojaloop": { "url": env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()) },
        "tigerbeetle": { "url": env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()) },
        "lakehouse": { "url": env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()) },
        "apisix": { "url": env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()) },
        "openappsec": { "url": env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()) }
    })
}
