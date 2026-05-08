use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::sync::Mutex;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkflowDefinition {
    id: String,
    name: String,
    tenant_id: String,
    trigger: TriggerConfig,
    steps: Vec<WorkflowStep>,
    status: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TriggerConfig {
    trigger_type: String, // time_based, event_based, condition_based, manual
    config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkflowStep {
    id: String,
    step_type: String, // action, condition, wait, parallel
    action: String,    // send_email, create_task, update_record, call_api, run_agent
    config: serde_json::Value,
    next_on_success: Option<String>,
    next_on_failure: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkflowExecution {
    id: String,
    workflow_id: String,
    status: String, // running, completed, failed, paused
    current_step: String,
    started_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
    step_results: Vec<StepResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StepResult {
    step_id: String,
    status: String,
    output: serde_json::Value,
    duration_ms: u64,
    executed_at: DateTime<Utc>,
}

struct AppState {
    workflows: HashMap<String, WorkflowDefinition>,
    executions: Vec<WorkflowExecution>,
}

async fn list_workflows(state: web::Data<Mutex<AppState>>) -> HttpResponse {
    let s = state.lock().unwrap();
    let workflows: Vec<&WorkflowDefinition> = s.workflows.values().collect();
    HttpResponse::Ok().json(serde_json::json!({
        "data": workflows,
        "total": workflows.len()
    }))
}

async fn create_workflow(
    body: web::Json<serde_json::Value>,
    state: web::Data<Mutex<AppState>>,
) -> HttpResponse {
    let id = Uuid::new_v4().to_string();
    let wf = WorkflowDefinition {
        id: id.clone(),
        name: body.get("name").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string(),
        tenant_id: body.get("tenant_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        trigger: TriggerConfig {
            trigger_type: "manual".to_string(),
            config: serde_json::json!({}),
        },
        steps: vec![],
        status: "draft".to_string(),
        created_at: Utc::now(),
    };

    let mut s = state.lock().unwrap();
    s.workflows.insert(id.clone(), wf.clone());
    HttpResponse::Created().json(wf)
}

async fn execute_workflow(
    path: web::Path<String>,
    state: web::Data<Mutex<AppState>>,
) -> HttpResponse {
    let wf_id = path.into_inner();
    let exec = WorkflowExecution {
        id: Uuid::new_v4().to_string(),
        workflow_id: wf_id.clone(),
        status: "running".to_string(),
        current_step: "step-1".to_string(),
        started_at: Utc::now(),
        completed_at: None,
        step_results: vec![],
    };

    let mut s = state.lock().unwrap();
    s.executions.push(exec.clone());
    HttpResponse::Ok().json(exec)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "workflow-runtime"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Workflow Runtime starting on :8096");
    let state = web::Data::new(Mutex::new(AppState {
        workflows: HashMap::new(),
        executions: Vec::new(),
    }));

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/api/v1/workflows", web::get().to(list_workflows))
            .route("/api/v1/workflows", web::post().to(create_workflow))
            .route("/api/v1/workflows/{id}/execute", web::post().to(execute_workflow))
            .route("/health", web::get().to(health))
    })
    .bind("0.0.0.0:8096")?
    .run()
    .await
}
