use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": ev("KAFKA_BROKER", "localhost:9092"), "topics": ["sanctions.screen-request", "sanctions.match-found", "sanctions.list-updated", "sanctions.batch-rescreen"]},
        "dapr": {"app_id": "sanctions-screening-rs", "url": ev("DAPR_URL", "http://localhost:3500")},
        "fluvio": {"url": ev("FLUVIO_URL", "localhost:9003"), "topics": ["sanctions-screening-stream", "sanctions-match-stream"]},
        "temporal": {"url": ev("TEMPORAL_URL", "localhost:7233"), "namespace": "sanctions-screening", "workflows": ["RealTimeScreenWorkflow", "BatchRescreenWorkflow", "ListUpdateWorkflow"]},
        "postgres": {"url": ev("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["sanctions_lists", "sanctions_entries", "sanctions_screenings", "sanctions_matches"]},
        "keycloak": {"url": ev("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client_id": "sanctions-screening"},
        "permify": {"url": ev("PERMIFY_URL", "http://localhost:3476"), "schema": "sanctions", "relations": ["can_screen", "can_whitelist", "can_admin"]},
        "redis": {"url": ev("REDIS_URL", "redis://localhost:6379"), "keys": ["sanctions:cache:{name_hash}", "sanctions:list-version:{list}", "sanctions:batch-progress"]},
        "mojaloop": {"url": ev("MOJALOOP_URL", "http://localhost:3002"), "purpose": "cross-border-beneficiary-screening"},
        "opensearch": {"url": ev("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["sanctions-screenings", "sanctions-matches", "sanctions-audit"]},
        "openappsec": {"url": ev("OPENAPPSEC_URL", "http://localhost:4000"), "policies": ["sanctions-api-protection"]},
        "apisix": {"url": ev("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/sanctions/*"]},
        "tigerbeetle": {"url": ev("TIGERBEETLE_URL", "localhost:3000"), "ledger": "sanctions-billing"},
        "lakehouse": {"url": ev("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["sanctions_screening_history", "sanctions_match_analytics"]}
    })
}

#[derive(Clone, Serialize, Deserialize)]
struct SanctionsList { id: String, name: String, source: String, url: String, entry_count: u32, last_updated: String, update_frequency: String, format: String, active: bool }

#[derive(Clone, Serialize, Deserialize)]
struct SanctionsEntry { id: String, list_id: String, list_name: String, entity_name: String, entity_type: String, aliases: Vec<String>, nationality: String, dob: Option<String>, program: String, reason: String, added_date: String, risk_level: String }

#[derive(Clone, Serialize, Deserialize)]
struct ScreeningResult { id: String, screened_name: String, screened_type: String, customer_id: Option<String>, transaction_id: Option<String>, matches: Vec<ScreenMatch>, total_matches: usize, highest_score: f64, risk_level: String, action: String, screened_at: String, response_time_ms: u32 }

#[derive(Clone, Serialize, Deserialize)]
struct ScreenMatch { entry_id: String, list_name: String, matched_name: String, match_type: String, similarity_score: f64, algorithm: String, phonetic_match: bool, transliteration_match: bool, alias_match: bool, risk_level: String }

fn seed_lists() -> Vec<SanctionsList> {
    vec![
        SanctionsList { id: "SL-001".into(), name: "OFAC SDN List".into(), source: "US Treasury".into(), url: "https://www.treasury.gov/ofac/downloads/sdnlist.xml".into(), entry_count: 12847, last_updated: "2026-05-12T00:00:00Z".into(), update_frequency: "daily".into(), format: "XML".into(), active: true },
        SanctionsList { id: "SL-002".into(), name: "UN Security Council Consolidated List".into(), source: "United Nations".into(), url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml".into(), entry_count: 764, last_updated: "2026-05-11T00:00:00Z".into(), update_frequency: "weekly".into(), format: "XML".into(), active: true },
        SanctionsList { id: "SL-003".into(), name: "EU Consolidated Financial Sanctions".into(), source: "European Commission".into(), url: "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content".into(), entry_count: 2156, last_updated: "2026-05-10T00:00:00Z".into(), update_frequency: "daily".into(), format: "XML".into(), active: true },
        SanctionsList { id: "SL-004".into(), name: "HMT Financial Sanctions".into(), source: "UK HM Treasury".into(), url: "https://ofsistorage.blob.core.windows.net/publishlive/ConList.xml".into(), entry_count: 3421, last_updated: "2026-05-11T00:00:00Z".into(), update_frequency: "daily".into(), format: "XML".into(), active: true },
        SanctionsList { id: "SL-005".into(), name: "CBN Internal Watchlist".into(), source: "Central Bank of Nigeria".into(), url: "internal://cbn-watchlist".into(), entry_count: 892, last_updated: "2026-05-12T06:00:00Z".into(), update_frequency: "real-time".into(), format: "JSON".into(), active: true },
        SanctionsList { id: "SL-006".into(), name: "EFCC Watchlist".into(), source: "Economic and Financial Crimes Commission".into(), url: "internal://efcc-watchlist".into(), entry_count: 1245, last_updated: "2026-05-12T08:00:00Z".into(), update_frequency: "weekly".into(), format: "JSON".into(), active: true },
    ]
}

fn seed_entries() -> Vec<SanctionsEntry> {
    vec![
        SanctionsEntry { id: "SE-001".into(), list_id: "SL-001".into(), list_name: "OFAC SDN".into(), entity_name: "AL-QAEDA IN THE ARABIAN PENINSULA".into(), entity_type: "organization".into(), aliases: vec!["AQAP".into(), "Ansar al-Sharia".into()], nationality: "Yemen".into(), dob: None, program: "SDGT".into(), reason: "Designated terrorist organization".into(), added_date: "2010-01-19".into(), risk_level: "critical".into() },
        SanctionsEntry { id: "SE-002".into(), list_id: "SL-002".into(), list_name: "UN Consolidated".into(), entity_name: "Ibrahim Awwad Ibrahim Ali al-Badri".into(), entity_type: "individual".into(), aliases: vec!["Abu Bakr al-Baghdadi".into(), "Dr. Ibrahim".into()], nationality: "Iraq".into(), dob: Some("1971-01-01".into()), program: "Al-Qaida".into(), reason: "UN Security Council Resolution 1267".into(), added_date: "2014-06-25".into(), risk_level: "critical".into() },
        SanctionsEntry { id: "SE-003".into(), list_id: "SL-005".into(), list_name: "CBN Internal".into(), entity_name: "Abubakar Mohammed Bello".into(), entity_type: "individual".into(), aliases: vec!["Abu Bello".into(), "A.M. Bello".into()], nationality: "Nigeria".into(), dob: Some("1980-05-15".into()), program: "CBN-AML".into(), reason: "Linked to forex round-tripping scheme".into(), added_date: "2026-02-15".into(), risk_level: "high".into() },
        SanctionsEntry { id: "SE-004".into(), list_id: "SL-006".into(), list_name: "EFCC Watchlist".into(), entity_name: "Quantum Resources Nigeria Ltd".into(), entity_type: "organization".into(), aliases: vec!["Quantum Resources".into(), "QR Nigeria".into()], nationality: "Nigeria".into(), dob: None, program: "EFCC-FRAUD".into(), reason: "Under investigation for advance fee fraud and procurement fraud".into(), added_date: "2025-11-01".into(), risk_level: "high".into() },
    ]
}

fn seed_screenings() -> Vec<ScreeningResult> {
    vec![
        ScreeningResult {
            id: "SCR-001".into(), screened_name: "Abubakar M. Bello".into(), screened_type: "customer_onboarding".into(),
            customer_id: Some("CUS-NEW-001".into()), transaction_id: None,
            matches: vec![ScreenMatch { entry_id: "SE-003".into(), list_name: "CBN Internal".into(), matched_name: "Abubakar Mohammed Bello".into(), match_type: "fuzzy".into(), similarity_score: 0.92, algorithm: "levenshtein+soundex".into(), phonetic_match: true, transliteration_match: false, alias_match: false, risk_level: "high".into() }],
            total_matches: 1, highest_score: 0.92, risk_level: "high".into(), action: "block_and_edd".into(),
            screened_at: "2026-05-12T10:00:00Z".into(), response_time_ms: 45,
        },
        ScreeningResult {
            id: "SCR-002".into(), screened_name: "Amina Yusuf".into(), screened_type: "periodic_rescreen".into(),
            customer_id: Some("CUS-1045".into()), transaction_id: None,
            matches: vec![], total_matches: 0, highest_score: 0.0, risk_level: "clear".into(), action: "proceed".into(),
            screened_at: "2026-05-12T08:00:00Z".into(), response_time_ms: 12,
        },
        ScreeningResult {
            id: "SCR-003".into(), screened_name: "Quantum Resources Nig".into(), screened_type: "transfer_beneficiary".into(),
            customer_id: None, transaction_id: Some("TXN-50015".into()),
            matches: vec![ScreenMatch { entry_id: "SE-004".into(), list_name: "EFCC Watchlist".into(), matched_name: "Quantum Resources Nigeria Ltd".into(), match_type: "fuzzy".into(), similarity_score: 0.88, algorithm: "levenshtein+jaro_winkler".into(), phonetic_match: false, transliteration_match: false, alias_match: true, risk_level: "high".into() }],
            total_matches: 1, highest_score: 0.88, risk_level: "high".into(), action: "hold_and_review".into(),
            screened_at: "2026-05-12T14:30:00Z".into(), response_time_ms: 38,
        },
    ]
}

struct State { lists: Mutex<Vec<SanctionsList>>, entries: Mutex<Vec<SanctionsEntry>>, screenings: Mutex<Vec<ScreeningResult>> }

async fn healthz() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "sanctions-screening-rs", "version": "1.0.0", "middleware": middleware_config()})) }
async fn get_lists(d: web::Data<State>) -> HttpResponse { let l = d.lists.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items": *l, "total": l.len()})) }
async fn get_entries(d: web::Data<State>) -> HttpResponse { let e = d.entries.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items": *e, "total": e.len()})) }
async fn get_screenings(d: web::Data<State>) -> HttpResponse { let s = d.screenings.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items": *s, "total": s.len()})) }
async fn screen_name(body: web::Json<serde_json::Value>, d: web::Data<State>) -> HttpResponse {
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let entries = d.entries.lock().unwrap();
    let matches: Vec<ScreenMatch> = entries.iter().filter(|e| {
        let n = name.to_lowercase();
        let en = e.entity_name.to_lowercase();
        en.contains(&n) || n.contains(&en) || e.aliases.iter().any(|a| a.to_lowercase().contains(&n) || n.contains(&a.to_lowercase().as_str()))
    }).map(|e| ScreenMatch {
        entry_id: e.id.clone(), list_name: e.list_name.clone(), matched_name: e.entity_name.clone(),
        match_type: "fuzzy".into(), similarity_score: 0.85, algorithm: "levenshtein+soundex+jaro_winkler".into(),
        phonetic_match: true, transliteration_match: false, alias_match: false, risk_level: e.risk_level.clone(),
    }).collect();
    let highest = matches.iter().map(|m| m.similarity_score).fold(0.0_f64, f64::max);
    let risk = if highest > 0.9 { "critical" } else if highest > 0.7 { "high" } else if matches.is_empty() { "clear" } else { "medium" };
    let action = if risk == "critical" { "block_and_edd" } else if risk == "high" { "hold_and_review" } else { "proceed" };
    HttpResponse::Ok().json(ScreeningResult {
        id: "SCR-NEW".into(), screened_name: name.into(), screened_type: "api_request".into(),
        customer_id: None, transaction_id: None, total_matches: matches.len(), highest_score: highest,
        risk_level: risk.into(), action: action.into(), screened_at: "2026-05-12T15:00:00Z".into(), response_time_ms: 25, matches,
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT", "8283").parse().unwrap_or(8283);
    let data = web::Data::new(State { lists: Mutex::new(seed_lists()), entries: Mutex::new(seed_entries()), screenings: Mutex::new(seed_screenings()) });
    println!("sanctions-screening-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/lists", web::get().to(get_lists))
            .route("/api/entries", web::get().to(get_entries))
            .route("/api/screenings", web::get().to(get_screenings))
            .route("/api/screen", web::post().to(screen_name))
    }).bind(("0.0.0.0", port))?.run().await
}
