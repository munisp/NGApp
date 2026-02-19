import os
from functools import lru_cache
from typing import Generator

from pydantic_settings import BaseSettings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Define the base directory for the application
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    """
    # Database settings
    DATABASE_URL: str = "sqlite:///./art_agent_service.db"
    
    # Application settings
    SERVICE_NAME: str = "art-agent-service"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings object.
    """
    return Settings()

# Initialize settings
settings = get_settings()

# Configure SQLAlchemy engine
# The connect_args are only needed for SQLite
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
engine = create_engine(
    settings.DATABASE_URL, 
    **connect_args
)

# Configure SessionLocal
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get a database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
