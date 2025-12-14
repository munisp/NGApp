# Integration Testing Guide

## Overview

This guide provides step-by-step instructions for testing the complete Document Intelligence Platform integration between the Node.js UI backend and the Python FastAPI OCR service.

---

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React UI      │────────>│  Node.js/tRPC    │────────>│  Python FastAPI │
│  (Frontend)     │         │   (Backend)      │         │   OCR Service   │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │                             │
                                     ▼                             ▼
                            ┌──────────────────┐         ┌─────────────────┐
                            │  MySQL/TiDB      │         │  OCR Engines    │
                            │  (Database)      │         │  (DeepSeek,     │
                            └──────────────────┘         │   Paddle, etc)  │
                                     │                    └─────────────────┘
                                     ▼
                            ┌──────────────────┐
                            │  S3 Storage      │
                            │  (File Storage)  │
                            └──────────────────┘
```

---

## Prerequisites

### 1. Environment Setup

**Node.js Backend (.env):**
```bash
# Database
DATABASE_URL=mysql://user:password@localhost:3306/document_intelligence

# OCR Service
OCR_SERVICE_URL=http://localhost:8001

# S3 Storage (automatically configured by Manus)
# No manual setup required

# OAuth (automatically configured by Manus)
# No manual setup required
```

**Python OCR Service (.env):**
```bash
# OCR Engines
ENABLE_DEEPSEEK=true
ENABLE_PADDLE=true
ENABLE_EASY=true
ENABLE_TESSERACT=true

# Default Strategy
DEFAULT_STRATEGY=highest_confidence

# Server Port
PORT=8001
```

### 2. Start Services

**Terminal 1 - Python OCR Service:**
```bash
cd /home/ubuntu/document_intelligence_platform
python ocr_pipeline/ensemble_ocr_service.py
```

Expected output:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

**Terminal 2 - Node.js Backend:**
```bash
cd /home/ubuntu/document_intelligence_ui
pnpm dev
```

Expected output:
```
Server running on http://localhost:3000/
[OAuth] Initialized with baseURL: https://api.manus.im
```

---

## Test Scenarios

### Scenario 1: Health Checks

**Objective**: Verify both services are running and healthy.

**Steps:**

1. **Test Python OCR Service Health:**
```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "available_engines": ["deepseek", "paddle", "easy", "tesseract"],
  "total_engines": 4,
  "uptime_seconds": 123.45
}
```

2. **Test Node.js Backend:**
```bash
curl http://localhost:3000/api/trpc/auth.me
```

Expected response (if not authenticated):
```json
{
  "result": {
    "data": null
  }
}
```

**Success Criteria:**
- ✅ Python service returns HTTP 200 with healthy status
- ✅ Node.js service returns HTTP 200
- ✅ All 4 OCR engines are available

---

### Scenario 2: Single Document Upload (End-to-End)

**Objective**: Test complete flow from upload to OCR processing.

**Steps:**

1. **Authenticate** (via browser):
   - Navigate to `http://localhost:3000`
   - Click "Sign In" and complete OAuth flow
   - Copy session cookie from browser DevTools

2. **Upload Document** (using Postman or curl):

```bash
# Prepare base64-encoded image
BASE64_IMAGE=$(base64 -i /path/to/passport.jpg)

# Upload via tRPC
curl -X POST http://localhost:3000/api/trpc/documents.upload \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "filename": "passport.jpg",
    "category": "citizenship_identity",
    "fileData": "'$BASE64_IMAGE'"
  }'
```

Expected response:
```json
{
  "result": {
    "data": {
      "id": 1,
      "filename": "passport.jpg",
      "category": "citizenship_identity",
      "status": "pending",
      "uploadedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

3. **Check Processing Status:**

```bash
curl http://localhost:3000/api/trpc/documents.get?input='{"id":1}' \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

Expected response (after processing):
```json
{
  "result": {
    "data": {
      "id": 1,
      "filename": "passport.jpg",
      "category": "citizenship_identity",
      "status": "completed",
      "ocrResult": {
        "extractedText": "PASSPORT\nUnited States of America\n...",
        "confidence": 95,
        "selectedEngine": "deepseek",
        "processingTimeMs": 425,
        "extractedData": {
          "full_name": "John Doe",
          "document_number": "P123456789"
        }
      }
    }
  }
}
```

**Success Criteria:**
- ✅ Document uploaded successfully to S3
- ✅ Database record created with status "pending"
- ✅ OCR processing triggered automatically
- ✅ Status changes to "processing" then "completed"
- ✅ OCR results stored in database
- ✅ Confidence score > 80%
- ✅ Processing time < 2000ms

---

### Scenario 3: Batch Upload

**Objective**: Test concurrent processing of multiple documents.

**Steps:**

1. **Create Batch Upload:**

```bash
curl -X POST http://localhost:3000/api/trpc/batches.create \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "name": "Test Batch - Mixed Documents",
    "files": [
      {
        "filename": "passport.jpg",
        "category": "citizenship_identity",
        "fileData": "BASE64_1"
      },
      {
        "filename": "visa.jpg",
        "category": "immigration_status",
        "fileData": "BASE64_2"
      },
      {
        "filename": "w2.pdf",
        "category": "income_employment",
        "fileData": "BASE64_3"
      }
    ]
  }'
```

2. **Monitor Batch Progress:**

```bash
# Poll every 2 seconds
watch -n 2 'curl -s http://localhost:3000/api/trpc/batches.get?input='\''{"id":1}'\'' \
  -H "Cookie: session=YOUR_SESSION_COOKIE" | jq'
```

Expected output:
```json
{
  "result": {
    "data": {
      "id": 1,
      "name": "Test Batch - Mixed Documents",
      "totalFiles": 3,
      "completedFiles": 3,
      "failedFiles": 0,
      "status": "completed",
      "documents": [
        {"id": 1, "filename": "passport.jpg", "status": "completed"},
        {"id": 2, "filename": "visa.jpg", "status": "completed"},
        {"id": 3, "filename": "w2.pdf", "status": "completed"}
      ]
    }
  }
}
```

**Success Criteria:**
- ✅ All 3 documents uploaded successfully
- ✅ Batch status progresses: pending → processing → completed
- ✅ All documents processed concurrently (< 5 seconds total)
- ✅ completedFiles count updates correctly
- ✅ No failed files

---

### Scenario 4: OCR Engine Comparison

**Objective**: Test different ensemble strategies and compare results.

**Steps:**

1. **Test Highest Confidence Strategy:**

```bash
curl -X POST http://localhost:8001/ocr/file \
  -F "file=@/path/to/document.jpg" \
  -F "strategy=highest_confidence"
```

2. **Test Majority Vote Strategy:**

```bash
curl -X POST http://localhost:8001/ocr/file \
  -F "file=@/path/to/document.jpg" \
  -F "strategy=majority_vote"
```

3. **Test All Engines Strategy:**

```bash
curl -X POST http://localhost:8001/ocr/file \
  -F "file=@/path/to/document.jpg" \
  -F "strategy=all_engines"
```

Expected response (all_engines):
```json
{
  "text": "Selected result text",
  "confidence": 0.95,
  "metadata": {
    "strategy": "all_engines",
    "engine_results": {
      "deepseek": {
        "text": "DeepSeek result",
        "confidence": 0.95,
        "processing_time_ms": 300
      },
      "paddle": {
        "text": "Paddle result",
        "confidence": 0.87,
        "processing_time_ms": 450
      },
      "easy": {
        "text": "Easy result",
        "confidence": 0.82,
        "processing_time_ms": 600
      },
      "tesseract": {
        "text": "Tesseract result",
        "confidence": 0.75,
        "processing_time_ms": 200
      }
    }
  },
  "processing_time_ms": 1550
}
```

**Success Criteria:**
- ✅ All strategies return valid results
- ✅ Confidence scores vary by strategy
- ✅ All 4 engines return results
- ✅ Processing times are reasonable (< 2000ms)

---

### Scenario 5: Error Handling

**Objective**: Test system behavior under error conditions.

**Test Cases:**

1. **Invalid File Format:**
```bash
curl -X POST http://localhost:3000/api/trpc/documents.upload \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "filename": "document.exe",
    "category": "citizenship_identity",
    "fileData": "INVALID_BASE64"
  }'
```

Expected: HTTP 400 with error message

2. **OCR Service Unavailable:**
```bash
# Stop Python OCR service
# Attempt upload
```

Expected: Document status = "failed", error logged

3. **Invalid Category:**
```bash
curl -X POST http://localhost:3000/api/trpc/documents.upload \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "filename": "test.jpg",
    "category": "invalid_category",
    "fileData": "BASE64_DATA"
  }'
```

Expected: HTTP 400 with validation error

**Success Criteria:**
- ✅ Appropriate error messages returned
- ✅ Failed documents marked with status "failed"
- ✅ No data corruption in database
- ✅ System remains stable after errors

---

### Scenario 6: Retry Failed Documents

**Objective**: Test retry mechanism for failed OCR processing.

**Steps:**

1. **Create Failed Document** (stop OCR service first):
```bash
# Stop Python service
# Upload document → will fail
```

2. **Restart OCR Service:**
```bash
cd /home/ubuntu/document_intelligence_platform
python ocr_pipeline/ensemble_ocr_service.py
```

3. **Retry Failed Documents:**
```bash
curl -X POST http://localhost:3000/api/trpc/batches.retryFailed \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{"batchId": 1}'
```

**Success Criteria:**
- ✅ Failed documents identified correctly
- ✅ Retry triggers new OCR processing
- ✅ Status updates from "failed" to "processing" to "completed"
- ✅ Batch statistics updated correctly

---

## Performance Testing

### Load Test: Concurrent Uploads

**Objective**: Test system under load with multiple concurrent users.

**Tool**: Apache Bench (ab) or Artillery

```bash
# Install artillery
npm install -g artillery

# Create test scenario
cat > load-test.yml <<EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Sustained load"
scenarios:
  - name: "Upload documents"
    flow:
      - post:
          url: "/api/trpc/documents.upload"
          json:
            filename: "test.jpg"
            category: "citizenship_identity"
            fileData: "{{ \$randomBase64 }}"
EOF

# Run load test
artillery run load-test.yml
```

**Success Criteria:**
- ✅ 95th percentile response time < 2000ms
- ✅ Error rate < 1%
- ✅ System remains stable under load
- ✅ Database connections properly managed

---

## Integration Checklist

### Pre-Deployment Verification

- [ ] All services start without errors
- [ ] Health endpoints return 200 OK
- [ ] Database migrations applied successfully
- [ ] S3 bucket configured and accessible
- [ ] OAuth authentication working
- [ ] All 4 OCR engines available

### Functional Testing

- [ ] Single document upload works
- [ ] Batch upload works
- [ ] OCR processing completes successfully
- [ ] Results stored in database correctly
- [ ] Search and filtering work
- [ ] Export functionality works (JSON/CSV)
- [ ] Delete operations work correctly

### Error Handling

- [ ] Invalid file formats rejected
- [ ] OCR service failures handled gracefully
- [ ] Network timeouts handled
- [ ] Database errors logged properly
- [ ] User-friendly error messages displayed

### Performance

- [ ] Single document processing < 2000ms
- [ ] Batch processing scales linearly
- [ ] Database queries optimized
- [ ] S3 uploads complete quickly
- [ ] No memory leaks detected

### Security

- [ ] Authentication required for all endpoints
- [ ] Users can only access their own documents
- [ ] File uploads validated and sanitized
- [ ] SQL injection prevented (using ORM)
- [ ] XSS prevention in place

---

## Troubleshooting

### Issue: OCR Service Connection Refused

**Symptoms:**
- Documents stuck in "pending" status
- Error: "OCR service returned 500"

**Solution:**
1. Check if Python service is running: `curl http://localhost:8001/health`
2. Verify `OCR_SERVICE_URL` environment variable
3. Check firewall/network settings
4. Review Python service logs

### Issue: Low OCR Confidence Scores

**Symptoms:**
- Confidence scores consistently < 70%
- Poor text extraction quality

**Solution:**
1. Check image quality (resolution, clarity)
2. Try different ensemble strategies
3. Enable more OCR engines
4. Preprocess images (deskew, denoise)

### Issue: Slow Processing Times

**Symptoms:**
- Processing time > 5000ms per document
- Batch uploads timeout

**Solution:**
1. Check OCR engine performance individually
2. Reduce number of engines in ensemble
3. Increase server resources (CPU/RAM)
4. Enable GPU acceleration for DeepSeek

### Issue: Database Connection Errors

**Symptoms:**
- "Connection refused" errors
- Timeouts on database queries

**Solution:**
1. Verify `DATABASE_URL` is correct
2. Check database server is running
3. Verify credentials and permissions
4. Check connection pool settings

---

## Monitoring

### Key Metrics to Track

1. **OCR Processing:**
   - Average processing time per document
   - Confidence score distribution
   - Engine selection frequency
   - Error rate by document category

2. **System Performance:**
   - API response times (p50, p95, p99)
   - Database query times
   - S3 upload/download times
   - Memory and CPU usage

3. **Business Metrics:**
   - Documents processed per hour
   - Success rate by category
   - User upload patterns
   - Batch vs single upload ratio

### Logging

**Node.js Backend:**
```javascript
console.log('[OCR] Processing document:', documentId);
console.log('[OCR] Service response:', ocrData);
console.error('[OCR] Processing error:', error);
```

**Python OCR Service:**
```python
logger.info(f"Processing document with strategy: {strategy}")
logger.error(f"OCR processing failed: {str(e)}")
```

---

## Next Steps

After successful integration testing:

1. **Deploy to Staging**: Test in staging environment
2. **User Acceptance Testing**: Get feedback from real users
3. **Performance Tuning**: Optimize based on metrics
4. **Production Deployment**: Deploy to production
5. **Monitoring Setup**: Configure alerts and dashboards

---

## Support

For issues or questions:
- Check logs in `/home/ubuntu/document_intelligence_platform/logs/`
- Review database queries in slow query log
- Contact platform support at https://help.manus.im
