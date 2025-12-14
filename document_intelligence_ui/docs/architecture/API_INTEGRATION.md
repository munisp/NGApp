# API Integration Documentation

## Overview

This document describes the complete API integration between the Document Intelligence Platform UI (Node.js/tRPC) and the Python FastAPI OCR Service.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Layer                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │   Upload   │  │ Documents  │  │  Batches   │  │   Search   │ │
│  │    Page    │  │    Page    │  │    Page    │  │   Filter   │ │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘ │
│         │                │                │                │       │
│         └────────────────┴────────────────┴────────────────┘       │
│                              │                                     │
│                              │ tRPC Client                         │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────────┐
│                        Backend Layer (Node.js)                     │
│                              │                                     │
│  ┌───────────────────────────▼──────────────────────────────────┐ │
│  │                     tRPC Router                               │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │ │
│  │  │   Auth   │  │Documents │  │ Batches  │  │  System  │    │ │
│  │  │  Router  │  │  Router  │  │  Router  │  │  Router  │    │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │ │
│  └───────┼─────────────┼─────────────┼─────────────┼───────────┘ │
│          │             │             │             │              │
│  ┌───────▼─────────────▼─────────────▼─────────────▼───────────┐ │
│  │                  Database Layer (db.ts)                      │ │
│  │  • upsertUser      • createDocument    • createBatch        │ │
│  │  • getUserByOpenId • getDocumentById   • getBatchById       │ │
│  │  • createOcrResult • updateDocument    • updateBatch        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│          │                                          │              │
│          │                                          │              │
│  ┌───────▼──────────┐                      ┌───────▼───────────┐ │
│  │  MySQL/TiDB      │                      │   S3 Storage      │ │
│  │  (Drizzle ORM)   │                      │   (storagePut)    │ │
│  └──────────────────┘                      └───────────────────┘ │
│                                                     │              │
│                                                     │              │
│  ┌──────────────────────────────────────────────────▼───────────┐ │
│  │              processOcr() Function                           │ │
│  │  1. Fetch image from S3                                      │ │
│  │  2. Create FormData with image buffer                        │ │
│  │  3. Call Python OCR service                                  │ │
│  │  4. Store results in database                                │ │
│  │  5. Update document/batch status                             │ │
│  └──────────────────────────────────┬───────────────────────────┘ │
└─────────────────────────────────────┼─────────────────────────────┘
                                      │
                                      │ HTTP POST /ocr/file
                                      │
┌─────────────────────────────────────▼─────────────────────────────┐
│                   OCR Service Layer (Python/FastAPI)              │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  FastAPI Endpoints                            │ │
│  │  • GET  /health       - Health check                         │ │
│  │  • GET  /engines      - List available engines               │ │
│  │  • GET  /strategies   - List ensemble strategies             │ │
│  │  • POST /ocr          - OCR with base64 image                │ │
│  │  • POST /ocr/file     - OCR with file upload                 │ │
│  │  • POST /ocr/batch    - Batch OCR processing                 │ │
│  └────────────────────────┬─────────────────────────────────────┘ │
│                           │                                        │
│  ┌────────────────────────▼──────────────────────────────────────┐ │
│  │           EnsembleOCROrchestrator                             │ │
│  │  • Coordinates multiple OCR engines                           │ │
│  │  • Applies ensemble strategies                                │ │
│  │  • Returns best result based on strategy                      │ │
│  └────────────────────────┬──────────────────────────────────────┘ │
│                           │                                        │
│  ┌────────────────────────▼──────────────────────────────────────┐ │
│  │                    OCR Engines                                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │ │
│  │  │ DeepSeek │  │  Paddle  │  │   Easy   │  │Tesseract │    │ │
│  │  │   OCR    │  │   OCR    │  │   OCR    │  │   OCR    │    │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Node.js tRPC API

**Base URL**: `http://localhost:3000/api/trpc`

#### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `auth.me` | GET | Get current user |
| `auth.logout` | POST | Logout user |

#### Documents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `documents.list` | GET | List all user documents |
| `documents.get` | GET | Get document by ID |
| `documents.upload` | POST | Upload single document |
| `documents.delete` | POST | Delete document |
| `documents.export` | GET | Export document results |

#### Batches

| Endpoint | Method | Description |
|----------|--------|-------------|
| `batches.list` | GET | List all user batches |
| `batches.get` | GET | Get batch by ID |
| `batches.create` | POST | Create batch upload |
| `batches.retryFailed` | POST | Retry failed documents |
| `batches.delete` | POST | Delete batch |

---

### Python OCR API

**Base URL**: `http://localhost:8001`

#### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/engines` | GET | List available OCR engines |
| `/strategies` | GET | List ensemble strategies |

#### OCR Processing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ocr` | POST | OCR with base64 image |
| `/ocr/file` | POST | OCR with file upload |
| `/ocr/batch` | POST | Batch OCR processing |

---

## Integration Flow

### Single Document Upload Flow

```
1. User uploads file via UI
   │
   ▼
2. Frontend calls trpc.documents.upload.useMutation()
   │
   ▼
3. Backend receives upload request
   │
   ├─> Validate file and category
   ├─> Upload file to S3 (storagePut)
   ├─> Create document record in database
   │   (status: "pending")
   │
   ▼
4. Backend calls processOcr() asynchronously
   │
   ├─> Fetch image from S3
   ├─> Create FormData with image buffer
   ├─> POST to Python OCR service /ocr/file
   │   with query params: ?strategy=highest_confidence&document_type=...
   │
   ▼
5. Python OCR Service processes request
   │
   ├─> Load image
   ├─> Run all enabled OCR engines
   ├─> Apply ensemble strategy
   ├─> Return best result
   │
   ▼
6. Backend receives OCR response
   │
   ├─> Store OCR result in database
   ├─> Update document status to "completed"
   │
   ▼
7. Frontend polls for updates
   │
   └─> Display OCR results to user
```

### Batch Upload Flow

```
1. User selects multiple files via UI
   │
   ▼
2. Frontend calls trpc.batches.create.useMutation()
   │
   ▼
3. Backend receives batch request
   │
   ├─> Create batch record (status: "pending")
   ├─> For each file:
   │   ├─> Upload to S3
   │   ├─> Create document record
   │   └─> Trigger processOcr() asynchronously
   │
   ▼
4. Multiple OCR processes run concurrently
   │
   ├─> Each document processed independently
   ├─> Batch progress updated after each completion
   │   (completedFiles++, status updated)
   │
   ▼
5. All documents complete
   │
   ├─> Batch status updated to "completed"
   │
   ▼
6. Frontend displays batch results
```

---

## Data Flow

### Request/Response Formats

#### 1. Document Upload Request

**Frontend → Backend (tRPC)**

```typescript
{
  filename: string;          // "passport.jpg"
  category: DocumentCategory; // "citizenship_identity"
  fileData: string;          // Base64-encoded file
}
```

**Backend → S3**

```typescript
storagePut(
  fileKey: string,           // "user-123/passport-abc.jpg"
  fileBuffer: Buffer,        // Binary file data
  contentType: string        // "image/jpeg"
)
→ Returns: { url: string, key: string }
```

**Backend → Database**

```typescript
createDocument({
  userId: number,
  filename: string,
  fileUrl: string,
  fileKey: string,
  category: string,
  status: "pending"
})
→ Returns: { id: number, ...document }
```

#### 2. OCR Processing Request

**Backend → Python OCR Service**

```http
POST /ocr/file?strategy=highest_confidence&document_type=citizenship_identity
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="document.jpg"
Content-Type: image/jpeg

<binary image data>
--boundary--
```

**Python OCR Service → Backend**

```json
{
  "text": "PASSPORT\nUnited States of America\nJohn Doe\n...",
  "confidence": 0.95,
  "metadata": {
    "selected_engine": "deepseek",
    "strategy": "highest_confidence",
    "engine_results": {
      "deepseek": {
        "text": "...",
        "confidence": 0.95,
        "processing_time_ms": 300
      },
      "paddle": {
        "text": "...",
        "confidence": 0.87,
        "processing_time_ms": 450
      }
    },
    "fields_extracted": ["full_name", "document_number", "date_of_birth"]
  },
  "processing_time_ms": 425
}
```

**Backend → Database**

```typescript
createOcrResult({
  documentId: number,
  extractedText: string,
  confidence: number,        // 0-100 integer
  selectedEngine: string,
  strategy: string,
  processingTimeMs: number,
  extractedData: string,     // JSON string
  metadata: string           // JSON string
})
```

#### 3. Get Document Response

**Backend → Frontend (tRPC)**

```typescript
{
  id: number,
  filename: string,
  category: string,
  status: "completed",
  uploadedAt: Date,
  processedAt: Date,
  ocrResult: {
    extractedText: string,
    confidence: number,
    selectedEngine: string,
    processingTimeMs: number,
    extractedData: {
      full_name: string,
      document_number: string,
      date_of_birth: string,
      // ... other extracted fields
    },
    metadata: {
      selected_engine: string,
      strategy: string,
      engine_results: { ... }
    }
  }
}
```

---

## Error Handling

### Backend Error Handling

```typescript
async function processOcr(
  documentId: number,
  fileUrl: string,
  category: string,
  batchId?: number
): Promise<void> {
  try {
    // 1. Update status to "processing"
    await updateDocumentStatus(documentId, "processing");

    // 2. Fetch image from S3
    const imageResponse = await fetch(fileUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    // 3. Call OCR service
    const response = await fetch(`${ocrServiceUrl}/ocr/file?...`, {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OCR service error: ${response.status} - ${errorText}`);
    }

    // 4. Store results
    const ocrData = await response.json();
    await createOcrResult({ ... });
    await updateDocumentStatus(documentId, "completed");

    // 5. Update batch progress
    if (batchId) {
      await updateBatchProgress(batchId, { ... });
    }

  } catch (error) {
    console.error("OCR processing error:", error);
    
    // Mark document as failed
    await updateDocumentStatus(documentId, "failed");
    
    // Update batch statistics
    if (batchId) {
      await updateBatchProgress(batchId, { ... });
    }
    
    throw error;
  }
}
```

### Python OCR Service Error Handling

```python
@app.post("/ocr/file", response_model=OCRResponse)
async def process_ocr_file(
    file: UploadFile = File(...),
    document_type: Optional[str] = None,
    strategy: Optional[str] = Query(None)
):
    start = datetime.now()
    
    try:
        # Read file
        image_bytes = await file.read()
        
        # Parse strategy
        strategy_enum = None
        if strategy:
            try:
                strategy_enum = EnsembleStrategy(strategy)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid strategy: {strategy}"
                )
        
        # Process with ensemble
        result = orchestrator.process_image(
            image_bytes,
            document_type=document_type,
            strategy=strategy_enum
        )
        
        processing_time = (datetime.now() - start).total_seconds() * 1000
        
        return OCRResponse(
            text=result['text'],
            confidence=result['confidence'],
            metadata=result['metadata'],
            processing_time_ms=processing_time
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Configuration

### Environment Variables

**Node.js Backend (.env)**

```bash
# Required
DATABASE_URL=mysql://user:password@host:port/database
OCR_SERVICE_URL=http://localhost:8001

# Optional (automatically configured by Manus)
JWT_SECRET=<auto-generated>
OAUTH_SERVER_URL=<auto-configured>
VITE_APP_ID=<auto-configured>
```

**Python OCR Service (.env)**

```bash
# OCR Engine Configuration
ENABLE_DEEPSEEK=true
ENABLE_PADDLE=true
ENABLE_EASY=true
ENABLE_TESSERACT=true

# Default Strategy
DEFAULT_STRATEGY=highest_confidence

# Server Configuration
PORT=8001
HOST=0.0.0.0

# Model Paths (optional)
DEEPSEEK_MODEL_PATH=/path/to/model
PADDLE_MODEL_DIR=/path/to/paddle
```

---

## Performance Optimization

### 1. Concurrent Processing

The backend processes OCR requests asynchronously, allowing multiple documents to be processed simultaneously:

```typescript
// Batch upload triggers multiple async processOcr calls
for (const fileData of files) {
  // Each processOcr runs independently
  processOcr(doc.id, doc.fileUrl, doc.category, batch.id)
    .catch(error => console.error(`Failed to process ${doc.id}:`, error));
}
```

### 2. Connection Pooling

- **Database**: Drizzle ORM manages connection pool automatically
- **HTTP**: Node.js `fetch` uses keep-alive connections
- **S3**: Reuses connections for multiple uploads

### 3. Caching

- **OCR Results**: Stored in database, no re-processing needed
- **S3 URLs**: Pre-signed URLs cached for 1 hour
- **User Sessions**: JWT tokens cached in cookies

### 4. Timeout Configuration

```typescript
// OCR service timeout: 30 seconds
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

const response = await fetch(ocrServiceUrl, {
  signal: controller.signal,
  // ... other options
});

clearTimeout(timeoutId);
```

---

## Security

### 1. Authentication

- All tRPC endpoints require authentication (except `auth.me`)
- OAuth flow handled by Manus platform
- Session cookies are HTTP-only and secure

### 2. Authorization

- Users can only access their own documents
- Row-level security enforced in database queries:

```typescript
const documents = await db
  .select()
  .from(documentsTable)
  .where(eq(documentsTable.userId, ctx.user.id));
```

### 3. Input Validation

- File size limits enforced (16MB max)
- File type validation (images and PDFs only)
- Category validation using TypeScript enums
- SQL injection prevention via ORM

### 4. Data Protection

- S3 files stored with non-enumerable keys
- PII data in `extractedData` JSON field
- Database backups encrypted at rest
- HTTPS required for all API calls in production

---

## Monitoring & Logging

### Backend Logging

```typescript
console.log('[OCR] Processing document:', documentId);
console.log('[OCR] Service URL:', ocrServiceUrl);
console.log('[OCR] Response:', ocrData);
console.error('[OCR] Processing error:', error);
```

### Python Service Logging

```python
logger.info(f"Processing document with strategy: {strategy}")
logger.info(f"Selected engine: {selected_engine}")
logger.error(f"OCR processing failed: {str(e)}")
```

### Metrics to Track

1. **Processing Times**:
   - Average OCR processing time per document
   - P50, P95, P99 latencies
   - Time by document category

2. **Success Rates**:
   - Overall success rate
   - Success rate by category
   - Success rate by OCR engine

3. **Confidence Scores**:
   - Average confidence by category
   - Distribution of confidence scores
   - Low confidence alerts (< 70%)

4. **System Health**:
   - OCR service uptime
   - Database connection pool usage
   - S3 upload success rate
   - API error rates

---

## Testing

### Unit Tests

**Backend (Node.js)**:
```bash
cd /home/ubuntu/document_intelligence_ui
pnpm test
```

**OCR Service (Python)**:
```bash
cd /home/ubuntu/document_intelligence_platform
pytest tests/
```

### Integration Tests

See [INTEGRATION_TESTING.md](./INTEGRATION_TESTING.md) for detailed test scenarios.

### Postman Collections

1. **Python OCR API**: `postman_collection_ocr_api.json`
2. **Node.js tRPC API**: `postman_collection_trpc_api.json`

Import into Postman and run test suites.

---

## Deployment

### Production Checklist

- [ ] Set `OCR_SERVICE_URL` to production OCR service
- [ ] Configure `DATABASE_URL` for production database
- [ ] Enable HTTPS for all endpoints
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up database backups
- [ ] Configure S3 bucket policies
- [ ] Enable rate limiting
- [ ] Set up CDN for static assets
- [ ] Configure auto-scaling

### Docker Deployment

**Node.js Backend**:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
```

**Python OCR Service**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "ocr_pipeline/ensemble_ocr_service.py"]
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  ui-backend:
    build: ./document_intelligence_ui
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OCR_SERVICE_URL=http://ocr-service:8001
    depends_on:
      - ocr-service
  
  ocr-service:
    build: ./document_intelligence_platform
    ports:
      - "8001:8001"
    environment:
      - ENABLE_DEEPSEEK=true
      - ENABLE_PADDLE=true
```

---

## Troubleshooting

See [INTEGRATION_TESTING.md](./INTEGRATION_TESTING.md#troubleshooting) for common issues and solutions.

---

## Support

For API integration support:
- Documentation: This file
- Testing Guide: [INTEGRATION_TESTING.md](./INTEGRATION_TESTING.md)
- Database Schema: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- Platform Support: https://help.manus.im
