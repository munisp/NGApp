# Deployment Checklist

## Pre-Deployment Verification

### ✅ Phase 1: Local Testing Complete

- [x] OCR Service running on port 8001
- [x] API Gateway running on port 8002
- [x] Node.js UI running on port 3000
- [x] PWA icons generated (8 sizes)
- [x] Date range presets implemented
- [x] Java upgraded to version 17
- [ ] Environment variables configured (User action required)
- [ ] End-to-end OCR test passed
- [ ] Batch upload test passed
- [ ] Analytics dashboard verified
- [ ] Lakehouse explorer tested

### ✅ Phase 2: Code Quality

- [x] No TypeScript errors
- [x] No ESLint errors
- [x] All dependencies installed
- [x] Database schema up to date
- [x] API endpoints documented
- [x] Error handling implemented
- [x] Loading states added
- [x] Responsive design verified

### ✅ Phase 3: Features Implemented

**Core Features:**
- [x] Document upload (single & batch)
- [x] OCR processing (EasyOCR + Tesseract)
- [x] Real-time WebSocket notifications
- [x] Document search and filtering
- [x] Date range presets
- [x] Category management
- [x] Status tracking
- [x] Document comparison

**Analytics Features:**
- [x] Processing trends chart
- [x] Category statistics
- [x] Error patterns table
- [x] KPI cards
- [x] Date range filtering

**Lakehouse Features:**
- [x] Table browser
- [x] Schema viewer
- [x] Data query interface
- [x] CSV export
- [x] Pagination

**PWA Features:**
- [x] Service worker
- [x] Manifest.json
- [x] App icons (8 sizes)
- [x] Offline support
- [x] Install prompt

**UX Features:**
- [x] Welcome modal
- [x] Guided tours
- [x] Loading skeletons
- [x] Empty states
- [x] Error messages
- [x] Toast notifications

## Production Deployment Steps

### Step 1: Environment Configuration

**Required Environment Variables:**

```bash
# Database
DATABASE_URL=mysql://user:pass@host:3306/dbname

# Authentication
JWT_SECRET=your-secret-key-here
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im

# OCR Service
OCR_SERVICE_URL=https://your-ocr-service.com

# API Gateway
PYTHON_API_URL=https://your-api-gateway.com

# Storage
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Application
VITE_APP_TITLE=Document Intelligence Platform
VITE_APP_LOGO=https://your-cdn.com/logo.png
NODE_ENV=production
```

### Step 2: Database Setup

```bash
# Run migrations
cd /home/ubuntu/document_intelligence_ui
pnpm db:push

# Verify tables created
# Check users, documents, batches, batch_documents tables
```

### Step 3: Build Application

```bash
# Install dependencies
pnpm install

# Build for production
pnpm build

# Test production build locally
pnpm preview
```

### Step 4: Deploy Services

**OCR Service Deployment:**
```bash
# Option A: Docker
docker build -t ocr-service ./ocr_pipeline
docker run -d -p 8001:8001 ocr-service

# Option B: Systemd service
sudo cp ocr-service.service /etc/systemd/system/
sudo systemctl enable ocr-service
sudo systemctl start ocr-service
```

**API Gateway Deployment:**
```bash
# Option A: Docker
docker build -t api-gateway .
docker run -d -p 8002:8002 api-gateway

# Option B: Systemd service
sudo cp api-gateway.service /etc/systemd/system/
sudo systemctl enable api-gateway
sudo systemctl start api-gateway
```

**Node.js UI Deployment:**
```bash
# Option A: PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Option B: Docker
docker build -t doc-intel-ui .
docker run -d -p 3000:3000 doc-intel-ui

# Option C: Serverless (Vercel, Netlify, etc.)
# Follow platform-specific deployment guide
```

### Step 5: Configure Reverse Proxy

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    # UI
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # OCR Service
    location /api/ocr/ {
        proxy_pass http://localhost:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Gateway
    location /api/lakehouse/ {
        proxy_pass http://localhost:8002/api/lakehouse/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Step 6: SSL/TLS Setup

```bash
# Using Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Step 7: Monitoring Setup

**Health Check Endpoints:**
- UI: `https://your-domain.com/`
- OCR: `https://your-domain.com/api/ocr/health`
- Gateway: `https://your-domain.com/api/lakehouse/health`

**Monitoring Tools:**
```bash
# Install monitoring agent
# - Datadog
# - New Relic
# - Prometheus + Grafana
# - Sentry for error tracking
```

### Step 8: Backup Strategy

**Database Backups:**
```bash
# Daily automated backups
0 2 * * * mysqldump -u user -p database > /backups/db_$(date +\%Y\%m\%d).sql

# Retention: 30 days
find /backups -name "db_*.sql" -mtime +30 -delete
```

**S3 Backups:**
- Enable versioning on S3 bucket
- Configure lifecycle policies
- Set up cross-region replication

**Configuration Backups:**
```bash
# Backup environment variables
cp .env .env.backup.$(date +%Y%m%d)

# Backup nginx config
sudo cp /etc/nginx/sites-available/default /etc/nginx/backup/
```

## Post-Deployment Verification

### Step 1: Smoke Tests

```bash
# Test UI
curl -I https://your-domain.com

# Test OCR Service
curl https://your-domain.com/api/ocr/health

# Test API Gateway
curl https://your-domain.com/api/lakehouse/health

# Test WebSocket
# Open browser DevTools → Network → WS
# Should see active connection
```

### Step 2: Functional Tests

- [ ] User can register/login
- [ ] Document upload works
- [ ] OCR processing completes
- [ ] Real-time notifications appear
- [ ] Search and filters work
- [ ] Analytics dashboard loads
- [ ] Lakehouse explorer accessible
- [ ] Batch upload processes files
- [ ] Document comparison works
- [ ] PWA installs on mobile

### Step 3: Performance Tests

```bash
# Load testing with Apache Bench
ab -n 1000 -c 10 https://your-domain.com/

# OCR endpoint stress test
ab -n 100 -c 5 -p test_image.json -T application/json \
   https://your-domain.com/api/ocr/process

# Expected results:
# - Response time < 2s for UI
# - OCR processing < 500ms
# - No 500 errors
# - No memory leaks
```

### Step 4: Security Audit

- [ ] HTTPS enabled everywhere
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation in place
- [ ] SQL injection protection
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Secrets not in code
- [ ] Database credentials secured

### Step 5: Monitoring Alerts

Configure alerts for:
- [ ] Service downtime (> 1 minute)
- [ ] High error rate (> 5%)
- [ ] Slow response time (> 3s)
- [ ] High CPU usage (> 80%)
- [ ] High memory usage (> 90%)
- [ ] Disk space low (< 10%)
- [ ] Database connection failures
- [ ] S3 upload failures

## Rollback Plan

If deployment fails:

### Step 1: Identify Issue
```bash
# Check logs
tail -f /var/log/nginx/error.log
pm2 logs
docker logs container_id

# Check service status
systemctl status ocr-service
systemctl status api-gateway
pm2 status
```

### Step 2: Rollback Code
```bash
# Revert to previous version
git checkout previous-version-tag
pnpm install
pnpm build
pm2 restart all
```

### Step 3: Rollback Database
```bash
# Restore from backup
mysql -u user -p database < /backups/db_YYYYMMDD.sql
```

### Step 4: Verify Rollback
```bash
# Test all endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/ocr/health
curl https://your-domain.com/api/lakehouse/health
```

## Maintenance Schedule

### Daily:
- Monitor error logs
- Check disk space
- Verify backup completion
- Review performance metrics

### Weekly:
- Review analytics data
- Check for security updates
- Test backup restoration
- Review user feedback

### Monthly:
- Update dependencies
- Security audit
- Performance optimization
- Capacity planning review

## Support Contacts

**Technical Issues:**
- Platform Admin: admin@your-domain.com
- DevOps Team: devops@your-domain.com
- On-call: +1-XXX-XXX-XXXX

**Service Providers:**
- Hosting: support@hosting-provider.com
- Database: support@db-provider.com
- CDN: support@cdn-provider.com

## Documentation Links

- [Quick Start Guide](./QUICK_START.md)
- [End-to-End Testing](./END_TO_END_TESTING.md)
- [OCR Configuration](./OCR_SERVICE_CONFIGURATION.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API.md)

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Version:** _____________
**Environment:** _____________

**Sign-off:**
- [ ] Technical Lead
- [ ] DevOps Engineer
- [ ] QA Engineer
- [ ] Product Manager
