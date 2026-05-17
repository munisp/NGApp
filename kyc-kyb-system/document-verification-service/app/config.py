from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://kyc_user:kyc_password@postgres:5432/kyc_db"
    REDIS_URL: str = "redis://redis:6379/0"
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"
    DAPR_HTTP_PORT: int = 3500
    DAPR_GRPC_PORT: int = 50001
    
    # NIMC (NIN Verification) API Configuration
    NIMC_API_URL: Optional[str] = "https://api.nimc.gov.ng/v1"
    NIMC_API_KEY: Optional[str] = None
    NIMC_SECRET_KEY: Optional[str] = None
    
    # NIBSS (BVN Verification) API Configuration
    NIBSS_API_URL: Optional[str] = "https://api.nibss-plc.com.ng/bvn/v2"
    NIBSS_API_KEY: Optional[str] = None
    NIBSS_SECRET_KEY: Optional[str] = None
    NIBSS_ORGANIZATION_CODE: Optional[str] = None
    
    # Redis Configuration
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    
    # Webhook Configuration
    WEBHOOK_SECRET: Optional[str] = None
    WEBHOOK_RETRY_COUNT: int = 3
    WEBHOOK_TIMEOUT: int = 30
    
    class Config:
        env_file = ".env"


settings = Settings()
