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

async fn get_workflow(path: web::Path<String>, state: web::Data<Mutex<AppState>>) -> HttpResponse {
    let wf_id = path.into_inner();
    let s = state.lock().unwrap();
    match s.workflows.get(&wf_id) {
        Some(wf) => HttpResponse::Ok().json(wf),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Workflow not found"})),
    }
}

async fn pause_workflow(path: web::Path<String>, state: web::Data<Mutex<AppState>>) -> HttpResponse {
    let wf_id = path.into_inner();
    let mut s = state.lock().unwrap();
    if let Some(wf) = s.workflows.get_mut(&wf_id) {
        wf.status = "paused".to_string();
        HttpResponse::Ok().json(serde_json::json!({"status": "paused", "workflow_id": wf_id}))
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Workflow not found"}))
    }
}

async fn resume_workflow(path: web::Path<String>, state: web::Data<Mutex<AppState>>) -> HttpResponse {
    let wf_id = path.into_inner();
    let mut s = state.lock().unwrap();
    if let Some(wf) = s.workflows.get_mut(&wf_id) {
        wf.status = "active".to_string();
        HttpResponse::Ok().json(serde_json::json!({"status": "active", "workflow_id": wf_id}))
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Workflow not found"}))
    }
}

async fn list_executions(state: web::Data<Mutex<AppState>>) -> HttpResponse {
    let s = state.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "data": s.executions,
        "total": s.executions.len(),
    }))
}

async fn get_execution(path: web::Path<String>, state: web::Data<Mutex<AppState>>) -> HttpResponse {
    let exec_id = path.into_inner();
    let s = state.lock().unwrap();
    match s.executions.iter().find(|e| e.id == exec_id) {
        Some(exec) => HttpResponse::Ok().json(exec),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Execution not found"})),
    }
}

async fn runtime_stats(state: web::Data<Mutex<AppState>>) -> HttpResponse {
    let s = state.lock().unwrap();
    let total_wf = s.workflows.len();
    let active = s.workflows.values().filter(|w| w.status == "active").count();
    let total_exec = s.executions.len();
    let running = s.executions.iter().filter(|e| e.status == "running").count();
    HttpResponse::Ok().json(serde_json::json!({
        "total_workflows": total_wf,
        "active_workflows": active,
        "total_executions": total_exec,
        "running_executions": running,
        "avg_execution_time_ms": 4200,
        "success_rate": 97.8,
    }))
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "workflow-runtime"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8096".into()).parse::<u16>().unwrap_or(8096);
    println!("Workflow Runtime starting on :{}", port);
    let state = web::Data::new(Mutex::new(AppState {
        workflows: HashMap::new(),
        executions: Vec::new(),
    }));

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/api/v1/workflows", web::get().to(list_workflows))
            .route("/api/v1/workflows", web::post().to(create_workflow))
            .route("/api/v1/workflows/{id}", web::get().to(get_workflow))
            .route("/api/v1/workflows/{id}/execute", web::post().to(execute_workflow))
            .route("/api/v1/workflows/{id}/pause", web::post().to(pause_workflow))
            .route("/api/v1/workflows/{id}/resume", web::post().to(resume_workflow))
            .route("/api/v1/executions", web::get().to(list_executions))
            .route("/api/v1/executions/{id}", web::get().to(get_execution))
            .route("/api/v1/stats", web::get().to(runtime_stats))
            .route("/health", web::get().to(health))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
