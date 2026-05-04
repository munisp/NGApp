# OpenCTI Configuration for Wazuh Integration

This document provides the specific OpenCTI configuration required to ingest critical alerts (level 12) from Wazuh as incidents, including platform configuration, automation rules, and deployment procedures.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration Components](#configuration-components)
4. [Deployment](#deployment)
5. [Verification](#verification)
6. [Automation Rules](#automation-rules)
7. [Troubleshooting](#troubleshooting)

## Overview

This integration enables OpenCTI to automatically ingest critical security alerts from Wazuh and create structured incidents with full context, including:

*   **Incident Creation**: Automatic creation of incidents from Wazuh alerts
*   **Observable Extraction**: Extraction and creation of observables (IPs, users, accounts)
*   **Indicator Generation**: Creation of threat indicators with STIX patterns
*   **Threat Intelligence Enrichment**: Correlation with existing threat intelligence
*   **Automated Response**: Automation rules for incident handling and enrichment

## Architecture

### Data Flow

```
Wazuh Alert (Level 12)
    ↓
Integration Script
    ↓
OpenCTI API
    ↓
Incident Created
    ├── Observables (IPs, Users, Accounts)
    ├── Indicators (STIX Patterns)
    ├── Labels (wazuh-alert, severity, compliance)
    └── Relationships
    ↓
Automation Rules
    ├── Auto-assign
    ├── Enrich observables
    ├── Create cases
    ├── Send notifications
    └── Correlate incidents
```

### Components

1.  **OpenCTI Platform**: Core threat intelligence platform
2.  **Enhanced Integration Script**: Python script that creates incidents via OpenCTI API
3.  **Incident Types**: Predefined incident types for different alert categories
4.  **Labels**: Categorization labels for alerts
5.  **Automation Rules**: Automated actions triggered by incident creation
6.  **Enrichment Connectors**: External threat intelligence sources

## Configuration Components

### 1. Platform Configuration

The `opencti-platform-config.yaml` file contains the core OpenCTI platform configuration:

*   **API Settings**: Base URL, ports, timeouts
*   **Database Connections**: Elasticsearch, Redis, RabbitMQ, MinIO
*   **Rule Engine**: Enabled for automation
*   **Ingestion Manager**: Enabled for alert processing

### 2. Incident Types

Predefined incident types for Wazuh alerts:

| Incident Type | Description | Color |
|---|---|---|
| Wazuh Security Alert | Generic security alert from Wazuh | #ff5722 |
| Authentication Failure | Multiple authentication failures | #f44336 |
| Unauthorized Execution | Unauthorized workflow/operation execution | #e91e63 |
| Privilege Escalation | Privilege escalation attempt | #9c27b0 |
| API Abuse | API key abuse or invalid attempts | #673ab7 |
| DoS Attack | Denial of Service attack | #3f51b5 |
| Fraud Detection | Fraudulent transaction pattern | #2196f3 |
| Data Exfiltration | Potential data exfiltration | #03a9f4 |

### 3. Labels

Predefined labels for categorization:

*   **Source Labels**: `wazuh-alert`, `go-ledger`, `workflow-orchestrator`, `payment-switch`
*   **Severity Labels**: `critical`, `high`, `medium`, `low`
*   **Compliance Labels**: `pci-dss`, `gdpr`, `hipaa`

### 4. Enhanced Integration Script

The `wazuh_opencti_integration_enhanced.py` script provides:

*   **Automatic Incident Creation**: Creates incidents with full context
*   **Observable Extraction**: Extracts IPs, users, accounts, workflow IDs, API keys
*   **Indicator Generation**: Creates STIX indicators for malicious IPs
*   **Label Management**: Automatically creates and assigns labels
*   **Threat Intelligence Enrichment**: Queries existing indicators
*   **Comprehensive Logging**: Detailed logging for troubleshooting

## Deployment

### Step 1: Deploy OpenCTI Platform Configuration

```bash
# Apply platform configuration
kubectl apply -f config/opencti-platform-config.yaml

# Verify ConfigMaps are created
kubectl get configmap -n security -l app=opencti
```

### Step 2: Initialize OpenCTI with Wazuh Configuration

```bash
# Deploy the initialization job
kubectl apply -f config/opencti-wazuh-deployment.yaml

# Wait for initialization to complete
kubectl wait --for=condition=complete job/opencti-wazuh-init -n security --timeout=300s

# Check initialization logs
kubectl logs -n security job/opencti-wazuh-init
```

Expected output:
```
Connecting to OpenCTI at http://opencti-platform.security.svc.cluster.local:8080
Successfully connected to OpenCTI
Creating incident types...
Created incident type: Wazuh Security Alert
Created incident type: Authentication Failure
Created incident type: Unauthorized Execution
...
Creating labels...
Created label: wazuh-alert
Created label: go-ledger
...
OpenCTI initialization completed successfully
```

### Step 3: Deploy Enhanced Wazuh Manager

```bash
# Deploy Wazuh manager with enhanced integration
kubectl apply -f config/opencti-wazuh-deployment.yaml

# Wait for Wazuh manager to be ready
kubectl wait --for=condition=ready pod -l app=wazuh,component=manager -n security --timeout=600s

# Verify integration script is installed
kubectl exec -n security wazuh-manager-enhanced-0 -- ls -la /var/ossec/integrations/wazuh_opencti_integration.py

# Verify Python dependencies
kubectl exec -n security wazuh-manager-enhanced-0 -- pip3 list | grep pycti
```

### Step 4: Configure Automation Rules (Optional)

Automation rules can be configured via the OpenCTI UI:

```bash
# Port forward to OpenCTI UI
kubectl port-forward -n security svc/opencti-platform 8080:8080

# Open http://localhost:8080 in your browser
# Navigate to: Settings > Customization > Automation
```

Import the automation rules from `automation/opencti-automation-rules.json`.

## Verification

### Step 1: Verify OpenCTI Configuration

```bash
# Check incident types
kubectl port-forward -n security svc/opencti-platform 8080:8080

# Use OpenCTI API to list incident types
curl -X POST http://localhost:8080/graphql \
  -H "Authorization: Bearer ChangeMe" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ incidentTypes { edges { node { id name } } } }"}'
```

### Step 2: Generate Test Alert

```bash
# Generate a test alert from Go Ledger service
kubectl exec -n payment-switch ledger-service-0 -- bash -c 'for i in {1..6}; do echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"error\",\"service\":\"go-ledger\",\"msg\":\"authentication failed\",\"source_ip\":\"192.168.1.100\",\"user_id\":\"attacker@example.com\",\"status_code\":401}" | logger -t go-ledger; sleep 30; done'
```

### Step 3: Verify Incident Creation

```bash
# Check Wazuh integration logs
kubectl exec -n security wazuh-manager-enhanced-0 -- tail -f /var/ossec/logs/opencti_integration.log

# Expected output:
# 2024-01-15 10:30:00 - INFO - OpenCTI API client initialized successfully
# 2024-01-15 10:30:05 - INFO - Parsed Wazuh alert: Rule 100002
# 2024-01-15 10:30:05 - INFO - Processing Wazuh alert 100002 for OpenCTI integration
# 2024-01-15 10:30:06 - INFO - Created OpenCTI incident: incident--xxxxx
# 2024-01-15 10:30:07 - INFO - Created observable: ipv4-addr--xxxxx
# 2024-01-15 10:30:08 - INFO - Created indicator: indicator--xxxxx
# 2024-01-15 10:30:08 - INFO - Successfully processed alert and created OpenCTI incident
```

### Step 4: Verify in OpenCTI UI

1. Open OpenCTI UI: `http://localhost:8080`
2. Login with: `admin@opencti.io` / `ChangeMe`
3. Navigate to: **Analysis > Incidents**
4. Verify incident is created: "Wazuh Alert: Go Ledger: Multiple authentication failures from 192.168.1.100"
5. Click on the incident to view details:
   - **Severity**: High or Critical
   - **Incident Type**: Authentication Failure
   - **Labels**: wazuh-alert, go-ledger, high/critical
   - **Observables**: IPv4-Addr (192.168.1.100), User-Account (attacker@example.com)
   - **Description**: Full alert details including rule ID, timestamp, and alert data

### Step 5: Verify Observables

1. Navigate to: **Observations > Observables**
2. Search for: `192.168.1.100`
3. Verify observable is created and linked to the incident

### Step 6: Verify Indicators

1. Navigate to: **Observations > Indicators**
2. Search for: `192.168.1.100`
3. Verify indicator is created with STIX pattern: `[ipv4-addr:value = '192.168.1.100']`

## Automation Rules

The integration includes 8 predefined automation rules:

### 1. Auto-assign Wazuh Critical Alerts

*   **Trigger**: Incident created with severity=critical and label=wazuh-alert
*   **Actions**: Assign to security team, add "requires-immediate-action" label

### 2. Auto-enrich IP Observables

*   **Trigger**: IPv4-Addr observable created
*   **Actions**: Enrich with VirusTotal, AbuseIPDB, Shodan

### 3. Create Case for Privilege Escalation

*   **Trigger**: Incident created with type=Privilege Escalation
*   **Actions**: Create investigation case, add "high-priority" label

### 4. Notify on Fraud Detection

*   **Trigger**: Incident created with type=Fraud Detection
*   **Actions**: Send notification to Slack and email

### 5. Block Malicious IPs (Disabled by default)

*   **Trigger**: Indicator created with confidence ≥ 80
*   **Actions**: Execute firewall blocking playbook

### 6. Correlate Related Incidents

*   **Trigger**: Incident created with label=wazuh-alert
*   **Actions**: Correlate incidents from same source IP within 1 hour

### 7. Escalate Multiple Authentication Failures

*   **Trigger**: Incident created with type=Authentication Failure and severity=high
*   **Actions**: Update severity to critical, add "potential-breach" label

### 8. Tag PCI DSS Compliance Violations

*   **Trigger**: Incident created with label=pci-dss
*   **Actions**: Add "compliance-violation" label, notify compliance team

## Troubleshooting

### Issue: Incidents Not Created

**Check Integration Script Logs:**

```bash
kubectl exec -n security wazuh-manager-enhanced-0 -- tail -100 /var/ossec/logs/opencti_integration.log
```

**Common Errors:**

1.  **"Failed to initialize OpenCTI API client"**
    - Check OPENCTI_URL and OPENCTI_TOKEN environment variables
    - Verify OpenCTI platform is running and accessible

2.  **"Error creating OpenCTI incident"**
    - Check OpenCTI platform logs for API errors
    - Verify incident type exists in OpenCTI

3.  **"Alert does not require OpenCTI integration"**
    - Verify alert has "opencti_integration" group in Wazuh rule
    - Check alert level is 12 or higher

### Issue: Observables Not Created

**Check Script Logs:**

```bash
kubectl exec -n security wazuh-manager-enhanced-0 -- grep "observable" /var/ossec/logs/opencti_integration.log
```

**Verify Alert Data:**

Ensure alert contains extractable fields:
- `srcip` or `source_ip` for IP addresses
- `user` or `user_id` for user accounts
- `account_id`, `workflow_id`, `api_key` for custom observables

### Issue: Automation Rules Not Triggering

**Check OpenCTI Rule Engine:**

```bash
# Check if rule engine is enabled
kubectl logs -n security -l app=opencti,component=platform | grep "rule_engine"
```

**Verify Rule Configuration:**

1. Open OpenCTI UI
2. Navigate to: Settings > Customization > Automation
3. Verify rules are enabled
4. Check rule filters match incident properties

### Issue: Labels Not Applied

**Check Label Creation:**

```bash
# List labels via API
curl -X POST http://localhost:8080/graphql \
  -H "Authorization: Bearer ChangeMe" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ labels { edges { node { id value color } } } }"}'
```

**Re-run Initialization:**

```bash
kubectl delete job opencti-wazuh-init -n security
kubectl apply -f config/opencti-wazuh-deployment.yaml
```

## Best Practices

1.  **Token Security**: Change default OpenCTI token immediately after deployment
2.  **Automation Rules**: Start with rules disabled and enable gradually
3.  **Observable Enrichment**: Configure enrichment connectors (VirusTotal, AbuseIPDB) before enabling auto-enrichment
4.  **Incident Assignment**: Configure proper user groups and notification channels
5.  **Data Retention**: Configure OpenCTI data retention policies to manage storage
6.  **Backup**: Regularly backup OpenCTI Elasticsearch and MinIO data
7.  **Monitoring**: Monitor OpenCTI platform logs and resource usage
8.  **Compliance**: Map incident types to your organization's compliance requirements

## API Examples

### Create Incident Manually

```python
from pycti import OpenCTIApiClient

client = OpenCTIApiClient('http://localhost:8080', 'ChangeMe')

incident = client.incident.create(
    name="Test Incident",
    description="Test incident from API",
    severity="high",
    incident_type="Wazuh Security Alert",
    first_seen="2024-01-15T10:00:00Z",
    last_seen="2024-01-15T10:00:00Z"
)

print(f"Created incident: {incident['id']}")
```

### Query Incidents

```python
incidents = client.incident.list(
    filters=[
        {'key': 'severity', 'values': ['critical']},
        {'key': 'labels', 'values': ['wazuh-alert'], 'operator': 'contains'}
    ]
)

for incident in incidents:
    print(f"{incident['name']} - {incident['severity']}")
```

### Create Observable

```python
observable = client.stix_cyber_observable.create(
    observableData={
        'type': 'ipv4-addr',
        'value': '192.168.1.100'
    }
)

print(f"Created observable: {observable['id']}")
```

## Conclusion

This OpenCTI configuration provides a comprehensive solution for ingesting and managing Wazuh security alerts as structured incidents. The integration enables automated incident creation, observable extraction, threat intelligence correlation, and automated response actions, significantly enhancing your security operations capabilities.
