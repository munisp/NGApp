use actix_web::{web,App,HttpServer,HttpResponse,Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"interest-computation-rs","port":8336})) }
async fn config() -> impl Responder { HttpResponse::Ok().json(json!({"service":"Interest Computation","port":8336,"status":"active"})) }
async fn mw() -> impl Responder {
    HttpResponse::Ok().json(json!({"kafka":{"topics":["interest-computation.events"]},"dapr":{"stateStore":"interest-computation-state"},"fluvio":{"topics":["interest-computation-stream"]},"temporal":{"workflows":["interest-computation-workflow"]},"postgres":{"tables":["interest-computation_config"]},"keycloak":{"roles":["interest-computation-admin"]},"permify":{"relations":["interest-computation:can_manage"]},"redis":{"keys":["interest-computation:cache"]},"mojaloop":{"oracle":"interest-computation-oracle"},"opensearch":{"indices":["interest-computation-events"]},"openappsec":{"policy":"interest-computation-protection"},"apisix":{"route":"/api/interest-computation/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["interest-computation_analytics"]}}))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8336".into()).parse().unwrap_or(8336);
    println!("Interest Computation on :{}",port);
    HttpServer::new(||App::new().route("/healthz",web::get().to(healthz)).route("/api/interest-computation/config",web::get().to(config)).route("/api/interest-computation/middleware",web::get().to(mw))).bind(("0.0.0.0",port))?.run().await
}
