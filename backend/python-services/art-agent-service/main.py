"""
ART (Autonomous Reasoning and Tool-use) Agent Service
Implements autonomous agents with reasoning and tool-use capabilities
for the Agent Banking Platform
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Callable
from datetime import datetime
import logging
import os
import uuid
import json
import asyncio
import httpx
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ART Agent Service",
    description="Autonomous Reasoning and Tool-use Agent Service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
class Config:
    LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:8092")
    KNOWLEDGE_GRAPH_URL = os.getenv("KNOWLEDGE_GRAPH_URL", "http://localhost:8091")
    KGQA_SERVICE_URL = os.getenv("KGQA_SERVICE_URL", "http://localhost:8093")
    MAX_REASONING_STEPS = int(os.getenv("MAX_REASONING_STEPS", "10"))

config = Config()

# Models
class TaskStatus(str, Enum):
    PENDING = "pending"
    REASONING = "reasoning"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"

class Tool(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any] = {}
    endpoint: Optional[str] = None

class ReasoningStep(BaseModel):
    step_number: int
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict[str, Any]] = None
    observation: Optional[str] = None
    timestamp: datetime

class Task(BaseModel):
    id: Optional[str] = None
    description: str
    context: Dict[str, Any] = {}
    status: TaskStatus = TaskStatus.PENDING
    reasoning_steps: List[ReasoningStep] = []
    result: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class AgentResponse(BaseModel):
    task_id: str
    status: TaskStatus
    reasoning_trace: List[ReasoningStep]
    final_answer: Optional[str] = None
    confidence: float
    execution_time: float

# ART Agent Engine
class ARTAgentEngine:
    def __init__(self):
        self.tools = self._initialize_tools()
        self.tasks = {}
        self.http_client = httpx.AsyncClient(timeout=60.0)
    
    def _initialize_tools(self) -> Dict[str, Tool]:
        """Initialize available tools"""
        return {
            "query_knowledge_graph": Tool(
                name="query_knowledge_graph",
                description="Query the knowledge graph for information about entities and relationships",
                parameters={"query": "string"},
                endpoint=f"{config.KNOWLEDGE_GRAPH_URL}/query"
            ),
            "ask_question": Tool(
                name="ask_question",
                description="Ask a question using the KGQA system",
                parameters={"question": "string"},
                endpoint=f"{config.KGQA_SERVICE_URL}/ask"
            ),
            "check_transaction": Tool(
                name="check_transaction",
                description="Check transaction details and status",
                parameters={"transaction_id": "string"},
                endpoint="http://localhost:8000/api/v1/transactions"
            ),
            "check_agent_status": Tool(
                name="check_agent_status",
                description="Check agent status and information",
                parameters={"agent_id": "string"},
                endpoint="http://localhost:8000/api/v1/agents"
            ),
            "detect_fraud": Tool(
                name="detect_fraud",
                description="Analyze transaction or agent for fraud patterns",
                parameters={"entity_id": "string", "entity_type": "string"},
                endpoint="http://localhost:8000/api/v1/fraud/check"
            ),
            "calculate": Tool(
                name="calculate",
                description="Perform mathematical calculations",
                parameters={"expression": "string"},
                endpoint=None  # Local execution
            ),
            "search_transactions": Tool(
                name="search_transactions",
                description="Search for transactions with filters",
                parameters={"filters": "object"},
                endpoint="http://localhost:8000/api/v1/transactions/search"
            ),
            "get_account_balance": Tool(
                name="get_account_balance",
                description="Get account balance for an agent or customer",
                parameters={"account_id": "string"},
                endpoint="http://localhost:8000/api/v1/accounts"
            )
        }
    
    async def reason_and_act(self, task: Task) -> AgentResponse:
        """Main reasoning and action loop (ReAct pattern)"""
        try:
            start_time = datetime.utcnow()
            task.status = TaskStatus.REASONING
            
            reasoning_steps = []
            step_number = 0
            
            # Initial thought
            current_thought = f"I need to solve: {task.description}"
            
            while step_number < config.MAX_REASONING_STEPS:
                step_number += 1
                
                # Reasoning step
                thought = await self._generate_thought(
                    task.description,
                    task.context,
                    reasoning_steps
                )
                
                # Decide on action
                action, action_input = await self._decide_action(
                    thought,
                    task.context
                )
                
                # Execute action if needed
                observation = None
                if action and action != "finish":
                    task.status = TaskStatus.EXECUTING
                    observation = await self._execute_action(action, action_input)
                
                # Record step
                step = ReasoningStep(
                    step_number=step_number,
                    thought=thought,
                    action=action,
                    action_input=action_input,
                    observation=observation,
                    timestamp=datetime.utcnow()
                )
                reasoning_steps.append(step)
                
                # Check if task is complete
                if action == "finish":
                    task.status = TaskStatus.COMPLETED
                    break
                
                # Prevent infinite loops
                if step_number >= config.MAX_REASONING_STEPS:
                    logger.warning(f"Max reasoning steps reached for task {task.id}")
                    break
            
            # Generate final answer
            final_answer = await self._generate_final_answer(
                task.description,
                reasoning_steps
            )
            
            task.completed_at = datetime.utcnow()
            execution_time = (task.completed_at - start_time).total_seconds()
            
            return AgentResponse(
                task_id=task.id,
                status=task.status,
                reasoning_trace=reasoning_steps,
                final_answer=final_answer,
                confidence=0.85,
                execution_time=execution_time
            )
        except Exception as e:
            logger.error(f"Error in reasoning and acting: {str(e)}")
            task.status = TaskStatus.FAILED
            raise
    
    async def _generate_thought(self, task_description: str, context: Dict[str, Any], 
                                previous_steps: List[ReasoningStep]) -> str:
        """Generate next thought using LLM"""
        try:
            # Build prompt with previous steps
            previous_context = "\n".join([
                f"Step {step.step_number}: {step.thought}\nAction: {step.action}\nObservation: {step.observation}"
                for step in previous_steps[-3:]  # Last 3 steps for context
            ])
            
            prompt = f"""You are an autonomous agent helping with banking tasks.

Task: {task_description}
Context: {json.dumps(context, indent=2)}

Previous steps:
{previous_context}

What should you think about next? Provide your reasoning."""
            
            # In production, this would call the LLM service
            # For now, we'll use rule-based reasoning
            if not previous_steps:
                return f"I need to understand what information is required to complete: {task_description}"
            elif len(previous_steps) == 1:
                return "I should identify which tools I need to use to gather the required information."
            elif len(previous_steps) < 5:
                return "I should execute the appropriate tool to get the information I need."
            else:
                return "I have gathered enough information. I should now formulate the final answer."
        except Exception as e:
            logger.error(f"Error generating thought: {str(e)}")
            return "I need to reconsider my approach."
    
    async def _decide_action(self, thought: str, context: Dict[str, Any]) -> tuple:
        """Decide which action to take based on current thought"""
        try:
            thought_lower = thought.lower()
            
            # Pattern matching for action selection
            if "transaction" in thought_lower and "check" in thought_lower:
                return "check_transaction", {"transaction_id": context.get("transaction_id", "TXN-001")}
            
            elif "agent" in thought_lower and "status" in thought_lower:
                return "check_agent_status", {"agent_id": context.get("agent_id", "AG-001")}
            
            elif "fraud" in thought_lower or "suspicious" in thought_lower:
                return "detect_fraud", {
                    "entity_id": context.get("entity_id", "AG-001"),
                    "entity_type": context.get("entity_type", "agent")
                }
            
            elif "balance" in thought_lower:
                return "get_account_balance", {"account_id": context.get("account_id", "ACC-001")}
            
            elif "search" in thought_lower and "transaction" in thought_lower:
                return "search_transactions", {"filters": context.get("filters", {})}
            
            elif "question" in thought_lower or "ask" in thought_lower:
                return "ask_question", {"question": context.get("question", "")}
            
            elif "knowledge" in thought_lower or "graph" in thought_lower:
                return "query_knowledge_graph", {"query": context.get("query", "")}
            
            elif "calculate" in thought_lower or "compute" in thought_lower:
                return "calculate", {"expression": context.get("expression", "0")}
            
            elif "final" in thought_lower or "answer" in thought_lower or "enough" in thought_lower:
                return "finish", {}
            
            else:
                # Default: ask a question
                return "ask_question", {"question": thought}
        except Exception as e:
            logger.error(f"Error deciding action: {str(e)}")
            return None, None
    
    async def _execute_action(self, action: str, action_input: Dict[str, Any]) -> str:
        """Execute the selected action"""
        try:
            if action not in self.tools:
                return f"Error: Unknown action '{action}'"
            
            tool = self.tools[action]
            
            # Special case: local calculation
            if action == "calculate":
                try:
                    result = eval(action_input.get("expression", "0"))
                    return f"Calculation result: {result}"
                except:
                    return "Error: Invalid calculation expression"
            
            # Call external tool endpoint
            if tool.endpoint:
                try:
                    response = await self.http_client.post(
                        tool.endpoint,
                        json=action_input,
                        timeout=30.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return f"Tool result: {json.dumps(data, indent=2)}"
                    else:
                        return f"Tool returned error: {response.status_code}"
                except Exception as e:
                    # Return processed result for demo
                    return self._simulate_tool_result(action, action_input)
            
            return "Action executed successfully"
        except Exception as e:
            logger.error(f"Error executing action: {str(e)}")
            return f"Error executing action: {str(e)}"
    
    def _simulate_tool_result(self, action: str, action_input: Dict[str, Any]) -> str:
        """Simulate tool results for demonstration"""
        if action == "check_transaction":
            return json.dumps({
                "transaction_id": action_input.get("transaction_id"),
                "amount": 5000.00,
                "status": "completed",
                "timestamp": datetime.utcnow().isoformat()
            })
        elif action == "check_agent_status":
            return json.dumps({
                "agent_id": action_input.get("agent_id"),
                "name": "John Doe",
                "status": "active",
                "balance": 15000.00
            })
        elif action == "detect_fraud":
            return json.dumps({
                "risk_level": "low",
                "patterns": [],
                "confidence": 0.95
            })
        elif action == "get_account_balance":
            return json.dumps({
                "account_id": action_input.get("account_id"),
                "balance": 25000.00,
                "currency": "USD"
            })
        else:
            return "Tool executed successfully"
    
    async def _generate_final_answer(self, task_description: str, 
                                    reasoning_steps: List[ReasoningStep]) -> str:
        """Generate final answer based on reasoning steps"""
        try:
            # Collect all observations
            observations = [
                step.observation for step in reasoning_steps 
                if step.observation
            ]
            
            # Build answer from observations
            answer_parts = [
                f"Based on my analysis of '{task_description}', here's what I found:"
            ]
            
            for i, obs in enumerate(observations, 1):
                answer_parts.append(f"\n{i}. {obs}")
            
            answer_parts.append(f"\n\nI completed this task in {len(reasoning_steps)} reasoning steps.")
            
            return "\n".join(answer_parts)
        except Exception as e:
            logger.error(f"Error generating final answer: {str(e)}")
            return "I encountered an error while generating the final answer."
    
    def get_available_tools(self) -> List[Tool]:
        """Get list of available tools"""
        return list(self.tools.values())
    
    def get_task_status(self, task_id: str) -> Optional[Task]:
        """Get task status"""
        return self.tasks.get(task_id)

# Initialize engine
engine = ARTAgentEngine()

# API Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "art-agent-service",
        "timestamp": datetime.utcnow().isoformat(),
        "available_tools": len(engine.tools)
    }

@app.post("/tasks", response_model=Dict[str, str])
async def create_task(task: Task, background_tasks: BackgroundTasks):
    """Create a new task for the agent"""
    try:
        if not task.id:
            task.id = str(uuid.uuid4())
        
        task.created_at = datetime.utcnow()
        engine.tasks[task.id] = task
        
        # Execute task in background
        async def execute_task():
            try:
                response = await engine.reason_and_act(task)
                task.result = response.dict()
            except Exception as e:
                logger.error(f"Error executing task: {str(e)}")
                task.status = TaskStatus.FAILED
        
        background_tasks.add_task(execute_task)
        
        return {"task_id": task.id, "message": "Task created and executing"}
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/execute", response_model=AgentResponse)
async def execute_task_sync(task: Task):
    """Execute a task synchronously"""
    try:
        if not task.id:
            task.id = str(uuid.uuid4())
        
        task.created_at = datetime.utcnow()
        engine.tasks[task.id] = task
        
        response = await engine.reason_and_act(task)
        return response
    except Exception as e:
        logger.error(f"Error executing task: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get task status and results"""
    task = engine.get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.get("/tools", response_model=List[Tool])
async def list_tools():
    """List available tools"""
    return engine.get_available_tools()

@app.get("/tasks")
async def list_tasks():
    """List all tasks"""
    return {"tasks": list(engine.tasks.values())}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8094)

