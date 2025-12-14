# Deployment Guide

This guide explains how to deploy the Document Intelligence Platform UI and integrate it with the OCR ensemble service.

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Web Browser   │─────▶│   UI Service     │─────▶│  OCR Ensemble   │
│                 │      │  (This Project)  │      │    Service      │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                │                           │
                                ▼                           ▼
                         ┌──────────────┐          ┌──────────────┐
                         │   Database   │          │  Delta Lake  │
                         │ (MySQL/TiDB) │          │  (Bronze/    │
                         └──────────────┘          │   Silver/    │
                                │                  │   Gold)      │
                                ▼                  └──────────────┘
                         ┌──────────────┐
                         │  S3 Storage  │
                         │  (Documents) │
                         └──────────────┘
```

## Prerequisites

### 1. OCR Ensemble Service

The UI requires a running OCR ensemble service. You can deploy it using:

**Option A: Docker Compose**
```bash
cd /home/ubuntu/document_intelligence_platform
docker-compose up -d ensemble-ocr
```

**Option B: Kubernetes with Helm**
```bash
cd /home/ubuntu/document_intelligence_platform/helm
helm install ensemble-ocr ./ensemble-ocr \
  --set image.tag=latest \
  --set service.type=ClusterIP
```

**Option C: Serverless (AWS Lambda)**
```bash
cd /home/ubuntu/document_intelligence_platform/deployment/serverless/aws
terraform init
terraform apply
```

### 2. Database Setup

The UI uses MySQL/TiDB for storing document metadata and OCR results.

```sql
-- Database is automatically created by Manus platform
-- Schema is managed by Drizzle ORM

-- Verify tables exist:
SHOW TABLES;
-- Expected: users, documents, ocrResults
```

### 3. S3-Compatible Storage

Configure S3 storage for document uploads:
- Manus platform provides built-in S3-compatible storage
- Or use AWS S3, MinIO, or any S3-compatible service

## Deployment Options

### Option 1: Manus Platform (Recommended)

The simplest deployment method using the Manus platform:

1. **Save Checkpoint**
   ```bash
   # In Manus UI, save a checkpoint
   # This creates a deployment-ready snapshot
   ```

2. **Configure Environment**
   - Navigate to Management UI → Settings → Secrets
   - Add `OCR_SERVICE_URL` pointing to your OCR service
   - Example: `http://ensemble-ocr:8001` (Kubernetes)
   - Example: `https://your-lambda-url.amazonaws.com` (AWS Lambda)

3. **Publish**
   - Click "Publish" button in Management UI
   - Access via auto-generated domain: `https://xxx.manus.space`
   - Or configure custom domain in Settings → Domains

### Option 2: Docker Deployment

Deploy both UI and OCR service together:

1. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   
   services:
     ui:
       build: /home/ubuntu/document_intelligence_ui
       ports:
         - "3000:3000"
       environment:
         - DATABASE_URL=mysql://user:pass@db:3306/docai
         - OCR_SERVICE_URL=http://ocr:8001
         - JWT_SECRET=your-secret
         # ... other env vars
       depends_on:
         - db
         - ocr
     
     ocr:
       image: document-intelligence-ocr:latest
       ports:
         - "8001:8001"
       environment:
         - DEEPSEEK_API_KEY=your-key
         - ENSEMBLE_STRATEGY=highest_confidence
     
     db:
       image: mysql:8.0
       environment:
         - MYSQL_ROOT_PASSWORD=rootpass
         - MYSQL_DATABASE=docai
       volumes:
         - db_data:/var/lib/mysql
   
   volumes:
     db_data:
   ```

2. **Build and Run**
   ```bash
   docker-compose up -d
   ```

### Option 3: Kubernetes Deployment

Deploy to Kubernetes cluster:

1. **Create Namespace**
   ```bash
   kubectl create namespace docai
   ```

2. **Deploy OCR Service**
   ```bash
   cd /home/ubuntu/document_intelligence_platform/helm
   helm install ensemble-ocr ./ensemble-ocr \
     --namespace docai \
     --set image.repository=your-registry/ensemble-ocr \
     --set image.tag=latest
   ```

3. **Deploy UI Service**
   ```bash
   # Build Docker image
   cd /home/ubuntu/document_intelligence_ui
   docker build -t your-registry/docai-ui:latest .
   docker push your-registry/docai-ui:latest
   
   # Create deployment
   kubectl apply -f - <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: docai-ui
     namespace: docai
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: docai-ui
     template:
       metadata:
         labels:
           app: docai-ui
       spec:
         containers:
         - name: ui
           image: your-registry/docai-ui:latest
           ports:
           - containerPort: 3000
           env:
           - name: OCR_SERVICE_URL
             value: "http://ensemble-ocr:8001"
           - name: DATABASE_URL
             valueFrom:
               secretKeyRef:
                 name: docai-secrets
                 key: database-url
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: docai-ui
     namespace: docai
   spec:
     selector:
       app: docai-ui
     ports:
     - port: 80
       targetPort: 3000
     type: LoadBalancer
   EOF
   ```

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=mysql://user:pass@host:3306/database

# OAuth (Manus Platform)
JWT_SECRET=your-jwt-secret
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# Storage (S3-compatible)
# Configured automatically by Manus platform
# Or set manually for self-hosted:
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=us-east-1
# S3_BUCKET=docai-uploads

# OCR Service
OCR_SERVICE_URL=http://ensemble-ocr:8001

# App Branding
VITE_APP_TITLE=Document Intelligence Platform UI
VITE_APP_LOGO=https://your-logo-url.com/logo.png
```

### Optional Environment Variables

```bash
# OCR Service Timeout (default: 300000ms = 5 minutes)
OCR_TIMEOUT_MS=300000

# File Upload Limits
MAX_FILE_SIZE_MB=50

# Polling Intervals (milliseconds)
DOCUMENT_LIST_REFETCH_INTERVAL=5000
DOCUMENT_DETAIL_REFETCH_INTERVAL=3000
```

## Integration with OCR Service

### Service Discovery

The UI communicates with the OCR service via HTTP. Configure the endpoint:

**Kubernetes (ClusterIP)**
```bash
OCR_SERVICE_URL=http://ensemble-ocr:8001
```

**Kubernetes (Ingress)**
```bash
OCR_SERVICE_URL=https://ocr.yourdomain.com
```

**AWS Lambda**
```bash
OCR_SERVICE_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

**Azure Functions**
```bash
OCR_SERVICE_URL=https://your-function-app.azurewebsites.net/api
```

### API Contract

The UI expects the OCR service to implement:

**Endpoint**: `POST /ocr`

**Request**:
```json
{
  "image_url": "https://s3.amazonaws.com/bucket/document.pdf",
  "document_type": "citizenship_identity",
  "strategy": "highest_confidence"
}
```

**Response**:
```json
{
  "text": "UNITED STATES OF AMERICA\\nCERTIFICATE OF BIRTH...",
  "confidence": 0.96,
  "processing_time_ms": 425,
  "metadata": {
    "selected_engine": "deepseek-ocr",
    "strategy": "highest_confidence",
    "engines_used": ["deepseek-ocr", "paddleocr", "easyocr", "tesseract"],
    "fields_extracted": {
      "full_name": "John Doe",
      "date_of_birth": "1990-01-15",
      "certificate_number": "2023-001234"
    }
  }
}
```

### Error Handling

The UI handles OCR service errors gracefully:

- **Service Unavailable**: Document status set to "failed"
- **Timeout**: Retries not implemented (manual re-upload required)
- **Invalid Response**: Logged and status set to "failed"

## Monitoring and Observability

### Health Checks

**UI Service**:
```bash
curl http://localhost:3000/api/health
```

**OCR Service**:
```bash
curl http://ensemble-ocr:8001/health
```

### Metrics

The OCR service exposes Prometheus metrics at `/metrics`:
- `ocr_requests_total`: Total OCR requests
- `ocr_processing_duration_seconds`: Processing time histogram
- `ocr_confidence_score`: Confidence score distribution

### Logging

**UI Service Logs**:
```bash
# Docker
docker logs docai-ui

# Kubernetes
kubectl logs -f deployment/docai-ui -n docai

# Manus Platform
# View in Management UI → Logs
```

**OCR Service Logs**:
```bash
# Docker
docker logs ensemble-ocr

# Kubernetes
kubectl logs -f deployment/ensemble-ocr -n docai
```

## Performance Tuning

### UI Service

1. **Horizontal Scaling**
   ```bash
   # Kubernetes
   kubectl scale deployment docai-ui --replicas=5 -n docai
   ```

2. **Database Connection Pooling**
   - Configured automatically by Drizzle ORM
   - Default: 10 connections per instance

3. **CDN for Static Assets**
   - Enable in Manus platform settings
   - Or configure CloudFront/Cloudflare

### OCR Service

1. **Autoscaling** (Kubernetes HPA)
   ```yaml
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: ensemble-ocr-hpa
   spec:
     scaleTargetRef:
       apiVersion: apps/v1
       kind: Deployment
       name: ensemble-ocr
     minReplicas: 3
     maxReplicas: 10
     metrics:
     - type: Resource
       resource:
         name: cpu
         target:
           type: Utilization
           averageUtilization: 70
   ```

2. **GPU Acceleration**
   - Configure in Helm values: `resources.limits.nvidia.com/gpu: 1`
   - Improves DeepSeek-OCR and EasyOCR performance

## Security Considerations

1. **Network Policies** (Kubernetes)
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: docai-network-policy
   spec:
     podSelector:
       matchLabels:
         app: docai-ui
     policyTypes:
     - Ingress
     - Egress
     ingress:
     - from:
       - podSelector:
           matchLabels:
             app: ingress-nginx
     egress:
     - to:
       - podSelector:
           matchLabels:
             app: ensemble-ocr
     - to:
       - podSelector:
           matchLabels:
             app: mysql
   ```

2. **TLS/SSL**
   - Enable HTTPS in Manus platform settings
   - Or configure cert-manager in Kubernetes

3. **Secrets Management**
   - Use Kubernetes Secrets or AWS Secrets Manager
   - Never commit secrets to version control

## Troubleshooting

### Issue: OCR Service Not Reachable

**Symptoms**: Documents stuck in "pending" status

**Solutions**:
1. Verify `OCR_SERVICE_URL` is correct
2. Check network connectivity:
   ```bash
   kubectl exec -it deployment/docai-ui -n docai -- curl http://ensemble-ocr:8001/health
   ```
3. Check OCR service logs for errors

### Issue: Database Connection Errors

**Symptoms**: 500 errors on API calls

**Solutions**:
1. Verify `DATABASE_URL` is correct
2. Check database is running:
   ```bash
   kubectl get pods -n docai | grep mysql
   ```
3. Test connection manually:
   ```bash
   mysql -h host -u user -p database
   ```

### Issue: File Upload Failures

**Symptoms**: Upload errors, files not saved

**Solutions**:
1. Verify S3 credentials are configured
2. Check S3 bucket permissions
3. Verify file size is under 50MB limit

## Backup and Recovery

### Database Backups

```bash
# MySQL dump
mysqldump -h host -u user -p database > backup.sql

# Restore
mysql -h host -u user -p database < backup.sql
```

### S3 Backups

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket docai-uploads \
  --versioning-configuration Status=Enabled

# Cross-region replication
aws s3api put-bucket-replication \
  --bucket docai-uploads \
  --replication-configuration file://replication.json
```

## Scaling Recommendations

| Load Level | UI Replicas | OCR Replicas | Database | Storage |
|-----------|-------------|--------------|----------|---------|
| Light (<100 docs/day) | 1-2 | 1-2 | Single instance | Standard S3 |
| Medium (100-1000 docs/day) | 3-5 | 3-5 | Master-replica | S3 + CloudFront |
| Heavy (>1000 docs/day) | 5-10 | 10-20 | Sharded cluster | S3 + CDN + Glacier |

## Cost Optimization

1. **Use Spot Instances** (AWS/GCP) for OCR workers
2. **S3 Lifecycle Policies**: Move old documents to Glacier
3. **Database Read Replicas**: Offload read queries
4. **Serverless for OCR**: Pay only for processing time

## Support

For deployment issues:
1. Check logs in Management UI
2. Review health check endpoints
3. Verify environment variables
4. Test OCR service independently
5. Contact platform support at https://help.manus.im

---

**Last Updated**: 2025-01-07
