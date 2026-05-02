# Staging Deployment Guide

Complete guide for deploying the Payment Switch platform to a staging environment for testing and validation before production.

---

## Purpose of Staging Environment

The staging environment serves as a **production-like testing environment** where you can:

1. **Test External API Integrations** - Verify all third-party services work correctly
2. **Conduct Manual Testing** - Complete OAuth, 2FA, and feature testing with real users
3. **Load Testing** - Test performance under realistic traffic conditions
4. **Security Testing** - Validate security features and configurations
5. **User Acceptance Testing (UAT)** - Allow stakeholders to test before production
6. **CI/CD Validation** - Test deployment pipelines and automation

---

## Prerequisites

### Infrastructure
- Server or VM with Docker and Docker Compose installed
- Minimum 4GB RAM, 2 CPU cores, 50GB storage
- Public domain or subdomain (e.g., `staging.yourdomain.com`)
- SSL certificate (Let's Encrypt recommended for staging)

### Accounts & Credentials
- Staging/sandbox accounts for all external APIs:
  - Twilio (test account)
  - SendGrid/Resend (test account)
  - Smile Identity (sandbox)
  - NIBSS (sandbox)
  - Coinbase Commerce (test mode)
  - Circle (sandbox)

---

## Step 1: Server Setup

### 1.1 Install Docker

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 1.2 Clone Repository

```bash
# Clone your repository
git clone https://github.com/yourusername/payment-switch.git
cd payment-switch

# Checkout staging branch (if you have one)
git checkout staging
```

---

## Step 2: Environment Configuration

### 2.1 Create Staging Environment File

```bash
# Copy template
cp .env.staging.example .env.staging

# Edit with your staging credentials
nano .env.staging
```

### 2.2 Configure External APIs

Follow the **API Configuration Guide** (`docs/API_CONFIGURATION_GUIDE.md`) to set up:

1. **Twilio** - Use test account with verified phone numbers
2. **SendGrid** - Use test account (100 emails/day free tier)
3. **Smile Identity** - Use sandbox environment
4. **NIBSS** - Use sandbox/test credentials
5. **Coinbase Commerce** - Use test mode
6. **Circle** - Use sandbox environment

**Important**: Use **sandbox/test credentials** for all services, not production keys.

### 2.3 Generate Secrets

```bash
# Generate JWT secret
openssl rand -base64 48

# Generate webhook secrets
openssl rand -hex 32

# Add to .env.staging
```

---

## Step 3: SSL Certificate Setup

### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate (HTTP challenge)
sudo certbot certonly --standalone -d staging.yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/staging.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/staging.yourdomain.com/privkey.pem

# Copy to project directory
sudo cp /etc/letsencrypt/live/staging.yourdomain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/staging.yourdomain.com/privkey.pem ssl/
sudo chown $USER:$USER ssl/*.pem
```

### Option B: Self-Signed Certificate (Testing Only)

```bash
# Create ssl directory
mkdir -p ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/CN=staging.yourdomain.com"
```

---

## Step 4: Deploy with Docker Compose

### 4.1 Build and Start Services

```bash
# Build images
docker compose -f docker-compose.staging.yml build

# Start services in detached mode
docker compose -f docker-compose.staging.yml up -d

# View logs
docker compose -f docker-compose.staging.yml logs -f app
```

### 4.2 Verify Services

```bash
# Check all services are running
docker compose -f docker-compose.staging.yml ps

# Expected output:
# NAME                                  STATUS
# payment-switch-staging-app            Up (healthy)
# payment-switch-staging-db             Up (healthy)
# payment-switch-staging-redis          Up
# payment-switch-staging-nginx          Up
# payment-switch-staging-adminer        Up
# payment-switch-staging-redis-commander Up
```

---

## Step 5: Database Setup

### 5.1 Run Migrations

```bash
# Run migrations inside app container
docker compose -f docker-compose.staging.yml exec app pnpm db:push

# Verify tables created
docker compose -f docker-compose.staging.yml exec db mysql -u root -p payment_switch_staging -e "SHOW TABLES;"
```

### 5.2 Seed Test Data (Optional)

```bash
# Create test users
docker compose -f docker-compose.staging.yml exec app pnpm seed:test-users

# Verify users created
docker compose -f docker-compose.staging.yml exec db mysql -u root -p payment_switch_staging -e "SELECT * FROM users;"
```

---

## Step 6: Validate Deployment

### 6.1 Health Check

```bash
# Test health endpoint
curl https://staging.yourdomain.com/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-11-28T12:00:00.000Z",
#   "uptime": 3600,
#   "database": "connected",
#   "redis": "connected"
# }
```

### 6.2 Test API Connections

```bash
# Validate all external APIs
docker compose -f docker-compose.staging.yml exec app pnpm test:apis

# Test individual services
docker compose -f docker-compose.staging.yml exec app pnpm test:twilio
docker compose -f docker-compose.staging.yml exec app pnpm test:email
```

### 6.3 Access Admin Tools

**Adminer (Database Management)**
- URL: `http://staging.yourdomain.com:8081`
- Server: `db`
- Username: `staging_user`
- Password: (from .env.staging)
- Database: `payment_switch_staging`

**Redis Commander (Cache Management)**
- URL: `http://staging.yourdomain.com:8082`
- No authentication required (staging only)

---

## Step 7: Manual Testing

### 7.1 OAuth and 2FA Testing

Follow the comprehensive testing checklist:

```bash
# Open the checklist
cat docs/OAUTH_TESTING_CHECKLIST.md
```

**Key Test Scenarios:**
1. ✅ First-time OAuth login
2. ✅ 2FA enrollment and verification
3. ✅ Trusted device functionality
4. ✅ Account recovery flows
5. ✅ Login notifications
6. ✅ Session management and timeouts

### 7.2 Feature Testing

Test all major features:
- Participant onboarding (5-step workflow)
- Crypto remittance transactions
- Rate alert system
- OCR document processing
- Admin dashboards
- API key management

### 7.3 Load Testing

```bash
# Install k6 (load testing tool)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Run load test (example)
k6 run scripts/load-test.js
```

---

## Step 8: Monitoring and Logging

### 8.1 View Application Logs

```bash
# Real-time logs
docker compose -f docker-compose.staging.yml logs -f app

# Last 100 lines
docker compose -f docker-compose.staging.yml logs --tail=100 app

# Filter by error level
docker compose -f docker-compose.staging.yml logs app | grep ERROR
```

### 8.2 Database Logs

```bash
# View database logs
docker compose -f docker-compose.staging.yml logs db

# Check slow queries
docker compose -f docker-compose.staging.yml exec db mysql -u root -p -e "SHOW FULL PROCESSLIST;"
```

### 8.3 Monitor Resources

```bash
# View resource usage
docker stats

# Check disk space
df -h

# Check memory usage
free -h
```

---

## Step 9: Backup and Recovery

### 9.1 Create Database Backup

```bash
# Manual backup
docker compose -f docker-compose.staging.yml exec db mysqldump \
  -u root -p payment_switch_staging > backup_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
0 2 * * * cd /path/to/project && docker compose -f docker-compose.staging.yml exec -T db mysqldump -u root -p${DB_ROOT_PASSWORD} payment_switch_staging | gzip > backups/staging_$(date +\%Y\%m\%d).sql.gz
```

### 9.2 Restore from Backup

```bash
# Restore database
gunzip < backups/staging_20241128.sql.gz | \
  docker compose -f docker-compose.staging.yml exec -T db mysql -u root -p payment_switch_staging
```

---

## Step 10: Continuous Deployment

### 10.1 Automated Deployment Script

Create `scripts/deploy-staging.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying to Staging..."

# Pull latest code
git pull origin staging

# Rebuild images
docker compose -f docker-compose.staging.yml build

# Stop services
docker compose -f docker-compose.staging.yml down

# Start services
docker compose -f docker-compose.staging.yml up -d

# Run migrations
docker compose -f docker-compose.staging.yml exec -T app pnpm db:push

# Health check
sleep 10
curl -f https://staging.yourdomain.com/api/health || exit 1

echo "✅ Deployment complete!"
```

### 10.2 GitHub Actions Workflow

Create `.github/workflows/deploy-staging.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to staging server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/project
            ./scripts/deploy-staging.sh
```

---

## Troubleshooting

### Issue: Services Won't Start

```bash
# Check logs for errors
docker compose -f docker-compose.staging.yml logs

# Check if ports are already in use
sudo netstat -tulpn | grep -E '3000|3307|6380|8080|8443'

# Remove old containers and volumes
docker compose -f docker-compose.staging.yml down -v
docker system prune -a
```

### Issue: Database Connection Failed

```bash
# Check database is running
docker compose -f docker-compose.staging.yml ps db

# Test connection
docker compose -f docker-compose.staging.yml exec db mysql -u root -p

# Check DATABASE_URL in .env.staging
# Should be: mysql://staging_user:staging_password@db:3306/payment_switch_staging
```

### Issue: SSL Certificate Errors

```bash
# Verify certificate files exist
ls -la ssl/

# Test SSL configuration
openssl s_client -connect staging.yourdomain.com:443

# Check Nginx logs
docker compose -f docker-compose.staging.yml logs nginx
```

### Issue: External API Failures

```bash
# Test API connections
docker compose -f docker-compose.staging.yml exec app pnpm test:apis

# Check environment variables
docker compose -f docker-compose.staging.yml exec app env | grep -E 'TWILIO|SENDGRID|SMILE'

# Review API logs in storage/
ls -la storage/sms/
ls -la storage/emails/
```

---

## Staging vs Production Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| **Domain** | staging.yourdomain.com | yourdomain.com |
| **Database** | payment_switch_staging | payment_switch |
| **Ports** | 3307 (MySQL), 6380 (Redis) | 3306, 6379 |
| **API Credentials** | Sandbox/test accounts | Production accounts |
| **Rate Limits** | More lenient (200/15min) | Strict (100/15min) |
| **Logging** | DEBUG level | INFO/WARN level |
| **Monitoring** | Optional | Required |
| **Backups** | Daily | Hourly + daily |
| **SSL** | Let's Encrypt or self-signed | Commercial certificate |
| **Admin Tools** | Adminer, Redis Commander | Disabled |

---

## Security Considerations

### Staging-Specific Security

1. **Restrict Access** - Use firewall rules to limit access to staging environment
2. **Use Test Data** - Never use real customer data in staging
3. **Separate Credentials** - Use different API keys than production
4. **Monitor Access** - Log all access to staging environment
5. **Regular Updates** - Keep staging in sync with production security patches

### Firewall Rules

```bash
# Allow only specific IPs to access staging
sudo ufw allow from YOUR_OFFICE_IP to any port 3000
sudo ufw allow from YOUR_OFFICE_IP to any port 8080
sudo ufw allow from YOUR_OFFICE_IP to any port 8443

# Allow SSH from anywhere (or restrict to your IP)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

---

## Maintenance Tasks

### Daily
- ✅ Review application logs for errors
- ✅ Check health endpoint status
- ✅ Monitor disk space usage

### Weekly
- ✅ Update Docker images
- ✅ Review and test new features
- ✅ Verify backups are working
- ✅ Check external API usage and costs

### Monthly
- ✅ Apply security updates
- ✅ Review and rotate API keys
- ✅ Clean up old logs and backups
- ✅ Performance testing and optimization

---

## Next Steps After Staging Validation

Once staging testing is complete:

1. ✅ **Document Test Results** - Record all test outcomes and issues found
2. ✅ **Fix Issues** - Address any bugs or problems discovered
3. ✅ **Update Documentation** - Ensure all docs reflect actual behavior
4. ✅ **Get Stakeholder Approval** - Obtain sign-off from product owners
5. ✅ **Prepare Production** - Set up production environment with production credentials
6. ✅ **Deploy to Production** - Follow production deployment guide
7. ✅ **Monitor Closely** - Watch production closely for first 24-48 hours

---

## Useful Commands Reference

```bash
# Start staging environment
docker compose -f docker-compose.staging.yml up -d

# Stop staging environment
docker compose -f docker-compose.staging.yml down

# Restart specific service
docker compose -f docker-compose.staging.yml restart app

# View logs
docker compose -f docker-compose.staging.yml logs -f app

# Execute command in container
docker compose -f docker-compose.staging.yml exec app pnpm test:apis

# Database backup
docker compose -f docker-compose.staging.yml exec db mysqldump -u root -p payment_switch_staging > backup.sql

# Clean up everything
docker compose -f docker-compose.staging.yml down -v
docker system prune -a

# Check resource usage
docker stats
```

---

Your staging environment is ready for comprehensive testing! 🎉

For production deployment, see `docs/PRODUCTION_DEPLOYMENT.md`.
