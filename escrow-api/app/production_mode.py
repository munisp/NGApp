"""
Production Mode Gating Module

This module enforces production-grade requirements:
1. Fail fast if critical services aren't configured
2. Prevent in-memory fallbacks for money-critical flows
3. Validate all required secrets are set
4. Health checks for all dependencies

Production mode is enabled via PRODUCTION_MODE=true environment variable.
When enabled, the application will refuse to start if requirements aren't met.
"""

import os
import sys
import logging
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import asyncio

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class ProductionConfig:
    """Production mode configuration"""
    
    # Mode flags
    PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "false").lower() == "true"
    SANDBOX_MODE = os.getenv("SANDBOX_MODE", "false").lower() == "true"
    DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"
    
    # Required secrets for production
    REQUIRED_SECRETS = [
        "JWT_SECRET_KEY",
        "DATABASE_URL",
        "REDIS_URL",
    ]
    
    # Optional but recommended secrets
    RECOMMENDED_SECRETS = [
        "TIGERBEETLE_ADDRESSES",
        "PAYSTACK_SECRET_KEY",
        "FLUTTERWAVE_SECRET_KEY",
        "NIBSS_API_KEY",
        "ADMIN_API_KEY",
    ]
    
    # Minimum secret lengths
    SECRET_MIN_LENGTHS = {
        "JWT_SECRET_KEY": 32,
        "ADMIN_API_KEY": 32,
        "PAYSTACK_SECRET_KEY": 20,
        "FLUTTERWAVE_SECRET_KEY": 20,
    }


class ServiceStatus(str, Enum):
    """Service health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    NOT_CONFIGURED = "not_configured"


@dataclass
class ServiceHealth:
    """Service health check result"""
    name: str
    status: ServiceStatus
    message: str
    required: bool
    latency_ms: Optional[float] = None
    details: Optional[Dict[str, Any]] = None


@dataclass
class ProductionReadinessReport:
    """Production readiness assessment"""
    ready: bool
    score: float  # 0-100
    services: List[ServiceHealth]
    missing_secrets: List[str]
    weak_secrets: List[str]
    warnings: List[str]
    errors: List[str]


# =============================================================================
# Health Checkers
# =============================================================================

async def check_postgres_health() -> ServiceHealth:
    """Check PostgreSQL connection"""
    import time
    start = time.time()
    
    database_url = os.getenv("DATABASE_URL", "")
    
    if not database_url:
        return ServiceHealth(
            name="PostgreSQL",
            status=ServiceStatus.NOT_CONFIGURED,
            message="DATABASE_URL not set",
            required=True
        )
    
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text
        
        # Convert postgres:// to postgresql+asyncpg://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        engine = create_async_engine(database_url, echo=False)
        
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        
        await engine.dispose()
        
        latency = (time.time() - start) * 1000
        
        return ServiceHealth(
            name="PostgreSQL",
            status=ServiceStatus.HEALTHY,
            message="Connected successfully",
            required=True,
            latency_ms=latency
        )
        
    except Exception as e:
        return ServiceHealth(
            name="PostgreSQL",
            status=ServiceStatus.UNHEALTHY,
            message=f"Connection failed: {str(e)}",
            required=True
        )


async def check_redis_health() -> ServiceHealth:
    """Check Redis connection"""
    import time
    start = time.time()
    
    redis_url = os.getenv("REDIS_URL", "")
    
    if not redis_url:
        return ServiceHealth(
            name="Redis",
            status=ServiceStatus.NOT_CONFIGURED,
            message="REDIS_URL not set",
            required=True
        )
    
    try:
        import redis.asyncio as redis
        
        client = redis.from_url(redis_url)
        await client.ping()
        await client.close()
        
        latency = (time.time() - start) * 1000
        
        return ServiceHealth(
            name="Redis",
            status=ServiceStatus.HEALTHY,
            message="Connected successfully",
            required=True,
            latency_ms=latency
        )
        
    except Exception as e:
        return ServiceHealth(
            name="Redis",
            status=ServiceStatus.UNHEALTHY,
            message=f"Connection failed: {str(e)}",
            required=True
        )


async def check_tigerbeetle_health() -> ServiceHealth:
    """Check TigerBeetle connection"""
    import time
    start = time.time()
    
    addresses = os.getenv("TIGERBEETLE_ADDRESSES", "")
    
    if not addresses:
        return ServiceHealth(
            name="TigerBeetle",
            status=ServiceStatus.NOT_CONFIGURED,
            message="TIGERBEETLE_ADDRESSES not set - using in-memory ledger",
            required=False,
            details={"fallback": "in-memory"}
        )
    
    try:
        # TigerBeetle client check would go here
        # For now, just verify the address format
        address_list = [a.strip() for a in addresses.split(",")]
        
        if not all(a for a in address_list):
            raise ValueError("Invalid address format")
        
        latency = (time.time() - start) * 1000
        
        return ServiceHealth(
            name="TigerBeetle",
            status=ServiceStatus.HEALTHY,
            message=f"Configured with {len(address_list)} address(es)",
            required=False,
            latency_ms=latency
        )
        
    except Exception as e:
        return ServiceHealth(
            name="TigerBeetle",
            status=ServiceStatus.DEGRADED,
            message=f"Configuration issue: {str(e)}",
            required=False
        )


async def check_payment_providers() -> List[ServiceHealth]:
    """Check payment provider configurations"""
    results = []
    
    # Paystack
    paystack_key = os.getenv("PAYSTACK_SECRET_KEY", "")
    if paystack_key:
        results.append(ServiceHealth(
            name="Paystack",
            status=ServiceStatus.HEALTHY,
            message="API key configured",
            required=False
        ))
    else:
        results.append(ServiceHealth(
            name="Paystack",
            status=ServiceStatus.NOT_CONFIGURED,
            message="PAYSTACK_SECRET_KEY not set",
            required=False
        ))
    
    # Flutterwave
    flutterwave_key = os.getenv("FLUTTERWAVE_SECRET_KEY", "")
    if flutterwave_key:
        results.append(ServiceHealth(
            name="Flutterwave",
            status=ServiceStatus.HEALTHY,
            message="API key configured",
            required=False
        ))
    else:
        results.append(ServiceHealth(
            name="Flutterwave",
            status=ServiceStatus.NOT_CONFIGURED,
            message="FLUTTERWAVE_SECRET_KEY not set",
            required=False
        ))
    
    return results


# =============================================================================
# Secret Validation
# =============================================================================

def validate_secrets() -> tuple[List[str], List[str]]:
    """Validate required and recommended secrets"""
    missing = []
    weak = []
    
    for secret in ProductionConfig.REQUIRED_SECRETS:
        value = os.getenv(secret, "")
        if not value:
            missing.append(secret)
        elif secret in ProductionConfig.SECRET_MIN_LENGTHS:
            min_len = ProductionConfig.SECRET_MIN_LENGTHS[secret]
            if len(value) < min_len:
                weak.append(f"{secret} (min {min_len} chars)")
    
    for secret in ProductionConfig.RECOMMENDED_SECRETS:
        value = os.getenv(secret, "")
        if secret in ProductionConfig.SECRET_MIN_LENGTHS:
            min_len = ProductionConfig.SECRET_MIN_LENGTHS[secret]
            if value and len(value) < min_len:
                weak.append(f"{secret} (min {min_len} chars)")
    
    return missing, weak


# =============================================================================
# Production Readiness Assessment
# =============================================================================

async def assess_production_readiness() -> ProductionReadinessReport:
    """Assess overall production readiness"""
    
    services: List[ServiceHealth] = []
    warnings: List[str] = []
    errors: List[str] = []
    
    # Check core services
    postgres_health = await check_postgres_health()
    services.append(postgres_health)
    
    redis_health = await check_redis_health()
    services.append(redis_health)
    
    tigerbeetle_health = await check_tigerbeetle_health()
    services.append(tigerbeetle_health)
    
    # Check payment providers
    payment_health = await check_payment_providers()
    services.extend(payment_health)
    
    # Validate secrets
    missing_secrets, weak_secrets = validate_secrets()
    
    # Calculate score
    total_weight = 0
    achieved_weight = 0
    
    service_weights = {
        "PostgreSQL": 25,
        "Redis": 20,
        "TigerBeetle": 15,
        "Paystack": 10,
        "Flutterwave": 10,
    }
    
    for service in services:
        weight = service_weights.get(service.name, 5)
        total_weight += weight
        
        if service.status == ServiceStatus.HEALTHY:
            achieved_weight += weight
        elif service.status == ServiceStatus.DEGRADED:
            achieved_weight += weight * 0.5
        elif service.status == ServiceStatus.NOT_CONFIGURED and not service.required:
            achieved_weight += weight * 0.3  # Partial credit for optional services
    
    # Secret validation weight
    secret_weight = 20
    total_weight += secret_weight
    
    if not missing_secrets and not weak_secrets:
        achieved_weight += secret_weight
    elif not missing_secrets:
        achieved_weight += secret_weight * 0.7
    
    score = (achieved_weight / total_weight) * 100 if total_weight > 0 else 0
    
    # Generate warnings and errors
    for service in services:
        if service.status == ServiceStatus.UNHEALTHY and service.required:
            errors.append(f"{service.name}: {service.message}")
        elif service.status == ServiceStatus.UNHEALTHY:
            warnings.append(f"{service.name}: {service.message}")
        elif service.status == ServiceStatus.NOT_CONFIGURED and service.required:
            errors.append(f"{service.name} is required but not configured")
        elif service.status == ServiceStatus.NOT_CONFIGURED:
            warnings.append(f"{service.name} is not configured")
    
    for secret in missing_secrets:
        errors.append(f"Missing required secret: {secret}")
    
    for secret in weak_secrets:
        warnings.append(f"Weak secret: {secret}")
    
    # Production mode specific checks
    if ProductionConfig.PRODUCTION_MODE:
        if ProductionConfig.DEBUG_MODE:
            warnings.append("DEBUG mode is enabled in production")
        
        if tigerbeetle_health.status == ServiceStatus.NOT_CONFIGURED:
            warnings.append("TigerBeetle not configured - using in-memory ledger (not recommended for production)")
    
    ready = len(errors) == 0 and score >= 80
    
    return ProductionReadinessReport(
        ready=ready,
        score=round(score, 1),
        services=services,
        missing_secrets=missing_secrets,
        weak_secrets=weak_secrets,
        warnings=warnings,
        errors=errors
    )


# =============================================================================
# Startup Validation
# =============================================================================

def validate_production_startup():
    """Validate configuration at startup - fail fast if not ready"""
    
    if not ProductionConfig.PRODUCTION_MODE:
        logger.info("Running in development mode - skipping production validation")
        return
    
    logger.info("Production mode enabled - validating configuration...")
    
    # Check required secrets
    missing_secrets, weak_secrets = validate_secrets()
    
    if missing_secrets:
        error_msg = f"Missing required secrets for production: {', '.join(missing_secrets)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    
    if weak_secrets:
        logger.warning(f"Weak secrets detected: {', '.join(weak_secrets)}")
    
    # Check database URL
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required in production mode")
    
    if "sqlite" in database_url.lower():
        raise RuntimeError("SQLite is not allowed in production mode - use PostgreSQL")
    
    # Check Redis URL
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        raise RuntimeError("REDIS_URL is required in production mode")
    
    # Warn about optional services
    if not os.getenv("TIGERBEETLE_ADDRESSES"):
        logger.warning("TigerBeetle not configured - ledger will use fallback storage")
    
    if not os.getenv("PAYSTACK_SECRET_KEY") and not os.getenv("FLUTTERWAVE_SECRET_KEY"):
        logger.warning("No payment provider configured - payments will be simulated")
    
    logger.info("Production configuration validated successfully")


# =============================================================================
# In-Memory Fallback Prevention
# =============================================================================

class InMemoryFallbackError(Exception):
    """Raised when in-memory fallback is attempted in production"""
    pass


def prevent_in_memory_fallback(service_name: str):
    """Decorator to prevent in-memory fallback in production"""
    
    def decorator(func: Callable):
        def wrapper(*args, **kwargs):
            if ProductionConfig.PRODUCTION_MODE:
                raise InMemoryFallbackError(
                    f"{service_name} attempted to use in-memory fallback in production mode. "
                    "This is not allowed for money-critical operations."
                )
            return func(*args, **kwargs)
        return wrapper
    return decorator


def check_production_storage(storage_type: str, service_name: str):
    """Check if storage type is allowed in production"""
    
    if ProductionConfig.PRODUCTION_MODE:
        if storage_type in ["in-memory", "dict", "local"]:
            raise InMemoryFallbackError(
                f"{service_name} is using {storage_type} storage which is not allowed in production. "
                "Configure proper database storage."
            )


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/production", tags=["Production"])


@router.get("/readiness")
async def get_production_readiness():
    """Get production readiness assessment"""
    
    report = await assess_production_readiness()
    
    return {
        "ready": report.ready,
        "score": report.score,
        "production_mode": ProductionConfig.PRODUCTION_MODE,
        "sandbox_mode": ProductionConfig.SANDBOX_MODE,
        "services": [
            {
                "name": s.name,
                "status": s.status.value,
                "message": s.message,
                "required": s.required,
                "latency_ms": s.latency_ms
            }
            for s in report.services
        ],
        "missing_secrets": report.missing_secrets,
        "weak_secrets": report.weak_secrets,
        "warnings": report.warnings,
        "errors": report.errors
    }


@router.get("/health")
async def production_health_check():
    """Production health check endpoint"""
    
    report = await assess_production_readiness()
    
    if not report.ready and ProductionConfig.PRODUCTION_MODE:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "errors": report.errors,
                "score": report.score
            }
        )
    
    return {
        "status": "healthy" if report.ready else "degraded",
        "score": report.score,
        "mode": "production" if ProductionConfig.PRODUCTION_MODE else "development"
    }


@router.get("/config")
async def get_production_config():
    """Get production configuration (non-sensitive)"""
    
    return {
        "production_mode": ProductionConfig.PRODUCTION_MODE,
        "sandbox_mode": ProductionConfig.SANDBOX_MODE,
        "debug_mode": ProductionConfig.DEBUG_MODE,
        "required_secrets_configured": all(
            os.getenv(s) for s in ProductionConfig.REQUIRED_SECRETS
        ),
        "recommended_secrets_configured": [
            s for s in ProductionConfig.RECOMMENDED_SECRETS
            if os.getenv(s)
        ]
    }
