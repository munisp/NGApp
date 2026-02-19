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
    Application settings loaded from environment variables.
    Uses pydantic_settings for configuration management.
    """
    # Database configuration
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/./agent_service.db"
    
    # Logging configuration (optional, but good practice)
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings():
    """
    Cached function to get the application settings.
    """
    return Settings()

# Initialize settings
settings = get_settings()

# SQLAlchemy setup
# The connect_args are necessary for SQLite to allow multiple threads to access the database
# which is common in FastAPI/Uvicorn.
engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# SessionLocal is a factory for new Session objects
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get a database session for FastAPI endpoints.
    It ensures the session is closed after the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Example of a simple logger setup (can be expanded)
import logging
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

logger.info(f"Database URL: {settings.DATABASE_URL}")
