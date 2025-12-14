# Local-First Architecture Configuration

## Overview
This document describes the local-first architecture configuration for the Document Intelligence Platform, making all local/self-hosted services the default and preferred option.

## Service Ports

| Service | Port | Description | Default Mode |
|---------|------|-------------|--------------|
| DeepSeek Local | 9002 | Self-hosted DeepSeek OCR/VLM | **LOCAL** (default) |
| Docling Service | 9001 | PDF parsing and document conversion | **LOCAL** (default) |
| Biometric Service | 9004 | Face matching + liveness detection | **LOCAL** (default) |
| NIMC Service | 9005 | NIN verification | **LOCAL** (mock mode default) |
| CAC Service | 9006 | RC verification | **LOCAL** (mock mode default) |
| Go Orchestrator | 9003 | Document routing and processing | **LOCAL** (default) |
| Frontend UI | 3000 | React application | LOCAL |
| Backend API | 8001 | FastAPI OCR service | LOCAL |
| Orchestration API | 8003 | Celery job management | LOCAL |

## Environment Configuration

### Default Local-First Settings

```bash
# DeepSeek Configuration
DEEPSEEK_MODE=local  # Options: local, api
DEEPSEEK_LOCAL_URL=http://localhost:9002
DEEPSEEK_MODEL_PATH=/models/deepseek-vl-7b-chat
DEEPSEEK_QUANTIZATION=int4  # Options: int4, int8, fp16

# Docling Configuration
DOCLING_ENABLED=true
DOCLING_URL=http://localhost:9001
DOCLING_DEFAULT_FORMAT=markdown

# Biometric Configuration
BIOMETRIC_MODE=local  # Options: local, cloud
BIOMETRIC_URL=http://localhost:9004
FACE_MATCH_THRESHOLD=0.6
LIVENESS_THRESHOLD=0.5

# NIMC Configuration
NIMC_MODE=local  # Options: local, api
NIMC_URL=http://localhost:9005
NIMC_USE_MOCK=true  # Set to false for production with real API
NIMC_API_KEY=your_api_key_here
NIMC_API_SECRET=your_api_secret_here
NIMC_ENVIRONMENT=sandbox  # Options: sandbox, production

# CAC Configuration
CAC_MODE=local  # Options: local, api
CAC_URL=http://localhost:9006
CAC_USE_MOCK=true  # Set to false for production with real API
CAC_API_KEY=your_api_key_here
CAC_API_SECRET=your_api_secret_here
CAC_ENVIRONMENT=sandbox  # Options: sandbox, production

# Orchestration Configuration
ORCHESTRATOR_URL=http://localhost:9003
ORCHESTRATOR_WORKERS=10

# OCR Service Priority (comma-separated, first = highest priority)
OCR_SERVICE_PRIORITY=deepseek_local,docling,tesseract,paddleocr
```

## Service Priority Configuration

### Document Processing Pipeline

1. **PDF Documents** → Docling Service (local)
2. **Images with Text** → DeepSeek Local (self-hosted)
3. **Complex Layouts** → DeepSeek Local (self-hosted)
4. **Simple Text** → Tesseract (local)
5. **Fallback** → PaddleOCR (local)

### Biometric Verification Pipeline

1. **Face Detection** → Local Biometric Service (MTCNN)
2. **Face Recognition** → Local Biometric Service (FaceNet)
3. **Liveness Detection** → Local Biometric Service (multi-method)
4. **NIN Face Match** → NIMC Service → Local Biometric Service

### Identity Verification Pipeline

1. **NIN Verification** → NIMC Service (local mock or API)
2. **RC Verification** → CAC Service (local mock or API)
3. **Face Verification** → Local Biometric Service
4. **Document Verification** → DeepSeek Local + Docling

## Fallback Configuration

### OCR Fallback Chain
```
DeepSeek Local → Docling → Tesseract → PaddleOCR → Cloud API (if enabled)
```

### Biometric Fallback Chain
```
Local Biometric → Cloud Biometric API (if enabled)
```

### Database Fallback Chain
```
Local Mock → Sandbox API → Production API
```

## Performance Optimization

### Local Processing Benefits
- **Latency**: <100ms for local services vs 500-2000ms for cloud
- **Privacy**: All data stays on-premises
- **Cost**: No per-request API costs
- **Reliability**: No internet dependency
- **Scalability**: Horizontal scaling with more local instances

### Resource Requirements

#### Minimum Configuration
- CPU: 8 cores
- RAM: 16GB
- GPU: 8GB VRAM (for DeepSeek)
- Storage: 50GB

#### Recommended Configuration
- CPU: 16 cores
- RAM: 32GB
- GPU: 16GB VRAM (for DeepSeek + Biometric)
- Storage: 100GB

#### Production Configuration
- CPU: 32 cores
- RAM: 64GB
- GPU: 24GB VRAM (multiple GPUs)
- Storage: 500GB

## Deployment Modes

### Mode 1: Fully Local (Default)
All services run locally with mock external APIs.
- **Use Case**: Development, testing, air-gapped environments
- **Requirements**: Minimum configuration
- **Privacy**: Maximum (100% local)

### Mode 2: Hybrid Local
Local processing with real external APIs for verification.
- **Use Case**: Production with compliance requirements
- **Requirements**: Recommended configuration + API credentials
- **Privacy**: High (processing local, verification remote)

### Mode 3: Cloud Fallback
Local processing with cloud fallback for failures.
- **Use Case**: High availability requirements
- **Requirements**: Production configuration + cloud API keys
- **Privacy**: Medium (local first, cloud fallback)

## Configuration Files

### docker-compose.local.yml
```yaml
version: '3.8'

services:
  deepseek_local:
    build: ./deepseek_local
    ports:
      - "9002:9002"
    environment:
      - MODEL_PATH=/models/deepseek-vl-7b-chat
      - QUANTIZATION=int4
    volumes:
      - ./models:/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
  
  docling:
    build: ./docling_service
    ports:
      - "9001:9001"
    environment:
      - WORKERS=4
  
  biometric:
    build: ./biometric_service
    ports:
      - "9004:9004"
    environment:
      - DEVICE=cuda
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
  
  nimc:
    build: ./nimc_service
    ports:
      - "9005:9005"
    environment:
      - NIMC_USE_MOCK=true
  
  cac:
    build: ./cac_service
    ports:
      - "9006:9006"
    environment:
      - CAC_USE_MOCK=true
  
  go_orchestrator:
    build: ./go_orchestrator
    ports:
      - "9003:9003"
    environment:
      - DEEPSEEK_URL=http://deepseek_local:9002
      - DOCLING_URL=http://docling:9001
      - WORKERS=10
```

## Migration from Cloud to Local

### Step 1: Deploy Local Services
```bash
docker-compose -f docker-compose.local.yml up -d
```

### Step 2: Update Environment Variables
```bash
# Update .env file
DEEPSEEK_MODE=local
BIOMETRIC_MODE=local
NIMC_MODE=local
CAC_MODE=local
```

### Step 3: Test Local Services
```bash
# Test DeepSeek
curl http://localhost:9002/health

# Test Docling
curl http://localhost:9001/health

# Test Biometric
curl http://localhost:9004/health

# Test NIMC
curl http://localhost:9005/health

# Test CAC
curl http://localhost:9006/health
```

### Step 4: Update Application Configuration
Update application code to use local service URLs as default.

### Step 5: Verify End-to-End
Run integration tests to verify full pipeline works locally.

## Monitoring

### Health Checks
All services expose `/health` endpoints for monitoring.

### Metrics
- Request latency
- Success/failure rates
- Resource utilization (CPU, RAM, GPU)
- Queue depths
- Processing throughput

### Logging
Centralized logging with structured JSON format.

## Security

### Local Security Benefits
- No data leaves premises
- No API key exposure
- No man-in-the-middle attacks
- Full audit trail

### Security Measures
- Service-to-service authentication
- Request signing (HMAC)
- TLS for all connections
- Rate limiting
- Input validation

## Compliance

### Data Residency
All data processing occurs locally, meeting data residency requirements.

### GDPR/NDPR Compliance
- Data minimization (local processing)
- Right to erasure (local storage)
- Data portability (local exports)
- Audit trails (local logs)

## Support

### Troubleshooting
1. Check service health endpoints
2. Review service logs
3. Verify resource availability
4. Test individual services
5. Check network connectivity between services

### Performance Tuning
1. Adjust worker counts
2. Optimize model quantization
3. Enable GPU acceleration
4. Configure caching
5. Tune batch sizes

## Conclusion

The local-first architecture provides:
- **Privacy**: All processing on-premises
- **Performance**: Low latency (<100ms)
- **Cost**: No per-request fees
- **Reliability**: No internet dependency
- **Compliance**: Data residency requirements met

All services default to local mode with optional cloud fallback for flexibility.
