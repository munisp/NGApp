FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY services/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir torch-geometric

# Copy service code
COPY services/fraud-detection-service /app/fraud-detection-service

WORKDIR /app/fraud-detection-service

# Create models directory
RUN mkdir -p /app/models

# Expose port
EXPOSE 8002

# Run service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
