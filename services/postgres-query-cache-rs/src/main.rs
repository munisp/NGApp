use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "postgres.slow-queries,postgres.plan-cache"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "query-plan-cache,result-cache"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "slow_query_log,plan_cache"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "ledger-query-cache"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "pg-cache-events"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "SlowQueryRemediationWorkflow"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "pg-slow-queries-*"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "pg:cache"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "pg-cache-stream"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "transfer-query-cache"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/postgres/cache/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "pg-cache-protection"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "slow_query_history,plan_cache_stats"}
    })
}

fn handle_request(path: &str) -> (u16, String) {
    match path {
        "/healthz" => (200, serde_json::json!({"status": "ok", "service": "postgres-query-cache-rs", "port": 8273, "middleware": middleware_config()}).to_string()),
        "/v1/slow-queries" => (200, serde_json::json!({"items": [], "total": 0}).to_string()),
        "/v1/plan-cache" => (200, serde_json::json!({"items": [], "total": 0}).to_string()),
        _ => (404, r#"{"error": "not found"}"#.to_string()),
    }
}

fn main() {
    let port = get_env("PORT", "8273");
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("Failed to bind");
    println!("Postgres Query Cache + Slow Query Detector (Rust) listening on {}", addr);
    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let mut buf = [0u8; 4096];
            if let Ok(n) = stream.read(&mut buf) {
                let req = String::from_utf8_lossy(&buf[..n]);
                let path = req.split_whitespace().nth(1).unwrap_or("/");
                let (status, body) = handle_request(path);
                let response = format!("HTTP/1.1 {} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, body.len(), body);
                let _ = stream.write_all(response.as_bytes());
            }
        }
    }
}
