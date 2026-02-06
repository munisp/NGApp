FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors numpy
COPY realtime_inference_service.py .
EXPOSE 8106
CMD ["python", "realtime_inference_service.py"]
