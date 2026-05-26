# Unified Payment Switch Platform - Deployment Guide

## Overview

This guide covers deploying the complete Unified Payment Switch Platform, which integrates:

1. **Web-Checkout Portal** (Node.js/TypeScript) - Participant onboarding and management
2. **Payment Core Backend** (Go/Python) - High-performance payment processing and fraud detection

## Prerequisites

### System Requirements

**Minimum (Development):**
- 8 GB RAM
- 4 CPU cores
- 50 GB disk space
- Docker 20.10+
- Docker Compose 2.0+

**Recommended (Production):**
- 32 GB RAM
- 16 CPU cores
- 500 GB SSD storage
- Docker 20.10+
- Docker Compose 2.0+

### Software Dependencies

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

## Quick Start (Development)

### 1. Clone and Configure

```bash
# Navigate to project directory
cd /path/to/web-checkout

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 2. Configure Environment Variables

Create `.env` file with the following:

```bash
# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

# MySQL (Web Portal)
DATABASE_NAME=payment_switch_portal
DATABASE_USER=portal_user
DATABASE_PASSWORD=portal_pass_2024

# PostgreSQL (Payment Core)
POSTGRES_DB=payment_switch
POSTGRES_USER=payment_user
POSTGRES_PASSWORD=payment_pass_2024

# Redis (Shared)
REDIS_PASSWORD=redis_pass_2024

# ============================================================================
# AUTHENTICATION & SECURITY
# ============================================================================

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars

# Manus OAuth
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=Your Name

# Application
VITE_APP_ID=your_app_id
VITE_APP_TITLE=Payment Switch Platform
VITE_APP_LOGO=https://your-logo-url.com/logo.png

# ============================================================================
# EXTERNAL SERVICES
# ============================================================================

# Email Services (SendGrid or Resend)
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Payment Switch Platform

# Alternative: Resend
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# KYC Service (Smile Identity)
SMILE_IDENTITY_PARTNER_ID=your_partner_id
SMILE_IDENTITY_API_KEY=your_api_key
SMILE_IDENTITY_CALLBACK_URL=https://yourdomain.com/api/kyc/callback

# Nigerian Banking (NIBSS)
NIBSS_ORGANIZATION_CODE=your_org_code
NIBSS_API_KEY=your_nibss_api_key
NIBSS_ENDPOINT=https://api.nibss-plc.com.ng

# Cryptocurrency (Coinbase Commerce)
COINBASE_API_KEY=your_coinbase_api_key
COINBASE_WEBHOOK_SECRET=your_webhook_secret

# USDC (Circle)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret

# ============================================================================
# BUILT-IN SERVICES (Manus Platform)
# ============================================================================

BUILT_IN_FORGE_API_URL=https://forge.butterfly-effect.dev
BUILT_IN_FORGE_API_KEY=your_backend_api_key
VITE_FRONTEND_FORGE_API_KEY=your_frontend_api_key
VITE_FRONTEND_FORGE_API_URL=https://forge.butterfly-effect.dev

# ============================================================================
# MONITORING
# ============================================================================

GRAFANA_PASSWORD=admin
```

### 3. Start All Services

```bash
# Start all services
docker-compose -f docker-compose.unified.yml up -d

# View logs
docker-compose -f docker-compose.unified.yml logs -f

# Check service status
docker-compose -f docker-compose.unified.yml ps
```

### 4. Initialize Databases

```bash
# Run database migrations for Web Portal
docker-compose -f docker-compose.unified.yml exec web-portal pnpm db:push

# Seed test data (optional)
docker-compose -f docker-compose.unified.yml exec web-portal pnpm seed:test-users
```

### 5. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Web Portal** | http://localhost:3000 | OAuth login |
| **API Gateway** | http://localhost:80 | N/A |
| **Grafana** | http://localhost:3001 | admin / (GRAFANA_PASSWORD) |
| **Prometheus** | http://localhost:9090 | N/A |
| **Adminer (MySQL)** | http://localhost:8090 | See .env |
| **Redis Commander** | http://localhost:8091 | N/A |

## Production Deployment

### 1. Prepare Production Environment

```bash
# Create production directory
mkdir -p /opt/payment-switch
cd /opt/payment-switch

# Copy project files
cp -r /path/to/web-checkout/* .

# Set proper permissions
sudo chown -R $USER:$USER .
chmod 600 .env
```

### 2. Configure Production Environment

Update `.env` with production values:

```bash
# Use strong passwords (32+ characters)
DATABASE_PASSWORD=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 48)

# Use production URLs
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# Configure real external services
SENDGRID_API_KEY=your_production_key
TWILIO_ACCOUNT_SID=your_production_sid
# ... etc
```

### 3. SSL/TLS Certificates

#### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/*.pem

# Set up auto-renewal
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet && docker-compose -f /opt/payment-switch/docker-compose.unified.yml restart api-gateway
```

#### Option B: Commercial Certificate

```bash
# Copy your commercial certificates
cp /path/to/your/cert.pem nginx/ssl/cert.pem
cp /path/to/your/key.pem nginx/ssl/key.pem
chmod 644 nginx/ssl/*.pem
```

### 4. Configure Firewall

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### 5. Start Production Services

```bash
# Pull latest images
docker-compose -f docker-compose.unified.yml pull

# Start services
docker-compose -f docker-compose.unified.yml up -d

# Verify all services are running
docker-compose -f docker-compose.unified.yml ps

# Check logs for errors
docker-compose -f docker-compose.unified.yml logs --tail=100
```

### 6. Initialize Production Database

```bash
# Run migrations
docker-compose -f docker-compose.unified.yml exec web-portal pnpm db:push

# DO NOT seed test data in production
```

### 7. Configure Monitoring

```bash
# Access Grafana
open http://your-domain.com:3001

# Login with admin credentials
# Import dashboards from monitoring/grafana/dashboards/

# Configure alerts
# Set up email/Slack notifications in Grafana
```

## Service Architecture

### Service Startup Order

1. **Databases** (MySQL, PostgreSQL, TigerBeetle, Redis)
2. **Message Brokers** (Kafka, Zookeeper)
3. **Core Services** (Go Ledger, Python Fraud Detection, Python Data Pipeline)
4. **Web Portal**
5. **API Gateway** (Nginx)
6. **Monitoring** (Prometheus, Grafana)

### Health Checks

All services expose `/health` endpoints:

```bash
# Check Web Portal
curl http://localhost:3000/api/health

# Check Go Ledger
curl http://localhost:8080/health

# Check Fraud Detection
curl http://localhost:8081/health

# Check Data Pipeline
curl http://localhost:8082/health
```

## API Gateway Routing

The Nginx API Gateway routes requests to appropriate services:

| Route | Service | Purpose |
|-------|---------|---------|
| `/` | Web Portal | Frontend UI |
| `/api/trpc/*` | Web Portal | tRPC API endpoints |
| `/api/oauth/*` | Web Portal | OAuth callbacks |
| `/api/payment/*` | Go Ledger | Payment processing |
| `/api/fraud/*` | Fraud Detection | Fraud scoring |
| `/api/analytics/*` | Data Pipeline | Analytics queries |

## Authentication Flow

### 1. User Authentication (OAuth)

```
User → Web Portal → Manus OAuth
  ↓
OAuth Callback → Web Portal
  ↓
JWT Token Generated
  ↓
Token Stored in Cookie
```

### 2. API Key Authentication

```
Merchant API Request → API Gateway
  ↓
X-API-Key Header Check
  ↓
Redis Cache Lookup
  ↓
Route to Service (Go/Python)
```

### 3. Service-to-Service Authentication

```
Service A → API Gateway
  ↓
Internal JWT Token
  ↓
Service B
```

## Backup & Recovery

### Automated Backups

```bash
# Create backup script
cat > /opt/payment-switch/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/opt/backups/payment-switch
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MySQL
docker-compose -f /opt/payment-switch/docker-compose.unified.yml exec -T mysql \
  mysqldump -u root -proot_password_2024 payment_switch_portal \
  | gzip > $BACKUP_DIR/mysql_$DATE.sql.gz

# Backup PostgreSQL
docker-compose -f /opt/payment-switch/docker-compose.unified.yml exec -T postgres \
  pg_dump -U payment_user payment_switch \
  | gzip > $BACKUP_DIR/postgres_$DATE.sql.gz

# Backup Redis
docker-compose -f /opt/payment-switch/docker-compose.unified.yml exec -T redis \
  redis-cli --rdb /data/dump.rdb save
docker cp payment-switch-redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/payment-switch/backup.sh

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /opt/payment-switch/backup.sh >> /var/log/payment-switch-backup.log 2>&1
```

### Manual Backup

```bash
# Backup all data
docker-compose -f docker-compose.unified.yml exec mysql \
  mysqldump -u root -proot_password_2024 payment_switch_portal > backup_mysql.sql

docker-compose -f docker-compose.unified.yml exec postgres \
  pg_dump -U payment_user payment_switch > backup_postgres.sql
```

### Restore from Backup

```bash
# Restore MySQL
docker-compose -f docker-compose.unified.yml exec -T mysql \
  mysql -u root -proot_password_2024 payment_switch_portal < backup_mysql.sql

# Restore PostgreSQL
docker-compose -f docker-compose.unified.yml exec -T postgres \
  psql -U payment_user payment_switch < backup_postgres.sql
```

## Monitoring & Alerting

### Key Metrics

1. **Availability**
   - Service uptime
   - Health check status
   - Response time

2. **Performance**
   - Request rate (RPS)
   - Latency (P50, P95, P99)
   - Error rate

3. **Resources**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network I/O

4. **Business Metrics**
   - Transaction volume
   - Fraud detection rate
   - Payment success rate
   - API key usage

### Grafana Dashboards

Access Grafana at `http://your-domain.com:3001`

**Pre-configured Dashboards:**
1. System Overview
2. Transaction Monitoring
3. Fraud Detection Metrics
4. Service Performance
5. Database Performance

### Alert Configuration

Configure alerts in Grafana for:

- Service down (> 1 minute)
- High error rate (> 1%)
- High latency (P95 > 500ms)
- Database connection issues
- Fraud detection anomalies
- Disk space < 10%

## Scaling

### Horizontal Scaling

```yaml
# Scale Web Portal
docker-compose -f docker-compose.unified.yml up -d --scale web-portal=3

# Scale Go Ledger
docker-compose -f docker-compose.unified.yml up -d --scale go-ledger=3

# Scale Fraud Detection
docker-compose -f docker-compose.unified.yml up -d --scale fraud-detection=2
```

### Load Balancing

Nginx automatically load balances across multiple instances using `least_conn` algorithm.

### Database Scaling

#### MySQL Read Replicas

```yaml
# Add to docker-compose.unified.yml
mysql-replica:
  image: mysql:8.0
  environment:
    MYSQL_ROOT_PASSWORD: root_password_2024
  command: --server-id=2 --log-bin=mysql-bin --relay-log=relay-log
```

#### PostgreSQL Read Replicas

```yaml
# Add to docker-compose.unified.yml
postgres-replica:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: payment_switch
    POSTGRES_USER: payment_user
    POSTGRES_PASSWORD: payment_pass_2024
  command: postgres -c wal_level=replica
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.unified.yml logs service-name

# Check service status
docker-compose -f docker-compose.unified.yml ps

# Restart service
docker-compose -f docker-compose.unified.yml restart service-name
```

### Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.unified.yml ps mysql postgres

# Test connection
docker-compose -f docker-compose.unified.yml exec mysql mysql -u root -p

# Check environment variables
docker-compose -f docker-compose.unified.yml exec web-portal env | grep DATABASE
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Increase memory limits in docker-compose.unified.yml
services:
  web-portal:
    deploy:
      resources:
        limits:
          memory: 2G
```

### SSL Certificate Issues

```bash
# Verify certificate
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect yourdomain.com:443

# Renew Let's Encrypt certificate
sudo certbot renew
```

## Maintenance

### Update Services

```bash
# Pull latest images
docker-compose -f docker-compose.unified.yml pull

# Restart services (zero-downtime)
docker-compose -f docker-compose.unified.yml up -d --no-deps --build service-name
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune
```

### Log Rotation

```bash
# Configure Docker log rotation
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl restart docker
```

## Security Best Practices

1. **Use strong passwords** (32+ characters)
2. **Enable firewall** (only allow necessary ports)
3. **Use SSL/TLS** (Let's Encrypt or commercial cert)
4. **Regular updates** (keep Docker images up to date)
5. **Backup regularly** (daily automated backups)
6. **Monitor logs** (check for suspicious activity)
7. **Rate limiting** (configured in Nginx)
8. **API key rotation** (rotate keys every 90 days)
9. **Network isolation** (use Docker networks)
10. **Secrets management** (use Docker secrets or Vault)

## Performance Tuning

### Database Optimization

```sql
-- MySQL
SET GLOBAL max_connections = 500;
SET GLOBAL innodb_buffer_pool_size = 8G;

-- PostgreSQL
ALTER SYSTEM SET max_connections = 500;
ALTER SYSTEM SET shared_buffers = '8GB';
```

### Redis Optimization

```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 4gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Nginx Optimization

```nginx
# Increase worker connections
worker_connections 8192;

# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g;
```

## Support

For issues or questions:

1. Check logs: `docker-compose -f docker-compose.unified.yml logs`
2. Review documentation: `docs/`
3. Contact support: support@paymentswitch.com

## Appendix

### Environment Variables Reference

See `.env.example` for complete list of environment variables.

### API Reference

See `docs/API_REFERENCE.md` for complete API documentation.

### Architecture Diagram

See `docs/UNIFIED_PLATFORM_ARCHITECTURE.md` for detailed architecture.
