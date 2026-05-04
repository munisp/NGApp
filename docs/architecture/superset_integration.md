# Apache Superset Integration Guide
## Enterprise CRM Analytics Dashboard

This guide provides comprehensive instructions for integrating Apache Superset with the Enterprise CRM system to create powerful, interactive dashboards for business intelligence.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation & Setup](#installation--setup)
4. [Database Configuration](#database-configuration)
5. [Dashboard Deployment](#dashboard-deployment)
6. [Security Configuration](#security-configuration)
7. [Performance Optimization](#performance-optimization)
8. [Maintenance & Monitoring](#maintenance--monitoring)

## Overview

The Enterprise CRM Superset integration provides:

- **Executive Dashboard** with key business metrics
- **Real-time Analytics** across sales, marketing, customer, and inventory data
- **Interactive Visualizations** with drill-down capabilities
- **Automated Reporting** with scheduled exports
- **Role-based Access Control** for data security
- **Mobile-responsive Design** for access anywhere

### Key Features

- 16 interactive charts covering all business areas
- Real-time data refresh every 5 minutes
- Cross-filtering and drill-down capabilities
- Export functionality (PDF, Excel, CSV)
- Embedded analytics for other applications
- Custom SQL queries and advanced analytics

## Prerequisites

### System Requirements

- **Kubernetes Cluster** with at least 8GB RAM and 4 CPU cores
- **PostgreSQL 13+** for metadata storage
- **Redis** for caching and session storage
- **Enterprise CRM Database** access with read permissions
- **Python 3.8+** and pip
- **Docker** and Docker Compose (for containerized deployment)

### Network Requirements

- Access to Enterprise CRM database (PostgreSQL)
- Redis cluster connectivity
- HTTPS/SSL certificates for secure access
- Load balancer configuration (optional)

## Installation & Setup

### Option 1: Kubernetes Deployment (Recommended)

```yaml
# superset-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: superset
  namespace: enterprise-crm
spec:
  replicas: 2
  selector:
    matchLabels:
      app: superset
  template:
    metadata:
      labels:
        app: superset
    spec:
      containers:
      - name: superset
        image: apache/superset:2.1.0
        ports:
        - containerPort: 8088
        env:
        - name: SUPERSET_CONFIG_PATH
          value: "/app/superset_config.py"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: superset-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: superset-secrets
              key: redis-url
        volumeMounts:
        - name: superset-config
          mountPath: /app/superset_config.py
          subPath: superset_config.py
        resources:
          requests:
            memory: "2Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
      volumes:
      - name: superset-config
        configMap:
          name: superset-config
---
apiVersion: v1
kind: Service
metadata:
  name: superset-service
  namespace: enterprise-crm
spec:
  selector:
    app: superset
  ports:
  - port: 8088
    targetPort: 8088
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: superset-ingress
  namespace: enterprise-crm
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - analytics.enterprise-crm.com
    secretName: superset-tls
  rules:
  - host: analytics.enterprise-crm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: superset-service
            port:
              number: 8088
```

### Option 2: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  superset:
    image: apache/superset:2.1.0
    container_name: superset
    environment:
      - SUPERSET_CONFIG_PATH=/app/superset_config.py
    ports:
      - "8088:8088"
    volumes:
      - ./superset_config.py:/app/superset_config.py
      - superset_data:/app/superset_home
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:13
    container_name: superset-postgres
    environment:
      POSTGRES_DB: superset
      POSTGRES_USER: superset
      POSTGRES_PASSWORD: superset_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7
    container_name: superset-redis
    restart: unless-stopped

volumes:
  superset_data:
  postgres_data:
```

## Database Configuration

### Superset Configuration File

```python
# superset_config.py
import os
from datetime import timedelta

# Database Configuration
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 
    'postgresql://superset:superset_password@postgres:5432/superset')

# Redis Configuration
REDIS_HOST = os.environ.get('REDIS_HOST', 'redis')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_CELERY_DB = int(os.environ.get('REDIS_CELERY_DB', 0))
REDIS_RESULTS_DB = int(os.environ.get('REDIS_RESULTS_DB', 1))

# Cache Configuration
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 300,
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_HOST': REDIS_HOST,
    'CACHE_REDIS_PORT': REDIS_PORT,
    'CACHE_REDIS_DB': 1,
}

# Celery Configuration
class CeleryConfig:
    broker_url = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}'
    imports = ('superset.sql_lab',)
    result_backend = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}'
    worker_prefetch_multiplier = 1
    task_acks_late = False

CELERY_CONFIG = CeleryConfig

# Security Configuration
SECRET_KEY = os.environ.get('SUPERSET_SECRET_KEY', 'your-secret-key-here')
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = None

# Feature Flags
FEATURE_FLAGS = {
    'ENABLE_TEMPLATE_PROCESSING': True,
    'DASHBOARD_NATIVE_FILTERS': True,
    'DASHBOARD_CROSS_FILTERS': True,
    'GLOBAL_ASYNC_QUERIES': True,
    'VERSIONED_EXPORT': True,
}

# Row Limit
ROW_LIMIT = 5000
VIZ_ROW_LIMIT = 10000

# Timeout Configuration
SUPERSET_WEBSERVER_TIMEOUT = 300
SQLLAB_TIMEOUT = 300
SQLLAB_ASYNC_TIME_LIMIT_SEC = 600

# Email Configuration (optional)
SMTP_HOST = os.environ.get('SMTP_HOST')
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = os.environ.get('SMTP_USER')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_MAIL_FROM = os.environ.get('SMTP_MAIL_FROM')

# Custom CSS (optional)
CUSTOM_CSS = """
.navbar-brand {
    color: #1f77b4 !important;
}
.dashboard-header {
    background-color: #f8f9fa;
}
"""

# Database Connections
DATABASES = {
    'enterprise_crm': {
        'engine': 'postgresql',
        'host': os.environ.get('CRM_DB_HOST', 'crm-postgres'),
        'port': int(os.environ.get('CRM_DB_PORT', 5432)),
        'database': os.environ.get('CRM_DB_NAME', 'enterprise_crm'),
        'username': os.environ.get('CRM_DB_USER', 'crm_readonly'),
        'password': os.environ.get('CRM_DB_PASSWORD'),
    }
}
```

### Database Connection Setup

```sql
-- Create read-only user for Superset
CREATE USER superset_readonly WITH PASSWORD 'secure_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE enterprise_crm TO superset_readonly;
GRANT USAGE ON SCHEMA public TO superset_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO superset_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO superset_readonly;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO superset_readonly;
```

## Dashboard Deployment

### Step 1: Initialize Superset

```bash
# Initialize the database
superset db upgrade

# Create admin user
superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname User \
    --email admin@enterprise-crm.com \
    --password admin_password

# Load examples (optional)
superset load_examples

# Initialize roles and permissions
superset init
```

### Step 2: Import Dashboard Configuration

```bash
# Import the dashboard using Superset CLI
superset import-dashboards -p /path/to/superset-dashboard-config.json

# Or use the web interface:
# 1. Go to Settings > Import Dashboards
# 2. Upload the JSON configuration file
# 3. Select import options
# 4. Click Import
```

### Step 3: Configure Data Sources

```python
# Python script to programmatically add data sources
from superset import app, db
from superset.models.core import Database

# Add Enterprise CRM database
database = Database(
    database_name='Enterprise CRM',
    sqlalchemy_uri='postgresql://superset_readonly:password@crm-postgres:5432/enterprise_crm',
    expose_in_sqllab=True,
    allow_run_async=True,
    allow_ctas=False,
    allow_cvas=False,
    allow_dml=False,
)

db.session.add(database)
db.session.commit()
```

### Step 4: Create and Execute SQL Views

```bash
# Execute the SQL views creation script
psql -h crm-postgres -U postgres -d enterprise_crm -f superset-sql-queries.sql
```

## Security Configuration

### Role-Based Access Control

```python
# Custom security manager
from superset.security import SupersetSecurityManager

class CustomSecurityManager(SupersetSecurityManager):
    def get_user_roles(self, user):
        # Custom logic to determine user roles
        if user.email.endswith('@enterprise-crm.com'):
            return ['Admin']
        elif 'sales' in user.email:
            return ['Sales']
        elif 'marketing' in user.email:
            return ['Marketing']
        else:
            return ['Viewer']

CUSTOM_SECURITY_MANAGER = CustomSecurityManager
```

### Row Level Security

```sql
-- Create row level security policies
CREATE POLICY customer_access_policy ON customers
    FOR SELECT
    TO superset_readonly
    USING (
        -- Users can only see customers from their region
        region = current_setting('app.user_region', true)
    );

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
```

### SSL/TLS Configuration

```yaml
# Kubernetes TLS configuration
apiVersion: v1
kind: Secret
metadata:
  name: superset-tls
  namespace: enterprise-crm
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-certificate>
  tls.key: <base64-encoded-private-key>
```

## Performance Optimization

### Caching Strategy

```python
# Advanced caching configuration
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 300,  # 5 minutes
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_HOST': 'redis-cluster',
    'CACHE_REDIS_PORT': 6379,
    'CACHE_REDIS_DB': 1,
}

# Chart data caching
DATA_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 3600,  # 1 hour
    'CACHE_KEY_PREFIX': 'superset_data_',
    'CACHE_REDIS_HOST': 'redis-cluster',
    'CACHE_REDIS_PORT': 6379,
    'CACHE_REDIS_DB': 2,
}
```

### Database Optimization

```sql
-- Create materialized views for better performance
CREATE MATERIALIZED VIEW mv_sales_summary AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    stage,
    COUNT(*) as opportunity_count,
    SUM(amount) as total_amount
FROM opportunities
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('month', created_at), stage;

-- Create refresh schedule
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_summary;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every hour
SELECT cron.schedule('refresh-views', '0 * * * *', 'SELECT refresh_materialized_views();');
```

### Async Query Configuration

```python
# Celery configuration for async queries
CELERY_CONFIG = CeleryConfig

# Enable async queries
FEATURE_FLAGS['GLOBAL_ASYNC_QUERIES'] = True

# Query timeout settings
SQLLAB_ASYNC_TIME_LIMIT_SEC = 600
SUPERSET_WEBSERVER_TIMEOUT = 300
```

## Maintenance & Monitoring

### Health Checks

```python
# Health check endpoint
@app.route('/health')
def health_check():
    try:
        # Check database connectivity
        db.session.execute('SELECT 1')
        
        # Check Redis connectivity
        cache.get('health_check')
        
        return {'status': 'healthy', 'timestamp': datetime.utcnow()}
    except Exception as e:
        return {'status': 'unhealthy', 'error': str(e)}, 500
```

### Monitoring Configuration

```yaml
# Prometheus monitoring
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: superset-metrics
  namespace: enterprise-crm
spec:
  selector:
    matchLabels:
      app: superset
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Backup Strategy

```bash
#!/bin/bash
# Backup script for Superset metadata

# Backup database
pg_dump -h superset-postgres -U superset superset > superset_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup configuration
kubectl get configmap superset-config -o yaml > superset_config_backup_$(date +%Y%m%d_%H%M%S).yaml

# Backup dashboards
superset export-dashboards -f dashboards_backup_$(date +%Y%m%d_%H%M%S).json
```

### Log Management

```yaml
# Fluentd configuration for log collection
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-superset-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/superset/*.log
      pos_file /var/log/fluentd-superset.log.pos
      tag superset.*
      format json
    </source>
    
    <match superset.**>
      @type elasticsearch
      host elasticsearch.logging.svc.cluster.local
      port 9200
      index_name superset-logs
    </match>
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Test database connectivity
   psql -h crm-postgres -U superset_readonly -d enterprise_crm -c "SELECT 1;"
   ```

2. **Cache Issues**
   ```bash
   # Clear Redis cache
   redis-cli -h redis-cluster FLUSHDB
   ```

3. **Permission Issues**
   ```sql
   -- Check user permissions
   SELECT * FROM information_schema.table_privileges 
   WHERE grantee = 'superset_readonly';
   ```

### Performance Issues

1. **Slow Queries**
   ```sql
   -- Enable query logging
   ALTER SYSTEM SET log_statement = 'all';
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   SELECT pg_reload_conf();
   ```

2. **Memory Issues**
   ```yaml
   # Increase memory limits
   resources:
     limits:
       memory: "8Gi"
       cpu: "4000m"
   ```

## Best Practices

1. **Security**
   - Use strong passwords and rotate regularly
   - Enable SSL/TLS for all connections
   - Implement row-level security where needed
   - Regular security audits

2. **Performance**
   - Use materialized views for complex queries
   - Implement proper caching strategies
   - Monitor query performance regularly
   - Optimize database indexes

3. **Maintenance**
   - Regular backups of metadata and configurations
   - Monitor system resources and performance
   - Keep Superset updated to latest stable version
   - Document all customizations and configurations

4. **User Experience**
   - Provide training for dashboard users
   - Create documentation for common tasks
   - Implement proper error handling and user feedback
   - Regular review and optimization of dashboards

## Conclusion

This integration guide provides a comprehensive setup for Apache Superset with the Enterprise CRM system. The configuration includes advanced features like caching, security, and performance optimization to ensure a robust analytics platform.

For additional support or customization requirements, refer to the official Apache Superset documentation or contact the Enterprise CRM development team.

