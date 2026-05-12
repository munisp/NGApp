use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde_json::json;
use std::env;

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "falkordb-graph-rs", "port": 8307}))
}

async fn graphs() -> impl Responder {
    HttpResponse::Ok().json(json!([
        {"id": "FDB-001", "name": "customer_360_graph", "nodes": 2400000, "edges": 18700000,
         "node_labels": ["Customer", "Account", "Transaction", "Merchant", "Device", "BVN", "NIN"],
         "edge_types": ["OWNS", "TRANSACTED", "USED", "LINKED_TO", "SHARES"],
         "avg_query_ms": 1.8, "memory_mb": 4200, "persistence": "AOF+RDB"},
        {"id": "FDB-002", "name": "fraud_ring_graph", "nodes": 890000, "edges": 5600000,
         "node_labels": ["SuspiciousEntity", "Account", "Device", "IP", "Phone"],
         "edge_types": ["SHARED_DEVICE", "SHARED_IP", "RAPID_TRANSFER", "BENEFICIARY_CHAIN"],
         "avg_query_ms": 0.9, "memory_mb": 1800},
        {"id": "FDB-003", "name": "compliance_kg", "nodes": 1200000, "edges": 8400000,
         "node_labels": ["Regulation", "Section", "Entity", "Obligation", "Deadline"],
         "edge_types": ["REQUIRES", "APPLIES_TO", "REFERENCES", "SUPERSEDES"],
         "avg_query_ms": 2.1, "memory_mb": 2400},
        {"id": "FDB-004", "name": "ubo_corporate_graph", "nodes": 45000, "edges": 128000,
         "node_labels": ["Company", "Individual", "Trust", "Foundation"],
         "edge_types": ["OWNS", "DIRECTS", "CONTROLS", "BENEFITS_FROM", "NOMINEE_FOR"],
         "avg_query_ms": 0.4, "memory_mb": 120}
    ]))
}

async fn cypher_queries() -> impl Responder {
    HttpResponse::Ok().json(json!([
        {"id": "CYP-001", "name": "fraud_ring_detection",
         "cypher": "MATCH (a:Account)-[:SHARED_DEVICE]->(d:Device)<-[:SHARED_DEVICE]-(b:Account) WHERE a <> b RETURN a, b, d",
         "avg_ms": 3.2, "last_result_count": 847},
        {"id": "CYP-002", "name": "money_trail_3hop",
         "cypher": "MATCH path = (src:Account)-[:RAPID_TRANSFER*1..3]->(dst:Account) WHERE src.risk > 0.7 RETURN path",
         "avg_ms": 8.5, "last_result_count": 234},
        {"id": "CYP-003", "name": "ubo_chain",
         "cypher": "MATCH path = (c:Company)-[:OWNS*1..5]->(ubo:Individual) WHERE ALL(r IN relationships(path) WHERE r.pct >= 25) RETURN path",
         "avg_ms": 1.2, "last_result_count": 12}
    ]))
}

async fn middleware_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "kafka": {"topics": ["falkordb.graph.updates", "falkordb.queries"]},
        "dapr": {"stateStore": "falkordb-state"}, "fluvio": {"topics": ["fdb-stream-updates"]},
        "temporal": {"workflows": ["fdb-graph-rebuild", "fdb-backup"]},
        "postgres": {"tables": ["fdb_graphs", "fdb_queries", "fdb_metrics"]},
        "keycloak": {"roles": ["fdb-admin", "fdb-analyst"]},
        "permify": {"relations": ["fdb:can_query", "fdb:can_admin"]},
        "redis": {"keys": ["fdb:query:cache", "fdb:graph:meta"]},
        "mojaloop": {"oracle": "fdb-graph-oracle"},
        "opensearch": {"indices": ["fdb-query-logs"]},
        "openappsec": {"policy": "fdb-api-protection"},
        "apisix": {"route": "/api/falkordb/*"},
        "tigerbeetle": {"accounts": []},
        "lakehouse": {"tables": ["fdb_query_analytics"]}
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8307".into()).parse().unwrap_or(8307);
    println!("FalkorDB Graph Analytics on :{}", port);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/api/falkordb/graphs", web::get().to(graphs))
        .route("/api/falkordb/cypher-queries", web::get().to(cypher_queries))
        .route("/api/falkordb/middleware", web::get().to(middleware_config))
    ).bind(("0.0.0.0", port))?.run().await
}
