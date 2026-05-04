# Crypto Remittance System - Deployment Guide

This guide covers deploying the crypto-to-fiat remittance system to production.

---

## 📋 Prerequisites

### Required Software
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 22+ (for local development)
- pnpm 8+ (for local development)
- Git

### Required Accounts & API Keys
1. **Coinbase Commerce** - Crypto payment processing
2. **Circle** - USDC stablecoin processing
3. **NIBSS** - Nigerian banking integration
4. **Smile Identity** - KYC verification
5. **Paga/OPay/Kudi** - Agent cash pickup (optional)
6. **Quickteller** - Bill payments (optional)
7. **Twilio/Africa's Talking** - SMS notifications
8. **Sentry** - Error tracking (optional)

---

## 🚀 Quick Start (Docker)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/crypto-remittance.git
cd crypto-remittance
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env.production

# Edit with your API keys
nano .env.production
```

### 3. Start Services
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app
```

### 4. Run Migrations
```bash
docker-compose exec app pnpm db:push
```

### 5. Health Check
```bash
curl http://localhost:3000/health
```

---

## 🏗️ Manual Deployment

### 1. Install Dependencies
```bash
pnpm install --frozen-lockfile
```

### 2. Build Application
```bash
# Build frontend
pnpm --filter client build

# Build backend
pnpm --filter server build
```

### 3. Run Migrations
```bash
pnpm db:push
```

### 4. Start Application
```bash
NODE_ENV=production node server/dist/index.js
```

---

## 🔧 Configuration

### Required Environment Variables

#### Core Application
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://user:pass@host:3306/db
JWT_SECRET=your_jwt_secret
```

#### Crypto Providers
```bash
# Coinbase Commerce
COINBASE_API_KEY=your_key
COINBASE_WEBHOOK_SECRET=your_secret

# Circle USDC
CIRCLE_API_KEY=your_key
CIRCLE_MERCHANT_WALLET_ID=your_wallet_id
```

#### Nigerian Banking
```bash
NIBSS_API_KEY=your_key
NIBSS_INSTITUTION_CODE=your_code
NIBSS_SOURCE_ACCOUNT=your_account
```

#### KYC Verification
```bash
SMILE_PARTNER_ID=your_partner_id
SMILE_API_KEY=your_key
SMILE_CALLBACK_URL=https://your-domain.com/api/webhooks/smile
```

#### SMS Notifications
```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 📦 Deployment Scripts

### Deploy to Production
```bash
./scripts/deploy.sh deploy
```

### Backup Database
```bash
./scripts/deploy.sh backup
```

### Rollback Deployment
```bash
./scripts/deploy.sh rollback
```

### Check Status
```bash
./scripts/deploy.sh status
```

---

## 🔄 CI/CD Pipeline

The project includes GitHub Actions workflows for automated deployment:

### Workflow Triggers
- **Push to `main`** → Deploy to production
- **Push to `staging`** → Deploy to staging
- **Pull Request** → Run tests only

### Required Secrets
Configure these in GitHub Settings → Secrets:

```
PRODUCTION_SSH_KEY
PRODUCTION_HOST
PRODUCTION_USER
STAGING_SSH_KEY
STAGING_HOST
STAGING_USER
SLACK_WEBHOOK (optional)
```

### Manual Deployment
```bash
# Trigger deployment via GitHub Actions
git tag v1.0.0
git push origin v1.0.0
```

---

## 🗄️ Database Management

### Run Migrations
```bash
docker-compose exec app pnpm db:push
```

### Backup Database
```bash
docker-compose exec db mysqldump \
  -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} \
  > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
docker-compose exec -T db mysql \
  -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} \
  < backup_20240101.sql
```

### Connect to Database
```bash
docker-compose exec db mysql \
  -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}
```

---

## 📊 Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### View Logs
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f db

# All logs
docker-compose logs -f
```

### Metrics
- Access Prometheus metrics at `/metrics`
- View Grafana dashboards (if configured)
- Check Sentry for errors

---

## 🔒 Security Checklist

- [ ] All API keys stored in environment variables
- [ ] JWT secret is strong and unique
- [ ] Database password is strong
- [ ] HTTPS enabled with valid SSL certificate
- [ ] CORS configured for frontend domain only
- [ ] Rate limiting enabled
- [ ] Webhook signatures verified
- [ ] SQL injection prevention (using Drizzle ORM)
- [ ] XSS prevention (React escapes by default)
- [ ] CSRF protection enabled
- [ ] Security headers configured (Helmet.js)

---

## 🧪 Testing

### Run Tests
```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Test Coverage
```bash
pnpm test:coverage
```

---

## 🐛 Troubleshooting

### Application Won't Start
1. Check logs: `docker-compose logs app`
2. Verify environment variables
3. Check database connection
4. Ensure migrations ran successfully

### Database Connection Failed
1. Check DATABASE_URL format
2. Verify database is running: `docker-compose ps db`
3. Check database credentials
4. Ensure network connectivity

### Webhook Delivery Failed
1. Check webhook logs in admin dashboard
2. Verify webhook URL is accessible
3. Check webhook signature verification
4. Review retry attempts

### High Memory Usage
1. Check Redis cache size
2. Review database query performance
3. Monitor Docker container stats: `docker stats`
4. Consider scaling horizontally

---

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale application containers
docker-compose up -d --scale app=3
```

### Load Balancing
- Use Nginx or HAProxy
- Configure health checks
- Enable session stickiness (if needed)

### Database Scaling
- Enable read replicas
- Implement connection pooling
- Consider database sharding

---

## 🔄 Backup Strategy

### Automated Backups
```bash
# Add to crontab
0 2 * * * /opt/crypto-remittance/scripts/deploy.sh backup
```

### Backup Retention
- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 12 months

### Disaster Recovery
1. Restore database from backup
2. Restore application from Docker image
3. Verify data integrity
4. Run smoke tests

---

## 📞 Support

For deployment issues:
1. Check logs first
2. Review this documentation
3. Contact DevOps team
4. Create GitHub issue

---

## 📝 Changelog

### Version 1.0.0 (2024-01-01)
- Initial production release
- Core remittance functionality
- Bank deposits
- Agent cash pickup
- Bill payments
- Mobile money transfers
