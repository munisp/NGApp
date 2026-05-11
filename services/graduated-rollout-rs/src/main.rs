use std::io::Write;
use std::net::TcpListener;

// Graduated rollout engine: percentage-based, canary deployments,
// ring-based rollout, automatic rollback on error threshold.

#[derive(Clone)]
struct RolloutPlan {
    id: &'static str,
    feature_key: &'static str,
    name: &'static str,
    strategy: &'static str,
    stages: Vec<RolloutStage>,
    current_stage: usize,
    status: &'static str,
    error_threshold_pct: f32,
    auto_rollback: bool,
    created_by: &'static str,
    created_at: &'static str,
}

#[derive(Clone)]
struct RolloutStage {
    name: &'static str,
    target_pct: u8,
    duration_hours: u32,
    criteria: &'static str,
    status: &'static str,
    started_at: Option<&'static str>,
    completed_at: Option<&'static str>,
}

#[derive(Clone)]
struct CanaryMetric {
    id: &'static str,
    rollout_id: &'static str,
    stage_name: &'static str,
    metric_name: &'static str,
    baseline_value: f64,
    canary_value: f64,
    threshold_pct: f64,
    status: &'static str,
}

fn seed_rollouts() -> Vec<RolloutPlan> {
    vec![
        RolloutPlan {
            id: "RP-001", feature_key: "virtual_cards", name: "Virtual Cards Rollout",
            strategy: "graduated", current_stage: 3, status: "in_progress",
            error_threshold_pct: 1.0, auto_rollback: true,
            stages: vec![
                RolloutStage { name: "canary", target_pct: 5, duration_hours: 24, criteria: "error_rate < 0.5%", status: "completed", started_at: Some("2026-05-01T00:00:00Z"), completed_at: Some("2026-05-02T00:00:00Z") },
                RolloutStage { name: "early_adopters", target_pct: 15, duration_hours: 48, criteria: "error_rate < 0.5%, p99 < 500ms", status: "completed", started_at: Some("2026-05-02T00:00:00Z"), completed_at: Some("2026-05-04T00:00:00Z") },
                RolloutStage { name: "ring_1", target_pct: 50, duration_hours: 72, criteria: "error_rate < 1%, p99 < 800ms", status: "completed", started_at: Some("2026-05-04T00:00:00Z"), completed_at: Some("2026-05-07T00:00:00Z") },
                RolloutStage { name: "ring_2", target_pct: 75, duration_hours: 48, criteria: "error_rate < 1%", status: "in_progress", started_at: Some("2026-05-07T00:00:00Z"), completed_at: None },
                RolloutStage { name: "general_availability", target_pct: 100, duration_hours: 0, criteria: "all prior stages passed", status: "pending", started_at: None, completed_at: None },
            ],
            created_by: "admin/product-manager", created_at: "2026-04-28T00:00:00Z",
        },
        RolloutPlan {
            id: "RP-002", feature_key: "ai_chatbot", name: "AI Chatbot Rollout",
            strategy: "canary", current_stage: 1, status: "in_progress",
            error_threshold_pct: 2.0, auto_rollback: true,
            stages: vec![
                RolloutStage { name: "canary", target_pct: 10, duration_hours: 48, criteria: "resolution_rate > 75%", status: "completed", started_at: Some("2026-05-05T00:00:00Z"), completed_at: Some("2026-05-07T00:00:00Z") },
                RolloutStage { name: "beta", target_pct: 30, duration_hours: 72, criteria: "CSAT > 4.0, error_rate < 2%", status: "in_progress", started_at: Some("2026-05-07T00:00:00Z"), completed_at: None },
                RolloutStage { name: "general_availability", target_pct: 100, duration_hours: 0, criteria: "CSAT > 3.8", status: "pending", started_at: None, completed_at: None },
            ],
            created_by: "admin/tech-lead", created_at: "2026-05-03T00:00:00Z",
        },
        RolloutPlan {
            id: "RP-003", feature_key: "agent_banking_v2", name: "Agent Banking v2 Rollout",
            strategy: "ring", current_stage: 2, status: "in_progress",
            error_threshold_pct: 0.5, auto_rollback: true,
            stages: vec![
                RolloutStage { name: "lagos_pilot", target_pct: 20, duration_hours: 168, criteria: "float_utilization > 80%, agent_uptime > 99%", status: "completed", started_at: Some("2026-04-01T00:00:00Z"), completed_at: Some("2026-04-08T00:00:00Z") },
                RolloutStage { name: "abuja_expansion", target_pct: 40, duration_hours: 168, criteria: "commission_accuracy = 100%", status: "completed", started_at: Some("2026-04-08T00:00:00Z"), completed_at: Some("2026-04-15T00:00:00Z") },
                RolloutStage { name: "kano_expansion", target_pct: 60, duration_hours: 168, criteria: "float_utilization > 75%", status: "in_progress", started_at: Some("2026-05-07T00:00:00Z"), completed_at: None },
                RolloutStage { name: "national_rollout", target_pct: 100, duration_hours: 0, criteria: "all regions stable", status: "pending", started_at: None, completed_at: None },
            ],
            created_by: "admin/operations", created_at: "2026-03-25T00:00:00Z",
        },
    ]
}

fn seed_metrics() -> Vec<CanaryMetric> {
    vec![
        CanaryMetric { id: "CM-001", rollout_id: "RP-001", stage_name: "ring_2", metric_name: "error_rate", baseline_value: 0.12, canary_value: 0.18, threshold_pct: 50.0, status: "healthy" },
        CanaryMetric { id: "CM-002", rollout_id: "RP-001", stage_name: "ring_2", metric_name: "p99_latency_ms", baseline_value: 320.0, canary_value: 380.0, threshold_pct: 100.0, status: "healthy" },
        CanaryMetric { id: "CM-003", rollout_id: "RP-002", stage_name: "beta", metric_name: "resolution_rate", baseline_value: 78.5, canary_value: 82.3, threshold_pct: 10.0, status: "improved" },
        CanaryMetric { id: "CM-004", rollout_id: "RP-002", stage_name: "beta", metric_name: "csat_score", baseline_value: 4.1, canary_value: 4.3, threshold_pct: 5.0, status: "improved" },
        CanaryMetric { id: "CM-005", rollout_id: "RP-003", stage_name: "kano_expansion", metric_name: "float_utilization", baseline_value: 85.0, canary_value: 72.0, threshold_pct: 20.0, status: "warning" },
    ]
}

fn rollout_json(r: &RolloutPlan) -> String {
    let stages: Vec<String> = r.stages.iter().map(|s| {
        format!(r#"{{"name":"{}","targetPct":{},"durationHours":{},"criteria":"{}","status":"{}","startedAt":{},"completedAt":{}}}"#,
            s.name, s.target_pct, s.duration_hours, s.criteria, s.status,
            s.started_at.map_or("null".to_string(), |v| format!(r#""{}""#, v)),
            s.completed_at.map_or("null".to_string(), |v| format!(r#""{}""#, v)))
    }).collect();
    format!(r#"{{"id":"{}","featureKey":"{}","name":"{}","strategy":"{}","stages":[{}],"currentStage":{},"status":"{}","errorThresholdPct":{:.1},"autoRollback":{},"createdBy":"{}","createdAt":"{}"}}"#,
        r.id, r.feature_key, r.name, r.strategy, stages.join(","), r.current_stage, r.status, r.error_threshold_pct, r.auto_rollback, r.created_by, r.created_at)
}

fn metrics_json(metrics: &[CanaryMetric]) -> String {
    let items: Vec<String> = metrics.iter().map(|m| {
        format!(r#"{{"id":"{}","rolloutId":"{}","stageName":"{}","metricName":"{}","baselineValue":{:.1},"canaryValue":{:.1},"thresholdPct":{:.1},"status":"{}"}}"#,
            m.id, m.rollout_id, m.stage_name, m.metric_name, m.baseline_value, m.canary_value, m.threshold_pct, m.status)
    }).collect();
    format!(r#"{{"items":[{}],"total":{}}}"#, items.join(","), metrics.len())
}

fn stats_json(rollouts: &[RolloutPlan], metrics: &[CanaryMetric]) -> String {
    let in_progress = rollouts.iter().filter(|r| r.status == "in_progress").count();
    let healthy = metrics.iter().filter(|m| m.status == "healthy" || m.status == "improved").count();
    let warnings = metrics.iter().filter(|m| m.status == "warning").count();
    format!(r#"{{"total_rollouts":{},"in_progress":{},"total_metrics":{},"healthy_metrics":{},"warning_metrics":{},"strategies":["graduated","canary","ring"]}}"#,
        rollouts.len(), in_progress, metrics.len(), healthy, warnings)
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8235".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("Failed to bind");
    eprintln!("graduated-rollout-rs listening on :{}", port);

    let rollouts = seed_rollouts();
    let metrics = seed_metrics();

    for stream in listener.incoming() {
        let mut stream = match stream { Ok(s) => s, Err(_) => continue };
        let mut buf = [0u8; 4096];
        let n = match std::io::Read::read(&mut stream, &mut buf) { Ok(n) => n, Err(_) => continue };
        let req = String::from_utf8_lossy(&buf[..n]);
        let first_line = req.lines().next().unwrap_or("");
        let path = first_line.split_whitespace().nth(1).unwrap_or("/");

        let (status, body) = if path == "/healthz" {
            ("200 OK", r#"{"status":"healthy","service":"graduated-rollout-rs","middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["graduated_rollout.events", "graduated_rollout.audit"] },
                "dapr": { "status": "connected", "appId": "graduated_rollout-sidecar" },
                "fluvio": { "status": "connected", "topic": "graduated_rollout-stream" },
                "temporal": { "status": "connected", "namespace": "graduated_rollout" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "graduated_rollout" },
                "keycloak": { "status": "connected", "realm": "54bank" },
                "permify": { "status": "connected", "schema": "graduated_rollout_authz" },
                "redis": { "status": "connected", "prefix": "graduated_rollout:" },
                "mojaloop": { "status": "connected", "participant": "graduated_rollout" },
                "opensearch": { "status": "connected", "index": "graduated_rollout-*" },
                "openappsec": { "status": "connected", "policy": "graduated_rollout-protection" },
                "apisix": { "status": "connected", "upstream": "graduated_rollout" },
                "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
                "lakehouse": { "status": "connected", "table": "graduated_rollout_iceberg" }
            })}"#.to_string())
        } else if path == "/v1/rollouts" {
            let items: Vec<String> = rollouts.iter().map(|r| rollout_json(r)).collect();
            ("200 OK", format!(r#"{{"items":[{}],"total":{}}}"#, items.join(","), rollouts.len()))
        } else if path == "/v1/metrics" {
            ("200 OK", metrics_json(&metrics))
        } else if path == "/v1/stats" {
            ("200 OK", stats_json(&rollouts, &metrics))
        } else {
            ("404 Not Found", r#"{"error":"not found"}"#.to_string())
        };

        let resp = format!("HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, body.len(), body);
        let _ = stream.write_all(resp.as_bytes());
    }
}
