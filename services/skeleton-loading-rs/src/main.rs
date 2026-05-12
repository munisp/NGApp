use actix_web::{web,App,HttpServer,HttpResponse,Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"skeleton-loading-rs","port":8331})) }
async fn config() -> impl Responder { HttpResponse::Ok().json(json!({"service":"Skeleton Loading","port":8331,"status":"active"})) }
async fn mw() -> impl Responder {
    HttpResponse::Ok().json(json!({"kafka":{"topics":["skeleton-loading.events"]},"dapr":{"stateStore":"skeleton-loading-state"},"fluvio":{"topics":["skeleton-loading-stream"]},"temporal":{"workflows":["skeleton-loading-workflow"]},"postgres":{"tables":["skeleton-loading_config"]},"keycloak":{"roles":["skeleton-loading-admin"]},"permify":{"relations":["skeleton-loading:can_manage"]},"redis":{"keys":["skeleton-loading:cache"]},"mojaloop":{"oracle":"skeleton-loading-oracle"},"opensearch":{"indices":["skeleton-loading-events"]},"openappsec":{"policy":"skeleton-loading-protection"},"apisix":{"route":"/api/skeleton-loading/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["skeleton-loading_analytics"]}}))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8331".into()).parse().unwrap_or(8331);
    println!("Skeleton Loading on :{}",port);
    HttpServer::new(||App::new().route("/healthz",web::get().to(healthz)).route("/api/skeleton-loading/config",web::get().to(config)).route("/api/skeleton-loading/middleware",web::get().to(mw))).bind(("0.0.0.0",port))?.run().await
}
