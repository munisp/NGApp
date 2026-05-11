use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }
fn mw() -> serde_json::Value { serde_json::json!({"kafka":{"broker":ev("KAFKA_BROKER","localhost:9092"),"topics":["ubo.graph-updated","ubo.threshold-breach","ubo.circular-detected","ubo.shell-indicator"]},"dapr":{"app_id":"ubo-ownership-graph-rs"},"fluvio":{"url":ev("FLUVIO_URL","localhost:9003")},"temporal":{"url":ev("TEMPORAL_URL","localhost:7233"),"namespace":"ubo-graph"},"postgres":{"url":ev("DATABASE_URL","postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),"tables":["ubo_entities","ubo_edges","ubo_alerts"]},"keycloak":{"url":ev("KEYCLOAK_URL","http://localhost:8080"),"realm":"54bank"},"permify":{"url":ev("PERMIFY_URL","http://localhost:3476")},"redis":{"url":ev("REDIS_URL","redis://localhost:6379")},"mojaloop":{"url":ev("MOJALOOP_URL","http://localhost:3002")},"opensearch":{"url":ev("OPENSEARCH_URL","http://localhost:9200")},"openappsec":{"url":ev("OPENAPPSEC_URL","http://localhost:4000")},"apisix":{"url":ev("APISIX_URL","http://localhost:9080")},"tigerbeetle":{"url":ev("TIGERBEETLE_URL","localhost:3000")},"lakehouse":{"url":ev("LAKEHOUSE_URL","http://localhost:8181")}}) }

#[derive(Clone, Serialize, Deserialize)]
struct UBOEntity { id: String, name: String, entity_type: String, nationality: String, rc_number: Option<String>, bvn: Option<String>, pep_status: bool, sanctions_match: bool, risk_level: String }
#[derive(Clone, Serialize, Deserialize)]
struct OwnershipEdge { id: String, from_entity: String, to_entity: String, ownership_pct: f64, control_type: String, direct: bool, verified: bool }
#[derive(Clone, Serialize, Deserialize)]
struct UBOAlert { id: String, alert_type: String, entity_id: String, entity_name: String, details: String, risk_level: String, created_at: String }

fn seed_entities() -> Vec<UBOEntity> { vec![
    UBOEntity{id:"UE-001".into(),name:"Pinnacle Trading Ltd".into(),entity_type:"company".into(),nationality:"Nigeria".into(),rc_number:Some("RC-123456".into()),bvn:None,pep_status:false,sanctions_match:false,risk_level:"low".into()},
    UBOEntity{id:"UE-002".into(),name:"Emeka Okonkwo".into(),entity_type:"individual".into(),nationality:"Nigeria".into(),rc_number:None,bvn:Some("11122233344".into()),pep_status:false,sanctions_match:false,risk_level:"low".into()},
    UBOEntity{id:"UE-003".into(),name:"Pinnacle Holdings BVI".into(),entity_type:"company".into(),nationality:"British Virgin Islands".into(),rc_number:Some("BVI-78901".into()),bvn:None,pep_status:false,sanctions_match:false,risk_level:"high".into()},
    UBOEntity{id:"UE-004".into(),name:"Quantum Resources Nigeria Ltd".into(),entity_type:"company".into(),nationality:"Nigeria".into(),rc_number:Some("RC-345678".into()),bvn:None,pep_status:false,sanctions_match:true,risk_level:"critical".into()},
    UBOEntity{id:"UE-005".into(),name:"Unknown Nominee A".into(),entity_type:"individual".into(),nationality:"Unknown".into(),rc_number:None,bvn:None,pep_status:false,sanctions_match:false,risk_level:"critical".into()},
    UBOEntity{id:"UE-006".into(),name:"Quantum Holdings Cayman".into(),entity_type:"company".into(),nationality:"Cayman Islands".into(),rc_number:Some("CAY-55555".into()),bvn:None,pep_status:false,sanctions_match:false,risk_level:"high".into()},
]}
fn seed_edges() -> Vec<OwnershipEdge> { vec![
    OwnershipEdge{id:"OE-001".into(),from_entity:"UE-002".into(),to_entity:"UE-001".into(),ownership_pct:60.0,control_type:"direct_shareholding".into(),direct:true,verified:true},
    OwnershipEdge{id:"OE-002".into(),from_entity:"UE-003".into(),to_entity:"UE-001".into(),ownership_pct:40.0,control_type:"direct_shareholding".into(),direct:true,verified:true},
    OwnershipEdge{id:"OE-003".into(),from_entity:"UE-002".into(),to_entity:"UE-003".into(),ownership_pct:100.0,control_type:"indirect_control".into(),direct:false,verified:false},
    OwnershipEdge{id:"OE-004".into(),from_entity:"UE-005".into(),to_entity:"UE-004".into(),ownership_pct:100.0,control_type:"nominee_director".into(),direct:true,verified:false},
    OwnershipEdge{id:"OE-005".into(),from_entity:"UE-006".into(),to_entity:"UE-004".into(),ownership_pct:100.0,control_type:"parent_company".into(),direct:false,verified:false},
    OwnershipEdge{id:"OE-006".into(),from_entity:"UE-004".into(),to_entity:"UE-006".into(),ownership_pct:50.0,control_type:"cross_holding".into(),direct:true,verified:false},
]}
fn seed_alerts() -> Vec<UBOAlert> { vec![
    UBOAlert{id:"UA-001".into(),alert_type:"circular_ownership".into(),entity_id:"UE-004".into(),entity_name:"Quantum Resources → Quantum Holdings Cayman → Quantum Resources".into(),details:"Circular ownership detected: 50% cross-holding between Quantum Resources Nigeria and Quantum Holdings Cayman".into(),risk_level:"critical".into(),created_at:"2026-05-12T10:00:00Z".into()},
    UBOAlert{id:"UA-002".into(),alert_type:"nominee_director".into(),entity_id:"UE-005".into(),entity_name:"Unknown Nominee A".into(),details:"100% ownership by unidentified nominee director — UBO cannot be determined".into(),risk_level:"critical".into(),created_at:"2026-05-12T10:05:00Z".into()},
    UBOAlert{id:"UA-003".into(),alert_type:"tax_haven_jurisdiction".into(),entity_id:"UE-003".into(),entity_name:"Pinnacle Holdings BVI".into(),details:"Parent entity registered in BVI (FATF high-risk jurisdiction) — enhanced due diligence required".into(),risk_level:"high".into(),created_at:"2026-05-12T10:10:00Z".into()},
    UBOAlert{id:"UA-004".into(),alert_type:"25pct_threshold".into(),entity_id:"UE-002".into(),entity_name:"Emeka Okonkwo".into(),details:"UBO identified: 60% direct + 40% indirect (via Pinnacle Holdings BVI) = 100% effective control of Pinnacle Trading Ltd".into(),risk_level:"info".into(),created_at:"2026-05-12T10:15:00Z".into()},
]}

struct St { entities: Mutex<Vec<UBOEntity>>, edges: Mutex<Vec<OwnershipEdge>>, alerts: Mutex<Vec<UBOAlert>> }
async fn healthz() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status":"healthy","service":"ubo-ownership-graph-rs","version":"1.0.0","middleware":mw()})) }
async fn get_entities(d: web::Data<St>) -> HttpResponse { let e = d.entities.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*e,"total":e.len()})) }
async fn get_edges(d: web::Data<St>) -> HttpResponse { let e = d.edges.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*e,"total":e.len()})) }
async fn get_alerts(d: web::Data<St>) -> HttpResponse { let a = d.alerts.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*a,"total":a.len()})) }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT","8288").parse().unwrap_or(8288);
    let d = web::Data::new(St{entities:Mutex::new(seed_entities()),edges:Mutex::new(seed_edges()),alerts:Mutex::new(seed_alerts())});
    println!("ubo-ownership-graph-rs listening on :{}",port);
    HttpServer::new(move||App::new().app_data(d.clone()).route("/healthz",web::get().to(healthz)).route("/api/entities",web::get().to(get_entities)).route("/api/edges",web::get().to(get_edges)).route("/api/alerts",web::get().to(get_alerts))).bind(("0.0.0.0",port))?.run().await
}
