FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn pydantic
COPY insurance_service.py .
EXPOSE 8115
CMD ["uvicorn", "insurance_service:app", "--host", "0.0.0.0", "--port", "8115"]
