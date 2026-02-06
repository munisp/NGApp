FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn httpx cryptography pydantic python-multipart

COPY kyb_service.py .

EXPOSE 8111

CMD ["uvicorn", "kyb_service:app", "--host", "0.0.0.0", "--port", "8111"]
