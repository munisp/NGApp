FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt || \
    pip install --no-cache-dir fastapi uvicorn redis kafka-python psycopg2-binary numpy scikit-learn

# Copy ML models
COPY gnn-models /app/models/gnn
COPY ml-models /app/models/ml
COPY rule-engine /app/rule-engine
COPY integration /app/integration

# Create main application
RUN echo 'from fastapi import FastAPI\n\
import os\n\
\n\
app = FastAPI(title="Fraud Detection Service")\n\
\n\
@app.get("/health")\n\
async def health():\n\
    return {"status": "healthy", "service": "fraud-detection"}\n\
\n\
@app.post("/api/v1/fraud/score")\n\
async def score_transaction(transaction: dict):\n\
    # Placeholder for ML scoring\n\
    return {"score": 0.1, "risk_level": "low", "recommendation": "approve"}\n\
\n\
@app.post("/api/v1/fraud/analyze")\n\
async def analyze_transaction(transaction: dict):\n\
    return {"analysis": "completed", "flags": []}\n\
\n\
if __name__ == "__main__":\n\
    import uvicorn\n\
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("SERVICE_PORT", "8081")))\n\
' > /app/main.py

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Run service
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
