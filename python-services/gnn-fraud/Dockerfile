FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors numpy
COPY gnn_fraud_service.py .
EXPOSE 8101
CMD ["python", "gnn_fraud_service.py"]
