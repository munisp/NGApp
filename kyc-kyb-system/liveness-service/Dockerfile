FROM python:3.11-slim

# Install system dependencies for dlib and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk2.0-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download dlib models
RUN mkdir -p /app/models && \
    wget -q -O /app/models/shape_predictor_68_face_landmarks.dat.bz2 \
        "https://github.com/davisking/dlib-models/raw/master/shape_predictor_68_face_landmarks.dat.bz2" && \
    bunzip2 /app/models/shape_predictor_68_face_landmarks.dat.bz2 && \
    wget -q -O /app/models/dlib_face_recognition_resnet_model_v1.dat.bz2 \
        "https://github.com/davisking/dlib-models/raw/master/dlib_face_recognition_resnet_model_v1.dat.bz2" && \
    bunzip2 /app/models/dlib_face_recognition_resnet_model_v1.dat.bz2

# TinyLiveness ONNX model placeholder
# The model file should be placed at /app/models/tinyliveness_efficientnet_b0.onnx
# Download from: https://github.com/yuvrajraina/TinyLiveness/releases
# Or mount as a volume in production
ENV TINYLIVENESS_MODEL_PATH=/app/models/tinyliveness_efficientnet_b0.onnx

# Copy application
COPY app/ /app/app/

# Upload directory
RUN mkdir -p /app/uploads

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
