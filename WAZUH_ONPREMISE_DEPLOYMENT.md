# Wazuh SIEM On-Premise Deployment Guide

Complete guide for deploying Wazuh SIEM on-premise with Kubernetes and OpenStack for KYC security monitoring and compliance.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [OpenStack Deployment](#openstack-deployment)
6. [KYC Security Rules](#kyc-security-rules)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Compliance Dashboards](#compliance-dashboards)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Wazuh is an open-source SIEM (Security Information and Event Management) platform that provides:

- **Real-time security monitoring** for KYC services
- **Compliance management** (GDPR, PCI DSS, HIPAA)
- **Threat detection** and incident response
- **File integrity monitoring** (FIM)
- **Vulnerability detection**
- **Log analysis** and correlation
- **Active response** to security threats

### Components

| Component | Description | Resources |
|-----------|-------------|-----------|
| **Wazuh Manager** | Central management server | 2 CPU, 4GB RAM, 100GB disk |
| **Wazuh Indexer** | OpenSearch cluster for log storage | 4 CPU, 8GB RAM, 200GB disk (per node) |
| **Wazuh Dashboard** | Web UI for visualization | 1 CPU, 2GB RAM, 50GB disk |
| **Wazuh Agent** | Installed on all nodes | 100m CPU, 256MB RAM |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Wazuh Dashboard                      │
│              (Web UI - Port 5601/HTTPS)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│              Wazuh Indexer Cluster                      │
│         (OpenSearch - 3 nodes - Port 9200)              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Indexer-0│    │ Indexer-1│    │ Indexer-2│          │
│  └──────────┘    └──────────┘    └──────────┘          │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                  Wazuh Manager                          │
│         (Security Analytics - Port 1514/1515)           │
│  - Rule Engine                                          │
│  - Decoders                                             │
│  - Active Response                                      │
│  - API (Port 55000)                                     │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────┴─────┐  ┌─────┴──────┐  ┌────┴──────┐
│ Wazuh Agent │  │ Wazuh Agent│  │Wazuh Agent│
│  (KYC Pod)  │  │  (OCR Pod) │  │ (ML Pod)  │
└─────────────┘  └────────────┘  └───────────┘
```

### Data Flow

1. **Log Collection:** Wazuh agents collect logs from KYC, OCR, and ML services
2. **Log Forwarding:** Agents send logs to Wazuh Manager (TCP/1514)
3. **Analysis:** Manager analyzes logs using custom KYC rules
4. **Indexing:** Processed logs stored in Wazuh Indexer (OpenSearch)
5. **Visualization:** Dashboard displays security events and alerts
6. **Alerting:** Critical events trigger notifications (email, Slack, PagerDuty)

---

## Prerequisites

### Hardware Requirements

**Minimum (Small Deployment - < 1,000 events/sec):**
- 3x Indexer nodes: 4 CPU, 8GB RAM, 200GB SSD each
- 1x Manager node: 2 CPU, 4GB RAM, 100GB SSD
- 2x Dashboard nodes: 1 CPU, 2GB RAM, 50GB SSD each

**Recommended (Medium Deployment - 1,000-10,000 events/sec):**
- 3x Indexer nodes: 8 CPU, 16GB RAM, 500GB SSD each
- 1x Manager node: 4 CPU, 8GB RAM, 200GB SSD
- 2x Dashboard nodes: 2 CPU, 4GB RAM, 100GB SSD each

**Large Deployment (> 10,000 events/sec):**
- 5x Indexer nodes: 16 CPU, 32GB RAM, 1TB SSD each
- 2x Manager nodes: 8 CPU, 16GB RAM, 500GB SSD each
- 3x Dashboard nodes: 4 CPU, 8GB RAM, 200GB SSD each

### Software Requirements

**Kubernetes:**
- Kubernetes 1.27+
- kubectl CLI
- Helm 3.0+ (optional)
- Storage class with dynamic provisioning

**OpenStack:**
- OpenStack Yoga or newer
- OpenStack CLI tools
- Compute nodes with sufficient resources
- Neutron networking

**Both:**
- Ubuntu 22.04 LTS (recommended)
- OpenSSL for certificate generation
- curl, jq for testing

---

## Kubernetes Deployment

### Step 1: Prepare Cluster

```bash
# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Check available storage classes
kubectl get storageclass

# Label nodes for Wazuh components (optional)
kubectl label nodes node-1 wazuh-indexer=true
kubectl label nodes node-2 wazuh-indexer=true
kubectl label nodes node-3 wazuh-indexer=true
```

### Step 2: Generate SSL Certificates

```bash
cd /home/ubuntu/python-services/wazuh/scripts

# Generate all SSL certificates
./deploy-wazuh.sh certs

# Verify certificates
ls -lh ../certs/
```

**Generated Certificates:**
- `root-ca.pem` - Root Certificate Authority
- `node.pem` / `node-key.pem` - Indexer node certificates
- `admin.pem` / `admin-key.pem` - Admin certificates
- `filebeat.pem` / `filebeat-key.pem` - Filebeat certificates
- `dashboard.pem` / `dashboard-key.pem` - Dashboard certificates

### Step 3: Deploy Wazuh

```bash
# Deploy with default settings
DEPLOYMENT_TYPE=kubernetes ./deploy-wazuh.sh

# Or customize deployment
DEPLOYMENT_TYPE=kubernetes \
NAMESPACE=wazuh \
INDEXER_REPLICAS=3 \
MANAGER_REPLICAS=1 \
DASHBOARD_REPLICAS=2 \
./deploy-wazuh.sh
```

**Deployment Steps:**
1. Creates namespace
2. Generates and stores SSL certificates as secrets
3. Creates random passwords for all services
4. Deploys Wazuh Indexer (StatefulSet with 3 replicas)
5. Waits for Indexer to be ready
6. Deploys Wazuh Manager (StatefulSet with 1 replica)
7. Waits for Manager to be ready
8. Deploys Wazuh Dashboard (Deployment with 2 replicas)
9. Deploys Wazuh Agents (DaemonSet on all nodes)
10. Installs KYC custom security rules

### Step 4: Verify Deployment

```bash
# Check all pods
kubectl get pods -n wazuh

# Expected output:
# NAME                                READY   STATUS    RESTARTS   AGE
# wazuh-indexer-0                     1/1     Running   0          5m
# wazuh-indexer-1                     1/1     Running   0          4m
# wazuh-indexer-2                     1/1     Running   0          3m
# wazuh-manager-0                     1/1     Running   0          3m
# wazuh-dashboard-xxxx-yyyy           1/1     Running   0          2m
# wazuh-dashboard-xxxx-zzzz           1/1     Running   0          2m
# wazuh-agent-xxxx (one per node)     1/1     Running   0          1m

# Check services
kubectl get svc -n wazuh

# Check ingress
kubectl get ingress -n wazuh

# View logs
kubectl logs -n wazuh wazuh-manager-0 --tail=50
```

### Step 5: Access Dashboard

```bash
# Get Dashboard URL
DASHBOARD_URL=$(kubectl get ingress wazuh-dashboard-ingress -n wazuh -o jsonpath='{.spec.rules[0].host}')
echo "Dashboard URL: https://${DASHBOARD_URL}"

# Or use port forwarding
kubectl port-forward -n wazuh svc/wazuh-dashboard 5601:443

# Access at https://localhost:5601
```

**Default Credentials:**
- Username: `admin`
- Password: Check `/home/ubuntu/python-services/wazuh/wazuh-passwords.txt`

### Step 6: Configure KYC Service Logging

Update KYC service to send logs to Wazuh:

```python
# In /home/ubuntu/python-services/kyc/kyc_service.py
import logging
import json
from datetime import datetime

# Configure JSON logging for Wazuh
logging.basicConfig(
    filename='/var/log/kyc/kyc-service.json',
    format='%(message)s',
    level=logging.INFO
)

def log_kyc_event(action, user_email, submission_id=None, **kwargs):
    """Log KYC event in Wazuh-compatible JSON format"""
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "service": "kyc",
        "action": action,
        "user_email": user_email,
        "submission_id": submission_id,
        **kwargs
    }
    logging.info(json.dumps(event))

# Usage examples:
log_kyc_event("document_access", "admin@company.com", submission_id="12345", user_role="admin")
log_kyc_event("submission_approved", "reviewer@company.com", submission_id="12345", reviewer_email="reviewer@company.com")
log_kyc_event("pii_decrypted", "admin@company.com", submission_id="12345")
```

---

## OpenStack Deployment

### Step 1: Install OpenStack CLI

```bash
# Install OpenStack CLI
sudo apt-get update
sudo apt-get install -y python3-openstackclient

# Source OpenStack credentials
source openrc.sh

# Verify access
openstack server list
openstack network list
```

### Step 2: Create Flavors

```bash
# Indexer flavor (8 CPU, 16GB RAM, 500GB disk)
openstack flavor create \
  --ram 16384 \
  --disk 500 \
  --vcpus 8 \
  wazuh-indexer

# Manager flavor (4 CPU, 8GB RAM, 200GB disk)
openstack flavor create \
  --ram 8192 \
  --disk 200 \
  --vcpus 4 \
  wazuh-manager

# Dashboard flavor (2 CPU, 4GB RAM, 100GB disk)
openstack flavor create \
  --ram 4096 \
  --disk 100 \
  --vcpus 2 \
  wazuh-dashboard
```

### Step 3: Create Cloud-Init Scripts

**Indexer Cloud-Init** (`/home/ubuntu/python-services/wazuh/cloud-init/indexer-init.yaml`):
```yaml
#cloud-config
packages:
  - curl
  - apt-transport-https
  - gnupg

runcmd:
  - curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --no-default-keyring --keyring gnupg-ring:/usr/share/keyrings/wazuh.gpg --import
  - chmod 644 /usr/share/keyrings/wazuh.gpg
  - echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" | tee /etc/apt/sources.list.d/wazuh.list
  - apt-get update
  - apt-get install -y wazuh-indexer
  - systemctl daemon-reload
  - systemctl enable wazuh-indexer
  - systemctl start wazuh-indexer
```

**Manager Cloud-Init** (`/home/ubuntu/python-services/wazuh/cloud-init/manager-init.yaml`):
```yaml
#cloud-config
packages:
  - curl
  - apt-transport-https
  - gnupg

runcmd:
  - curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --no-default-keyring --keyring gnupg-ring:/usr/share/keyrings/wazuh.gpg --import
  - chmod 644 /usr/share/keyrings/wazuh.gpg
  - echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" | tee /etc/apt/sources.list.d/wazuh.list
  - apt-get update
  - apt-get install -y wazuh-manager
  - systemctl daemon-reload
  - systemctl enable wazuh-manager
  - systemctl start wazuh-manager
```

**Dashboard Cloud-Init** (`/home/ubuntu/python-services/wazuh/cloud-init/dashboard-init.yaml`):
```yaml
#cloud-config
packages:
  - curl
  - apt-transport-https
  - gnupg

runcmd:
  - curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --no-default-keyring --keyring gnupg-ring:/usr/share/keyrings/wazuh.gpg --import
  - chmod 644 /usr/share/keyrings/wazuh.gpg
  - echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" | tee /etc/apt/sources.list.d/wazuh.list
  - apt-get update
  - apt-get install -y wazuh-dashboard
  - systemctl daemon-reload
  - systemctl enable wazuh-dashboard
  - systemctl start wazuh-dashboard
```

### Step 4: Deploy Wazuh

```bash
# Deploy with automated script
cd /home/ubuntu/python-services/wazuh/scripts
DEPLOYMENT_TYPE=openstack ./deploy-wazuh.sh

# Or manually create instances
openstack server create \
  --flavor wazuh-indexer \
  --image ubuntu-22.04 \
  --key-name default \
  --security-group wazuh-security \
  --network private \
  --user-data ../cloud-init/indexer-init.yaml \
  wazuh-indexer-0

# Repeat for other components
```

### Step 5: Configure Cluster

After instances are created, SSH into each and configure:

**Indexer Configuration:**
```bash
# SSH into indexer-0
ssh ubuntu@<indexer-0-ip>

# Edit configuration
sudo nano /etc/wazuh-indexer/opensearch.yml

# Add cluster settings
cluster.name: wazuh-cluster
node.name: wazuh-indexer-0
network.host: 0.0.0.0
discovery.seed_hosts:
  - <indexer-0-ip>
  - <indexer-1-ip>
  - <indexer-2-ip>
cluster.initial_master_nodes:
  - wazuh-indexer-0
  - wazuh-indexer-1
  - wazuh-indexer-2

# Restart service
sudo systemctl restart wazuh-indexer
```

**Manager Configuration:**
```bash
# SSH into manager
ssh ubuntu@<manager-ip>

# Edit configuration
sudo nano /var/ossec/etc/ossec.conf

# Add indexer hosts
<indexer>
  <enabled>yes</enabled>
  <hosts>
    <host>https://<indexer-0-ip>:9200</host>
    <host>https://<indexer-1-ip>:9200</host>
    <host>https://<indexer-2-ip>:9200</host>
  </hosts>
</indexer>

# Restart service
sudo systemctl restart wazuh-manager
```

---

## KYC Security Rules

### Custom Rules Overview

The KYC security rules (`/home/ubuntu/python-services/wazuh/rules/kyc-rules.xml`) provide comprehensive monitoring:

| Rule ID | Level | Description | Category |
|---------|-------|-------------|----------|
| 100001 | 3 | KYC document accessed | PII Access |
| 100002 | 5 | Admin document access | Admin Activity |
| 100003 | 8 | Multiple accesses in 5 min | Suspicious |
| 100004 | 6 | Document download | Data Exfiltration |
| 100005 | 3 | Submission created | Normal Activity |
| 100006 | 5 | Submission approved | Approval |
| 100007 | 5 | Submission rejected | Rejection |
| 100008 | 8 | Multiple rejections | Suspicious |
| 100009 | 3 | OCR extraction | Normal Activity |
| 100010 | 6 | Low confidence OCR | Quality Issue |
| 100011 | 3 | Facial recognition | Normal Activity |
| 100012 | 8 | Face mismatch | Fraud |
| 100013 | 3 | Liveness check | Normal Activity |
| 100014 | 9 | Liveness failed | Spoofing |
| 100015 | 10 | Anti-spoofing triggered | Critical Fraud |
| 100016 | 10 | Multiple liveness failures | Persistent Attack |
| 100017 | 3 | PII encrypted | Security |
| 100018 | 5 | PII decrypted | PII Access |
| 100019 | 12 | Unauthorized PII access | Critical |
| 100020 | 3 | Audit log entry | Audit |
| 100021 | 9 | Suspicious pattern | Fraud |
| 100022 | 7 | Duplicate submission | Suspicious |
| 100023 | 4 | Service error | Error |
| 100024 | 10 | Critical failure | Critical |
| 100025 | 4 | Database query | Database |
| 100026 | 9 | Bulk export | Data Exfiltration |
| 100027 | 6 | Rate limit exceeded | Suspicious |
| 100028 | 7 | After-hours access | Suspicious |
| 100029 | 8 | Unusual location | Suspicious |
| 100030 | 12 | Compliance violation | Critical |

### Alert Levels

- **Level 0-3:** Informational (logged, not alerted)
- **Level 4-7:** Low to Medium (email notification)
- **Level 8-11:** High (email + Slack/PagerDuty)
- **Level 12-15:** Critical (immediate escalation)

---

## Monitoring and Alerts

### Prometheus Metrics

Wazuh exposes metrics for monitoring:

```bash
# Install Prometheus exporter
kubectl apply -f https://raw.githubusercontent.com/wazuh/wazuh-kubernetes/master/wazuh/wazuh-prometheus-exporter.yaml

# Add Prometheus scrape config
scrape_configs:
  - job_name: 'wazuh'
    static_configs:
      - targets: ['wazuh-manager.wazuh.svc.cluster.local:55000']
```

**Key Metrics:**
- `wazuh_events_total` - Total events processed
- `wazuh_alerts_total` - Total alerts generated
- `wazuh_agents_connected` - Connected agents
- `wazuh_indexer_cluster_health` - Indexer health status

### Grafana Dashboard

Import the Wazuh Grafana dashboard:

```bash
# Import dashboard JSON
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @/home/ubuntu/python-services/wazuh/grafana/wazuh-dashboard.json
```

### Email Alerts

Configure email notifications in Wazuh Manager:

```xml
<!-- /var/ossec/etc/ossec.conf -->
<global>
  <email_notification>yes</email_notification>
  <smtp_server>smtp.gmail.com</smtp_server>
  <email_from>wazuh@yourcompany.com</email_from>
  <email_to>security@yourcompany.com</email_to>
</global>

<alerts>
  <email_alert_level>8</email_alert_level>
</alerts>
```

### Slack Integration

Configure Slack webhook for critical alerts:

```bash
# Install Slack integration
sudo /var/ossec/integrations/slack.py

# Configure webhook
sudo nano /var/ossec/etc/ossec.conf

<integration>
  <name>slack</name>
  <hook_url>https://hooks.slack.com/services/YOUR/WEBHOOK/URL</hook_url>
  <level>10</level>
  <alert_format>json</alert_format>
</integration>
```

---

## Compliance Dashboards

### GDPR Compliance

**Key Requirements:**
- PII access logging (Article 30)
- Data breach notification (Article 33)
- Right to erasure tracking (Article 17)

**Wazuh Dashboard:**
1. Navigate to **Security Events** → **Compliance**
2. Select **GDPR** filter
3. View PII access logs (Rule 100001, 100002, 100018)
4. Monitor unauthorized access (Rule 100019)
5. Track data exports (Rule 100004, 100026)

### PCI DSS Compliance

**Key Requirements:**
- Access control monitoring (Requirement 7)
- Audit trail maintenance (Requirement 10)
- Security monitoring (Requirement 11)

**Wazuh Dashboard:**
1. Navigate to **Security Events** → **Compliance**
2. Select **PCI DSS** filter
3. View authentication events
4. Monitor file integrity changes
5. Track privileged user actions

### Custom Compliance Reports

Create custom reports for KYC compliance:

```bash
# Generate monthly KYC compliance report
curl -X POST "https://wazuh-manager:55000/security/reports" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "KYC Monthly Compliance Report",
    "description": "Monthly report of KYC security events",
    "filters": {
      "rule.groups": "kyc",
      "timestamp": {
        "gte": "now-30d",
        "lte": "now"
      }
    },
    "format": "pdf"
  }'
```

---

## Troubleshooting

### Common Issues

#### 1. Indexer Cluster Not Forming

**Symptoms:**
```
Cluster health: RED
Master node not elected
```

**Solution:**
```bash
# Check cluster status
curl -k -u admin:password https://wazuh-indexer-0:9200/_cluster/health?pretty

# Verify discovery settings
kubectl exec -it wazuh-indexer-0 -n wazuh -- cat /usr/share/opensearch/config/opensearch.yml | grep discovery

# Restart indexer pods
kubectl rollout restart statefulset wazuh-indexer -n wazuh
```

#### 2. Manager Not Receiving Logs

**Symptoms:**
```
No events in dashboard
Agents show as disconnected
```

**Solution:**
```bash
# Check agent status
kubectl exec -it wazuh-manager-0 -n wazuh -- /var/ossec/bin/agent_control -l

# Check firewall rules
kubectl exec -it wazuh-agent-xxxx -n wazuh -- netstat -an | grep 1514

# Verify agent configuration
kubectl exec -it wazuh-agent-xxxx -n wazuh -- cat /var/ossec/etc/ossec.conf
```

#### 3. Dashboard Not Loading

**Symptoms:**
```
502 Bad Gateway
Dashboard pod crashing
```

**Solution:**
```bash
# Check dashboard logs
kubectl logs -n wazuh wazuh-dashboard-xxxx --tail=100

# Verify indexer connection
kubectl exec -it wazuh-dashboard-xxxx -n wazuh -- curl -k https://wazuh-indexer-0:9200

# Restart dashboard
kubectl rollout restart deployment wazuh-dashboard -n wazuh
```

#### 4. High Memory Usage

**Symptoms:**
```
OOMKilled pods
Slow query performance
```

**Solution:**
```bash
# Increase indexer memory
kubectl edit statefulset wazuh-indexer -n wazuh
# Update resources.limits.memory to 16Gi

# Adjust JVM heap size
kubectl set env statefulset/wazuh-indexer -n wazuh OPENSEARCH_JAVA_OPTS="-Xms8g -Xmx8g"

# Enable index lifecycle management
curl -X PUT "https://wazuh-indexer-0:9200/_ilm/policy/wazuh-policy" \
  -H 'Content-Type: application/json' \
  -d '{
    "policy": {
      "phases": {
        "hot": {
          "actions": {
            "rollover": {
              "max_age": "7d",
              "max_size": "50gb"
            }
          }
        },
        "delete": {
          "min_age": "90d",
          "actions": {
            "delete": {}
          }
        }
      }
    }
  }'
```

### Debugging Commands

**Kubernetes:**
```bash
# View all Wazuh resources
kubectl get all -n wazuh

# Check pod logs
kubectl logs -n wazuh wazuh-manager-0 --tail=100 -f

# Execute into pod
kubectl exec -it -n wazuh wazuh-manager-0 -- bash

# Check events
kubectl get events -n wazuh --sort-by='.lastTimestamp'

# Describe pod
kubectl describe pod -n wazuh wazuh-indexer-0
```

**OpenStack:**
```bash
# Check instance status
openstack server show wazuh-manager

# View console log
openstack console log show wazuh-manager

# SSH into instance
ssh ubuntu@<instance-ip>

# Check service status
sudo systemctl status wazuh-manager
sudo systemctl status wazuh-indexer
sudo systemctl status wazuh-dashboard

# View logs
sudo tail -f /var/ossec/logs/ossec.log
sudo tail -f /var/log/wazuh-indexer/wazuh-cluster.log
```

---

## Cost Estimation

### On-Premise Costs

**Hardware (One-Time):**
- 3x Indexer servers (8 CPU, 16GB RAM, 500GB SSD): $3,000 - $5,000 each = $9,000 - $15,000
- 1x Manager server (4 CPU, 8GB RAM, 200GB SSD): $1,500 - $2,500
- 2x Dashboard servers (2 CPU, 4GB RAM, 100GB SSD): $800 - $1,200 each = $1,600 - $2,400
- **Total Hardware:** $12,100 - $19,900

**Recurring Costs (Monthly):**
- Power consumption: $150 - $300
- Network bandwidth: $50 - $100
- Maintenance: $200 - $500
- **Total Monthly:** $400 - $900

**3-Year TCO:** $26,500 - $52,300

### Cloud Costs (AWS/GCP/Azure)

**Monthly Costs:**
- 3x Indexer instances (m5.2xlarge): $300 each = $900
- 1x Manager instance (m5.xlarge): $150
- 2x Dashboard instances (m5.large): $75 each = $150
- Storage (1.5TB): $150
- Data transfer: $100
- **Total Monthly:** $1,450

**3-Year TCO:** $52,200

### Recommendation

**On-premise is more cost-effective for:**
- Long-term deployments (> 2 years)
- High data volumes (> 10,000 events/sec)
- Strict data residency requirements

**Cloud is better for:**
- Short-term deployments (< 1 year)
- Variable workloads
- Rapid scaling requirements

---

## Next Steps

1. **Deploy Wazuh:**
   ```bash
   cd /home/ubuntu/python-services/wazuh/scripts
   DEPLOYMENT_TYPE=kubernetes ./deploy-wazuh.sh
   ```

2. **Access Dashboard:**
   - URL: https://wazuh.yourcompany.com (or use port forwarding)
   - Username: admin
   - Password: Check `../wazuh-passwords.txt`

3. **Configure KYC Logging:**
   - Update KYC service to log in JSON format
   - Send logs to `/var/log/kyc/kyc-service.json`
   - Wazuh agents will automatically collect and forward logs

4. **Review Security Events:**
   - Navigate to **Security Events** in dashboard
   - Filter by `rule.groups: kyc`
   - Review PII access, fraud attempts, and compliance events

5. **Set Up Alerts:**
   - Configure email notifications for level 8+ alerts
   - Integrate Slack for critical alerts (level 10+)
   - Set up PagerDuty for incident response

---

## Support

For issues and questions:
- Wazuh Documentation: https://documentation.wazuh.com/
- Wazuh Community: https://groups.google.com/g/wazuh
- GitHub Issues: https://github.com/wazuh/wazuh/issues
- Internal Support: security@yourcompany.com

---

**Last Updated:** January 23, 2026
**Version:** 1.0.0
