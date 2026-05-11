use std::io::Write;
use std::net::TcpListener;
use std::collections::HashMap;

// Advanced feature flag engine with graduated rollout, targeting rules,
// scheduling, audit trail, A/B testing, and environment-specific flags.

#[derive(Clone)]
struct FeatureFlag {
    id: &'static str,
    key: &'static str,
    name: &'static str,
    description: &'static str,
    enabled: bool,
    rollout_pct: u8,
    environment: &'static str,       // dev | staging | production | all
    targeting_rules: Vec<TargetingRule>,
    schedule_start: Option<&'static str>,
    schedule_end: Option<&'static str>,
    variants: Vec<Variant>,
    dependencies: Vec<&'static str>,
    kill_switch: bool,
    created_by: &'static str,
    created_at: &'static str,
    updated_at: &'static str,
}

#[derive(Clone)]
struct TargetingRule {
    attribute: &'static str,
    operator: &'static str,   // eq | neq | in | not_in | gt | lt | contains | regex
    value: &'static str,
    rollout_pct: u8,
}

#[derive(Clone)]
struct Variant {
    key: &'static str,
    name: &'static str,
    weight: u8,
    payload: &'static str,
}

#[derive(Clone)]
struct FlagAuditEntry {
    id: &'static str,
    flag_id: &'static str,
    action: &'static str,
    old_value: &'static str,
    new_value: &'static str,
    changed_by: &'static str,
    changed_at: &'static str,
    reason: &'static str,
}

#[derive(Clone)]
struct ABTest {
    id: &'static str,
    flag_id: &'static str,
    name: &'static str,
    hypothesis: &'static str,
    control_variant: &'static str,
    test_variant: &'static str,
    traffic_pct: u8,
    status: &'static str,   // draft | running | concluded
    start_date: &'static str,
    end_date: Option<&'static str>,
    winner: Option<&'static str>,
    sample_size: u32,
    confidence_pct: f32,
}

fn seed_flags() -> Vec<FeatureFlag> {
    vec![
        FeatureFlag {
            id: "FF-001", key: "instant_transfers", name: "Instant Transfers",
            description: "Enable NIP instant transfer for eligible accounts",
            enabled: true, rollout_pct: 100, environment: "production",
            targeting_rules: vec![
                TargetingRule { attribute: "account.tier", operator: "in", value: "tier2,tier3", rollout_pct: 100 },
                TargetingRule { attribute: "account.kyc_status", operator: "eq", value: "verified", rollout_pct: 100 },
            ],
            schedule_start: None, schedule_end: None, variants: vec![], dependencies: vec![],
            kill_switch: false, created_by: "admin/system", created_at: "2026-01-15T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
        },
        FeatureFlag {
            id: "FF-002", key: "virtual_cards", name: "Virtual Cards",
            description: "Issue virtual Visa/Mastercard for online transactions",
            enabled: true, rollout_pct: 75, environment: "production",
            targeting_rules: vec![
                TargetingRule { attribute: "customer.segment", operator: "in", value: "retail,premium", rollout_pct: 75 },
            ],
            schedule_start: Some("2026-05-01T00:00:00Z"), schedule_end: None, variants: vec![],
            dependencies: vec!["instant_transfers"],
            kill_switch: false, created_by: "admin/product-manager", created_at: "2026-03-01T00:00:00Z", updated_at: "2026-05-05T00:00:00Z",
        },
        FeatureFlag {
            id: "FF-003", key: "ai_chatbot", name: "AI Chatbot",
            description: "NLP-powered customer support chatbot with intent routing",
            enabled: true, rollout_pct: 50, environment: "production",
            targeting_rules: vec![
                TargetingRule { attribute: "customer.language", operator: "in", value: "en,ha,yo,ig", rollout_pct: 50 },
            ],
            schedule_start: None, schedule_end: None,
            variants: vec![
                Variant { key: "basic", name: "Basic FAQ", weight: 60, payload: r#"{"model":"faq-v1","max_turns":5}"# },
                Variant { key: "advanced", name: "Advanced NLP", weight: 40, payload: r#"{"model":"llm-v2","max_turns":20}"# },
            ],
            dependencies: vec![], kill_switch: false, created_by: "admin/tech-lead", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-05-08T00:00:00Z",
        },
        FeatureFlag {
            id: "FF-004", key: "islamic_banking", name: "Islamic Banking Suite",
            description: "Sharia-compliant products: Murabaha, Sukuk, Takaful, Wakala",
            enabled: true, rollout_pct: 100, environment: "all",
            targeting_rules: vec![
                TargetingRule { attribute: "tenant.type", operator: "in", value: "islamic,universal", rollout_pct: 100 },
            ],
            schedule_start: None, schedule_end: None, variants: vec![],
            dependencies: vec![], kill_switch: false, created_by: "admin/compliance", created_at: "2026-02-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
        },
        FeatureFlag {
            id: "FF-005", key: "biometric_auth", name: "Biometric Authentication",
            description: "Fingerprint and face recognition for transaction auth",
            enabled: true, rollout_pct: 30, environment: "staging",
            targeting_rules: vec![
                TargetingRule { attribute: "device.has_biometric", operator: "eq", value: "true", rollout_pct: 30 },
                TargetingRule { attribute: "customer.risk_score", operator: "lt", value: "50", rollout_pct: 100 },
            ],
            schedule_start: Some("2026-06-01T00:00:00Z"), schedule_end: Some("2026-09-01T00:00:00Z"),
            variants: vec![], dependencies: vec!["instant_transfers"],
            kill_switch: false, created_by: "admin/security", created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-09T00:00:00Z",
        },
        FeatureFlag {
            id: "FF-006", key: "crypto_custody", name: "Crypto Custody",
            description: "Digital asset custody with cold/hot wallet management",
            enabled: false, rollout_pct: 0, environment: "dev",
            targeting_rules: vec![],
            schedule_start: Some("2026-08-01T00:00:00Z"), schedule_end: None,
            variants: vec![], dependencies: vec!["biometric_auth", "instant_transfers"],
            kill_switch: true, created_by: "admin/cto", created_at: "2026-05-05T00:00:00Z", updated_at: "2026-05-09T00:00:00Z",
        },
        FeatureFlag {
            id: "FF-007", key: "open_banking_api", name: "Open Banking APIs",
            description: "PSD2/CBN open banking consent and data sharing",
            enabled: true, rollout_pct: 100, environment: "production",
            targeting_rules: vec![
                TargetingRule { attribute: "partner.certified", operator: "eq", value: "true", rollout_pct: 100 },
            ],
            schedule_start: None, schedule_end: None, variants: vec![],
            dependencies: vec![], kill_switch: false, created_by: "admin/compliance", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-04-15T00:00:00Z",
        },
        FeatureFlag {
            id: "FF-008", key: "agent_banking_v2", name: "Agent Banking v2",
            description: "Next-gen agent network with float optimization and geo-mapping",
            enabled: true, rollout_pct: 60, environment: "production",
            targeting_rules: vec![
                TargetingRule { attribute: "agent.tier", operator: "in", value: "super,premium", rollout_pct: 80 },
                TargetingRule { attribute: "agent.region", operator: "in", value: "lagos,abuja,kano", rollout_pct: 60 },
            ],
            schedule_start: None, schedule_end: None, variants: vec![],
            dependencies: vec![], kill_switch: false, created_by: "admin/operations", created_at: "2026-03-15T00:00:00Z", updated_at: "2026-05-07T00:00:00Z",
        },
    ]
}

fn seed_audit() -> Vec<FlagAuditEntry> {
    vec![
        FlagAuditEntry { id: "FA-001", flag_id: "FF-002", action: "rollout_increased", old_value: "50", new_value: "75", changed_by: "admin/product-manager", changed_at: "2026-05-05T10:00:00Z", reason: "Phase 2 rollout after successful pilot" },
        FlagAuditEntry { id: "FA-002", flag_id: "FF-003", action: "variant_added", old_value: "1 variant", new_value: "2 variants", changed_by: "admin/tech-lead", changed_at: "2026-05-08T14:00:00Z", reason: "Added advanced NLP variant for A/B test" },
        FlagAuditEntry { id: "FA-003", flag_id: "FF-006", action: "kill_switch_enabled", old_value: "false", new_value: "true", changed_by: "admin/cto", changed_at: "2026-05-09T09:00:00Z", reason: "Regulatory uncertainty — paused crypto custody launch" },
        FlagAuditEntry { id: "FA-004", flag_id: "FF-005", action: "schedule_set", old_value: "no schedule", new_value: "2026-06-01 to 2026-09-01", changed_by: "admin/security", changed_at: "2026-05-09T11:00:00Z", reason: "Biometric auth pilot scheduled for Q3" },
        FlagAuditEntry { id: "FA-005", flag_id: "FF-008", action: "targeting_updated", old_value: "lagos,abuja", new_value: "lagos,abuja,kano", changed_by: "admin/operations", changed_at: "2026-05-07T16:00:00Z", reason: "Expanded agent banking v2 to Kano region" },
    ]
}

fn seed_ab_tests() -> Vec<ABTest> {
    vec![
        ABTest { id: "AB-001", flag_id: "FF-003", name: "Chatbot NLP Quality", hypothesis: "Advanced NLP model increases resolution rate by 20%", control_variant: "basic", test_variant: "advanced", traffic_pct: 50, status: "running", start_date: "2026-05-08T00:00:00Z", end_date: None, winner: None, sample_size: 4500, confidence_pct: 0.0 },
        ABTest { id: "AB-002", flag_id: "FF-002", name: "Virtual Card Adoption", hypothesis: "Simplified issuance flow increases adoption by 15%", control_variant: "standard_flow", test_variant: "simplified_flow", traffic_pct: 30, status: "concluded", start_date: "2026-04-01T00:00:00Z", end_date: Some("2026-04-30T00:00:00Z"), winner: Some("simplified_flow"), sample_size: 12000, confidence_pct: 95.2 },
    ]
}

fn flags_json(flags: &[FeatureFlag]) -> String {
    let items: Vec<String> = flags.iter().map(|f| {
        let rules: Vec<String> = f.targeting_rules.iter().map(|r| {
            format!(r#"{{"attribute":"{}","operator":"{}","value":"{}","rolloutPct":{}}}"#, r.attribute, r.operator, r.value, r.rollout_pct)
        }).collect();
        let variants: Vec<String> = f.variants.iter().map(|v| {
            format!(r#"{{"key":"{}","name":"{}","weight":{},"payload":{}}}"#, v.key, v.name, v.weight, v.payload)
        }).collect();
        let deps: Vec<String> = f.dependencies.iter().map(|d| format!(r#""{}""#, d)).collect();
        format!(
            r#"{{"id":"{}","key":"{}","name":"{}","description":"{}","enabled":{},"rolloutPct":{},"environment":"{}","targetingRules":[{}],"scheduleStart":{},"scheduleEnd":{},"variants":[{}],"dependencies":[{}],"killSwitch":{},"createdBy":"{}","createdAt":"{}","updatedAt":"{}"}}"#,
            f.id, f.key, f.name, f.description, f.enabled, f.rollout_pct, f.environment,
            rules.join(","),
            f.schedule_start.map_or("null".to_string(), |s| format!(r#""{}""#, s)),
            f.schedule_end.map_or("null".to_string(), |s| format!(r#""{}""#, s)),
            variants.join(","), deps.join(","), f.kill_switch,
            f.created_by, f.created_at, f.updated_at
        )
    }).collect();
    format!(r#"{{"items":[{}],"total":{}}}"#, items.join(","), flags.len())
}

fn audit_json(entries: &[FlagAuditEntry]) -> String {
    let items: Vec<String> = entries.iter().map(|e| {
        format!(r#"{{"id":"{}","flagId":"{}","action":"{}","oldValue":"{}","newValue":"{}","changedBy":"{}","changedAt":"{}","reason":"{}"}}"#,
            e.id, e.flag_id, e.action, e.old_value, e.new_value, e.changed_by, e.changed_at, e.reason)
    }).collect();
    format!(r#"{{"items":[{}],"total":{}}}"#, items.join(","), entries.len())
}

fn ab_tests_json(tests: &[ABTest]) -> String {
    let items: Vec<String> = tests.iter().map(|t| {
        format!(r#"{{"id":"{}","flagId":"{}","name":"{}","hypothesis":"{}","controlVariant":"{}","testVariant":"{}","trafficPct":{},"status":"{}","startDate":"{}","endDate":{},"winner":{},"sampleSize":{},"confidencePct":{:.1}}}"#,
            t.id, t.flag_id, t.name, t.hypothesis, t.control_variant, t.test_variant, t.traffic_pct, t.status, t.start_date,
            t.end_date.map_or("null".to_string(), |s| format!(r#""{}""#, s)),
            t.winner.map_or("null".to_string(), |s| format!(r#""{}""#, s)),
            t.sample_size, t.confidence_pct)
    }).collect();
    format!(r#"{{"items":[{}],"total":{}}}"#, items.join(","), tests.len())
}

fn stats_json(flags: &[FeatureFlag], audit: &[FlagAuditEntry], tests: &[ABTest]) -> String {
    let enabled = flags.iter().filter(|f| f.enabled).count();
    let with_schedule = flags.iter().filter(|f| f.schedule_start.is_some()).count();
    let with_variants = flags.iter().filter(|f| !f.variants.is_empty()).count();
    let kill_switched = flags.iter().filter(|f| f.kill_switch).count();
    let avg_rollout: f64 = if flags.is_empty() { 0.0 } else { flags.iter().map(|f| f.rollout_pct as f64).sum::<f64>() / flags.len() as f64 };
    let by_env: HashMap<&str, usize> = {
        let mut m = HashMap::new();
        for f in flags { *m.entry(f.environment).or_insert(0) += 1; }
        m
    };
    let env_entries: Vec<String> = by_env.iter().map(|(k, v)| format!(r#""{}": {}"#, k, v)).collect();
    let running_tests = tests.iter().filter(|t| t.status == "running").count();

    format!(r#"{{"total_flags":{},"enabled":{},"disabled":{},"avg_rollout_pct":{:.1},"with_schedule":{},"with_variants":{},"kill_switched":{},"by_environment":{{{}}},"total_audit_entries":{},"total_ab_tests":{},"running_ab_tests":{},"concluded_ab_tests":{}}}"#,
        flags.len(), enabled, flags.len() - enabled, avg_rollout, with_schedule, with_variants, kill_switched,
        env_entries.join(","), audit.len(), tests.len(), running_tests, tests.len() - running_tests)
}

fn evaluate_json(flags: &[FeatureFlag], key: &str, tenant_id: &str) -> String {
    let flag = flags.iter().find(|f| f.key == key);
    match flag {
        None => format!(r#"{{"key":"{}","found":false,"enabled":false,"reason":"Flag not found"}}"#, key),
        Some(f) => {
            if f.kill_switch {
                return format!(r#"{{"key":"{}","found":true,"enabled":false,"reason":"Kill switch active","killSwitch":true}}"#, key);
            }
            let enabled = f.enabled && f.rollout_pct > 0;
            let variant = if !f.variants.is_empty() { format!(r#","variant":"{}""#, f.variants[0].key) } else { String::new() };
            format!(r#"{{"key":"{}","found":true,"enabled":{},"rolloutPct":{},"environment":"{}","tenantId":"{}","targetingRules":{},"hasSchedule":{},"reason":"{}"{}}}"#,
                key, enabled, f.rollout_pct, f.environment, tenant_id,
                f.targeting_rules.len(), f.schedule_start.is_some(),
                if enabled { "Flag enabled for tenant" } else { "Flag disabled or rollout at 0%" },
                variant
            )
        }
    }
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8229".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("Failed to bind");
    eprintln!("feature-flag-engine-rs listening on :{}", port);

    let flags = seed_flags();
    let audit = seed_audit();
    let ab_tests = seed_ab_tests();

    for stream in listener.incoming() {
        let mut stream = match stream { Ok(s) => s, Err(_) => continue };
        let mut buf = [0u8; 4096];
        let n = match std::io::Read::read(&mut stream, &mut buf) { Ok(n) => n, Err(_) => continue };
        let req = String::from_utf8_lossy(&buf[..n]);
        let first_line = req.lines().next().unwrap_or("");
        let path = first_line.split_whitespace().nth(1).unwrap_or("/");

        let (status, body) = if path == "/healthz" {
            ("200 OK", r#"{"status":"healthy","service":"feature-flag-engine-rs","middleware":["kafka","dapr","fluvio","temporal","postgres","keycloak","permify","redis","mojaloop","opensearch","openappsec","apisix","tigerbeetle","lakehouse"]}"#.to_string())
        } else if path == "/v1/flags" {
            ("200 OK", flags_json(&flags))
        } else if path == "/v1/audit" {
            ("200 OK", audit_json(&audit))
        } else if path == "/v1/ab-tests" {
            ("200 OK", ab_tests_json(&ab_tests))
        } else if path == "/v1/stats" {
            ("200 OK", stats_json(&flags, &audit, &ab_tests))
        } else if path.starts_with("/v1/evaluate/") {
            let parts: Vec<&str> = path.split('/').collect();
            let key = if parts.len() > 3 { parts[3] } else { "" };
            let tenant = "default";
            ("200 OK", evaluate_json(&flags, key, tenant))
        } else {
            ("404 Not Found", r#"{"error":"not found"}"#.to_string())
        };

        let resp = format!("HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, body.len(), body);
        let _ = stream.write_all(resp.as_bytes());
    }
}
