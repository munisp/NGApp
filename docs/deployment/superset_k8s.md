# Apache Superset Kubernetes Deployment Guide
## Enterprise CRM Analytics Dashboard

This comprehensive guide provides step-by-step instructions to deploy Apache Superset on Kubernetes for the Enterprise CRM analytics dashboard.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Preparation](#environment-preparation)
3. [Namespace and RBAC Setup](#namespace-and-rbac-setup)
4. [Secrets and ConfigMaps](#secrets-and-configmaps)
5. [Database Setup](#database-setup)
6. [Redis Cache Setup](#redis-cache-setup)
7. [Superset Application Deployment](#superset-application-deployment)
8. [Ingress and SSL Configuration](#ingress-and-ssl-configuration)
9. [Dashboard Import and Configuration](#dashboard-import-and-configuration)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
12. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
sudo apt-get update
sudo apt-get install helm

# Install cert-manager CLI (optional)
curl -L -o cmctl.tar.gz https://github.com/cert-manager/cert-manager/releases/latest/download/cmctl-linux-amd64.tar.gz
tar xzf cmctl.tar.gz
sudo mv cmctl /usr/local/bin
```

### Cluster Requirements

- **Kubernetes Version**: 1.20+
- **CPU**: Minimum 4 cores, Recommended 8 cores
- **Memory**: Minimum 8GB, Recommended 16GB
- **Storage**: 100GB+ for persistent volumes
- **Ingress Controller**: NGINX or similar
- **Cert-Manager**: For SSL certificate management

### Verify Cluster Access

```bash
# Check cluster connection
kubectl cluster-info

# Check available resources
kubectl top nodes

# Verify RBAC permissions
kubectl auth can-i create deployments --namespace=enterprise-crm
```

## Environment Preparation

### Step 1: Create Project Directory

```bash
# Create deployment directory
mkdir -p ~/superset-k8s-deployment
cd ~/superset-k8s-deployment

# Create subdirectories
mkdir -p {manifests,configs,scripts,backups}
```

### Step 2: Set Environment Variables

```bash
# Create environment configuration
cat > .env << 'EOF'
# Cluster Configuration
NAMESPACE=enterprise-crm
SUPERSET_RELEASE_NAME=superset
DOMAIN=analytics.enterprise-crm.com

# Database Configuration
POSTGRES_HOST=crm-postgres.enterprise-crm.svc.cluster.local
POSTGRES_PORT=5432
POSTGRES_DB=enterprise_crm
POSTGRES_USER=superset_readonly
POSTGRES_PASSWORD=your_secure_password

# Superset Configuration
SUPERSET_SECRET_KEY=your_superset_secret_key_here
SUPERSET_ADMIN_USER=admin
SUPERSET_ADMIN_EMAIL=admin@enterprise-crm.com
SUPERSET_ADMIN_PASSWORD=admin_secure_password

# Redis Configuration
REDIS_HOST=redis.enterprise-crm.svc.cluster.local
REDIS_PORT=6379

# SSL Configuration
CERT_ISSUER=letsencrypt-prod
EOF

# Load environment variables
source .env
```

## Namespace and RBAC Setup

### Step 3: Create Namespace

```bash
# Create namespace manifest
cat > manifests/01-namespace.yaml << EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
  labels:
    name: ${NAMESPACE}
    app.kubernetes.io/name: enterprise-crm
    app.kubernetes.io/component: analytics
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: superset
  namespace: ${NAMESPACE}
  labels:
    app.kubernetes.io/name: superset
    app.kubernetes.io/component: analytics
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: ${NAMESPACE}
  name: superset-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: superset-rolebinding
  namespace: ${NAMESPACE}
subjects:
- kind: ServiceAccount
  name: superset
  namespace: ${NAMESPACE}
roleRef:
  kind: Role
  name: superset-role
  apiGroup: rbac.authorization.k8s.io
EOF

# Apply namespace and RBAC
kubectl apply -f manifests/01-namespace.yaml
```

## Secrets and ConfigMaps

### Step 4: Create Secrets

```bash
# Create database secret
kubectl create secret generic superset-db-secret \
  --namespace=${NAMESPACE} \
  --from-literal=host=${POSTGRES_HOST} \
  --from-literal=port=${POSTGRES_PORT} \
  --from-literal=database=${POSTGRES_DB} \
  --from-literal=username=${POSTGRES_USER} \
  --from-literal=password=${POSTGRES_PASSWORD} \
  --dry-run=client -o yaml > manifests/02-secrets.yaml

# Create Superset secret
kubectl create secret generic superset-secret \
  --namespace=${NAMESPACE} \
  --from-literal=secret-key=${SUPERSET_SECRET_KEY} \
  --from-literal=admin-user=${SUPERSET_ADMIN_USER} \
  --from-literal=admin-email=${SUPERSET_ADMIN_EMAIL} \
  --from-literal=admin-password=${SUPERSET_ADMIN_PASSWORD} \
  --dry-run=client -o yaml >> manifests/02-secrets.yaml

# Apply secrets
kubectl apply -f manifests/02-secrets.yaml
```

### Step 5: Create Superset Configuration

```bash
# Create Superset configuration
cat > configs/superset_config.py << 'EOF'
import os
from datetime import timedelta

# Database Configuration
SQLALCHEMY_DATABASE_URI = f"postgresql://{os.environ.get('DB_USER')}:{os.environ.get('DB_PASS')}@{os.environ.get('DB_HOST')}:{os.environ.get('DB_PORT')}/superset"

# Enterprise CRM Database
SQLALCHEMY_BINDS = {
    'enterprise_crm': f"postgresql://{os.environ.get('CRM_DB_USER')}:{os.environ.get('CRM_DB_PASS')}@{os.environ.get('CRM_DB_HOST')}:{os.environ.get('CRM_DB_PORT')}/{os.environ.get('CRM_DB_NAME')}"
}

# Redis Configuration
REDIS_HOST = os.environ.get('REDIS_HOST', 'redis')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

# Cache Configuration
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 300,
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_HOST': REDIS_HOST,
    'CACHE_REDIS_PORT': REDIS_PORT,
    'CACHE_REDIS_DB': 1,
}

DATA_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 3600,
    'CACHE_KEY_PREFIX': 'superset_data_',
    'CACHE_REDIS_HOST': REDIS_HOST,
    'CACHE_REDIS_PORT': REDIS_PORT,
    'CACHE_REDIS_DB': 2,
}

# Celery Configuration
class CeleryConfig:
    broker_url = f'redis://{REDIS_HOST}:{REDIS_PORT}/0'
    imports = ('superset.sql_lab',)
    result_backend = f'redis://{REDIS_HOST}:{REDIS_PORT}/1'
    worker_prefetch_multiplier = 1
    task_acks_late = False
    task_annotations = {
        'sql_lab.get_sql_results': {
            'rate_limit': '100/s',
        },
    }

CELERY_CONFIG = CeleryConfig

# Security Configuration
SECRET_KEY = os.environ.get('SUPERSET_SECRET_KEY')
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = None

# Feature Flags
FEATURE_FLAGS = {
    'ENABLE_TEMPLATE_PROCESSING': True,
    'DASHBOARD_NATIVE_FILTERS': True,
    'DASHBOARD_CROSS_FILTERS': True,
    'GLOBAL_ASYNC_QUERIES': True,
    'VERSIONED_EXPORT': True,
    'DASHBOARD_RBAC': True,
    'ENABLE_EXPLORE_JSON_CSRF_PROTECTION': True,
}

# Row Limits
ROW_LIMIT = 5000
VIZ_ROW_LIMIT = 10000
SAMPLES_ROW_LIMIT = 1000

# Timeout Configuration
SUPERSET_WEBSERVER_TIMEOUT = 300
SQLLAB_TIMEOUT = 300
SQLLAB_ASYNC_TIME_LIMIT_SEC = 600

# Upload Configuration
UPLOAD_FOLDER = '/app/superset_home/uploads/'
IMG_UPLOAD_FOLDER = '/app/superset_home/uploads/'
IMG_UPLOAD_URL = '/static/uploads/'

# Email Configuration
SMTP_HOST = os.environ.get('SMTP_HOST')
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = os.environ.get('SMTP_USER')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_MAIL_FROM = os.environ.get('SMTP_MAIL_FROM')

# Logging Configuration
ENABLE_TIME_ROTATE = True
TIME_ROTATE_LOG_LEVEL = 'INFO'
FILENAME = '/app/superset_home/logs/superset.log'

# Custom CSS
CUSTOM_CSS = """
.navbar-brand {
    color: #1f77b4 !important;
    font-weight: bold;
}
.dashboard-header {
    background-color: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}
.slice_container {
    border: 1px solid #e3e6ea;
    border-radius: 0.375rem;
}
"""

# Public Role Configuration
PUBLIC_ROLE_LIKE = 'Gamma'

# CORS Configuration
ENABLE_CORS = True
CORS_OPTIONS = {
    'supports_credentials': True,
    'allow_headers': ['*'],
    'resources': ['*'],
    'origins': ['*']
}

# Async Query Configuration
RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=REDIS_PORT,
    key_prefix='superset_results'
)
EOF

# Create ConfigMap for Superset configuration
kubectl create configmap superset-config \
  --namespace=${NAMESPACE} \
  --from-file=superset_config.py=configs/superset_config.py \
  --dry-run=client -o yaml > manifests/03-configmap.yaml

# Apply ConfigMap
kubectl apply -f manifests/03-configmap.yaml
```

## Database Setup

### Step 6: Deploy PostgreSQL for Superset Metadata

```bash
# Create PostgreSQL deployment for Superset metadata
cat > manifests/04-postgres.yaml << EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: ${NAMESPACE}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: fast-ssd
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: ${NAMESPACE}
  labels:
    app: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:13
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: superset
        - name: POSTGRES_USER
          value: superset
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - superset
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - superset
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: ${NAMESPACE}
  labels:
    app: postgres
spec:
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: postgres
  type: ClusterIP
EOF

# Apply PostgreSQL deployment
kubectl apply -f manifests/04-postgres.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=postgres --namespace=${NAMESPACE} --timeout=300s
```

## Redis Cache Setup

### Step 7: Deploy Redis

```bash
# Create Redis deployment
cat > manifests/05-redis.yaml << EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: ${NAMESPACE}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: ${NAMESPACE}
  labels:
    app: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --appendonly
        - "yes"
        - --maxmemory
        - "1gb"
        - --maxmemory-policy
        - "allkeys-lru"
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: ${NAMESPACE}
  labels:
    app: redis
spec:
  ports:
  - port: 6379
    targetPort: 6379
  selector:
    app: redis
  type: ClusterIP
EOF

# Apply Redis deployment
kubectl apply -f manifests/05-redis.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis --namespace=${NAMESPACE} --timeout=300s
```

## Superset Application Deployment

### Step 8: Deploy Superset

```bash
# Create Superset deployment
cat > manifests/06-superset.yaml << EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: superset-pvc
  namespace: ${NAMESPACE}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: fast-ssd
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: superset
  namespace: ${NAMESPACE}
  labels:
    app: superset
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
      serviceAccountName: superset
      initContainers:
      - name: wait-for-postgres
        image: postgres:13
        command:
        - sh
        - -c
        - |
          until pg_isready -h postgres -p 5432 -U superset; do
            echo "Waiting for PostgreSQL..."
            sleep 2
          done
      - name: superset-init
        image: apache/superset:2.1.0
        command:
        - sh
        - -c
        - |
          superset db upgrade
          superset fab create-admin \
            --username \$SUPERSET_ADMIN_USER \
            --firstname Admin \
            --lastname User \
            --email \$SUPERSET_ADMIN_EMAIL \
            --password \$SUPERSET_ADMIN_PASSWORD || true
          superset init
        env:
        - name: SUPERSET_CONFIG_PATH
          value: /app/superset_config.py
        - name: DB_HOST
          value: postgres
        - name: DB_PORT
          value: "5432"
        - name: DB_USER
          value: superset
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: password
        - name: CRM_DB_HOST
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: host
        - name: CRM_DB_PORT
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: port
        - name: CRM_DB_NAME
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: database
        - name: CRM_DB_USER
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: username
        - name: CRM_DB_PASS
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: password
        - name: REDIS_HOST
          value: redis
        - name: REDIS_PORT
          value: "6379"
        - name: SUPERSET_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: superset-secret
              key: secret-key
        - name: SUPERSET_ADMIN_USER
          valueFrom:
            secretKeyRef:
              name: superset-secret
              key: admin-user
        - name: SUPERSET_ADMIN_EMAIL
          valueFrom:
            secretKeyRef:
              name: superset-secret
              key: admin-email
        - name: SUPERSET_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: superset-secret
              key: admin-password
        volumeMounts:
        - name: superset-config
          mountPath: /app/superset_config.py
          subPath: superset_config.py
        - name: superset-storage
          mountPath: /app/superset_home
      containers:
      - name: superset
        image: apache/superset:2.1.0
        ports:
        - containerPort: 8088
        command:
        - sh
        - -c
        - |
          gunicorn \
            --bind 0.0.0.0:8088 \
            --workers 4 \
            --worker-class gevent \
            --worker-connections 1000 \
            --timeout 300 \
            --keepalive 2 \
            --max-requests 1000 \
            --max-requests-jitter 100 \
            --preload \
            --limit-request-line 0 \
            --limit-request-field_size 0 \
            "superset.app:create_app()"
        env:
        - name: SUPERSET_CONFIG_PATH
          value: /app/superset_config.py
        - name: DB_HOST
          value: postgres
        - name: DB_PORT
          value: "5432"
        - name: DB_USER
          value: superset
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: password
        - name: CRM_DB_HOST
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: host
        - name: CRM_DB_PORT
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: port
        - name: CRM_DB_NAME
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: database
        - name: CRM_DB_USER
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: username
        - name: CRM_DB_PASS
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: password
        - name: REDIS_HOST
          value: redis
        - name: REDIS_PORT
          value: "6379"
        - name: SUPERSET_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: superset-secret
              key: secret-key
        volumeMounts:
        - name: superset-config
          mountPath: /app/superset_config.py
          subPath: superset_config.py
        - name: superset-storage
          mountPath: /app/superset_home
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8088
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8088
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
      - name: superset-worker
        image: apache/superset:2.1.0
        command:
        - sh
        - -c
        - |
          celery --app=superset.tasks.celery_app:app worker \
            --loglevel=INFO \
            --concurrency=4
        env:
        - name: SUPERSET_CONFIG_PATH
          value: /app/superset_config.py
        - name: DB_HOST
          value: postgres
        - name: DB_PORT
          value: "5432"
        - name: DB_USER
          value: superset
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: password
        - name: CRM_DB_HOST
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: host
        - name: CRM_DB_PORT
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: port
        - name: CRM_DB_NAME
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: database
        - name: CRM_DB_USER
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: username
        - name: CRM_DB_PASS
          valueFrom:
            secretKeyRef:
              name: superset-db-secret
              key: password
        - name: REDIS_HOST
          value: redis
        - name: REDIS_PORT
          value: "6379"
        - name: SUPERSET_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: superset-secret
              key: secret-key
        volumeMounts:
        - name: superset-config
          mountPath: /app/superset_config.py
          subPath: superset_config.py
        - name: superset-storage
          mountPath: /app/superset_home
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: superset-config
        configMap:
          name: superset-config
      - name: superset-storage
        persistentVolumeClaim:
          claimName: superset-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: superset
  namespace: ${NAMESPACE}
  labels:
    app: superset
spec:
  ports:
  - port: 8088
    targetPort: 8088
    name: http
  selector:
    app: superset
  type: ClusterIP
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: superset-pdb
  namespace: ${NAMESPACE}
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: superset
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: superset-hpa
  namespace: ${NAMESPACE}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: superset
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
EOF

# Apply Superset deployment
kubectl apply -f manifests/06-superset.yaml

# Wait for Superset to be ready
kubectl wait --for=condition=ready pod -l app=superset --namespace=${NAMESPACE} --timeout=600s
```

## Ingress and SSL Configuration

### Step 8: Install cert-manager (if not already installed)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod -l app=cert-manager --namespace=cert-manager --timeout=300s

# Create ClusterIssuer for Let's Encrypt
cat > manifests/07-cert-issuer.yaml << EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@enterprise-crm.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

kubectl apply -f manifests/07-cert-issuer.yaml
```

### Step 9: Create Ingress

```bash
# Create Ingress with SSL
cat > manifests/08-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: superset-ingress
  namespace: ${NAMESPACE}
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "${CERT_ISSUER}"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "300"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: SAMEORIGIN";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
spec:
  tls:
  - hosts:
    - ${DOMAIN}
    secretName: superset-tls
  rules:
  - host: ${DOMAIN}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: superset
            port:
              number: 8088
EOF

# Apply Ingress
kubectl apply -f manifests/08-ingress.yaml

# Check certificate status
kubectl get certificate -n ${NAMESPACE}
kubectl describe certificate superset-tls -n ${NAMESPACE}
```

## Dashboard Import and Configuration

### Step 10: Import Dashboard Configuration

```bash
# Create dashboard import script
cat > scripts/import-dashboard.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}
SUPERSET_POD=$(kubectl get pods -n $NAMESPACE -l app=superset -o jsonpath='{.items[0].metadata.name}')

echo "Importing dashboard configuration..."

# Copy dashboard configuration to pod
kubectl cp superset-dashboard-config.json $NAMESPACE/$SUPERSET_POD:/tmp/dashboard-config.json

# Import dashboard
kubectl exec -n $NAMESPACE $SUPERSET_POD -- superset import-dashboards -p /tmp/dashboard-config.json

echo "Dashboard import completed!"
EOF

chmod +x scripts/import-dashboard.sh

# Create database setup script
cat > scripts/setup-database.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}
CRM_DB_HOST=${2:-crm-postgres.enterprise-crm.svc.cluster.local}

echo "Setting up database views and permissions..."

# Copy SQL script to CRM database pod
CRM_POD=$(kubectl get pods -n $NAMESPACE -l app=crm-postgres -o jsonpath='{.items[0].metadata.name}')
kubectl cp superset-sql-queries.sql $NAMESPACE/$CRM_POD:/tmp/superset-views.sql

# Execute SQL script
kubectl exec -n $NAMESPACE $CRM_POD -- psql -U postgres -d enterprise_crm -f /tmp/superset-views.sql

echo "Database setup completed!"
EOF

chmod +x scripts/setup-database.sh

# Execute setup scripts
./scripts/setup-database.sh ${NAMESPACE}
./scripts/import-dashboard.sh ${NAMESPACE}
```

### Step 11: Configure Data Sources

```bash
# Create data source configuration script
cat > scripts/configure-datasources.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}
SUPERSET_POD=$(kubectl get pods -n $NAMESPACE -l app=superset -o jsonpath='{.items[0].metadata.name}')

echo "Configuring data sources..."

# Create Python script for data source configuration
cat > /tmp/configure_datasources.py << 'PYTHON_EOF'
import os
from superset import app, db
from superset.models.core import Database

# Initialize app context
app.app_context().push()

# Add Enterprise CRM database
crm_db = Database(
    database_name='Enterprise CRM',
    sqlalchemy_uri=f"postgresql://{os.environ.get('CRM_DB_USER')}:{os.environ.get('CRM_DB_PASS')}@{os.environ.get('CRM_DB_HOST')}:{os.environ.get('CRM_DB_PORT')}/{os.environ.get('CRM_DB_NAME')}",
    expose_in_sqllab=True,
    allow_run_async=True,
    allow_ctas=False,
    allow_cvas=False,
    allow_dml=False,
    extra='{"metadata_params": {}, "engine_params": {"pool_size": 10, "max_overflow": 20}}'
)

# Check if database already exists
existing_db = db.session.query(Database).filter_by(database_name='Enterprise CRM').first()
if not existing_db:
    db.session.add(crm_db)
    db.session.commit()
    print("Enterprise CRM database added successfully!")
else:
    print("Enterprise CRM database already exists!")

print("Data source configuration completed!")
PYTHON_EOF

# Copy and execute the script
kubectl cp /tmp/configure_datasources.py $NAMESPACE/$SUPERSET_POD:/tmp/configure_datasources.py
kubectl exec -n $NAMESPACE $SUPERSET_POD -- python /tmp/configure_datasources.py

echo "Data source configuration completed!"
EOF

chmod +x scripts/configure-datasources.sh

# Execute data source configuration
./scripts/configure-datasources.sh ${NAMESPACE}
```

## Monitoring and Logging

### Step 12: Deploy Monitoring

```bash
# Create monitoring configuration
cat > manifests/09-monitoring.yaml << EOF
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: superset-metrics
  namespace: ${NAMESPACE}
  labels:
    app: superset
spec:
  selector:
    matchLabels:
      app: superset
  endpoints:
  - port: http
    interval: 30s
    path: /metrics
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: superset-grafana-dashboard
  namespace: ${NAMESPACE}
  labels:
    grafana_dashboard: "1"
data:
  superset-dashboard.json: |
    {
      "dashboard": {
        "title": "Superset Monitoring",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(superset_requests_total[5m])",
                "legendFormat": "{{method}} {{status}}"
              }
            ]
          },
          {
            "title": "Response Time",
            "type": "graph", 
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(superset_request_duration_seconds_bucket[5m]))",
                "legendFormat": "95th percentile"
              }
            ]
          },
          {
            "title": "Active Users",
            "type": "singlestat",
            "targets": [
              {
                "expr": "superset_active_users",
                "legendFormat": "Active Users"
              }
            ]
          }
        ]
      }
    }
EOF

# Apply monitoring configuration
kubectl apply -f manifests/09-monitoring.yaml
```

### Step 13: Configure Logging

```bash
# Create logging configuration
cat > manifests/10-logging.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-superset-config
  namespace: ${NAMESPACE}
data:
  fluent.conf: |
    <source>
      @type tail
      path /app/superset_home/logs/*.log
      pos_file /var/log/fluentd-superset.log.pos
      tag superset.*
      format json
      time_key timestamp
      time_format %Y-%m-%d %H:%M:%S
    </source>
    
    <filter superset.**>
      @type record_transformer
      <record>
        namespace ${NAMESPACE}
        app superset
        cluster \${ENV["CLUSTER_NAME"]}
      </record>
    </filter>
    
    <match superset.**>
      @type elasticsearch
      host elasticsearch.logging.svc.cluster.local
      port 9200
      index_name superset-logs
      type_name _doc
      include_tag_key true
      tag_key @log_name
      flush_interval 10s
    </match>
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd-superset
  namespace: ${NAMESPACE}
spec:
  selector:
    matchLabels:
      name: fluentd-superset
  template:
    metadata:
      labels:
        name: fluentd-superset
    spec:
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging.svc.cluster.local"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        - name: CLUSTER_NAME
          value: "enterprise-crm"
        volumeMounts:
        - name: config
          mountPath: /fluentd/etc/fluent.conf
          subPath: fluent.conf
        - name: superset-logs
          mountPath: /app/superset_home/logs
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: fluentd-superset-config
      - name: superset-logs
        hostPath:
          path: /var/log/superset
EOF

# Apply logging configuration
kubectl apply -f manifests/10-logging.yaml
```

## Backup and Disaster Recovery

### Step 14: Create Backup Strategy

```bash
# Create backup script
cat > scripts/backup-superset.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}
BACKUP_DIR=${2:-./backups}
DATE=$(date +%Y%m%d_%H%M%S)

echo "Starting Superset backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
echo "Backing up PostgreSQL database..."
kubectl exec -n $NAMESPACE deployment/postgres -- pg_dump -U superset superset > $BACKUP_DIR/superset_db_$DATE.sql

# Backup Superset configuration
echo "Backing up Superset configuration..."
kubectl get configmap superset-config -n $NAMESPACE -o yaml > $BACKUP_DIR/superset_config_$DATE.yaml
kubectl get secret superset-secret -n $NAMESPACE -o yaml > $BACKUP_DIR/superset_secrets_$DATE.yaml

# Backup dashboards
echo "Backing up dashboards..."
SUPERSET_POD=$(kubectl get pods -n $NAMESPACE -l app=superset -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n $NAMESPACE $SUPERSET_POD -- superset export-dashboards > $BACKUP_DIR/dashboards_$DATE.json

# Backup persistent volumes
echo "Backing up persistent volumes..."
kubectl get pvc -n $NAMESPACE -o yaml > $BACKUP_DIR/pvc_$DATE.yaml

# Create compressed archive
tar -czf $BACKUP_DIR/superset_backup_$DATE.tar.gz -C $BACKUP_DIR superset_db_$DATE.sql superset_config_$DATE.yaml superset_secrets_$DATE.yaml dashboards_$DATE.json pvc_$DATE.yaml

echo "Backup completed: $BACKUP_DIR/superset_backup_$DATE.tar.gz"
EOF

chmod +x scripts/backup-superset.sh

# Create restore script
cat > scripts/restore-superset.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}
BACKUP_FILE=${2}

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <namespace> <backup_file>"
    exit 1
fi

echo "Starting Superset restore from $BACKUP_FILE..."

# Extract backup
TEMP_DIR=$(mktemp -d)
tar -xzf $BACKUP_FILE -C $TEMP_DIR

# Restore database
echo "Restoring PostgreSQL database..."
kubectl exec -i -n $NAMESPACE deployment/postgres -- psql -U superset superset < $TEMP_DIR/superset_db_*.sql

# Restore configuration
echo "Restoring configuration..."
kubectl apply -f $TEMP_DIR/superset_config_*.yaml
kubectl apply -f $TEMP_DIR/superset_secrets_*.yaml

# Restart Superset
echo "Restarting Superset..."
kubectl rollout restart deployment/superset -n $NAMESPACE
kubectl rollout status deployment/superset -n $NAMESPACE

# Restore dashboards
echo "Restoring dashboards..."
sleep 30  # Wait for Superset to be ready
SUPERSET_POD=$(kubectl get pods -n $NAMESPACE -l app=superset -o jsonpath='{.items[0].metadata.name}')
kubectl cp $TEMP_DIR/dashboards_*.json $NAMESPACE/$SUPERSET_POD:/tmp/restore_dashboards.json
kubectl exec -n $NAMESPACE $SUPERSET_POD -- superset import-dashboards -p /tmp/restore_dashboards.json

# Cleanup
rm -rf $TEMP_DIR

echo "Restore completed!"
EOF

chmod +x scripts/restore-superset.sh

# Create automated backup CronJob
cat > manifests/11-backup-cronjob.yaml << EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: superset-backup
  namespace: ${NAMESPACE}
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:13
            command:
            - /bin/bash
            - -c
            - |
              DATE=\$(date +%Y%m%d_%H%M%S)
              pg_dump -h postgres -U superset superset > /backup/superset_db_\$DATE.sql
              find /backup -name "superset_db_*.sql" -mtime +7 -delete
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: superset-db-secret
                  key: password
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-pvc
  namespace: ${NAMESPACE}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: standard
EOF

kubectl apply -f manifests/11-backup-cronjob.yaml
```

## Troubleshooting

### Step 15: Verification and Testing

```bash
# Create verification script
cat > scripts/verify-deployment.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}
DOMAIN=${2:-analytics.enterprise-crm.com}

echo "Verifying Superset deployment..."

# Check namespace
echo "1. Checking namespace..."
kubectl get namespace $NAMESPACE

# Check pods
echo "2. Checking pods..."
kubectl get pods -n $NAMESPACE

# Check services
echo "3. Checking services..."
kubectl get services -n $NAMESPACE

# Check ingress
echo "4. Checking ingress..."
kubectl get ingress -n $NAMESPACE

# Check certificates
echo "5. Checking certificates..."
kubectl get certificates -n $NAMESPACE

# Check persistent volumes
echo "6. Checking persistent volumes..."
kubectl get pvc -n $NAMESPACE

# Test database connectivity
echo "7. Testing database connectivity..."
kubectl exec -n $NAMESPACE deployment/postgres -- pg_isready -U superset

# Test Redis connectivity
echo "8. Testing Redis connectivity..."
kubectl exec -n $NAMESPACE deployment/redis -- redis-cli ping

# Test Superset health
echo "9. Testing Superset health..."
SUPERSET_POD=$(kubectl get pods -n $NAMESPACE -l app=superset -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n $NAMESPACE $SUPERSET_POD -- curl -f http://localhost:8088/health

# Test external access
echo "10. Testing external access..."
curl -k https://$DOMAIN/health

echo "Verification completed!"
EOF

chmod +x scripts/verify-deployment.sh

# Run verification
./scripts/verify-deployment.sh ${NAMESPACE} ${DOMAIN}
```

### Common Issues and Solutions

```bash
# Create troubleshooting script
cat > scripts/troubleshoot.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}

echo "Superset Troubleshooting Guide"
echo "=============================="

# Check pod status
echo "1. Pod Status:"
kubectl get pods -n $NAMESPACE -o wide

# Check pod logs
echo "2. Recent Pod Logs:"
kubectl logs -n $NAMESPACE -l app=superset --tail=50

# Check events
echo "3. Recent Events:"
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'

# Check resource usage
echo "4. Resource Usage:"
kubectl top pods -n $NAMESPACE

# Check persistent volume status
echo "5. Persistent Volume Status:"
kubectl get pvc -n $NAMESPACE

# Check ingress status
echo "6. Ingress Status:"
kubectl describe ingress superset-ingress -n $NAMESPACE

# Check certificate status
echo "7. Certificate Status:"
kubectl describe certificate superset-tls -n $NAMESPACE

# Database connectivity test
echo "8. Database Connectivity:"
kubectl exec -n $NAMESPACE deployment/postgres -- pg_isready -U superset

# Redis connectivity test
echo "9. Redis Connectivity:"
kubectl exec -n $NAMESPACE deployment/redis -- redis-cli ping

# Superset configuration check
echo "10. Superset Configuration:"
kubectl get configmap superset-config -n $NAMESPACE -o yaml

echo "Troubleshooting completed!"
EOF

chmod +x scripts/troubleshoot.sh
```

### Performance Tuning

```bash
# Create performance tuning script
cat > scripts/tune-performance.sh << 'EOF'
#!/bin/bash

NAMESPACE=${1:-enterprise-crm}

echo "Applying performance optimizations..."

# Update Superset deployment with performance settings
kubectl patch deployment superset -n $NAMESPACE -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "superset",
            "resources": {
              "requests": {
                "memory": "4Gi",
                "cpu": "2000m"
              },
              "limits": {
                "memory": "8Gi", 
                "cpu": "4000m"
              }
            },
            "env": [
              {
                "name": "GUNICORN_WORKERS",
                "value": "8"
              },
              {
                "name": "GUNICORN_WORKER_CLASS",
                "value": "gevent"
              },
              {
                "name": "GUNICORN_WORKER_CONNECTIONS",
                "value": "1000"
              }
            ]
          }
        ]
      }
    }
  }
}'

# Update HPA settings
kubectl patch hpa superset-hpa -n $NAMESPACE -p '{
  "spec": {
    "maxReplicas": 20,
    "metrics": [
      {
        "type": "Resource",
        "resource": {
          "name": "cpu",
          "target": {
            "type": "Utilization",
            "averageUtilization": 60
          }
        }
      }
    ]
  }
}'

echo "Performance tuning applied!"
EOF

chmod +x scripts/tune-performance.sh
```

## Final Steps

### Step 16: Access and Verify

```bash
# Get access information
echo "Superset Dashboard Access Information:"
echo "====================================="
echo "URL: https://${DOMAIN}"
echo "Username: ${SUPERSET_ADMIN_USER}"
echo "Password: ${SUPERSET_ADMIN_PASSWORD}"
echo ""

# Check deployment status
kubectl get all -n ${NAMESPACE}

# Get ingress IP
kubectl get ingress superset-ingress -n ${NAMESPACE}

# Check certificate status
kubectl get certificate superset-tls -n ${NAMESPACE}

echo "Deployment completed successfully!"
echo "Access your Superset dashboard at: https://${DOMAIN}"
```

## Maintenance Commands

```bash
# Scale deployment
kubectl scale deployment superset --replicas=5 -n ${NAMESPACE}

# Update image
kubectl set image deployment/superset superset=apache/superset:2.1.1 -n ${NAMESPACE}

# Restart deployment
kubectl rollout restart deployment/superset -n ${NAMESPACE}

# Check rollout status
kubectl rollout status deployment/superset -n ${NAMESPACE}

# View logs
kubectl logs -f deployment/superset -n ${NAMESPACE}

# Execute commands in pod
kubectl exec -it deployment/superset -n ${NAMESPACE} -- bash

# Port forward for local access
kubectl port-forward service/superset 8088:8088 -n ${NAMESPACE}
```

This comprehensive guide provides everything needed to deploy Apache Superset on Kubernetes with enterprise-grade features, monitoring, backup, and troubleshooting capabilities. The deployment is production-ready with SSL, scaling, and comprehensive monitoring.

