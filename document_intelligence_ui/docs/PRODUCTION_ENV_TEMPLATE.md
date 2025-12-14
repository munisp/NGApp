# Production Environment Variables Template

## Overview

This document provides a complete template for all environment variables needed in production deployment.

## Required Environment Variables

### Database Configuration

```bash
# MySQL/TiDB Connection
DATABASE_URL="mysql://username:password@hostname:3306/database_name"

# Connection Pool Settings (Optional)
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_TIMEOUT=30000
```

### Authentication & Security

```bash
# JWT Secret (Generate with: openssl rand -base64 32)
JWT_SECRET="your-secure-random-jwt-secret-here-min-32-chars"

# OAuth Configuration
OAUTH_SERVER_URL="https://api.manus.im"
VITE_OAUTH_PORTAL_URL="https://auth.manus.im"
VITE_APP_ID="your-app-id-from-manus-platform"

# Owner Information
OWNER_OPEN_ID="owner-open-id-from-oauth"
OWNER_NAME="Platform Owner Name"
```

### OCR Service Configuration

```bash
# OCR Ensemble Service Endpoint
OCR_SERVICE_URL="https://ocr.your-domain.com"

# Alternative: Internal service URL if deployed together
# OCR_SERVICE_URL="http://localhost:8001"
```

### API Gateway Configuration

```bash
# Python API Gateway Endpoint
PYTHON_API_URL="https://api.your-domain.com"

# Alternative: Internal service URL if deployed together
# PYTHON_API_URL="http://localhost:8002"
```

### AWS S3 Storage

```bash
# S3 Credentials
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-document-storage-bucket"

# Optional: Custom S3 endpoint (for MinIO, DigitalOcean Spaces, etc.)
# AWS_S3_ENDPOINT="https://s3.your-provider.com"
```

### Application Configuration

```bash
# Application Metadata
VITE_APP_TITLE="Document Intelligence Platform"
VITE_APP_LOGO="https://your-cdn.com/logo.png"

# Environment
NODE_ENV="production"
PORT=3000

# Base URL (for production deployment)
VITE_BASE_URL="https://your-domain.com"
```

### Analytics & Monitoring (Optional)

```bash
# Analytics Configuration
VITE_ANALYTICS_WEBSITE_ID="your-analytics-website-id"
VITE_ANALYTICS_ENDPOINT="https://analytics.your-domain.com"

# Error Tracking (Sentry)
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
SENTRY_ENVIRONMENT="production"

# Performance Monitoring
NEW_RELIC_LICENSE_KEY="your-new-relic-license-key"
NEW_RELIC_APP_NAME="Document Intelligence Platform"
```

### Forge API (Built-in Services)

```bash
# Manus Built-in APIs
BUILT_IN_FORGE_API_URL="https://forge.manus.im"
BUILT_IN_FORGE_API_KEY="your-forge-api-key"
VITE_FRONTEND_FORGE_API_URL="https://forge.manus.im"
VITE_FRONTEND_FORGE_API_KEY="your-frontend-forge-api-key"
```

### Email & Notifications (Optional)

```bash
# SMTP Configuration
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT=587
SMTP_USER="your-smtp-username"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="noreply@your-domain.com"

# SendGrid Alternative
SENDGRID_API_KEY="your-sendgrid-api-key"

# Notification Service
NOTIFICATION_WEBHOOK_URL="https://your-notification-service.com/webhook"
```

### Rate Limiting & Security (Optional)

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN="https://your-domain.com,https://www.your-domain.com"

# Security Headers
HELMET_ENABLED=true
CSRF_PROTECTION=true
```

## Environment-Specific Files

### Development (.env.development)

```bash
NODE_ENV=development
DATABASE_URL=mysql://dev:dev@localhost:3306/doc_intel_dev
OCR_SERVICE_URL=http://localhost:8001
PYTHON_API_URL=http://localhost:8002
VITE_BASE_URL=http://localhost:3000
```

### Staging (.env.staging)

```bash
NODE_ENV=staging
DATABASE_URL=mysql://staging:pass@staging-db.com:3306/doc_intel_staging
OCR_SERVICE_URL=https://ocr-staging.your-domain.com
PYTHON_API_URL=https://api-staging.your-domain.com
VITE_BASE_URL=https://staging.your-domain.com
```

### Production (.env.production)

```bash
NODE_ENV=production
DATABASE_URL=mysql://prod:secure-pass@prod-db.com:3306/doc_intel_prod
OCR_SERVICE_URL=https://ocr.your-domain.com
PYTHON_API_URL=https://api.your-domain.com
VITE_BASE_URL=https://your-domain.com
```

## Security Best Practices

### 1. Never Commit Secrets

```bash
# Add to .gitignore
.env
.env.local
.env.*.local
.env.production
*.key
*.pem
```

### 2. Use Secrets Management

**AWS Secrets Manager:**
```bash
aws secretsmanager get-secret-value --secret-id prod/doc-intel/database
```

**HashiCorp Vault:**
```bash
vault kv get secret/prod/doc-intel/database
```

**Kubernetes Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: doc-intel-secrets
type: Opaque
data:
  database-url: <base64-encoded-value>
  jwt-secret: <base64-encoded-value>
```

### 3. Rotate Secrets Regularly

- JWT secrets: Every 90 days
- Database passwords: Every 90 days
- API keys: Every 180 days
- S3 access keys: Every 180 days

### 4. Use Strong Passwords

```bash
# Generate secure random passwords
openssl rand -base64 32

# Generate JWT secret
openssl rand -hex 64

# Generate API keys
openssl rand -base64 48 | tr -d "=+/" | cut -c1-32
```

## Deployment Platform Configuration

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add OCR_SERVICE_URL production
# ... add all other variables

# Deploy
vercel --prod
```

### AWS Elastic Beanstalk

```bash
# Set environment variables
eb setenv DATABASE_URL="mysql://..." \
  JWT_SECRET="..." \
  OCR_SERVICE_URL="https://..." \
  PYTHON_API_URL="https://..."

# Deploy
eb deploy production
```

### Docker

```dockerfile
# Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

```bash
# Build and run with environment file
docker build -t doc-intel .
docker run -d --env-file .env.production -p 3000:3000 doc-intel
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: doc-intel-ui
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: doc-intel-ui
        image: your-registry/doc-intel-ui:latest
        envFrom:
        - secretRef:
            name: doc-intel-secrets
        - configMapRef:
            name: doc-intel-config
        ports:
        - containerPort: 3000
```

## Validation Checklist

Before deploying to production:

- [ ] All required environment variables set
- [ ] Database connection tested
- [ ] S3 bucket accessible and configured
- [ ] OCR service endpoint responding
- [ ] API Gateway endpoint responding
- [ ] OAuth configuration verified
- [ ] JWT secret is strong and unique
- [ ] CORS origins correctly configured
- [ ] SSL certificates installed
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented
- [ ] Rate limiting configured
- [ ] Security headers enabled

## Testing Environment Variables

```bash
# Test database connection
node -e "require('mysql2').createConnection(process.env.DATABASE_URL).connect(err => console.log(err || 'Connected'))"

# Test S3 access
aws s3 ls s3://$AWS_S3_BUCKET --profile production

# Test OCR service
curl $OCR_SERVICE_URL/health

# Test API Gateway
curl $PYTHON_API_URL/health

# Test OAuth
curl $OAUTH_SERVER_URL/health
```

## Troubleshooting

### Database Connection Fails

```bash
# Check connection string format
# mysql://username:password@hostname:port/database

# Test with mysql client
mysql -h hostname -P port -u username -p database

# Check firewall rules
telnet hostname port
```

### S3 Access Denied

```bash
# Verify credentials
aws sts get-caller-identity

# Check bucket policy
aws s3api get-bucket-policy --bucket your-bucket-name

# Test write access
echo "test" | aws s3 cp - s3://your-bucket-name/test.txt
```

### OCR Service Unreachable

```bash
# Check DNS resolution
nslookup ocr.your-domain.com

# Test connectivity
curl -v https://ocr.your-domain.com/health

# Check SSL certificate
openssl s_client -connect ocr.your-domain.com:443
```

## Support

For environment configuration issues:
- Review deployment platform documentation
- Check service logs for specific errors
- Verify network connectivity between services
- Ensure all secrets are correctly formatted

---

**Important:** Never share production environment variables or commit them to version control. Always use secure secrets management.
