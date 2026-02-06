FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn httpx cryptography pydantic

COPY kyc_unified_service.py .

EXPOSE 8110

CMD ["uvicorn", "kyc_unified_service:app", "--host", "0.0.0.0", "--port", "8110"]
