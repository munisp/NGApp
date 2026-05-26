FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY services/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY services/offline-payments /app/offline-payments

WORKDIR /app/offline-payments

# Expose port
EXPOSE 8004

# Run service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
