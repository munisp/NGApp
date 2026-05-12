use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"connection-pooler-rs","port":8320})) }
async fn pool_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "pgbouncer": {
            "mode": "transaction", "max_client_connections": 10000, "default_pool_size": 50,
            "reserve_pool_size": 10, "reserve_pool_timeout_seconds": 5,
            "server_idle_timeout_seconds": 300, "query_timeout_seconds": 30,
            "pools": [
                {"database":"bank54_primary","active":45,"waiting":0,"server_active":12,"max":50,"mode":"transaction"},
                {"database":"bank54_readonly","active":120,"waiting":2,"server_active":30,"max":200,"mode":"transaction"},
                {"database":"bank54_analytics","active":8,"waiting":0,"server_active":4,"max":20,"mode":"session"},
            ],
            "stats_24h": {"total_queries": 12400000, "avg_query_ms": 4.2, "total_connections_opened": 34000, "total_connections_closed": 33800},
        },
        "redis_pool": {
            "cluster_mode": true, "nodes": 6, "max_connections_per_node": 500,
            "pools": [
                {"purpose":"session_cache","active":230,"max":500,"hit_rate":0.97},
                {"purpose":"rate_limiting","active":180,"max":500,"hit_rate":0.99},
                {"purpose":"feature_flags","active":45,"max":100,"hit_rate":0.995},
            ]
        },
        "kafka_pool": {"brokers":3,"producer_pool":50,"consumer_groups":186,"active_consumers":890},
        "monitoring": {"health_check_interval_ms":5000,"slow_query_threshold_ms":500,"connection_leak_detection":true}
    }))
}
async fn middleware_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "kafka":{"topics":["pool.stats","pool.alerts"]},"dapr":{"stateStore":"pool-state"},
        "fluvio":{"topics":["pool-events"]},"temporal":{"workflows":["pool-scaling"]},
        "postgres":{"tables":["pool_stats","pool_alerts"]},"keycloak":{"roles":["pool-admin"]},
        "permify":{"relations":["pool:can_manage"]},"redis":{"keys":["pool:stats:realtime"]},
        "mojaloop":{"oracle":"pool-oracle"},"opensearch":{"indices":["pool-metrics"]},
        "openappsec":{"policy":"pool-protection"},"apisix":{"route":"/api/connection-pool/*"},
        "tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["pool_analytics"]}
    }))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8320".into()).parse().unwrap_or(8320);
    println!("Connection Pooler on :{}", port);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/api/connection-pool/config", web::get().to(pool_config))
        .route("/api/connection-pool/middleware", web::get().to(middleware_config))
    ).bind(("0.0.0.0", port))?.run().await
}
