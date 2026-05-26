# Enterprise CRM Production Deployment Guide

## Overview
This comprehensive guide outlines the production deployment process for the Enterprise CRM system, including infrastructure setup, security configuration, monitoring, and operational procedures.

## Pre-Deployment Checklist

### Infrastructure Requirements
- [ ] Kubernetes cluster (v1.27+) with 3+ nodes
- [ ] PostgreSQL database cluster (v15+)
- [ ] Redis cluster for caching and sessions
- [ ] Load balancer with SSL termination
- [ ] CDN for static asset delivery
- [ ] Backup and disaster recovery systems
- [ ] Monitoring and logging infrastructure

### Security Requirements
- [ ] SSL/TLS certificates configured
- [ ] Network security groups configured
- [ ] IAM roles and policies defined
- [ ] Secrets management system deployed
- [ ] Security scanning tools activated
- [ ] Compliance monitoring enabled

### Performance Requirements
- [ ] Auto-scaling policies configured
- [ ] Resource limits and requests defined
- [ ] Caching layers implemented
- [ ] Database optimization applied
- [ ] CDN configuration completed

## Deployment Architecture

### Production Environment Layout
```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   CDN (CloudFlare)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Load Balancer (ALB)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Kubernetes Cluster                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Node 1    │ │   Node 2    │ │   Node 3    │           │
│  │ (Frontend)  │ │ (Backend)   │ │ (Database)  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Service Mesh Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Istio Service Mesh                       │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Frontend   │    │   Backend   │    │  Database   │     │
│  │   Services  │◄──►│   Services  │◄──►│   Services  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Monitoring  │    │  Security   │    │   Logging   │     │
│  │   Stack     │    │    Stack    │    │    Stack    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Deployment Process

### Phase 1: Infrastructure Setup

#### 1.1 Kubernetes Cluster Deployment
```bash
#!/bin/bash
# Deploy Kubernetes cluster using Terraform

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -var-file="production.tfvars"

# Apply the configuration
terraform apply -var-file="production.tfvars" -auto-approve

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name enterprise-crm-prod

# Verify cluster
kubectl get nodes
kubectl get namespaces
```

#### 1.2 Namespace Creation
```bash
# Create production namespaces
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: enterprise-crm-prod
  labels:
    environment: production
    project: enterprise-crm
---
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
  labels:
    environment: production
    project: monitoring
---
apiVersion: v1
kind: Namespace
metadata:
  name: security
  labels:
    environment: production
    project: security
---
apiVersion: v1
kind: Namespace
metadata:
  name: istio-system
  labels:
    environment: production
    project: service-mesh
EOF
```

#### 1.3 Storage Classes and PVCs
```bash
# Deploy storage classes
kubectl apply -f infrastructure/kubernetes/storage-classes.yaml

# Create persistent volume claims
kubectl apply -f infrastructure/kubernetes/persistent-volumes.yaml
```

### Phase 2: Security Infrastructure

#### 2.1 Certificate Management
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create cluster issuer
kubectl apply -f - <<EOF
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
```

#### 2.2 Secrets Management
```bash
# Create secrets for production
kubectl create secret generic postgresql-secret \
  --from-literal=username=postgres \
  --from-literal=password=$(openssl rand -base64 32) \
  --from-literal=database=enterprise_crm_prod \
  -n enterprise-crm-prod

kubectl create secret generic redis-secret \
  --from-literal=password=$(openssl rand -base64 32) \
  -n enterprise-crm-prod

kubectl create secret generic jwt-secret \
  --from-literal=secret=$(openssl rand -base64 64) \
  -n enterprise-crm-prod

kubectl create secret generic novu-secret \
  --from-literal=api-key=$NOVU_API_KEY \
  --from-literal=app-id=$NOVU_APP_ID \
  --from-literal=webhook-secret=$NOVU_WEBHOOK_SECRET \
  -n enterprise-crm-prod
```

### Phase 3: Database Deployment

#### 3.1 PostgreSQL Cluster
```bash
# Deploy PostgreSQL operator
kubectl apply -f https://raw.githubusercontent.com/zalando/postgres-operator/master/manifests/configmap.yaml
kubectl apply -f https://raw.githubusercontent.com/zalando/postgres-operator/master/manifests/operator-service-account-rbac.yaml
kubectl apply -f https://raw.githubusercontent.com/zalando/postgres-operator/master/manifests/postgres-operator.yaml

# Deploy PostgreSQL cluster
kubectl apply -f - <<EOF
apiVersion: "acid.zalan.do/v1"
kind: postgresql
metadata:
  name: enterprise-crm-postgres
  namespace: enterprise-crm-prod
spec:
  teamId: "enterprise-crm"
  volume:
    size: 100Gi
    storageClass: fast-ssd
  numberOfInstances: 3
  users:
    enterprise_crm:
    - superuser
    - createdb
  databases:
    enterprise_crm_prod: enterprise_crm
  postgresql:
    version: "15"
    parameters:
      max_connections: "200"
      shared_buffers: "4GB"
      effective_cache_size: "12GB"
      work_mem: "64MB"
      maintenance_work_mem: "1GB"
      checkpoint_completion_target: "0.9"
      wal_buffers: "64MB"
      default_statistics_target: "100"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"
  resources:
    requests:
      cpu: 2000m
      memory: 8Gi
    limits:
      cpu: 4000m
      memory: 16Gi
EOF
```

#### 3.2 Redis Cluster
```bash
# Deploy Redis cluster
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: enterprise-crm-prod
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: client
        - containerPort: 16379
          name: gossip
        command:
        - redis-server
        - /etc/redis/redis.conf
        - --cluster-enabled
        - "yes"
        - --cluster-config-file
        - /data/nodes.conf
        - --cluster-node-timeout
        - "5000"
        - --appendonly
        - "yes"
        volumeMounts:
        - name: data
          mountPath: /data
        - name: config
          mountPath: /etc/redis
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
      volumes:
      - name: config
        configMap:
          name: redis-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
EOF
```

### Phase 4: Service Mesh Deployment

#### 4.1 Istio Installation
```bash
# Download and install Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Install Istio
istioctl install --set values.defaultRevision=default -y

# Enable sidecar injection
kubectl label namespace enterprise-crm-prod istio-injection=enabled
```

#### 4.2 Gateway Configuration
```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: enterprise-crm-gateway
  namespace: enterprise-crm-prod
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: enterprise-crm-tls
    hosts:
    - "*.enterprise-crm.com"
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "*.enterprise-crm.com"
    tls:
      httpsRedirect: true
EOF
```

### Phase 5: Application Deployment

#### 5.1 Backend Services
```bash
# Deploy customer service
kubectl apply -f services/go/customer-service/deployments/kubernetes.yaml

# Deploy CRM core service
kubectl apply -f services/go/crm-core-service/deployments/kubernetes.yaml

# Deploy inventory service
kubectl apply -f services/go/inventory-service/deployments/kubernetes.yaml

# Deploy analytics service
kubectl apply -f services/go/analytics-service/deployments/kubernetes.yaml

# Deploy Novu integration service
kubectl apply -f novu-integration/kubernetes/deployment.yaml
```

#### 5.2 Frontend Deployment
```bash
# Build and deploy frontend
cd frontend
npm run build

# Create Docker image
docker build -t enterprise-crm/frontend:prod .
docker push enterprise-crm/frontend:prod

# Deploy frontend
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: enterprise-crm-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: enterprise-crm/frontend:prod
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        env:
        - name: REACT_APP_API_URL
          value: "https://api.enterprise-crm.com"
        - name: REACT_APP_NOVU_APP_ID
          valueFrom:
            secretKeyRef:
              name: novu-secret
              key: app-id
EOF
```

### Phase 6: Monitoring and Observability

#### 6.1 Prometheus Stack
```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=fast-ssd \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi \
  --set grafana.adminPassword=admin123 \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.storageClassName=fast-ssd \
  --set grafana.persistence.size=10Gi
```

#### 6.2 Logging Stack
```bash
# Deploy OpenSearch
kubectl apply -f monitoring/opensearch/opensearch-deployment.yaml

# Deploy Fluent Bit
kubectl apply -f monitoring/fluent-bit/fluent-bit-deployment.yaml
```

### Phase 7: Security Stack Deployment

#### 7.1 KeyCloak
```bash
kubectl apply -f security/keycloak/keycloak-deployment.yaml
```

#### 7.2 Security Monitoring
```bash
# Deploy Wazuh
kubectl apply -f security/wazuh/wazuh-deployment.yaml

# Deploy OpenAppSec
kubectl apply -f security/openappsec/openappsec-deployment.yaml

# Deploy OpenCTI
kubectl apply -f security/opencti/opencti-deployment.yaml
```

### Phase 8: Load Balancer and Ingress

#### 8.1 NGINX Ingress Controller
```bash
# Install NGINX Ingress
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=3 \
  --set controller.nodeSelector."kubernetes\.io/os"=linux \
  --set defaultBackend.nodeSelector."kubernetes\.io/os"=linux
```

#### 8.2 Ingress Configuration
```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: enterprise-crm-ingress
  namespace: enterprise-crm-prod
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - app.enterprise-crm.com
    - api.enterprise-crm.com
    - notifications.enterprise-crm.com
    secretName: enterprise-crm-tls
  rules:
  - host: app.enterprise-crm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: api.enterprise-crm.com
    http:
      paths:
      - path: /customers
        pathType: Prefix
        backend:
          service:
            name: customer-service
            port:
              number: 80
      - path: /crm
        pathType: Prefix
        backend:
          service:
            name: crm-core-service
            port:
              number: 80
      - path: /inventory
        pathType: Prefix
        backend:
          service:
            name: inventory-service
            port:
              number: 80
      - path: /analytics
        pathType: Prefix
        backend:
          service:
            name: analytics-service
            port:
              number: 80
  - host: notifications.enterprise-crm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: novu-integration-service
            port:
              number: 80
EOF
```

## Post-Deployment Configuration

### Database Initialization
```bash
# Run database migrations
kubectl exec -it postgresql-0 -n enterprise-crm-prod -- psql -U postgres -d enterprise_crm_prod -f /migrations/init.sql

# Create initial data
kubectl exec -it postgresql-0 -n enterprise-crm-prod -- psql -U postgres -d enterprise_crm_prod -f /migrations/seed.sql
```

### Application Configuration
```bash
# Configure KeyCloak realm
kubectl exec -it keycloak-0 -n enterprise-crm-prod -- /opt/keycloak/bin/kc.sh import --file /realm-config.json

# Initialize Novu templates
curl -X POST https://notifications.enterprise-crm.com/api/templates/init \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Monitoring and Alerting Setup

### Grafana Dashboards
```bash
# Import custom dashboards
kubectl create configmap grafana-dashboards \
  --from-file=monitoring/grafana/dashboards/ \
  -n monitoring

# Configure data sources
kubectl apply -f monitoring/grafana/datasources.yaml
```

### Alert Rules
```bash
# Deploy alert rules
kubectl apply -f monitoring/prometheus/alert-rules.yaml

# Configure Alertmanager
kubectl apply -f monitoring/alertmanager/alertmanager-config.yaml
```

## Backup and Disaster Recovery

### Database Backup
```bash
# Configure automated backups
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: enterprise-crm-prod
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15-alpine
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgresql -U postgres enterprise_crm_prod | gzip > /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz
              aws s3 cp /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz s3://enterprise-crm-backups/
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgresql-secret
                  key: password
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
EOF
```

### Application Backup
```bash
# Backup application configurations
kubectl get all -n enterprise-crm-prod -o yaml > backup/app-config-$(date +%Y%m%d).yaml
kubectl get secrets -n enterprise-crm-prod -o yaml > backup/secrets-$(date +%Y%m%d).yaml
kubectl get configmaps -n enterprise-crm-prod -o yaml > backup/configmaps-$(date +%Y%m%d).yaml
```

## Health Checks and Validation

### Service Health Validation
```bash
#!/bin/bash
# Health check script

echo "Checking service health..."

# Check frontend
curl -f https://app.enterprise-crm.com/health || echo "Frontend health check failed"

# Check backend services
curl -f https://api.enterprise-crm.com/customers/health || echo "Customer service health check failed"
curl -f https://api.enterprise-crm.com/crm/health || echo "CRM service health check failed"
curl -f https://api.enterprise-crm.com/inventory/health || echo "Inventory service health check failed"
curl -f https://api.enterprise-crm.com/analytics/health || echo "Analytics service health check failed"

# Check notification service
curl -f https://notifications.enterprise-crm.com/health || echo "Notification service health check failed"

# Check database
kubectl exec -it postgresql-0 -n enterprise-crm-prod -- pg_isready -U postgres || echo "Database health check failed"

# Check Redis
kubectl exec -it redis-cluster-0 -n enterprise-crm-prod -- redis-cli ping || echo "Redis health check failed"

echo "Health checks completed"
```

### Performance Validation
```bash
# Load testing
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: load-test
  namespace: enterprise-crm-prod
spec:
  template:
    spec:
      containers:
      - name: load-test
        image: loadimpact/k6:latest
        command:
        - k6
        - run
        - --vus
        - "100"
        - --duration
        - "5m"
        - /scripts/load-test.js
        volumeMounts:
        - name: test-scripts
          mountPath: /scripts
      volumes:
      - name: test-scripts
        configMap:
          name: load-test-scripts
      restartPolicy: Never
EOF
```

## Operational Procedures

### Deployment Updates
```bash
# Rolling update procedure
kubectl set image deployment/customer-service customer-service=enterprise-crm/customer-service:v1.1.0 -n enterprise-crm-prod
kubectl rollout status deployment/customer-service -n enterprise-crm-prod

# Rollback if needed
kubectl rollout undo deployment/customer-service -n enterprise-crm-prod
```

### Scaling Operations
```bash
# Manual scaling
kubectl scale deployment customer-service --replicas=5 -n enterprise-crm-prod

# Check HPA status
kubectl get hpa -n enterprise-crm-prod
```

### Troubleshooting
```bash
# Check pod logs
kubectl logs -f deployment/customer-service -n enterprise-crm-prod

# Check events
kubectl get events -n enterprise-crm-prod --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n enterprise-crm-prod
kubectl top nodes
```

## Security Hardening

### Network Security
```bash
# Apply network policies
kubectl apply -f security/network-policies/

# Configure pod security standards
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: enterprise-crm-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
EOF
```

### RBAC Configuration
```bash
# Apply RBAC policies
kubectl apply -f security/rbac/

# Create service accounts
kubectl apply -f security/service-accounts/
```

## Compliance and Auditing

### Audit Logging
```bash
# Enable audit logging
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: audit-policy
  namespace: kube-system
data:
  audit-policy.yaml: |
    apiVersion: audit.k8s.io/v1
    kind: Policy
    rules:
    - level: Metadata
      namespaces: ["enterprise-crm-prod"]
      resources:
      - group: ""
        resources: ["secrets", "configmaps"]
    - level: RequestResponse
      namespaces: ["enterprise-crm-prod"]
      resources:
      - group: "apps"
        resources: ["deployments", "statefulsets"]
EOF
```

### Compliance Monitoring
```bash
# Deploy compliance monitoring
kubectl apply -f security/compliance/falco-deployment.yaml
kubectl apply -f security/compliance/opa-gatekeeper.yaml
```

## Production Readiness Checklist

### Infrastructure ✅
- [ ] Kubernetes cluster deployed and configured
- [ ] Load balancer configured with SSL termination
- [ ] CDN configured for static assets
- [ ] DNS records configured
- [ ] Backup systems operational

### Security ✅
- [ ] SSL certificates installed and auto-renewal configured
- [ ] Network security groups configured
- [ ] RBAC policies applied
- [ ] Secrets management operational
- [ ] Security monitoring active

### Monitoring ✅
- [ ] Prometheus and Grafana deployed
- [ ] Custom dashboards configured
- [ ] Alert rules configured
- [ ] Log aggregation operational
- [ ] Performance monitoring active

### Applications ✅
- [ ] All services deployed and healthy
- [ ] Database migrations completed
- [ ] Initial data loaded
- [ ] Health checks passing
- [ ] Performance tests passed

### Operations ✅
- [ ] Backup procedures tested
- [ ] Disaster recovery plan validated
- [ ] Monitoring and alerting tested
- [ ] Scaling procedures documented
- [ ] Troubleshooting guides available

## Go-Live Procedures

### Final Validation
1. **Smoke Tests**: Run comprehensive smoke tests
2. **Performance Tests**: Validate performance under load
3. **Security Scan**: Run final security scans
4. **Backup Test**: Verify backup and restore procedures
5. **Monitoring Check**: Ensure all monitoring is operational

### DNS Cutover
```bash
# Update DNS records to point to production
# This should be done during maintenance window
aws route53 change-resource-record-sets --hosted-zone-id Z123456789 --change-batch file://dns-change.json
```

### Post Go-Live Monitoring
- Monitor system performance for first 24 hours
- Check error rates and response times
- Validate user experience
- Monitor security alerts
- Ensure backup systems are operational

## Support and Maintenance

### 24/7 Monitoring
- Prometheus alerts configured
- PagerDuty integration active
- Grafana dashboards accessible
- Log aggregation operational

### Maintenance Windows
- Weekly maintenance: Sundays 2-4 AM UTC
- Monthly updates: First Sunday of month
- Security patches: As needed
- Database maintenance: Monthly

### Escalation Procedures
1. **Level 1**: Automated alerts and basic troubleshooting
2. **Level 2**: On-call engineer response within 15 minutes
3. **Level 3**: Senior engineer and architect involvement
4. **Level 4**: Vendor support and emergency procedures

This comprehensive deployment guide ensures a successful production deployment of the Enterprise CRM system with enterprise-grade reliability, security, and performance.

