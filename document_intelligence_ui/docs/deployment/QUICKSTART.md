# Document Intelligence Platform - Quick Start

## Archive Contents

- `document_intelligence_ui/` - Node.js/React web application
- `document_intelligence_platform/` - Python backend services (OCR, Lakehouse, Ingestion)

## Setup

### 1. Python Backend (Port 8001 & 8002)

```bash
cd document_intelligence_platform
pip install -r requirements.txt
python ocr_pipeline/ensemble_ocr_service.py  # Port 8001
python platform_api_gateway.py               # Port 8002
```

### 2. Node.js UI (Port 3000)

```bash
cd document_intelligence_ui
pnpm install
pnpm db:push
pnpm dev
```

### 3. Environment Variables

Set in UI Settings → Secrets:
- `OCR_SERVICE_URL=http://localhost:8001`
- `PYTHON_API_URL=http://localhost:8002`

## Features

**UI**: Document upload, batch processing, real-time WebSocket notifications, analytics dashboard, lakehouse explorer, document comparison, search/filter, PWA support, notification center

**Backend**: Multi-engine OCR ensemble, Delta Lake lakehouse, ingestion framework, MLOps pipeline, geospatial processing, distributed computing (Spark/Ray)

## Access

- Web UI: http://localhost:3000
- OCR API: http://localhost:8001/docs
- Platform API: http://localhost:8002/docs
