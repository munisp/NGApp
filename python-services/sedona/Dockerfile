FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors numpy
COPY sedona_geospatial_service.py .
EXPOSE 8102
CMD ["python", "sedona_geospatial_service.py"]
