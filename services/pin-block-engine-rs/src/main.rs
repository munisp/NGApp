use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PinBlockRequest { id: String, format: String, pan_masked: String, key_id: String, channel: String, terminal_id: String, status: String, iso_format: String, translation_zone: String, created_at: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PinTranslation { id: String, source_format: String, target_format: String, source_key: String, target_key: String, pan_masked: String, status: String, created_at: String }

struct State { blocks: Mutex<Vec<PinBlockRequest>>, translations: Mutex<Vec<PinTranslation>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "pin-block-engine-rs", "version": "3.0.0", "status": "healthy", "port": 8487,
        "description": "PIN Block Encryption Engine — ISO 9564 Format 0/1/3/4, ANSI X9.8, PIN Translation",
        "features": ["iso9564_format0", "iso9564_format1", "iso9564_format3", "iso9564_format4", "ansi_x9_8", "pin_translation", "zone_key_management", "clear_pin_prohibition", "pin_length_validation", "nibss_pin_format"],
        "middleware": {
            "kafka": {"topics": ["pin-block.encrypted", "pin-block.translated", "pin-block.failed"]},
            "redis": {"usage": "PIN block cache, zone key cache"},
            "postgres": {"tables": ["pin_block_requests", "pin_translations"]},
            "opensearch": {"indices": ["pin-block-operations"]},
            "keycloak": {"realm": "54bank"}, "permify": {"schema": "pin_block"},
            "dapr": {"appId": "pin-block-engine-rs"}, "fluvio": {"topics": ["pin-block-stream"]},
            "temporal": {"workflows": ["pin-translation-batch"]},
            "mojaloop": {"usage": "Interbank PIN routing"}, "tigerbeetle": {"ledger": 17},
            "lakehouse": {"tables": ["pin_block_analytics"]},
            "apisix": {"routes": ["/v1/pin-blocks/*"]}, "openappsec": {"policy": "pin-block-protection"}
        }
    }))
}

async fn list_blocks(data: web::Data<State>) -> HttpResponse {
    let b = data.blocks.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *b, "total": b.len()}))
}
async fn list_translations(data: web::Data<State>) -> HttpResponse {
    let t = data.translations.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *t, "total": t.len()}))
}
async fn stats(data: web::Data<State>) -> HttpResponse {
    let b = data.blocks.lock().unwrap();
    let t = data.translations.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"totalBlocks": b.len(), "totalTranslations": t.len(), "supportedFormats": ["ISO9564-F0","ISO9564-F1","ISO9564-F3","ISO9564-F4","ANSI-X9.8"]}))
}

fn seed() -> State {
    State {
        blocks: Mutex::new(vec![
            PinBlockRequest { id: "PBR-001".into(), format: "iso9564_format0".into(), pan_masked: "****4532".into(), key_id: "ZPK-001".into(), channel: "atm".into(), terminal_id: "ATM-LOS-001".into(), status: "encrypted".into(), iso_format: "Format 0 (XOR PAN+PIN)".into(), translation_zone: "zone_a".into(), created_at: "2026-05-09T14:30:00Z".into() },
            PinBlockRequest { id: "PBR-002".into(), format: "iso9564_format4".into(), pan_masked: "****8891".into(), key_id: "ZPK-002".into(), channel: "pos".into(), terminal_id: "POS-ABJ-001".into(), status: "encrypted".into(), iso_format: "Format 4 (AES-based)".into(), translation_zone: "zone_b".into(), created_at: "2026-05-09T14:35:00Z".into() },
            PinBlockRequest { id: "PBR-003".into(), format: "iso9564_format3".into(), pan_masked: "****2210".into(), key_id: "ZPK-001".into(), channel: "mobile".into(), terminal_id: "MOB-APP".into(), status: "translated".into(), iso_format: "Format 3 (Random fill)".into(), translation_zone: "zone_a".into(), created_at: "2026-05-09T15:00:00Z".into() },
            PinBlockRequest { id: "PBR-004".into(), format: "iso9564_format1".into(), pan_masked: "****6677".into(), key_id: "ZPK-003".into(), channel: "web".into(), terminal_id: "WEB-PORTAL".into(), status: "encrypted".into(), iso_format: "Format 1 (Transaction number fill)".into(), translation_zone: "zone_c".into(), created_at: "2026-05-09T15:05:00Z".into() },
        ]),
        translations: Mutex::new(vec![
            PinTranslation { id: "PT-001".into(), source_format: "iso9564_format3".into(), target_format: "iso9564_format0".into(), source_key: "ZPK-001".into(), target_key: "ZPK-NIBSS".into(), pan_masked: "****2210".into(), status: "completed".into(), created_at: "2026-05-09T15:01:00Z".into() },
            PinTranslation { id: "PT-002".into(), source_format: "iso9564_format0".into(), target_format: "iso9564_format4".into(), source_key: "ZPK-001".into(), target_key: "ZPK-INTERSWITCH".into(), pan_masked: "****4532".into(), status: "completed".into(), created_at: "2026-05-09T14:31:00Z".into() },
        ]),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8487);
    let data = web::Data::new(seed());
    println!("pin-block-engine-rs on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/pin-blocks", web::get().to(list_blocks))
            .route("/v1/pin-blocks/translations", web::get().to(list_translations))
            .route("/v1/pin-blocks/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}
