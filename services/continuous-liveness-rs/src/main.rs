use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }
fn mw() -> serde_json::Value { serde_json::json!({"kafka":{"broker":ev("KAFKA_BROKER","localhost:9092"),"topics":["liveness.step-up-triggered","liveness.re-verify","liveness.behavioral","liveness.device-anomaly","liveness.injection-detected"]},"dapr":{"app_id":"continuous-liveness-rs"},"fluvio":{"url":ev("FLUVIO_URL","localhost:9003")},"temporal":{"url":ev("TEMPORAL_URL","localhost:7233"),"namespace":"continuous-liveness","workflows":["StepUpLivenessWorkflow","PeriodicReverifyWorkflow","BehavioralBaselineWorkflow"]},"postgres":{"url":ev("DATABASE_URL","postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),"tables":["liveness_sessions","liveness_behavioral","liveness_device_bindings","liveness_step_ups"]},"keycloak":{"url":ev("KEYCLOAK_URL","http://localhost:8080"),"realm":"54bank"},"permify":{"url":ev("PERMIFY_URL","http://localhost:3476")},"redis":{"url":ev("REDIS_URL","redis://localhost:6379"),"keys":["liveness:session:{id}","liveness:device:{fingerprint}","liveness:behavioral:{customer_id}"]},"mojaloop":{"url":ev("MOJALOOP_URL","http://localhost:3002")},"opensearch":{"url":ev("OPENSEARCH_URL","http://localhost:9200")},"openappsec":{"url":ev("OPENAPPSEC_URL","http://localhost:4000")},"apisix":{"url":ev("APISIX_URL","http://localhost:9080")},"tigerbeetle":{"url":ev("TIGERBEETLE_URL","localhost:3000")},"lakehouse":{"url":ev("LAKEHOUSE_URL","http://localhost:8181")}}) }

#[derive(Clone, Serialize, Deserialize)]
struct StepUpConfig { id: String, trigger: String, threshold_ngn: u64, tier_required: u8, liveness_methods: Vec<String>, timeout_seconds: u32, enabled: bool }
#[derive(Clone, Serialize, Deserialize)]
struct BehavioralProfile { id: String, customer_id: String, typing_pattern_hash: String, touch_pressure_avg: f64, session_duration_avg_min: f64, login_time_pattern: String, device_count: u8, anomaly_score: f64, last_updated: String }
#[derive(Clone, Serialize, Deserialize)]
struct DeviceBinding { id: String, customer_id: String, device_fingerprint: String, device_type: String, os_version: String, app_version: String, bound_at: String, last_seen: String, status: String }

fn seed_configs() -> Vec<StepUpConfig> { vec![
    StepUpConfig{id:"SUC-001".into(),trigger:"high_value_transfer".into(),threshold_ngn:5000000,tier_required:2,liveness_methods:vec!["passive_3d".into(),"blink_challenge".into()],timeout_seconds:120,enabled:true},
    StepUpConfig{id:"SUC-002".into(),trigger:"international_transfer".into(),threshold_ngn:0,tier_required:3,liveness_methods:vec!["passive_3d".into(),"face_match".into(),"smile_challenge".into()],timeout_seconds:180,enabled:true},
    StepUpConfig{id:"SUC-003".into(),trigger:"new_beneficiary_large".into(),threshold_ngn:2000000,tier_required:2,liveness_methods:vec!["passive_3d".into()],timeout_seconds:90,enabled:true},
    StepUpConfig{id:"SUC-004".into(),trigger:"periodic_tier3_quarterly".into(),threshold_ngn:0,tier_required:3,liveness_methods:vec!["passive_3d".into(),"face_match".into(),"blink_challenge".into(),"smile_challenge".into(),"head_turn".into()],timeout_seconds:300,enabled:true},
]}
fn seed_profiles() -> Vec<BehavioralProfile> { vec![
    BehavioralProfile{id:"BP-001".into(),customer_id:"CUS-1045".into(),typing_pattern_hash:"sha256:tp_a3f8...".into(),touch_pressure_avg:0.72,session_duration_avg_min:8.5,login_time_pattern:"weekdays_9am_6pm".into(),device_count:2,anomaly_score:0.05,last_updated:"2026-05-12T14:00:00Z".into()},
    BehavioralProfile{id:"BP-002".into(),customer_id:"CUS-2089".into(),typing_pattern_hash:"sha256:tp_b7d4...".into(),touch_pressure_avg:0.68,session_duration_avg_min:12.0,login_time_pattern:"mixed".into(),device_count:3,anomaly_score:0.35,last_updated:"2026-05-11T22:00:00Z".into()},
]}
fn seed_devices() -> Vec<DeviceBinding> { vec![
    DeviceBinding{id:"DB-001".into(),customer_id:"CUS-1045".into(),device_fingerprint:"fp_iphone15_a3f8".into(),device_type:"iPhone 15 Pro".into(),os_version:"iOS 19.1".into(),app_version:"3.2.0".into(),bound_at:"2026-01-15T10:00:00Z".into(),last_seen:"2026-05-12T14:00:00Z".into(),status:"active".into()},
    DeviceBinding{id:"DB-002".into(),customer_id:"CUS-1045".into(),device_fingerprint:"fp_macbook_b7d4".into(),device_type:"MacBook Pro".into(),os_version:"macOS 15.2".into(),app_version:"web".into(),bound_at:"2026-02-01T09:00:00Z".into(),last_seen:"2026-05-12T10:00:00Z".into(),status:"active".into()},
]}

struct St { configs: Mutex<Vec<StepUpConfig>>, profiles: Mutex<Vec<BehavioralProfile>>, devices: Mutex<Vec<DeviceBinding>> }
async fn healthz() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status":"healthy","service":"continuous-liveness-rs","version":"1.0.0","middleware":mw()})) }
async fn get_configs(d: web::Data<St>) -> HttpResponse { let c = d.configs.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*c,"total":c.len()})) }
async fn get_profiles(d: web::Data<St>) -> HttpResponse { let p = d.profiles.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*p,"total":p.len()})) }
async fn get_devices(d: web::Data<St>) -> HttpResponse { let dv = d.devices.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*dv,"total":dv.len()})) }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT","8293").parse().unwrap_or(8293);
    let d = web::Data::new(St{configs:Mutex::new(seed_configs()),profiles:Mutex::new(seed_profiles()),devices:Mutex::new(seed_devices())});
    println!("continuous-liveness-rs listening on :{}",port);
    HttpServer::new(move||App::new().app_data(d.clone()).route("/healthz",web::get().to(healthz)).route("/api/step-up-configs",web::get().to(get_configs)).route("/api/behavioral-profiles",web::get().to(get_profiles)).route("/api/device-bindings",web::get().to(get_devices))).bind(("0.0.0.0",port))?.run().await
}
