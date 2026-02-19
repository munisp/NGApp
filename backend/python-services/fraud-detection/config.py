from pydantic_settings import BaseSettings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator

# 1. Configuration Settings
class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    """
    DATABASE_URL: str = "sqlite:///./fraud_detection.db"
    
    # ML/Rules Engine Simulation Settings
    ML_MODEL_THRESHOLD: float = 0.75
    RULES_ENGINE_ENABLED: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# 2. Database Setup
# Use connect_args={"check_same_thread": False} for SQLite
engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 3. Dependency Injection
def get_db() -> Generator:
    """
    Dependency to get a database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 4. ML/Rules Engine Dependency (Simulation)
class MLService:
    """
    A simulated Machine Learning and Rules Engine service.
    In a real application, this would be an external service or a complex
    in-memory object.
    """
    def __init__(self, threshold: float, rules_enabled: bool):
        self.threshold = threshold
        self.rules_enabled = rules_enabled

    def score_transaction(self, transaction_data: dict) -> float:
        """
        Simulates an ML model scoring a transaction.
        The score is a random float between 0.0 and 1.0.
        """
        import random
        # Simple heuristic for simulation: higher amount -> higher chance of fraud
        # This is a placeholder for a real ML model prediction
        amount = transaction_data.get("amount", 0.0)
        base_score = random.uniform(0.0, 0.5)
        amount_factor = min(amount / 1000.0, 0.5) # Max 0.5 for $1000+
        score = base_score + amount_factor
        return min(score, 0.99) # Cap at 0.99

    def apply_rules(self, transaction_data: dict) -> list[str]:
        """
        Simulates a rules engine applying rules to a transaction.
        """
        if not self.rules_enabled:
            return []

        rules_triggered = []
        
        # Rule 1: High-value transaction
        if transaction_data.get("amount", 0) > 500:
            rules_triggered.append("RULE_HIGH_VALUE_TRANSACTION")

        # Rule 2: Transaction from a suspicious country (simulated)
        if transaction_data.get("country", "").upper() in ["IR", "KP"]:
            rules_triggered.append("RULE_SUSPICIOUS_COUNTRY")

        # Rule 3: Multiple transactions in a short time (simulated by checking count)
        if transaction_data.get("transaction_count_24h", 0) > 5:
            rules_triggered.append("RULE_VELOCITY_CHECK_FAIL")

        return rules_triggered

    def get_decision(self, ml_score: float, rules_triggered: list[str]) -> tuple[str, str]:
        """
        Combines ML score and rules engine output to make a final decision.
        Returns (decision, reason).
        """
        if ml_score >= self.threshold:
            return "BLOCK", f"ML Score ({ml_score:.2f}) exceeds threshold ({self.threshold:.2f})"
        
        if "RULE_SUSPICIOUS_COUNTRY" in rules_triggered:
            return "BLOCK", "Rules Engine: Suspicious country rule triggered"

        if rules_triggered:
            return "REVIEW", f"Rules Engine: {len(rules_triggered)} rules triggered"

        return "ALLOW", "ML Score below threshold and no critical rules triggered"


def get_ml_service() -> MLService:
    """
    Dependency to get the ML/Rules Engine service instance.
    """
    return MLService(
        threshold=settings.ML_MODEL_THRESHOLD,
        rules_enabled=settings.RULES_ENGINE_ENABLED
    )

# 5. Initialization
def init_db():
    """
    Initializes the database and creates tables.
    This should be called once at application startup.
    """
    # Import models here to ensure they are registered with Base
    from . import models 
    Base.metadata.create_all(bind=engine)

# Note: The actual models import will be relative in a real project structure.
# For this single-file structure, we'll assume the models are in a separate file
# that will be imported by the main application file.
# For the purpose of this task, we'll assume the models are in `models.py`
# and the main app will handle the import.
