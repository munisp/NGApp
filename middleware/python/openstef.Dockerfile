FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for XGBoost
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY openstef_requirements.txt .
RUN pip install --no-cache-dir -r openstef_requirements.txt

COPY openstef_service.py .

ENV RTDIP_API_URL=http://rtdip:8000
ENV OPENSTEF_ENABLED=false
ENV MIN_SAFE_LOAD_KW=200
ENV OPENSTEF_PORT=8001

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python3 -c "import httpx; httpx.get('http://localhost:8001/health').raise_for_status()"

CMD ["python3", "openstef_service.py"]
