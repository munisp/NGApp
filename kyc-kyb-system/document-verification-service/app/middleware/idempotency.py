"""
Idempotency Middleware for FastAPI
Ensures that duplicate requests with the same idempotency key return the same response
"""

import hashlib
import json
import redis
from typing import Optional, Callable, Any
from datetime import timedelta
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dataclasses import dataclass, asdict
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class IdempotencyStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class IdempotentResponse:
    status: IdempotencyStatus
    status_code: int
    headers: dict
    body: str
    created_at: str


class IdempotencyService:
    """
    Service for managing idempotent request handling.
    Uses Redis for distributed storage of idempotency keys.
    """
    
    def __init__(
        self,
        redis_host: str = "redis",
        redis_port: int = 6379,
        redis_db: int = 1,
        default_ttl: int = 86400  # 24 hours
    ):
        self.redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            decode_responses=True
        )
        self.default_ttl = default_ttl
        self.key_prefix = "idempotency:"
    
    def _get_key(self, idempotency_key: str, endpoint: str) -> str:
        """Generate Redis key from idempotency key and endpoint"""
        combined = f"{idempotency_key}:{endpoint}"
        return f"{self.key_prefix}{hashlib.sha256(combined.encode()).hexdigest()}"
    
    def get_cached_response(
        self,
        idempotency_key: str,
        endpoint: str
    ) -> Optional[IdempotentResponse]:
        """Retrieve cached response for idempotency key"""
        key = self._get_key(idempotency_key, endpoint)
        cached = self.redis_client.get(key)
        
        if cached:
            data = json.loads(cached)
            return IdempotentResponse(**data)
        return None
    
    def set_processing(
        self,
        idempotency_key: str,
        endpoint: str,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Mark request as processing. Returns True if lock acquired, False if already processing.
        Uses Redis SETNX for atomic operation.
        """
        key = self._get_key(idempotency_key, endpoint)
        lock_key = f"{key}:lock"
        
        acquired = self.redis_client.setnx(lock_key, "1")
        if acquired:
            self.redis_client.expire(lock_key, ttl or 60)  # Lock expires in 60 seconds
        return acquired
    
    def cache_response(
        self,
        idempotency_key: str,
        endpoint: str,
        status_code: int,
        headers: dict,
        body: str,
        ttl: Optional[int] = None
    ):
        """Cache the response for future duplicate requests"""
        from datetime import datetime
        
        key = self._get_key(idempotency_key, endpoint)
        lock_key = f"{key}:lock"
        
        response = IdempotentResponse(
            status=IdempotencyStatus.COMPLETED,
            status_code=status_code,
            headers=headers,
            body=body,
            created_at=datetime.utcnow().isoformat()
        )
        
        self.redis_client.setex(
            key,
            ttl or self.default_ttl,
            json.dumps(asdict(response))
        )
        self.redis_client.delete(lock_key)
    
    def mark_failed(
        self,
        idempotency_key: str,
        endpoint: str
    ):
        """Release the processing lock on failure"""
        key = self._get_key(idempotency_key, endpoint)
        lock_key = f"{key}:lock"
        self.redis_client.delete(lock_key)
    
    def is_processing(
        self,
        idempotency_key: str,
        endpoint: str
    ) -> bool:
        """Check if a request with this key is currently being processed"""
        key = self._get_key(idempotency_key, endpoint)
        lock_key = f"{key}:lock"
        return self.redis_client.exists(lock_key) == 1


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for handling idempotent requests.
    
    Usage:
        app.add_middleware(IdempotencyMiddleware)
    
    Clients should include X-Idempotency-Key header for POST/PUT/PATCH requests.
    """
    
    IDEMPOTENT_METHODS = {"POST", "PUT", "PATCH"}
    HEADER_NAME = "X-Idempotency-Key"
    
    def __init__(self, app, idempotency_service: Optional[IdempotencyService] = None):
        super().__init__(app)
        self.service = idempotency_service or IdempotencyService()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method not in self.IDEMPOTENT_METHODS:
            return await call_next(request)
        
        idempotency_key = request.headers.get(self.HEADER_NAME)
        
        if not idempotency_key:
            return await call_next(request)
        
        endpoint = f"{request.method}:{request.url.path}"
        
        cached = self.service.get_cached_response(idempotency_key, endpoint)
        if cached:
            logger.info(f"Returning cached response for idempotency key: {idempotency_key[:8]}...")
            return JSONResponse(
                status_code=cached.status_code,
                content=json.loads(cached.body) if cached.body else None,
                headers={
                    **cached.headers,
                    "X-Idempotency-Replayed": "true"
                }
            )
        
        if self.service.is_processing(idempotency_key, endpoint):
            return JSONResponse(
                status_code=409,
                content={
                    "error": "Conflict",
                    "message": "A request with this idempotency key is currently being processed"
                }
            )
        
        if not self.service.set_processing(idempotency_key, endpoint):
            return JSONResponse(
                status_code=409,
                content={
                    "error": "Conflict",
                    "message": "A request with this idempotency key is currently being processed"
                }
            )
        
        try:
            response = await call_next(request)
            
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk
            
            headers_dict = dict(response.headers)
            headers_dict.pop("content-length", None)
            
            self.service.cache_response(
                idempotency_key=idempotency_key,
                endpoint=endpoint,
                status_code=response.status_code,
                headers=headers_dict,
                body=response_body.decode("utf-8") if response_body else ""
            )
            
            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=headers_dict,
                media_type=response.media_type
            )
            
        except Exception as e:
            self.service.mark_failed(idempotency_key, endpoint)
            raise


def idempotent(ttl: int = 86400):
    """
    Decorator for making individual endpoints idempotent.
    
    Usage:
        @router.post("/create")
        @idempotent(ttl=3600)
        async def create_item(request: Request, ...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            request: Request = kwargs.get("request")
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                return await func(*args, **kwargs)
            
            idempotency_key = request.headers.get("X-Idempotency-Key")
            if not idempotency_key:
                return await func(*args, **kwargs)
            
            service = IdempotencyService()
            endpoint = f"{request.method}:{request.url.path}"
            
            cached = service.get_cached_response(idempotency_key, endpoint)
            if cached:
                return JSONResponse(
                    status_code=cached.status_code,
                    content=json.loads(cached.body) if cached.body else None,
                    headers={"X-Idempotency-Replayed": "true"}
                )
            
            result = await func(*args, **kwargs)
            return result
        
        return wrapper
    return decorator
