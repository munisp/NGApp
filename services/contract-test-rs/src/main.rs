use actix_web::{web,App,HttpServer,HttpResponse,Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"contract-test-rs","port":8324})) }
async fn contracts() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "framework":"pact","total_contracts":89,"verified":85,"failed":2,"pending":2,
        "contracts":[
            {"consumer":"pwa-frontend","provider":"express-api","interactions":45,"status":"verified","last_verified":"2026-05-12"},
            {"consumer":"flutter-app","provider":"express-api","interactions":38,"status":"verified"},
            {"consumer":"express-api","provider":"gl-engine-rs","interactions":12,"status":"verified"},
            {"consumer":"express-api","provider":"mojaloop-connector-go","interactions":8,"status":"failed","failure":"schema_mismatch"},
            {"consumer":"express-api","provider":"tigerbeetle-adapter-rs","interactions":6,"status":"verified"},
            {"consumer":"kafka-streaming-go","provider":"fraud-detection-rs","interactions":5,"status":"verified"},
        ],
        "schema_compatibility":{"total_schemas":89,"backward_compatible":87,"breaking_changes":2}
    }))
}
async fn mw() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "kafka":{"topics":["contract.verified","contract.failed"]},"dapr":{"stateStore":"contract-state"},
        "fluvio":{"topics":["contract-events"]},"temporal":{"workflows":["contract-verify"]},
        "postgres":{"tables":["contracts","contract_results"]},"keycloak":{"roles":["contract-admin"]},
        "permify":{"relations":["contract:can_verify"]},"redis":{"keys":["contract:cache"]},
        "mojaloop":{"oracle":"contract-oracle"},"opensearch":{"indices":["contract-results"]},
        "openappsec":{"policy":"contract-protection"},"apisix":{"route":"/api/contract-tests/*"},
        "tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["contract_analytics"]}
    }))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8324".into()).parse().unwrap_or(8324);
    println!("Contract Test Engine on :{}",port);
    HttpServer::new(||App::new().route("/healthz",web::get().to(healthz)).route("/api/contract-tests/results",web::get().to(contracts)).route("/api/contract-tests/middleware",web::get().to(mw))).bind(("0.0.0.0",port))?.run().await
}
