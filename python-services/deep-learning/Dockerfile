FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors numpy
COPY deep_learning_service.py .
EXPOSE 8103
CMD ["python", "deep_learning_service.py"]
