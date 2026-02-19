import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pydantic_settings import BaseSettings, SettingsConfigDict

# --- Configuration Settings ---

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    """
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database Settings
    DATABASE_URL: str = "sqlite:///./agent_ecommerce_platform.db"
    
    # API Settings
    PROJECT_NAME: str = "Agent E-commerce Platform API"
    API_V1_STR: str = "/api/v1"
    
    # Logging Settings (can be expanded)
    LOG_LEVEL: str = "INFO"

settings = Settings()

# --- Database Setup ---

# Use check_same_thread=False for SQLite in a multi-threaded environment like FastAPI
# For production databases (PostgreSQL, MySQL), this is not needed.
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Dependency ---

def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get a database session.
    A new session is created for each request and closed after the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ensure the directory exists
os.makedirs(os.path.dirname(settings.DATABASE_URL.replace("sqlite:///./", "")), exist_ok=True)

# For SQLite, we can create the database file if it doesn't exist.
if settings.DATABASE_URL.startswith("sqlite"):
    # This is a placeholder to ensure the file is created if needed, 
    # but the actual table creation will happen in models.py
    pass

if __name__ == "__main__":
    print(f"Project Name: {settings.PROJECT_NAME}")
    print(f"Database URL: {settings.DATABASE_URL}")
    # Example of how to use the dependency outside of FastAPI
    with next(get_db()) as db_session:
        print(f"Database session created: {db_session}")
        # db_session.execute(text("SELECT 1")) # Example query
        print("Database session closed.")
