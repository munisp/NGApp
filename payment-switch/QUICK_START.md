# Quick Start Guide - Payment Switch Platform

Get the platform running in 15 minutes with this streamlined guide.

## Prerequisites

- Docker & Docker Compose installed
- 8GB RAM minimum, 16GB recommended
- 20GB free disk space
- Linux/macOS (Windows with WSL2)

## Step 1: Clone and Setup (2 minutes)

```bash
# Navigate to project directory
cd web-checkout

# Copy environment template
cp .env.example .env.production

# Run interactive setup wizard
./scripts/setup-api-credentials.sh .env.production
```

The wizard will guide you through configuring:
- ✅ Email service (SendGrid/Resend)
- ✅ SMS service (Twilio)
- ✅ KYC service (Smile Identity)
- ✅ Banking (NIBSS)
- ✅ Crypto payments (Coinbase/Circle)
- ✅ Slack alerts

**Skip any service** to use file-based fallbacks for development.

## Step 2: Start Platform (3 minutes)

```bash
# Start all services
docker-compose -f docker-compose.unified.yml --env-file .env.production up -d

# Wait for services to initialize (2-3 minutes)
# Watch logs
docker-compose -f docker-compose.unified.yml logs -f web-portal
```

## Step 3: Initialize Database (1 minute)

```bash
# Run database migrations
docker-compose -f docker-compose.unified.yml exec web-portal pnpm db:push

# Seed test data (optional)
docker-compose -f docker-compose.unified.yml exec web-portal pnpm seed:test-users
```

## Step 4: Verify Health (2 minutes)

```bash
# Run health check script
./scripts/health-check.sh

# Should see:
# ✓ All checks passed! Platform is healthy.
```

## Step 5: Access Services (1 minute)

Open in your browser:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Web Portal** | http://localhost:3000 | OAuth login |
| **API Gateway** | http://localhost:80 | N/A |
| **Grafana** | http://localhost:3001 | admin / admin |
| **Prometheus** | http://localhost:9090 | N/A |
| **Adminer** | http://localhost:8080 | See below |

### Adminer Database Access

- System: MySQL
- Server: mysql-db
- Username: root
- Password: (from .env.production)
- Database: qvp5tnhy6ni4vrn3ohqe9a

## Step 6: Test APIs (3 minutes)

```bash
# Test all external API connections
docker-compose -f docker-compose.unified.yml exec web-portal pnpm test:apis

# Should see:
# ✅ Email Service: Connected
# ✅ SMS Service: Connected
# ✅ KYC Service: Connected
# etc.
```

## Step 7: Import Grafana Dashboards (3 minutes)

1. Open Grafana: http://localhost:3001
2. Login: admin / admin
3. Go to **Dashboards** > **Import**
4. Import these dashboards:

```bash
monitoring/grafana/dashboards/system-overview.json
monitoring/grafana/dashboards/transaction-monitoring.json
monitoring/grafana/dashboards/fraud-detection.json
```

5. View real-time metrics!

## Quick Commands

### View Logs

```bash
# All services
docker-compose -f docker-compose.unified.yml logs -f

# Specific service
docker-compose -f docker-compose.unified.yml logs -f web-portal
docker-compose -f docker-compose.unified.yml logs -f nginx-gateway
```

### Restart Services

```bash
# All services
docker-compose -f docker-compose.unified.yml restart

# Specific service
docker-compose -f docker-compose.unified.yml restart web-portal
```

### Stop Platform

```bash
# Stop all services
docker-compose -f docker-compose.unified.yml down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose -f docker-compose.unified.yml down -v
```

### Update Code

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.unified.yml up -d --build web-portal
```

## Troubleshooting

### Services Not Starting

```bash
# Check Docker resources
docker system df

# Check service logs
docker-compose -f docker-compose.unified.yml logs web-portal

# Restart problematic service
docker-compose -f docker-compose.unified.yml restart web-portal
```

### Database Connection Failed

```bash
# Check MySQL is running
docker-compose -f docker-compose.unified.yml ps mysql-db

# Check MySQL logs
docker-compose -f docker-compose.unified.yml logs mysql-db

# Restart MySQL
docker-compose -f docker-compose.unified.yml restart mysql-db
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in docker-compose.unified.yml
```

### API Tests Failing

```bash
# Check .env.production has correct credentials
cat .env.production

# Re-run setup wizard
./scripts/setup-api-credentials.sh .env.production

# Test individual APIs
docker-compose -f docker-compose.unified.yml exec web-portal pnpm test:twilio
docker-compose -f docker-compose.unified.yml exec web-portal pnpm test:email
```

## Next Steps

### 1. Configure Production Settings

Edit `.env.production`:

```bash
# Security
JWT_SECRET=<generate-strong-secret>
SESSION_TIMEOUT=7d

# Email
EMAIL_FROM=noreply@your-domain.com

# Domain
BASE_URL=https://your-domain.com
```

### 2. Set Up SSL/TLS

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Update nginx config
# See: monitoring/nginx/nginx.conf
```

### 3. Run Load Tests

```bash
# Install k6
curl https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.45.0-linux-amd64/k6 /usr/local/bin/

# Run payment processing test (10K TPS target)
cd load-tests
./run-all-tests.sh local
```

### 4. Enable Monitoring Alerts

1. Configure SMTP in Grafana (see `monitoring/grafana/grafana-smtp.ini`)
2. Set up Slack webhook (see `monitoring/SLACK_SETUP_GUIDE.md`)
3. Import alert rules from `monitoring/prometheus/alerts/`

### 5. Deploy to Production

Follow the comprehensive guide:

```bash
docs/PRODUCTION_DEPLOYMENT.md
```

## Support

- **Documentation**: `docs/` directory
- **API Reference**: `docs/API_CONFIGURATION_GUIDE.md`
- **Testing Guide**: `docs/OAUTH_TESTING_CHECKLIST.md`
- **Deployment**: `docs/STAGING_DEPLOYMENT_GUIDE.md`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Nginx API Gateway                       │
│                    (Port 80, Rate Limiting)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        │             │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐   ┌───▼────┐
   │   Web   │   │   Go   │   │ Python │   │ Python │
   │ Portal  │   │ Ledger │   │ Fraud  │   │  Data  │
   │(Node.js)│   │Service │   │Detector│   │Pipeline│
   └────┬────┘   └───┬────┘   └───┬────┘   └───┬────┘
        │            │            │            │
   ┌────▼────────────▼────────────▼────────────▼────┐
   │              Shared Infrastructure              │
   │  MySQL │ PostgreSQL │ Redis │ Kafka │ TigerBeetle│
   └─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │Prometheus│   │Grafana │   │ Nginx  │
   │(Metrics) │   │(Dashboards)│(Gateway)│
   └──────────┘   └────────┘   └────────┘
```

## Key Features

✅ **Participant Onboarding** - 5-step workflow with OCR, 2FA, KYC
✅ **Payment Processing** - 10K+ TPS with Go ledger service
✅ **Fraud Detection** - AI-powered with Python GNN models
✅ **Crypto Remittance** - BTC/ETH/USDC/USDT → NGN
✅ **Rate Alerts** - Real-time exchange rate monitoring
✅ **Admin Dashboard** - Complete management interface
✅ **API Management** - Rate limiting, webhooks, monitoring
✅ **Security** - 2FA, trusted devices, account recovery
✅ **Monitoring** - Grafana dashboards, Prometheus alerts

## Performance Targets

- **Payment Processing**: 10,000 TPS
- **Fraud Detection**: 5,000 TPS
- **API Response Time**: <100ms (p95)
- **Uptime**: 99.9%

---

**Ready to go live?** Follow the production deployment guide: `docs/PRODUCTION_DEPLOYMENT.md`
