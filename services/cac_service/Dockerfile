FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 9006

ENV PYTHONUNBUFFERED=1
ENV CAC_USE_MOCK=false
ENV CAC_ENVIRONMENT=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9006/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9006"]
