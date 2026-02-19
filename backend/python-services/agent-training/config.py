import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic_settings import BaseSettings, SettingsConfigDict

# --- Configuration Settings ---

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database settings
    DATABASE_URL: str = "postgresql+psycopg2://user:password@db:5432/agent_training_db"
    
    # Service-specific settings
    SERVICE_NAME: str = "agent-training"
    LOG_LEVEL: str = "INFO"

# Load settings
settings = Settings()

# --- Database Setup ---

# Use the database URL from settings
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Create the SQLAlchemy engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    pool_pre_ping=True,
    # connect_args={"check_same_thread": False} # Only needed for SQLite
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for declarative class definitions
Base = declarative_base()

# --- Dependency ---

def get_db() -> Generator:
    """
    Dependency function to get a database session.
    Yields a session and ensures it is closed after the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Logging Setup (Minimal) ---
# In a real production environment, a more robust logging setup would be used.
# This minimal setup ensures the settings are available.

import logging

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(settings.SERVICE_NAME)
logger.setLevel(settings.LOG_LEVEL)
