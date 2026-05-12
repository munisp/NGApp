use actix_web::{web,App,HttpServer,HttpResponse,Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"dormancy-management-rs","port":8335})) }
async fn config() -> impl Responder { HttpResponse::Ok().json(json!({"service":"Dormancy Management","port":8335,"status":"active"})) }
async fn mw() -> impl Responder {
    HttpResponse::Ok().json(json!({"kafka":{"topics":["dormancy-management.events"]},"dapr":{"stateStore":"dormancy-management-state"},"fluvio":{"topics":["dormancy-management-stream"]},"temporal":{"workflows":["dormancy-management-workflow"]},"postgres":{"tables":["dormancy-management_config"]},"keycloak":{"roles":["dormancy-management-admin"]},"permify":{"relations":["dormancy-management:can_manage"]},"redis":{"keys":["dormancy-management:cache"]},"mojaloop":{"oracle":"dormancy-management-oracle"},"opensearch":{"indices":["dormancy-management-events"]},"openappsec":{"policy":"dormancy-management-protection"},"apisix":{"route":"/api/dormancy-management/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["dormancy-management_analytics"]}}))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8335".into()).parse().unwrap_or(8335);
    println!("Dormancy Management on :{}",port);
    HttpServer::new(||App::new().route("/healthz",web::get().to(healthz)).route("/api/dormancy-management/config",web::get().to(config)).route("/api/dormancy-management/middleware",web::get().to(mw))).bind(("0.0.0.0",port))?.run().await
}
