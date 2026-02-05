# Production Infrastructure Setup

Complete guide for deploying the African Fintech Mobile App with production-grade infrastructure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Load Balancer                        │
│                      (nginx + SSL/TLS)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
┌──────────▼──────────┐  ┌────────▼─────────┐
│   Express.js API    │  │   ML Services    │
│   (Node.js + tRPC)  │  │   (Python Flask) │
│   Port: 3000        │  │   Ports: 5003-7  │
└──────────┬──────────┘  └────────┬─────────┘
           │                      │
           │    ┌─────────────────┘
           │    │
┌──────────▼────▼──────┐
│   Redis Cache         │
│   Port: 6379          │
└───────────────────────┘
           │
┌──────────▼──────────┐
│   PostgreSQL DB      │
│   Port: 5432         │
└─────────────────────┘
           │
┌──────────▼──────────┐
│   Prometheus         │
│   Port: 9090         │
└─────────────────────┘
           │
┌──────────▼──────────┐
│   Grafana            │
│   Port: 3001         │
└─────────────────────┘
```

## Prerequisites

- Ubuntu 22.04 LTS server
- Root or sudo access
- Domain name with DNS configured
- At least 4GB RAM, 2 CPU cores
- 50GB disk space

## 1. Install Dependencies

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.11 and pip
sudo apt-get install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server

# Install nginx
sudo apt-get install -y nginx

# Install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
sudo mv prometheus-2.45.0.linux-amd64 /opt/prometheus

# Install Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y grafana

# Install process manager
sudo npm install -g pm2

# Install pnpm
sudo npm install -g pnpm
```

## 2. Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE fintech_app;
CREATE USER fintech_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE fintech_app TO fintech_user;
\q

# Configure PostgreSQL for remote connections (if needed)
sudo nano /etc/postgresql/14/main/postgresql.conf
# Set: listen_addresses = '*'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# Add: host    all             all             0.0.0.0/0            md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## 3. Configure Redis

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Recommended settings:
# maxmemory 1gb
# maxmemory-policy allkeys-lru
# bind 127.0.0.1
# requirepass your_redis_password

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

## 4. Deploy Application

```bash
# Create app directory
sudo mkdir -p /opt/fintech-app
sudo chown $USER:$USER /opt/fintech-app

# Upload and extract application
cd /opt/fintech-app
# Upload your archive here
tar -xzf african-fintech-mobile-app-*.tar.gz

# Install dependencies
cd fintech-mobile-app
pnpm install

# Set up environment variables
cp .env.example .env
nano .env

# Required environment variables:
# DATABASE_URL=postgresql://fintech_user:your_secure_password@localhost:5432/fintech_app
# REDIS_URL=redis://:your_redis_password@localhost:6379
# NODE_ENV=production
# PORT=3000
# ML_SERVICE_BASE_URL=http://127.0.0.1

# Run database migrations
pnpm db:push

# Build application
pnpm build
```

## 5. Set Up ML Services with Gunicorn

Create systemd service files for each ML service:

### Predictive Alerts Service

```bash
sudo nano /etc/systemd/system/ml-predictive-alerts.service
```

```ini
[Unit]
Description=ML Predictive Alerts Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fintech-app/fintech-mobile-app/python-services/ml
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 -m gunicorn --bind 127.0.0.1:5003 --workers 2 --timeout 120 predictive_alerts_ml:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Smart Categorization Service

```bash
sudo nano /etc/systemd/system/ml-smart-categorization.service
```

```ini
[Unit]
Description=ML Smart Categorization Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fintech-app/fintech-mobile-app/python-services/ml
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 -m gunicorn --bind 127.0.0.1:5004 --workers 2 --timeout 120 smart_categorization_ml:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Tax Optimization Service

```bash
sudo nano /etc/systemd/system/ml-tax-optimization.service
```

```ini
[Unit]
Description=ML Tax Optimization Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fintech-app/fintech-mobile-app/python-services/ml
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 -m gunicorn --bind 127.0.0.1:5005 --workers 2 --timeout 120 tax_optimization_ml:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Investment Risk Service

```bash
sudo nano /etc/systemd/system/ml-investment-risk.service
```

```ini
[Unit]
Description=ML Investment Risk Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fintech-app/fintech-mobile-app/python-services/ml
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 -m gunicorn --bind 127.0.0.1:5006 --workers 2 --timeout 120 investment_risk_ml:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Credit Score Service

```bash
sudo nano /etc/systemd/system/ml-credit-score.service
```

```ini
[Unit]
Description=ML Credit Score Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fintech-app/fintech-mobile-app/python-services/ml
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 -m gunicorn --bind 127.0.0.1:5007 --workers 2 --timeout 120 credit_score_ml:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and Start ML Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable ml-predictive-alerts
sudo systemctl enable ml-smart-categorization
sudo systemctl enable ml-tax-optimization
sudo systemctl enable ml-investment-risk
sudo systemctl enable ml-credit-score

# Start services
sudo systemctl start ml-predictive-alerts
sudo systemctl start ml-smart-categorization
sudo systemctl start ml-tax-optimization
sudo systemctl start ml-investment-risk
sudo systemctl start ml-credit-score

# Check status
sudo systemctl status ml-predictive-alerts
sudo systemctl status ml-smart-categorization
sudo systemctl status ml-tax-optimization
sudo systemctl status ml-investment-risk
sudo systemctl status ml-credit-score
```

## 6. Deploy Express.js API with PM2

```bash
cd /opt/fintech-app/fintech-mobile-app

# Start with PM2
pm2 start npm --name "fintech-api" -- start

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup systemd
# Follow the command output instructions

# Monitor
pm2 monit
pm2 logs fintech-api
```

## 7. Configure nginx

```bash
sudo nano /etc/nginx/sites-available/fintech-app
```

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=ml_limit:10m rate=5r/s;

# Upstream servers
upstream api_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream ml_predictive_alerts {
    server 127.0.0.1:5003 max_fails=3 fail_timeout=30s;
}

upstream ml_smart_categorization {
    server 127.0.0.1:5004 max_fails=3 fail_timeout=30s;
}

upstream ml_tax_optimization {
    server 127.0.0.1:5005 max_fails=3 fail_timeout=30s;
}

upstream ml_investment_risk {
    server 127.0.0.1:5006 max_fails=3 fail_timeout=30s;
}

upstream ml_credit_score {
    server 127.0.0.1:5007 max_fails=3 fail_timeout=30s;
}

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name api.yourfintech.app;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourfintech.app;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/api.yourfintech.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourfintech.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/fintech-app-access.log;
    error_log /var/log/nginx/fintech-app-error.log;

    # Main API
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # ML Services
    location /ml/predictive-alerts/ {
        limit_req zone=ml_limit burst=10 nodelay;
        proxy_pass http://ml_predictive_alerts/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location /ml/smart-categorization/ {
        limit_req zone=ml_limit burst=10 nodelay;
        proxy_pass http://ml_smart_categorization/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location /ml/tax-optimization/ {
        limit_req zone=ml_limit burst=10 nodelay;
        proxy_pass http://ml_tax_optimization/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location /ml/investment-risk/ {
        limit_req zone=ml_limit burst=10 nodelay;
        proxy_pass http://ml_investment_risk/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location /ml/credit-score/ {
        limit_req zone=ml_limit burst=10 nodelay;
        proxy_pass http://ml_credit_score/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/fintech-app /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## 8. Set Up SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourfintech.app

# Test auto-renewal
sudo certbot renew --dry-run
```

## 9. Configure Prometheus

```bash
sudo nano /opt/prometheus/prometheus.yml
```

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Express.js API metrics
  - job_name: 'fintech-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'

  # ML Services metrics
  - job_name: 'ml-predictive-alerts'
    static_configs:
      - targets: ['localhost:5003']
    metrics_path: '/metrics'

  - job_name: 'ml-smart-categorization'
    static_configs:
      - targets: ['localhost:5004']
    metrics_path: '/metrics'

  - job_name: 'ml-tax-optimization'
    static_configs:
      - targets: ['localhost:5005']
    metrics_path: '/metrics'

  - job_name: 'ml-investment-risk'
    static_configs:
      - targets: ['localhost:5006']
    metrics_path: '/metrics'

  - job_name: 'ml-credit-score'
    static_configs:
      - targets: ['localhost:5007']
    metrics_path: '/metrics'

  # System metrics
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  # PostgreSQL metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
```

Create systemd service:

```bash
sudo nano /etc/systemd/system/prometheus.service
```

```ini
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/opt/prometheus/prometheus \
    --config.file=/opt/prometheus/prometheus.yml \
    --storage.tsdb.path=/opt/prometheus/data \
    --web.console.templates=/opt/prometheus/consoles \
    --web.console.libraries=/opt/prometheus/console_libraries

[Install]
WantedBy=multi-user.target
```

```bash
# Create prometheus user
sudo useradd --no-create-home --shell /bin/false prometheus

# Set permissions
sudo chown -R prometheus:prometheus /opt/prometheus

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus
```

## 10. Configure Grafana

```bash
# Start Grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server

# Access Grafana at http://your-server:3001
# Default credentials: admin/admin

# Add Prometheus as data source:
# 1. Go to Configuration > Data Sources
# 2. Add Prometheus
# 3. URL: http://localhost:9090
# 4. Save & Test

# Import dashboards:
# - Node Exporter Full (ID: 1860)
# - PostgreSQL Database (ID: 9628)
# - Redis Dashboard (ID: 11835)
```

## 11. Monitoring and Logging

### Set up log rotation

```bash
sudo nano /etc/logrotate.d/fintech-app
```

```
/var/log/nginx/fintech-app-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/opt/fintech-app/fintech-mobile-app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
}
```

### Set up monitoring alerts

Create alert rules in Prometheus:

```bash
sudo nano /opt/prometheus/alert.rules.yml
```

```yaml
groups:
  - name: fintech_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for 5 minutes"

      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is above 2 seconds"

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.job }} has been down for more than 1 minute"
```

## 12. Backup Strategy

### Database backups

```bash
# Create backup script
sudo nano /opt/scripts/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/db"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="fintech_app"

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U fintech_user -h localhost $DB_NAME | gzip > $BACKUP_DIR/fintech_app_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "fintech_app_*.sql.gz" -mtime +7 -delete

echo "Backup completed: fintech_app_$DATE.sql.gz"
```

```bash
# Make executable
sudo chmod +x /opt/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /opt/scripts/backup-db.sh
```

## 13. Security Hardening

```bash
# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Install fail2ban
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Disable root SSH login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

## 14. Performance Tuning

### PostgreSQL

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```
# Memory settings (adjust based on available RAM)
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 16MB

# Connection settings
max_connections = 200

# Write-ahead log
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

### Redis

```bash
sudo nano /etc/redis/redis.conf
```

```
# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
```

## 15. Health Checks

Create a health check script:

```bash
nano /opt/scripts/health-check.sh
```

```bash
#!/bin/bash

echo "=== Health Check Report ==="
echo "Date: $(date)"
echo ""

# Check API
echo "1. Express.js API:"
curl -s http://localhost:3000/api/health | jq . || echo "FAILED"

# Check ML Services
echo "2. ML Services:"
for port in 5003 5004 5005 5006 5007; do
    service_name=$(curl -s http://localhost:$port/health | jq -r '.service // "Unknown"')
    echo "   Port $port ($service_name): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$port/health)"
done

# Check databases
echo "3. PostgreSQL:"
sudo -u postgres psql -c "SELECT version();" | head -1

echo "4. Redis:"
redis-cli ping

# Check disk space
echo "5. Disk Space:"
df -h / | tail -1

# Check memory
echo "6. Memory:"
free -h | grep Mem

echo ""
echo "=== End of Health Check ==="
```

```bash
chmod +x /opt/scripts/health-check.sh
```

## Deployment Checklist

- [ ] All dependencies installed
- [ ] PostgreSQL configured and running
- [ ] Redis configured and running
- [ ] Application deployed and built
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] All 5 ML services running via systemd
- [ ] Express.js API running via PM2
- [ ] nginx configured and running
- [ ] SSL certificates installed
- [ ] Prometheus configured and running
- [ ] Grafana configured with dashboards
- [ ] Log rotation configured
- [ ] Backup scripts configured
- [ ] Firewall configured
- [ ] Health checks passing
- [ ] Monitoring alerts configured

## Maintenance Commands

```bash
# View API logs
pm2 logs fintech-api

# View ML service logs
sudo journalctl -u ml-predictive-alerts -f
sudo journalctl -u ml-smart-categorization -f
sudo journalctl -u ml-tax-optimization -f
sudo journalctl -u ml-investment-risk -f
sudo journalctl -u ml-credit-score -f

# Restart services
pm2 restart fintech-api
sudo systemctl restart ml-predictive-alerts
sudo systemctl restart nginx

# Check service status
pm2 status
sudo systemctl status ml-*
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis-server

# Monitor system resources
htop
pm2 monit

# Check nginx logs
sudo tail -f /var/log/nginx/fintech-app-access.log
sudo tail -f /var/log/nginx/fintech-app-error.log
```

## Troubleshooting

### API not responding
```bash
pm2 logs fintech-api --lines 100
pm2 restart fintech-api
```

### ML service errors
```bash
sudo journalctl -u ml-predictive-alerts --since "1 hour ago"
sudo systemctl restart ml-predictive-alerts
```

### Database connection issues
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### High memory usage
```bash
free -h
pm2 list
sudo systemctl status ml-*
```

## Support

For issues or questions:
- Check logs first
- Run health check script
- Review Grafana dashboards
- Contact: support@yourfintech.app
