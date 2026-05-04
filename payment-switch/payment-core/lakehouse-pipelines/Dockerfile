FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including Java for Spark
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    libpq-dev \
    openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Set Java environment
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Copy and install requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt || \
    pip install --no-cache-dir fastapi uvicorn pyspark delta-spark kafka-python psycopg2-binary pandas pyarrow

# Copy pipeline code
COPY spark /app/spark
COPY flink /app/flink
COPY ray /app/ray

# Create main application
RUN echo 'from fastapi import FastAPI\n\
import os\n\
\n\
app = FastAPI(title="Data Pipeline Service")\n\
\n\
@app.get("/health")\n\
async def health():\n\
    return {"status": "healthy", "service": "data-pipeline"}\n\
\n\
@app.get("/api/v1/pipelines")\n\
async def list_pipelines():\n\
    return {"pipelines": ["transaction-etl", "fraud-analytics", "settlement-batch"]}\n\
\n\
@app.post("/api/v1/pipelines/{pipeline_id}/run")\n\
async def run_pipeline(pipeline_id: str):\n\
    return {"pipeline_id": pipeline_id, "status": "started", "job_id": "job-123"}\n\
\n\
@app.get("/api/v1/jobs/{job_id}")\n\
async def get_job_status(job_id: str):\n\
    return {"job_id": job_id, "status": "completed", "progress": 100}\n\
\n\
if __name__ == "__main__":\n\
    import uvicorn\n\
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("SERVICE_PORT", "8082")))\n\
' > /app/main.py

# Create data directory
RUN mkdir -p /app/data

# Expose ports
EXPOSE 8082
EXPOSE 4040

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1

# Run service
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]
