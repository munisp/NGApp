use actix_web::{web,App,HttpServer,HttpResponse,Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"express-rate-limiter-rs","port":8346})) }
async fn config() -> impl Responder { HttpResponse::Ok().json(json!({"service":"Express Rate Limiter","port":8346,"status":"active"})) }
async fn mw() -> impl Responder {
    HttpResponse::Ok().json(json!({"kafka":{"topics":["express-rate-limiter.events"]},"dapr":{"stateStore":"express-rate-limiter-state"},"fluvio":{"topics":["express-rate-limiter-stream"]},"temporal":{"workflows":["express-rate-limiter-workflow"]},"postgres":{"tables":["express-rate-limiter_config"]},"keycloak":{"roles":["express-rate-limiter-admin"]},"permify":{"relations":["express-rate-limiter:can_manage"]},"redis":{"keys":["express-rate-limiter:cache"]},"mojaloop":{"oracle":"express-rate-limiter-oracle"},"opensearch":{"indices":["express-rate-limiter-events"]},"openappsec":{"policy":"express-rate-limiter-protection"},"apisix":{"route":"/api/express-rate-limiter/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["express-rate-limiter_analytics"]}}))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8346".into()).parse().unwrap_or(8346);
    println!("Express Rate Limiter on :{}",port);
    HttpServer::new(||App::new().route("/healthz",web::get().to(healthz)).route("/api/express-rate-limiter/config",web::get().to(config)).route("/api/express-rate-limiter/middleware",web::get().to(mw))).bind(("0.0.0.0",port))?.run().await
}
