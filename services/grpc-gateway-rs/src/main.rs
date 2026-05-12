use actix_web::{web,App,HttpServer,HttpResponse,Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"grpc-gateway-rs","port":8344})) }
async fn config() -> impl Responder { HttpResponse::Ok().json(json!({"service":"gRPC Gateway","port":8344,"status":"active"})) }
async fn mw() -> impl Responder {
    HttpResponse::Ok().json(json!({"kafka":{"topics":["grpc-gateway.events"]},"dapr":{"stateStore":"grpc-gateway-state"},"fluvio":{"topics":["grpc-gateway-stream"]},"temporal":{"workflows":["grpc-gateway-workflow"]},"postgres":{"tables":["grpc-gateway_config"]},"keycloak":{"roles":["grpc-gateway-admin"]},"permify":{"relations":["grpc-gateway:can_manage"]},"redis":{"keys":["grpc-gateway:cache"]},"mojaloop":{"oracle":"grpc-gateway-oracle"},"opensearch":{"indices":["grpc-gateway-events"]},"openappsec":{"policy":"grpc-gateway-protection"},"apisix":{"route":"/api/grpc-gateway/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["grpc-gateway_analytics"]}}))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8344".into()).parse().unwrap_or(8344);
    println!("gRPC Gateway on :{}",port);
    HttpServer::new(||App::new().route("/healthz",web::get().to(healthz)).route("/api/grpc-gateway/config",web::get().to(config)).route("/api/grpc-gateway/middleware",web::get().to(mw))).bind(("0.0.0.0",port))?.run().await
}
