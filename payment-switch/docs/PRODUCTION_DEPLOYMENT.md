# Production Deployment Guide

Complete guide for deploying the Payment Switch platform to production with Docker, monitoring, and best practices.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Database Setup](#database-setup)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Disaster Recovery](#backup--disaster-recovery)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Security Hardening](#security-hardening)
10. [Performance Optimization](#performance-optimization)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Infrastructure Requirements

**Minimum Server Specifications:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB SSD
- Network: 1Gbps

**Recommended for Production:**
- CPU: 8 cores
- RAM: 16GB
- Storage: 500GB SSD
- Network: 10Gbps
- Load Balancer: Yes
- CDN: Yes

**Software Requirements:**
- Docker 24.0+
- Docker Compose 2.20+
- Node.js 22+ (for build)
- MySQL 8.0+ or TiDB
- Redis 7.0+ (optional, for caching)
- Nginx (reverse proxy)

---

## Environment Configuration

### 1. Create Production Environment File

Create `/home/ubuntu/web-checkout/.env.production`:

```bash
# ===== Core Configuration =====
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

# ===== Database =====
DATABASE_URL=mysql://user:password@db-host:3306/payment_switch

# ===== Authentication =====
JWT_SECRET=<generate-strong-secret-here>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
VITE_APP_ID=<your-manus-app-id>
OWNER_OPEN_ID=<owner-openid>
OWNER_NAME=<owner-name>

# ===== Application =====
VITE_APP_TITLE="Payment Switch Platform"
VITE_APP_LOGO=https://yourdomain.com/logo.png
VITE_ANALYTICS_ENDPOINT=https://analytics.yourdomain.com
VITE_ANALYTICS_WEBSITE_ID=<website-id>

# ===== External APIs =====
# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SendGrid (Email)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME="Payment Switch Platform"

# Smile Identity (KYC)
SMILE_IDENTITY_PARTNER_ID=your_partner_id
SMILE_IDENTITY_API_KEY=your_api_key
SMILE_IDENTITY_ENVIRONMENT=production

# NIBSS (Nigerian Banking)
NIBSS_ORGANIZATION_CODE=your_org_code
NIBSS_API_KEY=your_api_key
NIBSS_ENVIRONMENT=production
NIBSS_CERT_PATH=/app/certs/nibss_cert.pem
NIBSS_KEY_PATH=/app/certs/nibss_key.pem

# Coinbase Commerce (Crypto)
COINBASE_COMMERCE_API_KEY=your_api_key
COINBASE_COMMERCE_WEBHOOK_SECRET=your_webhook_secret

# Circle (USDC)
CIRCLE_API_KEY=your_api_key
CIRCLE_ENVIRONMENT=production

# ===== Security =====
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
SESSION_DURATION_DAYS=7
SESSION_DURATION_REMEMBER_DAYS=30
IDLE_TIMEOUT_MINUTES=15

# ===== Monitoring =====
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
LOG_LEVEL=info
ENABLE_METRICS=true

# ===== Storage =====
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=<your-api-key>
VITE_FRONTEND_FORGE_API_KEY=<frontend-api-key>
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
```

### 2. Generate Secure Secrets

```bash
# Generate JWT secret (64 characters)
openssl rand -base64 48

# Generate webhook secrets
openssl rand -hex 32
```

---

## Docker Deployment

### 1. Create Dockerfile

Create `/home/ubuntu/web-checkout/Dockerfile`:

```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Copy server code
COPY server ./server
COPY drizzle ./drizzle
COPY shared ./shared

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server/_core/index.js"]
```

### 2. Create Docker Compose File

Create `/home/ubuntu/web-checkout/docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: payment-switch-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    volumes:
      - ./storage:/app/storage
      - ./logs:/app/logs
      - ./certs:/app/certs:ro
    depends_on:
      - db
      - redis
    networks:
      - payment-switch-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: mysql:8.0
    container_name: payment-switch-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: payment_switch
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/mysql
      - ./backups:/backups
    ports:
      - "3306:3306"
    networks:
      - payment-switch-network
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    container_name: payment-switch-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - payment-switch-network
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    container_name: payment-switch-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - app
    networks:
      - payment-switch-network

volumes:
  db-data:
  redis-data:

networks:
  payment-switch-network:
    driver: bridge
```

### 3. Deploy with Docker Compose

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Check status
docker-compose -f docker-compose.prod.yml ps

# Stop services
docker-compose -f docker-compose.prod.yml down
```

---

## Database Setup

### 1. Run Migrations

```bash
# Inside container
docker exec -it payment-switch-app pnpm db:push

# Or from host
cd /home/ubuntu/web-checkout
pnpm db:push
```

### 2. Create Database Backup Script

Create `/home/ubuntu/web-checkout/scripts/backup-db.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="payment_switch_$DATE.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec payment-switch-db mysqldump \
  -u root \
  -p${DB_ROOT_PASSWORD} \
  payment_switch \
  | gzip > $BACKUP_DIR/$BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "payment_switch_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

### 3. Schedule Daily Backups

```bash
# Add to crontab
crontab -e

# Add this line (runs at 2 AM daily)
0 2 * * * /home/ubuntu/web-checkout/scripts/backup-db.sh >> /home/ubuntu/logs/backup.log 2>&1
```

---

## SSL/TLS Configuration

### 1. Obtain SSL Certificate

**Option A: Let's Encrypt (Free)**

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (already set up by certbot)
sudo certbot renew --dry-run
```

**Option B: Commercial Certificate**

1. Purchase SSL certificate from provider
2. Download certificate files
3. Place in `/home/ubuntu/web-checkout/ssl/`

### 2. Configure Nginx

Create `/home/ubuntu/web-checkout/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

    # Upstream
    upstream app_server {
        server app:3000;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Logging
        access_log /var/log/nginx/access.log;
        error_log /var/log/nginx/error.log;

        # Proxy settings
        location / {
            proxy_pass http://app_server;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # API rate limiting
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://app_server;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # Login rate limiting
        location /api/oauth/ {
            limit_req zone=login_limit burst=5 nodelay;
            proxy_pass http://app_server;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Static files caching
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://app_server;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

---

## Monitoring & Logging

### 1. Set Up Health Check Endpoint

Already implemented at `/api/health`. Returns:

```json
{
  "status": "ok",
  "timestamp": "2024-11-28T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### 2. Configure Logging

Create `/home/ubuntu/web-checkout/server/utils/logger.ts`:

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### 3. Set Up Monitoring

**Option A: Prometheus + Grafana**

```yaml
# Add to docker-compose.prod.yml
  prometheus:
    image: prom/prometheus
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - payment-switch-network

  grafana:
    image: grafana/grafana
    container_name: grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - payment-switch-network
```

**Option B: Sentry (Error Tracking)**

```bash
# Install Sentry SDK
pnpm add @sentry/node @sentry/tracing
```

Add to `server/_core/index.ts`:

```typescript
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}
```

---

## Backup & Disaster Recovery

### 1. Automated Backups

**Database Backups:**
- Daily full backups at 2 AM
- Retention: 30 days
- Location: `/home/ubuntu/backups/`

**File Backups:**
```bash
#!/bin/bash
# Backup storage directory
tar -czf /home/ubuntu/backups/storage_$(date +%Y%m%d).tar.gz /home/ubuntu/web-checkout/storage

# Backup to S3 (optional)
aws s3 cp /home/ubuntu/backups/ s3://your-bucket/backups/ --recursive
```

### 2. Disaster Recovery Plan

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 24 hours

**Recovery Steps:**

1. **Restore Database:**
```bash
# Decompress backup
gunzip payment_switch_20241128.sql.gz

# Restore to database
docker exec -i payment-switch-db mysql -u root -p${DB_ROOT_PASSWORD} payment_switch < payment_switch_20241128.sql
```

2. **Restore Files:**
```bash
tar -xzf storage_20241128.tar.gz -C /home/ubuntu/web-checkout/
```

3. **Restart Services:**
```bash
docker-compose -f docker-compose.prod.yml restart
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
      
      - name: Build application
        run: pnpm build
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/ubuntu/web-checkout
            git pull origin main
            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml build
            docker-compose -f docker-compose.prod.yml up -d
```

---

## Security Hardening

### 1. Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 2. Fail2Ban (Brute Force Protection)

```bash
# Install
sudo apt-get install fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /home/ubuntu/web-checkout/logs/nginx/error.log
maxretry = 5
bantime = 3600
```

### 3. Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] SSL/TLS enabled with strong ciphers
- [ ] Security headers configured in Nginx
- [ ] Rate limiting enabled
- [ ] Firewall configured
- [ ] Fail2Ban installed
- [ ] Database access restricted to app only
- [ ] Regular security updates applied
- [ ] Audit logging enabled
- [ ] Backup encryption enabled

---

## Performance Optimization

### 1. Database Optimization

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_login_history_user ON login_history(userId, loginAt);
CREATE INDEX idx_trusted_devices_user ON trusted_devices(userId, expiresAt);
```

### 2. Redis Caching

```typescript
// Cache exchange rates
const cacheKey = `exchange_rate:${from}:${to}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const rate = await fetchExchangeRate(from, to);
await redis.setex(cacheKey, 300, JSON.stringify(rate)); // 5 min TTL
```

### 3. CDN Configuration

Use CDN for static assets:
- Images
- CSS/JS files
- Fonts

Recommended: Cloudflare, AWS CloudFront, or Fastly

---

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check database status
docker-compose -f docker-compose.prod.yml ps db

# View database logs
docker-compose -f docker-compose.prod.yml logs db

# Test connection
docker exec -it payment-switch-db mysql -u root -p
```

**2. Application Not Starting**
```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker exec payment-switch-app env | grep DATABASE_URL
```

**3. High Memory Usage**
```bash
# Check container stats
docker stats

# Restart application
docker-compose -f docker-compose.prod.yml restart app
```

**4. SSL Certificate Issues**
```bash
# Test SSL configuration
openssl s_client -connect yourdomain.com:443

# Renew Let's Encrypt certificate
sudo certbot renew
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Database migrations tested
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Load testing completed

### Deployment
- [ ] Build Docker images
- [ ] Start services
- [ ] Run database migrations
- [ ] Verify health check endpoint
- [ ] Test critical user flows
- [ ] Monitor logs for errors

### Post-Deployment
- [ ] Verify all services running
- [ ] Test authentication flow
- [ ] Test 2FA functionality
- [ ] Test payment processing
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify backups working

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor error logs
- Check system health
- Review security alerts

**Weekly:**
- Review performance metrics
- Check disk space
- Verify backups

**Monthly:**
- Apply security updates
- Review and optimize database
- Rotate API keys
- Test disaster recovery

---

## Scaling Considerations

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
services:
  app:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

### Load Balancer Configuration

Use Nginx or HAProxy to distribute traffic across multiple app instances.

---

Your platform is now production-ready! 🚀

For questions or issues, refer to the troubleshooting section or contact the development team.
