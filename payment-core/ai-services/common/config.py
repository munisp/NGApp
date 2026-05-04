"""
Configuration module for the AI/ML integration services.
"""

import os
from typing import Dict, Any, List, Optional
from pydantic import BaseSettings, Field, validator
import yaml
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class DatabaseSettings(BaseSettings):
    """Database connection settings."""
    
    host: str = Field(..., env="DB_HOST")
    port: int = Field(5432, env="DB_PORT")
    username: str = Field(..., env="DB_USERNAME")
    password: str = Field(..., env="DB_PASSWORD")
    database: str = Field(..., env="DB_NAME")
    schema: str = Field("public", env="DB_SCHEMA")
    pool_size: int = Field(10, env="DB_POOL_SIZE")
    max_overflow: int = Field(20, env="DB_MAX_OVERFLOW")
    pool_timeout: int = Field(30, env="DB_POOL_TIMEOUT")
    pool_recycle: int = Field(1800, env="DB_POOL_RECYCLE")
    
    @property
    def connection_string(self) -> str:
        """Get the database connection string."""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"

class MongoSettings(BaseSettings):
    """MongoDB connection settings."""
    
    host: str = Field(..., env="MONGO_HOST")
    port: int = Field(27017, env="MONGO_PORT")
    username: str = Field(..., env="MONGO_USERNAME")
    password: str = Field(..., env="MONGO_PASSWORD")
    database: str = Field(..., env="MONGO_DATABASE")
    auth_source: str = Field("admin", env="MONGO_AUTH_SOURCE")
    
    @property
    def connection_string(self) -> str:
        """Get the MongoDB connection string."""
        return f"mongodb://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}?authSource={self.auth_source}"

class RedisSettings(BaseSettings):
    """Redis connection settings."""
    
    host: str = Field(..., env="REDIS_HOST")
    port: int = Field(6379, env="REDIS_PORT")
    password: Optional[str] = Field(None, env="REDIS_PASSWORD")
    db: int = Field(0, env="REDIS_DB")
    
    @property
    def connection_string(self) -> str:
        """Get the Redis connection string."""
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"

class KafkaSettings(BaseSettings):
    """Kafka connection settings."""
    
    bootstrap_servers: List[str] = Field(..., env="KAFKA_BOOTSTRAP_SERVERS")
    security_protocol: str = Field("PLAINTEXT", env="KAFKA_SECURITY_PROTOCOL")
    sasl_mechanism: Optional[str] = Field(None, env="KAFKA_SASL_MECHANISM")
    sasl_username: Optional[str] = Field(None, env="KAFKA_SASL_USERNAME")
    sasl_password: Optional[str] = Field(None, env="KAFKA_SASL_PASSWORD")
    
    @validator("bootstrap_servers", pre=True)
    def parse_bootstrap_servers(cls, v):
        """Parse bootstrap servers from string or list."""
        if isinstance(v, str):
            return v.split(",")
        return v

class FalkorDBSettings(BaseSettings):
    """FalkorDB connection settings."""
    
    host: str = Field(..., env="FALKORDB_HOST")
    port: int = Field(6379, env="FALKORDB_PORT")
    password: Optional[str] = Field(None, env="FALKORDB_PASSWORD")
    db: int = Field(0, env="FALKORDB_DB")
    
    @property
    def connection_string(self) -> str:
        """Get the FalkorDB connection string."""
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"

class OllamaSettings(BaseSettings):
    """Ollama connection settings."""
    
    host: str = Field("localhost", env="OLLAMA_HOST")
    port: int = Field(11434, env="OLLAMA_PORT")
    model: str = Field("llama3", env="OLLAMA_MODEL")
    
    @property
    def api_base(self) -> str:
        """Get the Ollama API base URL."""
        return f"http://{self.host}:{self.port}"

class LakehouseSettings(BaseSettings):
    """Lakehouse connection settings."""
    
    storage_path: str = Field(..., env="LAKEHOUSE_STORAGE_PATH")
    catalog_uri: str = Field(..., env="LAKEHOUSE_CATALOG_URI")
    warehouse_uri: str = Field(..., env="LAKEHOUSE_WAREHOUSE_URI")
    
class EPRKGQASettings(BaseSettings):
    """EPR-KGQA connection settings."""
    
    host: str = Field(..., env="EPRKGQA_HOST")
    port: int = Field(8000, env="EPRKGQA_PORT")
    api_key: Optional[str] = Field(None, env="EPRKGQA_API_KEY")
    
    @property
    def api_base(self) -> str:
        """Get the EPR-KGQA API base URL."""
        return f"http://{self.host}:{self.port}"

class GNNSettings(BaseSettings):
    """GNN model settings."""
    
    model_path: str = Field(..., env="GNN_MODEL_PATH")
    embedding_dim: int = Field(128, env="GNN_EMBEDDING_DIM")
    hidden_dim: int = Field(256, env="GNN_HIDDEN_DIM")
    num_layers: int = Field(3, env="GNN_NUM_LAYERS")
    dropout: float = Field(0.2, env="GNN_DROPOUT")
    device: str = Field("cpu", env="GNN_DEVICE")
    batch_size: int = Field(64, env="GNN_BATCH_SIZE")

class APISettings(BaseSettings):
    """API settings."""
    
    host: str = Field("0.0.0.0", env="API_HOST")
    port: int = Field(8000, env="API_PORT")
    debug: bool = Field(False, env="API_DEBUG")
    reload: bool = Field(False, env="API_RELOAD")
    workers: int = Field(1, env="API_WORKERS")
    cors_origins: List[str] = Field(["*"], env="API_CORS_ORIGINS")
    
    @validator("cors_origins", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return v.split(",")
        return v

class SecuritySettings(BaseSettings):
    """Security settings."""
    
    jwt_secret: str = Field(..., env="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    jwt_expiration: int = Field(3600, env="JWT_EXPIRATION")
    api_key: str = Field(..., env="API_KEY")
    keycloak_url: str = Field(..., env="KEYCLOAK_URL")
    keycloak_realm: str = Field(..., env="KEYCLOAK_REALM")
    keycloak_client_id: str = Field(..., env="KEYCLOAK_CLIENT_ID")
    keycloak_client_secret: str = Field(..., env="KEYCLOAK_CLIENT_SECRET")

class LoggingSettings(BaseSettings):
    """Logging settings."""
    
    level: str = Field("INFO", env="LOG_LEVEL")
    format: str = Field("%(asctime)s - %(name)s - %(levelname)s - %(message)s", env="LOG_FORMAT")
    file: Optional[str] = Field(None, env="LOG_FILE")
    
class Settings(BaseSettings):
    """Main application settings."""
    
    environment: str = Field("development", env="ENVIRONMENT")
    app_name: str = Field("banking-crm-ai-integration", env="APP_NAME")
    version: str = Field("0.1.0", env="VERSION")
    
    database: DatabaseSettings = DatabaseSettings()
    mongo: MongoSettings = MongoSettings()
    redis: RedisSettings = RedisSettings()
    kafka: KafkaSettings = KafkaSettings()
    falkordb: FalkorDBSettings = FalkorDBSettings()
    ollama: OllamaSettings = OllamaSettings()
    lakehouse: LakehouseSettings = LakehouseSettings()
    eprkgqa: EPRKGQASettings = EPRKGQASettings()
    gnn: GNNSettings = GNNSettings()
    api: APISettings = APISettings()
    security: SecuritySettings = SecuritySettings()
    logging: LoggingSettings = LoggingSettings()
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

def load_config(config_path: Optional[str] = None) -> Settings:
    """
    Load configuration from environment variables and config file.
    
    Args:
        config_path: Path to the config file.
        
    Returns:
        Settings object.
    """
    # Set environment variables from config file if provided
    if config_path:
        config_path = Path(config_path)
        if config_path.exists():
            with open(config_path, "r") as f:
                config_data = yaml.safe_load(f)
                
            # Flatten nested dictionaries
            flattened_config = {}
            
            def flatten_dict(d, parent_key=""):
                for k, v in d.items():
                    key = f"{parent_key}_{k}" if parent_key else k
                    if isinstance(v, dict):
                        flatten_dict(v, key)
                    else:
                        flattened_config[key.upper()] = v
            
            flatten_dict(config_data)
            
            # Set environment variables
            for key, value in flattened_config.items():
                if isinstance(value, list):
                    os.environ[key] = ",".join(str(v) for v in value)
                else:
                    os.environ[key] = str(value)
    
    # Load settings from environment variables
    return Settings()

# Default configuration instance
config = load_config()

def configure_logging():
    """Configure logging based on settings."""
    logging.basicConfig(
        level=getattr(logging, config.logging.level),
        format=config.logging.format,
        filename=config.logging.file
    )
    
    # Set log levels for noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("aiokafka").setLevel(logging.WARNING)
    
    logger.info(f"Logging configured with level {config.logging.level}")

def get_settings() -> Settings:
    """Get the current settings."""
    return config

