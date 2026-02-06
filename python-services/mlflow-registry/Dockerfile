FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors numpy
COPY mlflow_registry_service.py .
EXPOSE 8105
CMD ["python", "mlflow_registry_service.py"]
