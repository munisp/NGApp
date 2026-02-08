FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn numpy
COPY app.py .
CMD ["python", "app.py"]
