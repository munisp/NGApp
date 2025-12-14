# Unified Document Intelligence Platform - Deployment Guide

**Version**: 1.0  
**Date**: November 7, 2025  
**Status**: Production Ready

---

## Overview

This guide provides complete instructions for deploying the unified Document Intelligence Platform, which consists of:

1. **Node.js/React UI** - Web application with authentication, document management, and PWA support
2. **Python OCR Service** - Ensemble OCR processing with multiple engines
3. **Python API Gateway** - Lakehouse, analytics, and ingestion services
4. **Database** - MySQL/TiDB for application data
5. **Storage** - S3-compatible object storage for documents
6. **Lakehouse** - Delta Lake for data warehousing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOAD BALANCER                            │
│                      (NGINX / CloudFlare)                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND (Port 80/443)                     │
│  - React SPA (Static Files)                                      │
│  - PWA Service Worker                                            │
│  - Offline Support                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NODE.JS API (Port 3000)                       │
│  - tRPC Procedures                                               │
│  - Authentication                                                │
│  - WebSocket Server                                              │
│  - API Proxy                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────┬──────────────────────┬───────────────────┐
│  PYTHON OCR SERVICE  │  PYTHON API GATEWAY  │   DATABASE        │
│  (Port 8001)         │  (Port 8002)         │   (Port 3306)     │
│  - Ensemble OCR      │  - Lakehouse API     │   - MySQL/TiDB    │
│  - Multi-engine      │  - Analytics API     │   - User Data     │
│  - Batch Processing  │  - Ingestion API     │   - Documents     │
└──────────────────────┴──────────────────────┴───────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       DATA & STORAGE LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  S3 Storage  │  │  Delta Lake  │  │  Spark Cluster     │    │
│  │  - Documents │  │  - Bronze    │  │  - Processing      │    │
│  │  - OCR Files │  │  - Silver    │  │  - Analytics       │    │
│  │              │  │  - Gold      │  │                    │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

**Minimum (Development)**:
- CPU: 4 cores
- RAM: 16 GB
- Disk: 100 GB SSD
- GPU: Optional (for OCR acceleration)

**Recommended (Production)**:
- CPU: 16+ cores
- RAM: 64+ GB
- Disk: 500 GB+ SSD
- GPU: NVIDIA GPU with 8+ GB VRAM (for OCR)

### Software Requirements

- Docker 24.0+
- Docker Compose 2.20+
- Node.js 22.x (for local development)
- Python 3.11+ (for local development)
- NVIDIA Docker Runtime (if using GPU)

---

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
# Clone the repositories
git clone <ui-repo-url> document_intelligence_ui
git clone <platform-repo-url> document_intelligence_platform

# Create environment file
cd document_intelligence_ui
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env`:

```bash
# Database
DATABASE_URL=mysql://root:password@database:3306/document_intelligence

# Authentication
JWT_SECRET=<generate-random-secret>
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=<your-owner-id>

# Python Services
OCR_SERVICE_URL=http://ocr-service:8001
PYTHON_API_URL=http://python-api:8002

# Storage
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=us-east-1
AWS_S3_BUCKET=document-intelligence

# Spark & Delta Lake
SPARK_MASTER_URL=spark://spark-master:7077
DELTA_LAKE_PATH=/data/delta_lake

# Optional: Analytics
VITE_ANALYTICS_ENDPOINT=https://analytics.yourdomain.com
VITE_ANALYTICS_WEBSITE_ID=<your-website-id>
```

### 3. Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 4. Access the Application

- **Web UI**: http://localhost (or your domain)
- **Node.js API**: http://localhost:3000
- **OCR Service**: http://localhost:8001
- **Python API**: http://localhost:8002
- **Spark UI**: http://localhost:8080

---

## Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Frontend (React SPA)
  frontend:
    build:
      context: ./document_intelligence_ui/client
      dockerfile: Dockerfile
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_APP_TITLE=Document Intelligence Platform
      - VITE_APP_LOGO=/logo.svg
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - nodejs-api
    restart: unless-stopped

  # Node.js API Server
  nodejs-api:
    build:
      context: ./document_intelligence_ui
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - OCR_SERVICE_URL=http://ocr-service:8001
      - PYTHON_API_URL=http://python-api:8002
      - OAUTH_SERVER_URL=${OAUTH_SERVER_URL}
      - OWNER_OPEN_ID=${OWNER_OPEN_ID}
    depends_on:
      - database
      - ocr-service
      - python-api
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Python OCR Service
  ocr-service:
    build:
      context: ./document_intelligence_platform
      dockerfile: docker/Dockerfile.ocr
    ports:
      - "8001:8001"
    environment:
      - PYTHONUNBUFFERED=1
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
    volumes:
      - ocr-models:/app/models
      - ocr-cache:/app/.cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Python API Gateway
  python-api:
    build:
      context: ./document_intelligence_platform
      dockerfile: docker/Dockerfile.api-gateway
    ports:
      - "8002:8002"
    environment:
      - PYTHONUNBUFFERED=1
      - SPARK_MASTER_URL=spark://spark-master:7077
      - DELTA_LAKE_PATH=/data/delta_lake
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    volumes:
      - delta-lake-data:/data/delta_lake
    depends_on:
      - spark-master
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # MySQL Database
  database:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=document_intelligence
      - MYSQL_CHARACTER_SET_SERVER=utf8mb4
      - MYSQL_COLLATION_SERVER=utf8mb4_unicode_ci
    volumes:
      - db-data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Apache Spark Master
  spark-master:
    image: bitnami/spark:3.5
    environment:
      - SPARK_MODE=master
      - SPARK_RPC_AUTHENTICATION_ENABLED=no
      - SPARK_RPC_ENCRYPTION_ENABLED=no
      - SPARK_LOCAL_STORAGE_ENCRYPTION_ENABLED=no
      - SPARK_SSL_ENABLED=no
    ports:
      - "8080:8080"
      - "7077:7077"
    volumes:
      - spark-data:/opt/spark-data
    restart: unless-stopped

  # Apache Spark Worker
  spark-worker:
    image: bitnami/spark:3.5
    environment:
      - SPARK_MODE=worker
      - SPARK_MASTER_URL=spark://spark-master:7077
      - SPARK_WORKER_MEMORY=4G
      - SPARK_WORKER_CORES=4
      - SPARK_RPC_AUTHENTICATION_ENABLED=no
      - SPARK_RPC_ENCRYPTION_ENABLED=no
      - SPARK_LOCAL_STORAGE_ENCRYPTION_ENABLED=no
      - SPARK_SSL_ENABLED=no
    depends_on:
      - spark-master
    volumes:
      - spark-data:/opt/spark-data
    restart: unless-stopped
    deploy:
      replicas: 2

volumes:
  db-data:
  ocr-models:
  ocr-cache:
  delta-lake-data:
  spark-data:

networks:
  default:
    driver: bridge
```

---

## Dockerfiles

### Node.js API Dockerfile

Create `document_intelligence_ui/Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy built artifacts and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
```

### Python OCR Service Dockerfile

Create `document_intelligence_platform/docker/Dockerfile.ocr`:

```dockerfile
FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    tesseract-ocr \
    libtesseract-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download OCR models
RUN python3 -c "import paddleocr; paddleocr.PaddleOCR(use_angle_cls=True, lang='en')"
RUN python3 -c "import easyocr; easyocr.Reader(['en'])"

EXPOSE 8001

CMD ["python3", "ocr_pipeline/ensemble_ocr_service.py"]
```

### Python API Gateway Dockerfile

Create `document_intelligence_platform/docker/Dockerfile.api-gateway`:

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    openjdk-17-jre-headless \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8002

CMD ["python", "platform_api_gateway.py"]
```

---

## NGINX Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    upstream nodejs_backend {
        server nodejs-api:3000;
    }

    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;

        # Static files (React SPA)
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            expires 1h;
            add_header Cache-Control "public, immutable";
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://nodejs_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://nodejs_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

---

## Database Initialization

Create `init.sql`:

```sql
CREATE DATABASE IF NOT EXISTS document_intelligence
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE document_intelligence;

-- Tables will be created automatically by Drizzle migrations
-- This file can include any initial data or configuration
```

---

## Environment-Specific Configurations

### Development

```bash
# .env.development
NODE_ENV=development
DATABASE_URL=mysql://root:password@localhost:3306/document_intelligence_dev
OCR_SERVICE_URL=http://localhost:8001
PYTHON_API_URL=http://localhost:8002
```

### Staging

```bash
# .env.staging
NODE_ENV=production
DATABASE_URL=mysql://user:pass@staging-db.example.com:3306/document_intelligence
OCR_SERVICE_URL=https://ocr-staging.example.com
PYTHON_API_URL=https://api-staging.example.com
```

### Production

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=mysql://user:pass@prod-db.example.com:3306/document_intelligence
OCR_SERVICE_URL=https://ocr.example.com
PYTHON_API_URL=https://api.example.com
```

---

## Deployment Steps

### 1. Initial Setup

```bash
# Create project directory
mkdir -p /opt/document-intelligence
cd /opt/document-intelligence

# Clone repositories
git clone <ui-repo> document_intelligence_ui
git clone <platform-repo> document_intelligence_platform

# Create environment file
cp document_intelligence_ui/.env.example document_intelligence_ui/.env
```

### 2. Configure Services

```bash
# Edit environment variables
nano document_intelligence_ui/.env

# Generate secrets
openssl rand -hex 32  # For JWT_SECRET
```

### 3. Build and Deploy

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 4. Initialize Database

```bash
# Run migrations
docker-compose exec nodejs-api pnpm db:push

# Verify tables
docker-compose exec database mysql -u root -p -e "USE document_intelligence; SHOW TABLES;"
```

### 5. Verify Deployment

```bash
# Check service health
curl http://localhost/health
curl http://localhost:3000/api/health
curl http://localhost:8001/health
curl http://localhost:8002/health

# Check Spark cluster
curl http://localhost:8080
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Restart service
docker-compose restart [service-name]
```

### Backup

```bash
# Backup database
docker-compose exec database mysqldump -u root -p document_intelligence > backup.sql

# Backup Delta Lake
tar -czf delta-lake-backup.tar.gz /path/to/delta_lake

# Backup S3 (if using local storage)
aws s3 sync s3://document-intelligence ./s3-backup
```

### Updates

```bash
# Pull latest code
cd document_intelligence_ui && git pull
cd ../document_intelligence_platform && git pull

# Rebuild and restart
docker-compose build
docker-compose up -d
```

---

## Scaling

### Horizontal Scaling

```yaml
# Scale services in docker-compose.yml
services:
  nodejs-api:
    deploy:
      replicas: 3
  
  spark-worker:
    deploy:
      replicas: 5
```

### Load Balancing

Use NGINX or a cloud load balancer to distribute traffic across multiple Node.js instances.

### Database Scaling

- Use read replicas for read-heavy workloads
- Consider TiDB for horizontal scalability
- Implement connection pooling

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure firewall rules
- [ ] Enable database encryption at rest
- [ ] Implement rate limiting
- [ ] Set up WAF (Web Application Firewall)
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Secrets management (use HashiCorp Vault or AWS Secrets Manager)

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs [service-name]

# Check disk space
df -h

# Check memory
free -h
```

### Database Connection Issues

```bash
# Test connection
docker-compose exec nodejs-api nc -zv database 3306

# Check database logs
docker-compose logs database
```

### OCR Service Slow

- Check GPU availability: `nvidia-smi`
- Increase worker replicas
- Optimize batch sizes
- Use caching for frequently processed documents

---

## Support & Resources

- **Documentation**: https://docs.example.com
- **Issue Tracker**: https://github.com/org/repo/issues
- **Community**: https://community.example.com
- **Email**: support@example.com

---

## License

Copyright © 2025 Document Intelligence Platform. All rights reserved.
