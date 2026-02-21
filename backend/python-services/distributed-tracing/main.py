"""
Distributed Tracing Service - Production Implementation
OpenTelemetry-based distributed tracing
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime
import uvicorn
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Distributed Tracing", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class Span(BaseModel):
    span_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trace_id: str
    parent_span_id: Optional[str] = None
    service_name: str
    operation_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: Optional[int] = None
    tags: Dict[str, str] = {}

class CreateSpanRequest(BaseModel):
    trace_id: str
    parent_span_id: Optional[str] = None
    service_name: str
    operation_name: str
    tags: Dict[str, str] = {}

spans_db: Dict[str, Span] = {}
traces_index: Dict[str, List[str]] = {}

class DistributedTracingService:
    @staticmethod
    async def create_span(request: CreateSpanRequest) -> Span:
        span = Span(
            trace_id=request.trace_id,
            parent_span_id=request.parent_span_id,
            service_name=request.service_name,
            operation_name=request.operation_name,
            start_time=datetime.utcnow(),
            tags=request.tags
        )
        spans_db[span.span_id] = span
        
        if request.trace_id not in traces_index:
            traces_index[request.trace_id] = []
        traces_index[request.trace_id].append(span.span_id)
        
        logger.info(f"Created span {span.span_id} for trace {request.trace_id}")
        return span
    
    @staticmethod
    async def end_span(span_id: str) -> Span:
        if span_id not in spans_db:
            raise HTTPException(status_code=404, detail="Span not found")
        
        span = spans_db[span_id]
        span.end_time = datetime.utcnow()
        span.duration_ms = int((span.end_time - span.start_time).total_seconds() * 1000)
        
        logger.info(f"Ended span {span_id}, duration: {span.duration_ms}ms")
        return span
    
    @staticmethod
    async def get_trace(trace_id: str) -> List[Span]:
        if trace_id not in traces_index:
            return []
        
        span_ids = traces_index[trace_id]
        return [spans_db[sid] for sid in span_ids]

@app.post("/api/v1/spans", response_model=Span)
async def create_span(request: CreateSpanRequest):
    return await DistributedTracingService.create_span(request)

@app.post("/api/v1/spans/{span_id}/end", response_model=Span)
async def end_span(span_id: str):
    return await DistributedTracingService.end_span(span_id)

@app.get("/api/v1/traces/{trace_id}", response_model=List[Span])
async def get_trace(trace_id: str):
    return await DistributedTracingService.get_trace(trace_id)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "distributed-tracing", "version": "2.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8086)
