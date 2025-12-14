# Document Intelligence Platform - Integration Architecture

**Version**: 1.0  
**Date**: November 7, 2025  
**Status**: Implementation Ready

---

## Executive Summary

This document defines the architecture for integrating the Python backend platform services with the Node.js/React UI to create a unified Document Intelligence Platform. The integration will expose lakehouse data access, analytics dashboards, ingestion framework controls, and PWA capabilities through a modern web interface.

---

## Integration Approach

### Strategy: Hybrid Architecture with API Gateway Pattern

We will implement a **lightweight Python API Gateway** that exposes backend services through REST/FastAPI endpoints, which the Node.js backend will proxy through tRPC procedures. This approach provides:

- **Type Safety**: tRPC ensures end-to-end type safety from Python → Node.js → React
- **Authentication**: Single auth layer in Node.js
- **Caching**: Node.js can cache frequently accessed data
- **Error Handling**: Consistent error responses across the stack
- **Performance**: Minimal overhead with direct HTTP calls

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  React 19 SPA + PWA                                         │  │
│  │  - Document Management UI                                   │  │
│  │  - Analytics Dashboard                                      │  │
│  │  - Lakehouse Explorer                                       │  │
│  │  - Ingestion Controls                                       │  │
│  │  - Offline Support (Service Worker)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                ↓ tRPC
┌──────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Node.js/Express + tRPC + WebSocket                         │  │
│  │  - Authentication & Authorization                           │  │
│  │  - API Proxy to Python Services                             │  │
│  │  - Response Caching                                         │  │
│  │  - Real-time Notifications                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                ↓ HTTP
┌──────────────────────────────────────────────────────────────────┐
│                      PYTHON SERVICES LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  OCR Service │  │  API Gateway │  │  Main Platform         │ │
│  │  Port: 8001  │  │  Port: 8002  │  │  (Spark/Ray Cluster)   │ │
│  │              │  │              │  │                        │ │
│  │  - Ensemble  │  │  - Lakehouse │  │  - Delta Lake Manager  │ │
│  │  - Multi-eng │  │  - Ingestion │  │  - Spark Processor     │ │
│  │  - Batch OCR │  │  - Analytics │  │  - Ray Processor       │ │
│  │              │  │  - Geospatial│  │  - Geospatial Proc     │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  MySQL/TiDB  │  │  S3 Storage  │  │  Delta Lake Storage    │ │
│  │              │  │              │  │                        │ │
│  │  - Users     │  │  - Documents │  │  - Bronze Layer (Raw)  │ │
│  │  - Documents │  │  - OCR Files │  │  - Silver Layer (Clean)│ │
│  │  - Batches   │  │              │  │  - Gold Layer (Agg)    │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Python API Gateway (Priority: CRITICAL)

### Overview

Create a new FastAPI service (`platform_api_gateway.py`) that exposes lakehouse, ingestion, and analytics capabilities through REST endpoints.

### API Endpoints

#### 1. Lakehouse API (`/api/lakehouse/*`)

```python
# List all Delta tables
GET /api/lakehouse/tables
Response: {
  "tables": [
    {
      "name": "bronze_documents",
      "layer": "bronze",
      "path": "/data/lakehouse/bronze_documents",
      "size_mb": 1024.5,
      "row_count": 50000,
      "created_at": "2025-11-01T10:00:00Z",
      "last_modified": "2025-11-07T15:30:00Z"
    }
  ]
}

# Get table schema
GET /api/lakehouse/tables/{table_name}/schema
Response: {
  "table_name": "bronze_documents",
  "schema": [
    {"name": "document_id", "type": "string", "nullable": false},
    {"name": "extracted_text", "type": "string", "nullable": true},
    {"name": "confidence", "type": "double", "nullable": true}
  ],
  "partition_columns": ["ingestion_date"],
  "version": 42
}

# Query table data
POST /api/lakehouse/tables/{table_name}/query
Request: {
  "filters": {"primary_category": "passport"},
  "columns": ["document_id", "extracted_text", "confidence"],
  "limit": 100,
  "offset": 0,
  "order_by": "confidence DESC"
}
Response: {
  "data": [...],
  "total_count": 1500,
  "page": 1,
  "page_size": 100
}

# Time travel query
GET /api/lakehouse/tables/{table_name}/history
Response: {
  "versions": [
    {
      "version": 42,
      "timestamp": "2025-11-07T15:30:00Z",
      "operation": "MERGE",
      "rows_added": 150,
      "rows_deleted": 0
    }
  ]
}

# Get table statistics
GET /api/lakehouse/tables/{table_name}/stats
Response: {
  "row_count": 50000,
  "size_mb": 1024.5,
  "column_stats": {
    "confidence": {"min": 0.65, "max": 0.99, "avg": 0.92}
  }
}
```

#### 2. Analytics API (`/api/analytics/*`)

```python
# Get processing trends
GET /api/analytics/processing-trends
Query: ?period=30d&granularity=day
Response: {
  "trends": [
    {
      "date": "2025-11-07",
      "total_documents": 1500,
      "successful": 1425,
      "failed": 75,
      "avg_processing_time_ms": 425,
      "avg_confidence": 0.92
    }
  ]
}

# Get category statistics
GET /api/analytics/categories
Response: {
  "categories": [
    {
      "category": "passport",
      "total_documents": 5000,
      "success_rate": 0.96,
      "avg_confidence": 0.94,
      "avg_processing_time_ms": 380
    }
  ]
}

# Get error patterns
GET /api/analytics/errors
Query: ?period=7d
Response: {
  "errors": [
    {
      "error_type": "OCR_TIMEOUT",
      "count": 45,
      "percentage": 0.03,
      "affected_categories": ["passport", "visa"]
    }
  ]
}
```

#### 3. Ingestion API (`/api/ingestion/*`)

```python
# List available connectors
GET /api/ingestion/connectors
Response: {
  "connectors": [
    {
      "type": "s3",
      "name": "S3 Connector",
      "description": "Ingest from AWS S3 buckets",
      "config_schema": {...}
    }
  ]
}

# Create ingestion job
POST /api/ingestion/jobs
Request: {
  "name": "S3 Document Ingestion",
  "connector_type": "s3",
  "config": {
    "bucket": "my-documents",
    "prefix": "uploads/",
    "file_pattern": "*.pdf"
  },
  "schedule": "0 */6 * * *"  # Every 6 hours
}
Response: {
  "job_id": "job_123",
  "status": "created"
}

# List ingestion jobs
GET /api/ingestion/jobs
Response: {
  "jobs": [
    {
      "job_id": "job_123",
      "name": "S3 Document Ingestion",
      "status": "running",
      "last_run": "2025-11-07T15:00:00Z",
      "next_run": "2025-11-07T21:00:00Z",
      "total_files_ingested": 15000
    }
  ]
}

# Get job logs
GET /api/ingestion/jobs/{job_id}/logs
Response: {
  "logs": [
    {
      "timestamp": "2025-11-07T15:00:05Z",
      "level": "INFO",
      "message": "Started ingestion from S3"
    }
  ]
}
```

### Implementation Plan

1. **Create `platform_api_gateway.py`**
   - FastAPI application
   - CORS configuration
   - JWT authentication middleware
   - Error handling

2. **Implement Lakehouse Endpoints**
   - Use existing `DeltaLakeManager` class
   - Add pagination and filtering
   - Implement caching for table metadata

3. **Implement Analytics Endpoints**
   - Query Silver/Gold layers
   - Aggregate statistics
   - Time-series data

4. **Implement Ingestion Endpoints**
   - Use existing `IngestionEngine` class
   - Job scheduling with APScheduler
   - Status monitoring

---

## Phase 2: Node.js Integration Layer

### tRPC Procedures

Add new router in `server/routers.ts`:

```typescript
// Lakehouse router
lakehouse: router({
  listTables: protectedProcedure
    .query(async () => {
      const response = await fetch(`${PYTHON_API_URL}/api/lakehouse/tables`);
      return response.json();
    }),
  
  getTableSchema: protectedProcedure
    .input(z.object({ tableName: z.string() }))
    .query(async ({ input }) => {
      const response = await fetch(
        `${PYTHON_API_URL}/api/lakehouse/tables/${input.tableName}/schema`
      );
      return response.json();
    }),
  
  queryTable: protectedProcedure
    .input(z.object({
      tableName: z.string(),
      filters: z.record(z.any()).optional(),
      limit: z.number().default(100),
      offset: z.number().default(0)
    }))
    .mutation(async ({ input }) => {
      const response = await fetch(
        `${PYTHON_API_URL}/api/lakehouse/tables/${input.tableName}/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        }
      );
      return response.json();
    })
}),

// Analytics router
analytics: router({
  getProcessingTrends: protectedProcedure
    .input(z.object({
      period: z.enum(['7d', '30d', '90d']).default('30d'),
      granularity: z.enum(['hour', 'day', 'week']).default('day')
    }))
    .query(async ({ input }) => {
      const response = await fetch(
        `${PYTHON_API_URL}/api/analytics/processing-trends?period=${input.period}&granularity=${input.granularity}`
      );
      return response.json();
    }),
  
  getCategoryStats: protectedProcedure
    .query(async () => {
      const response = await fetch(`${PYTHON_API_URL}/api/analytics/categories`);
      return response.json();
    })
}),

// Ingestion router
ingestion: router({
  listConnectors: protectedProcedure
    .query(async () => {
      const response = await fetch(`${PYTHON_API_URL}/api/ingestion/connectors`);
      return response.json();
    }),
  
  createJob: protectedProcedure
    .input(z.object({
      name: z.string(),
      connectorType: z.string(),
      config: z.record(z.any()),
      schedule: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const response = await fetch(
        `${PYTHON_API_URL}/api/ingestion/jobs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        }
      );
      return response.json();
    })
})
```

---

## Phase 3: Frontend UI Components

### 1. Lakehouse Explorer Page

**Route**: `/lakehouse`

**Components**:
- `LakehouseExplorer.tsx` - Main page
- `TableList.tsx` - List of Delta tables
- `TableViewer.tsx` - Table data viewer with pagination
- `SchemaViewer.tsx` - Schema display
- `QueryBuilder.tsx` - Visual query builder
- `TimeTravel.tsx` - Version history browser

**Features**:
- Browse Bronze/Silver/Gold layers
- View table schemas
- Query table data with filters
- Time travel to previous versions
- Export query results

### 2. Analytics Dashboard

**Route**: `/analytics`

**Components**:
- `AnalyticsDashboard.tsx` - Main dashboard
- `ProcessingTrendsChart.tsx` - Line chart (Recharts)
- `CategoryStatsChart.tsx` - Bar chart
- `ErrorPatternsTable.tsx` - Error analysis
- `PerformanceMetrics.tsx` - KPI cards

**Features**:
- Processing trends over time
- Success rates by category
- Average processing times
- Error pattern analysis
- Real-time metrics

### 3. Ingestion Manager

**Route**: `/ingestion`

**Components**:
- `IngestionManager.tsx` - Main page
- `ConnectorList.tsx` - Available connectors
- `JobList.tsx` - Ingestion jobs
- `JobForm.tsx` - Create/edit job
- `JobLogs.tsx` - Job execution logs

**Features**:
- Configure data sources
- Schedule ingestion jobs
- Monitor job status
- View ingestion logs
- Retry failed jobs

---

## Phase 4: PWA Implementation

### Service Worker

Create `client/public/sw.js`:

```javascript
const CACHE_NAME = 'doc-intelligence-v1';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/logo.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE);
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});
```

### PWA Manifest

Create `client/public/manifest.json`:

```json
{
  "name": "Document Intelligence Platform",
  "short_name": "DocIntel",
  "description": "Intelligent document processing with OCR and analytics",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-1.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile-1.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["productivity", "business"],
  "shortcuts": [
    {
      "name": "Upload Document",
      "short_name": "Upload",
      "description": "Upload a new document",
      "url": "/upload",
      "icons": [{ "src": "/icons/upload.png", "sizes": "96x96" }]
    },
    {
      "name": "View Documents",
      "short_name": "Documents",
      "description": "View all documents",
      "url": "/documents",
      "icons": [{ "src": "/icons/documents.png", "sizes": "96x96" }]
    }
  ]
}
```

### Offline Support

**Features**:
- Cache document list for offline viewing
- Queue uploads when offline
- Sync when connection restored
- Offline indicator in UI

---

## Phase 5: Mobile Optimization

### Camera Integration

```typescript
// client/src/components/CameraCapture.tsx
import { useRef, useState } from 'react';

export function CameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
    setStream(mediaStream);
  };

  const capturePhoto = () => {
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    if (!video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        onCapture(file);
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline />
      <button onClick={startCamera}>Start Camera</button>
      <button onClick={capturePhoto}>Capture</button>
    </div>
  );
}
```

### Touch Gestures

- Swipe gestures for navigation
- Pinch-to-zoom for document viewing
- Pull-to-refresh for document list
- Long-press for context menus

---

## Implementation Timeline

### Week 1-2: Python API Gateway
- [ ] Create `platform_api_gateway.py`
- [ ] Implement lakehouse endpoints
- [ ] Implement analytics endpoints
- [ ] Implement ingestion endpoints
- [ ] Add authentication middleware
- [ ] Write API tests

### Week 3-4: Node.js Integration
- [ ] Add lakehouse tRPC router
- [ ] Add analytics tRPC router
- [ ] Add ingestion tRPC router
- [ ] Implement caching layer
- [ ] Add error handling
- [ ] Write integration tests

### Week 5-6: Lakehouse UI
- [ ] Create LakehouseExplorer page
- [ ] Implement TableViewer component
- [ ] Add QueryBuilder component
- [ ] Implement time travel UI
- [ ] Add export functionality

### Week 7-8: Analytics Dashboard
- [ ] Create AnalyticsDashboard page
- [ ] Implement chart components (Recharts)
- [ ] Add KPI cards
- [ ] Implement date range selector
- [ ] Add real-time updates

### Week 9-10: Ingestion Manager
- [ ] Create IngestionManager page
- [ ] Implement connector configuration UI
- [ ] Add job scheduling interface
- [ ] Implement log viewer
- [ ] Add job monitoring

### Week 11-12: PWA & Mobile
- [ ] Implement service worker
- [ ] Create PWA manifest
- [ ] Add offline support
- [ ] Implement camera capture
- [ ] Add touch gestures
- [ ] Generate app icons
- [ ] Test installation flow

---

## Testing Strategy

### Unit Tests
- Python: pytest for API Gateway
- Node.js: Jest for tRPC procedures
- React: React Testing Library for components

### Integration Tests
- End-to-end API flows
- Authentication flows
- Data synchronization
- Offline/online transitions

### Performance Tests
- API response times
- Large dataset queries
- Concurrent user load
- Mobile performance

### PWA Tests
- Service worker caching
- Offline functionality
- Install prompt
- Push notifications

---

## Deployment Architecture

### Production Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (NGINX)                     │
│  - SSL Termination                                           │
│  - Rate Limiting                                             │
│  - Request Routing                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (NGINX)                     │
│  /                    → React SPA (Static)                   │
│  /api/trpc/*          → Node.js (Port 3000)                  │
│  /api/ocr/*           → Python OCR (Port 8001)               │
│  /api/lakehouse/*     → Python API Gateway (Port 8002)       │
│  /api/analytics/*     → Python API Gateway (Port 8002)       │
│  /api/ingestion/*     → Python API Gateway (Port 8002)       │
└─────────────────────────────────────────────────────────────┘
```

### Container Configuration

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  frontend:
    build: ./client
    ports:
      - "80:80"
    depends_on:
      - nodejs-api
  
  nodejs-api:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OCR_SERVICE_URL=http://ocr-service:8001
      - PYTHON_API_URL=http://python-api:8002
    depends_on:
      - database
      - ocr-service
      - python-api
  
  ocr-service:
    build: ../document_intelligence_platform/docker/ocr
    ports:
      - "8001:8001"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
  
  python-api:
    build: ../document_intelligence_platform/docker/api-gateway
    ports:
      - "8002:8002"
    environment:
      - SPARK_MASTER_URL=${SPARK_MASTER_URL}
      - DELTA_LAKE_PATH=${DELTA_LAKE_PATH}
    depends_on:
      - spark-master
  
  database:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=document_intelligence
    volumes:
      - db-data:/var/lib/mysql
  
  spark-master:
    image: bitnami/spark:3.5
    environment:
      - SPARK_MODE=master
    ports:
      - "8080:8080"
      - "7077:7077"

volumes:
  db-data:
```

---

## Security Considerations

### Authentication
- JWT tokens for Python API Gateway
- Session cookies for Node.js
- Token refresh mechanism
- Role-based access control

### Data Protection
- HTTPS everywhere
- Encrypted data at rest
- Secure S3 bucket policies
- Input validation and sanitization

### API Security
- Rate limiting
- CORS configuration
- SQL injection prevention
- XSS protection

---

## Monitoring & Observability

### Metrics
- API response times
- Error rates
- OCR processing throughput
- Database query performance
- Cache hit rates

### Logging
- Structured logging (JSON)
- Log aggregation (ELK stack)
- Error tracking (Sentry)
- Audit logs

### Alerting
- Service health checks
- Error rate thresholds
- Performance degradation
- Disk space warnings

---

## Conclusion

This integration architecture provides a comprehensive plan for unifying the Python backend platform with the Node.js/React UI. The phased approach ensures incremental delivery of value while maintaining system stability.

**Key Benefits**:
- Unified user experience
- Full access to backend capabilities
- Type-safe API layer
- PWA support for offline use
- Mobile-optimized interface
- Scalable architecture

**Next Steps**:
1. Review and approve architecture
2. Set up development environment
3. Begin Phase 1 implementation
4. Establish CI/CD pipeline
5. Plan production deployment
