FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn pydantic
COPY tax_planning_service.py .
EXPOSE 8120
CMD ["uvicorn", "tax_planning_service:app", "--host", "0.0.0.0", "--port", "8120"]
