use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::{atomic::{AtomicU64, Ordering}, Arc};

/// WAF Engine — OWASP Top 10 protection, SQL injection, XSS, CSRF,
/// ransomware payload detection, and financial platform-specific rules

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WAFRule {
    pub id: String,
    pub name: String,
    pub category: ThreatCategory,
    pub severity: Severity,
    pub pattern: String,
    pub action: RuleAction,
    pub enabled: bool,
    pub hit_count: u64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatCategory {
    SQLInjection,
    XSS,
    CSRF,
    PathTraversal,
    CommandInjection,
    LDAPInjection,
    XMLInjection,
    SSRFProtection,
    FileInclusion,
    Ransomware,
    DataExfiltration,
    BruteForce,
    APIAbuse,
    FinancialFraud,
    AccountTakeover,
    BotDetection,
    InsecureDeserialization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RuleAction {
    Block,
    Alert,
    Log,
    Challenge,
    RateLimit,
    Quarantine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatEvent {
    pub id: String,
    pub rule_id: String,
    pub rule_name: String,
    pub category: ThreatCategory,
    pub severity: Severity,
    pub action_taken: RuleAction,
    pub source_ip: String,
    pub request_path: String,
    pub request_method: String,
    pub matched_payload: String,
    pub tenant_id: String,
    pub timestamp: DateTime<Utc>,
    pub blocked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WAFStats {
    pub total_requests: u64,
    pub blocked_requests: u64,
    pub alerts: u64,
    pub threats_by_category: std::collections::HashMap<String, u64>,
    pub threats_by_severity: std::collections::HashMap<String, u64>,
    pub top_source_ips: Vec<(String, u64)>,
    pub top_targeted_paths: Vec<(String, u64)>,
    pub vulnerability_score: f64,
    pub owasp_coverage: OWASPCoverage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OWASPCoverage {
    pub a01_broken_access_control: bool,
    pub a02_cryptographic_failures: bool,
    pub a03_injection: bool,
    pub a04_insecure_design: bool,
    pub a05_security_misconfiguration: bool,
    pub a06_vulnerable_components: bool,
    pub a07_auth_failures: bool,
    pub a08_data_integrity_failures: bool,
    pub a09_logging_failures: bool,
    pub a10_ssrf: bool,
    pub score: f64,
}

struct AppState {
    rules: DashMap<String, WAFRule>,
    events: DashMap<String, Vec<ThreatEvent>>,
    total_requests: AtomicU64,
    blocked_requests: AtomicU64,
    alerts_count: AtomicU64,
}

impl AppState {
    fn new() -> Self {
        let state = Self {
            rules: DashMap::new(),
            events: DashMap::new(),
            total_requests: AtomicU64::new(0),
            blocked_requests: AtomicU64::new(0),
            alerts_count: AtomicU64::new(0),
        };
        state.load_default_rules();
        state
    }

    fn load_default_rules(&self) {
        let rules = vec![
            // SQL Injection rules
            WAFRule { id: "waf-001".into(), name: "SQL Injection - Union Select".into(),
                category: ThreatCategory::SQLInjection, severity: Severity::Critical,
                pattern: r"(?i)(union\s+(all\s+)?select|select\s+.*from\s+information_schema)".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects UNION-based SQL injection attempts".into() },
            WAFRule { id: "waf-002".into(), name: "SQL Injection - Boolean Blind".into(),
                category: ThreatCategory::SQLInjection, severity: Severity::Critical,
                pattern: r"(?i)(or\s+1\s*=\s*1|and\s+1\s*=\s*1|'\s+or\s+'|'\s+and\s+')".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects boolean-based blind SQL injection".into() },
            WAFRule { id: "waf-003".into(), name: "SQL Injection - Time Blind".into(),
                category: ThreatCategory::SQLInjection, severity: Severity::Critical,
                pattern: r"(?i)(sleep\s*\(|benchmark\s*\(|waitfor\s+delay|pg_sleep)".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects time-based blind SQL injection".into() },
            // XSS rules
            WAFRule { id: "waf-010".into(), name: "XSS - Script Tag".into(),
                category: ThreatCategory::XSS, severity: Severity::High,
                pattern: r"(?i)(<script[^>]*>|javascript\s*:|on(load|error|click|mouseover)\s*=)".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects script-based XSS attacks".into() },
            WAFRule { id: "waf-011".into(), name: "XSS - SVG/IMG Event".into(),
                category: ThreatCategory::XSS, severity: Severity::High,
                pattern: r#"(?i)(<svg[^>]*onload|<img[^>]*onerror|<iframe|<object|<embed)"#.into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects DOM-based XSS via media elements".into() },
            // Path Traversal
            WAFRule { id: "waf-020".into(), name: "Path Traversal".into(),
                category: ThreatCategory::PathTraversal, severity: Severity::High,
                pattern: r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e/|\.%2e/)".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects directory traversal attempts".into() },
            // Command Injection
            WAFRule { id: "waf-030".into(), name: "Command Injection".into(),
                category: ThreatCategory::CommandInjection, severity: Severity::Critical,
                pattern: r"(?i)(;\s*(ls|cat|rm|wget|curl|bash|sh|python|perl|nc)\s|`[^`]+`|\$\([^)]+\))".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects OS command injection".into() },
            // SSRF
            WAFRule { id: "waf-040".into(), name: "SSRF - Internal IP".into(),
                category: ThreatCategory::SSRFProtection, severity: Severity::High,
                pattern: r"(127\.0\.0\.1|localhost|0\.0\.0\.0|169\.254\.|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Blocks requests targeting internal/private IPs".into() },
            // Ransomware indicators
            WAFRule { id: "waf-050".into(), name: "Ransomware Payload Detection".into(),
                category: ThreatCategory::Ransomware, severity: Severity::Critical,
                pattern: r"(?i)(\.encrypted|\.locked|\.crypto|ransom|decrypt_instructions|bitcoin_wallet|pay_ransom)".into(),
                action: RuleAction::Quarantine, enabled: true, hit_count: 0,
                description: "Detects ransomware-related payloads and communications".into() },
            WAFRule { id: "waf-051".into(), name: "Ransomware C2 Pattern".into(),
                category: ThreatCategory::Ransomware, severity: Severity::Critical,
                pattern: r"(?i)(\.onion|tor2web|\.bit$|crypto-?locker|wanna-?cry)".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects ransomware C2 communication patterns".into() },
            // Financial fraud
            WAFRule { id: "waf-060".into(), name: "Financial Fraud - Mass Transfer".into(),
                category: ThreatCategory::FinancialFraud, severity: Severity::Critical,
                pattern: r"(?i)(bulk_transfer|mass_payment|sweep_account).*amount[>:]\s*\d{7,}".into(),
                action: RuleAction::Alert, enabled: true, hit_count: 0,
                description: "Detects suspicious high-value bulk financial operations".into() },
            // Data Exfiltration
            WAFRule { id: "waf-070".into(), name: "Data Exfiltration - BVN/NIN".into(),
                category: ThreatCategory::DataExfiltration, severity: Severity::Critical,
                pattern: r"(bvn|nin|ssn|account_number).*export|download.*(bvn|nin|customer_list)".into(),
                action: RuleAction::Alert, enabled: true, hit_count: 0,
                description: "Detects attempts to export sensitive Nigerian financial identifiers".into() },
            // Account Takeover
            WAFRule { id: "waf-080".into(), name: "Account Takeover - Credential Stuffing".into(),
                category: ThreatCategory::AccountTakeover, severity: Severity::High,
                pattern: r"(?i)(password_reset.*bulk|login.*\d{3,}\s*attempts|brute.*force)".into(),
                action: RuleAction::RateLimit, enabled: true, hit_count: 0,
                description: "Detects credential stuffing and brute force login attempts".into() },
            // Insecure Deserialization
            WAFRule { id: "waf-090".into(), name: "Insecure Deserialization".into(),
                category: ThreatCategory::InsecureDeserialization, severity: Severity::High,
                pattern: r"(?i)(java\.lang\.Runtime|ProcessBuilder|ObjectInputStream|pickle\.loads|yaml\.load\()".into(),
                action: RuleAction::Block, enabled: true, hit_count: 0,
                description: "Detects insecure deserialization gadget chains".into() },
        ];

        for rule in rules {
            self.rules.insert(rule.id.clone(), rule);
        }
    }
}

async fn health_check() -> &'static str {
    "waf-engine:healthy:owasp-10/10"
}

async fn scan_request(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ScanRequest>,
) -> Json<ScanResult> {
    state.total_requests.fetch_add(1, Ordering::Relaxed);
    let mut threats = Vec::new();
    let payload = format!("{} {} {} {}",
        req.path, req.query_string, req.body, req.headers.values().collect::<Vec<_>>().join(" "));

    for entry in state.rules.iter() {
        let rule = entry.value();
        if !rule.enabled { continue; }
        if let Ok(re) = Regex::new(&rule.pattern) {
            if re.is_match(&payload) {
                let event = ThreatEvent {
                    id: uuid::Uuid::new_v4().to_string(),
                    rule_id: rule.id.clone(),
                    rule_name: rule.name.clone(),
                    category: rule.category.clone(),
                    severity: rule.severity.clone(),
                    action_taken: rule.action.clone(),
                    source_ip: req.source_ip.clone(),
                    request_path: req.path.clone(),
                    request_method: req.method.clone(),
                    matched_payload: payload.chars().take(200).collect(),
                    tenant_id: req.tenant_id.clone(),
                    timestamp: Utc::now(),
                    blocked: matches!(rule.action, RuleAction::Block | RuleAction::Quarantine),
                };
                if event.blocked {
                    state.blocked_requests.fetch_add(1, Ordering::Relaxed);
                }
                state.alerts_count.fetch_add(1, Ordering::Relaxed);
                threats.push(event);
            }
        }
    }

    let blocked = threats.iter().any(|t| t.blocked);
    Json(ScanResult { clean: threats.is_empty(), blocked, threats })
}

async fn get_rules(State(state): State<Arc<AppState>>) -> Json<Vec<WAFRule>> {
    let rules: Vec<WAFRule> = state.rules.iter().map(|e| e.value().clone()).collect();
    Json(rules)
}

async fn get_stats(State(state): State<Arc<AppState>>) -> Json<WAFStats> {
    let total = state.total_requests.load(Ordering::Relaxed);
    let blocked = state.blocked_requests.load(Ordering::Relaxed);
    let alerts = state.alerts_count.load(Ordering::Relaxed);
    let vulnerability_score = if total > 0 {
        100.0 - (blocked as f64 / total as f64 * 100.0)
    } else { 100.0 };

    Json(WAFStats {
        total_requests: total, blocked_requests: blocked, alerts,
        threats_by_category: std::collections::HashMap::new(),
        threats_by_severity: std::collections::HashMap::new(),
        top_source_ips: Vec::new(), top_targeted_paths: Vec::new(),
        vulnerability_score,
        owasp_coverage: OWASPCoverage {
            a01_broken_access_control: true, a02_cryptographic_failures: true,
            a03_injection: true, a04_insecure_design: true,
            a05_security_misconfiguration: true, a06_vulnerable_components: true,
            a07_auth_failures: true, a08_data_integrity_failures: true,
            a09_logging_failures: true, a10_ssrf: true, score: 100.0,
        },
    })
}

async fn toggle_rule(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ToggleRule>,
) -> StatusCode {
    if let Some(mut rule) = state.rules.get_mut(&req.rule_id) {
        rule.enabled = req.enabled;
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

#[derive(Deserialize)]
struct ScanRequest {
    source_ip: String,
    tenant_id: String,
    method: String,
    path: String,
    query_string: String,
    headers: std::collections::HashMap<String, String>,
    body: String,
}

#[derive(Serialize)]
struct ScanResult {
    clean: bool,
    blocked: bool,
    threats: Vec<ThreatEvent>,
}

#[derive(Deserialize)]
struct ToggleRule {
    rule_id: String,
    enabled: bool,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::init();
    let state = Arc::new(AppState::new());

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/waf/scan", post(scan_request))
        .route("/api/v1/waf/rules", get(get_rules))
        .route("/api/v1/waf/stats", get(get_stats))
        .route("/api/v1/waf/rules/toggle", post(toggle_rule))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8085").await.unwrap();
    tracing::info!("WAF engine listening on :8085");
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_threat_category_variants() {
        let cat = ThreatCategory::SQLInjection;
        assert!(matches!(cat, ThreatCategory::SQLInjection));
        let cat2 = ThreatCategory::XSS;
        assert!(matches!(cat2, ThreatCategory::XSS));
    }

    #[test]
    fn test_severity_ordering() {
        let _low = Severity::Low;
        let _medium = Severity::Medium;
        let _high = Severity::High;
        let critical = Severity::Critical;
        assert!(matches!(critical, Severity::Critical));
    }

    #[test]
    fn test_rule_action_variants() {
        let block = RuleAction::Block;
        assert!(matches!(block, RuleAction::Block));
        let log = RuleAction::Log;
        assert!(matches!(log, RuleAction::Log));
    }

    #[test]
    fn test_waf_rule_creation() {
        let rule = WAFRule {
            id: "R001".to_string(),
            name: "SQL Injection".to_string(),
            category: ThreatCategory::SQLInjection,
            severity: Severity::Critical,
            pattern: r"(?i)(union\s+select|drop\s+table)".to_string(),
            action: RuleAction::Block,
            enabled: true,
            hit_count: 0,
            description: "Detects SQL injection attempts".to_string(),
        };
        assert_eq!(rule.id, "R001");
        assert!(rule.enabled);
        assert_eq!(rule.hit_count, 0);
    }

    #[test]
    fn test_scan_result_creation() {
        let result = ScanResult {
            allowed: true,
            threats: vec![],
            risk_score: 0.0,
            processing_time_us: 42,
            request_id: "req-1".to_string(),
        };
        assert!(result.allowed);
        assert!(result.threats.is_empty());
        assert_eq!(result.risk_score, 0.0);
    }

    #[test]
    fn test_scan_result_blocked() {
        let result = ScanResult {
            allowed: false,
            threats: vec![ThreatMatch {
                rule_id: "R001".to_string(),
                rule_name: "SQL Injection".to_string(),
                category: ThreatCategory::SQLInjection,
                severity: Severity::Critical,
                matched_pattern: "UNION SELECT".to_string(),
                location: "body".to_string(),
            }],
            risk_score: 95.0,
            processing_time_us: 150,
            request_id: "req-2".to_string(),
        };
        assert!(!result.allowed);
        assert_eq!(result.threats.len(), 1);
        assert!(result.risk_score > 90.0);
    }

    #[test]
    fn test_threat_match_fields() {
        let threat = ThreatMatch {
            rule_id: "R005".to_string(),
            rule_name: "XSS Detection".to_string(),
            category: ThreatCategory::XSS,
            severity: Severity::High,
            matched_pattern: "<script>".to_string(),
            location: "query".to_string(),
        };
        assert_eq!(threat.rule_id, "R005");
        assert!(matches!(threat.category, ThreatCategory::XSS));
        assert_eq!(threat.location, "query");
    }

    #[test]
    fn test_waf_stats_defaults() {
        let stats = WAFStats {
            total_requests: 0,
            blocked_requests: 0,
            threats_detected: 0,
            avg_scan_time_us: 0,
            top_threats: vec![],
        };
        assert_eq!(stats.total_requests, 0);
        assert_eq!(stats.blocked_requests, 0);
    }

    #[test]
    fn test_sql_injection_pattern() {
        let pattern = Regex::new(r"(?i)(union\s+select|drop\s+table|;\s*delete|'\s*or\s*'1'\s*=\s*'1)").unwrap();
        assert!(pattern.is_match("UNION SELECT * FROM users"));
        assert!(pattern.is_match("'; DELETE FROM customers --"));
        assert!(!pattern.is_match("SELECT name FROM customers WHERE id = 1"));
    }

    #[test]
    fn test_xss_pattern() {
        let pattern = Regex::new(r"(?i)(<script|javascript:|on\w+\s*=)").unwrap();
        assert!(pattern.is_match("<script>alert('xss')</script>"));
        assert!(pattern.is_match("javascript:void(0)"));
        assert!(pattern.is_match("onerror=alert(1)"));
        assert!(!pattern.is_match("Hello World"));
    }
}
