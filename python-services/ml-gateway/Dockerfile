FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn pydantic httpx
COPY ml_gateway_service.py .
EXPOSE 8119
CMD ["uvicorn", "ml_gateway_service:app", "--host", "0.0.0.0", "--port", "8119"]
