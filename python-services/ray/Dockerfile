FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors numpy
COPY ray_cluster_service.py .
EXPOSE 8100
CMD ["python", "ray_cluster_service.py"]
