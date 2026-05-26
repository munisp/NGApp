FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    numpy pandas pyarrow scikit-learn \
    torch --index-url https://download.pytorch.org/whl/cpu \
    xgboost lightgbm joblib

COPY . /app/training/
COPY ../data /app/data/
COPY ../trained_models /app/trained_models/

ENV PYTHONPATH=/app
ENV MODEL_DIR=/app/trained_models
ENV DATA_DIR=/app/data

# Default: run continuous training pipeline
CMD ["python", "training/continuous_training_pipeline.py", "--mode=scheduled", "--interval=3600"]
