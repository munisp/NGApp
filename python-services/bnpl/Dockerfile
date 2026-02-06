FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn httpx pydantic

COPY bnpl_service.py .

EXPOSE 8112

CMD ["uvicorn", "bnpl_service:app", "--host", "0.0.0.0", "--port", "8112"]
