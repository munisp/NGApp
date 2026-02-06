FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors numpy
COPY feature_store_service.py .
EXPOSE 8104
CMD ["python", "feature_store_service.py"]
