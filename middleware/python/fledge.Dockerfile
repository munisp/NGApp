FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn httpx pydantic aiokafka

COPY fledge_bridge.py .

EXPOSE 8001

CMD ["python", "fledge_bridge.py"]
