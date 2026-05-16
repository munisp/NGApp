from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://kyc_user:kyc_password@postgres:5432/kyc_db"
    REDIS_URL: str = "redis://redis:6379/0"
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"
    DAPR_HTTP_PORT: int = 3500
    DAPR_GRPC_PORT: int = 50001
    
    class Config:
        env_file = ".env"

settings = Settings()
