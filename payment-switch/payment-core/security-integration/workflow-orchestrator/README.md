# Wazuh Monitoring for Python Workflow Orchestrator

This document provides a comprehensive configuration example for monitoring the Python Workflow Orchestrator (Temporal-based) for unauthorized workflow execution attempts and other security threats.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Security Rules](#security-rules)
4. [Deployment](#deployment)
5. [Sample Log Entries](#sample-log-entries)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Overview

The Python Workflow Orchestrator is a critical component of the Next-Generation Payment Switch, responsible for coordinating complex payment workflows using Temporal. This monitoring solution detects:

*   **Unauthorized workflow execution attempts**
*   **Authentication and authorization failures**
*   **Privilege escalation attempts**
*   **API key abuse**
*   **Rate limiting violations and DoS attacks**
*   **Workflow activity failures**
*   **Temporal infrastructure issues**
*   **Data exfiltration patterns**
*   **Off-hours suspicious activity**

## Architecture

### Log Collection Flow

```
Workflow Orchestrator Pod
    ↓ (JSON logs to stdout)
Fluentd DaemonSet
    ↓ (forward logs via syslog)
Wazuh Manager
    ↓ (decode and analyze)
Custom Rules & Decoders
    ↓ (generate alerts)
OpenCTI Integration
    ↓ (create incidents)
Threat Intelligence Platform
```

### Components

1.  **Fluentd DaemonSet**: Collects logs from workflow orchestrator pods and forwards them to Wazuh via syslog.
2.  **Wazuh Manager**: Receives logs, decodes them using custom decoders, and applies custom rules.
3.  **Custom Decoders**: Parse JSON logs from the workflow orchestrator.
4.  **Custom Rules**: Detect security threats and generate alerts.
5.  **OpenCTI Integration**: Sends critical alerts to OpenCTI for threat intelligence correlation.

## Security Rules

### Rule Categories

| Rule ID Range | Category | Description |
|---|---|---|
| 101000 | Base | Base rule for workflow orchestrator events |
| 101001-101005 | Authentication | Authentication failures, API key abuse, privilege escalation |
| 101010-101013 | Unauthorized Execution | Unauthorized workflow execution attempts |
| 101020-101022 | Rate Limiting | Rate limit violations and DoS attacks |
| 101030-101032 | Activity Failures | Workflow activity failures |
| 101040-101041 | Infrastructure | Temporal connection errors and outages |
| 101050-101052 | Data Access | Data exfiltration and suspicious patterns |
| 101080-101081 | Critical | Critical alerts for OpenCTI integration |

### Key Rules

#### Rule 101002: Multiple Authentication Failures

*   **Alert Level**: 10
*   **Trigger**: 5 authentication failures from the same IP within 300 seconds
*   **MITRE ATT&CK**: T1110 (Brute Force)
*   **OpenCTI Integration**: Yes

#### Rule 101005: Privilege Escalation Attempt

*   **Alert Level**: 12
*   **Trigger**: User attempts to execute workflow with insufficient authorization level
*   **MITRE ATT&CK**: T1068, T1548
*   **OpenCTI Integration**: Yes

#### Rule 101011: Multiple Unauthorized Workflow Execution Attempts

*   **Alert Level**: 12
*   **Trigger**: 3 unauthorized workflow execution attempts from the same IP within 300 seconds
*   **MITRE ATT&CK**: T1204, T1078
*   **OpenCTI Integration**: Yes

#### Rule 101081: Unauthorized Execution of Privileged Workflow

*   **Alert Level**: 12
*   **Trigger**: Unauthorized execution attempt of AdminWorkflow, SystemMaintenance, or BulkTransfer
*   **MITRE ATT&CK**: T1204, T1078.004
*   **OpenCTI Integration**: Yes

## Deployment

### Step 1: Apply ConfigMaps

```bash
kubectl apply -f configs/wazuh-workflow-config.yaml
```

### Step 2: Restart Wazuh Manager

```bash
kubectl rollout restart statefulset wazuh-manager -n security
```

### Step 3: Verify Deployment

```bash
# Check if decoders are loaded
kubectl exec -n security wazuh-manager-0 -- cat /var/ossec/etc/decoders/workflow-orchestrator-decoder.xml

# Check if rules are loaded
kubectl exec -n security wazuh-manager-0 -- cat /var/ossec/etc/rules/workflow-orchestrator-rules.xml

# Check Fluentd DaemonSet
kubectl get daemonset -n security fluentd-workflow-collector

# Check Fluentd logs
kubectl logs -n security -l app=fluentd,component=log-collector --tail=50
```

## Sample Log Entries

### Unauthorized Workflow Execution

```json
{
  "time": "2024-01-15T14:30:00Z",
  "level": "error",
  "service": "workflow-orchestrator",
  "msg": "unauthorized workflow execution",
  "workflow_type": "BulkTransfer",
  "workflow_id": "wf-bulk-transfer-12345",
  "run_id": "run-67890",
  "user_id": "unauthorized-user@example.com",
  "source_ip": "203.0.113.50",
  "authorization_level": 1,
  "required_authorization_level": 5,
  "status": "rejected"
}
```

### Authentication Failure

```json
{
  "time": "2024-01-15T14:35:00Z",
  "level": "error",
  "service": "workflow-orchestrator",
  "msg": "authentication failed",
  "user_id": "attacker@example.com",
  "source_ip": "192.168.1.100",
  "api_key": "invalid-key-12345",
  "status": "rejected"
}
```

### Privilege Escalation Attempt

```json
{
  "time": "2024-01-15T14:40:00Z",
  "level": "error",
  "service": "workflow-orchestrator",
  "msg": "privilege escalation attempt detected",
  "workflow_type": "AdminWorkflow",
  "workflow_id": "wf-admin-12345",
  "user_id": "regular-user@example.com",
  "source_ip": "10.0.1.50",
  "authorization_level": 2,
  "required_authorization_level": 10,
  "status": "blocked"
}
```

### Activity Failure

```json
{
  "time": "2024-01-15T14:45:00Z",
  "level": "error",
  "service": "workflow-orchestrator",
  "msg": "activity failed",
  "workflow_id": "wf-payment-12345",
  "run_id": "run-67890",
  "activity_name": "CreateTransfer",
  "error": "insufficient funds",
  "transaction_id": "txn-12345",
  "account_id": "acc-67890",
  "amount": 10000,
  "status": "failed"
}
```

### Rate Limit Exceeded

```json
{
  "time": "2024-01-15T14:50:00Z",
  "level": "warn",
  "service": "workflow-orchestrator",
  "msg": "rate limit exceeded",
  "user_id": "bot-user@example.com",
  "source_ip": "198.51.100.25",
  "workflow_type": "PaymentWorkflow",
  "status": "throttled"
}
```

### Temporal Connection Error

```json
{
  "time": "2024-01-15T14:55:00Z",
  "level": "error",
  "service": "workflow-orchestrator",
  "msg": "temporal error",
  "error": "connection timeout to temporal server",
  "workflow_id": "wf-payment-12345",
  "status": "failed"
}
```

## Testing

### Test 1: Unauthorized Workflow Execution

```bash
# Generate unauthorized workflow execution logs
kubectl exec -n payment-switch workflow-orchestrator-0 -- bash -c 'for i in {1..4}; do echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"error\",\"service\":\"workflow-orchestrator\",\"msg\":\"unauthorized workflow execution\",\"workflow_type\":\"BulkTransfer\",\"workflow_id\":\"wf-test-$i\",\"user_id\":\"unauthorized@example.com\",\"source_ip\":\"203.0.113.50\",\"authorization_level\":1,\"required_authorization_level\":5,\"status\":\"rejected\"}" | logger -t workflow-orchestrator; sleep 30; done'

# Verify alert
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "101011"

# Verify OpenCTI incident
kubectl port-forward -n security svc/opencti-platform 8080:8080
# Open http://localhost:8080 and check for incident
```

### Test 2: Authentication Failures

```bash
# Generate authentication failure logs
kubectl exec -n payment-switch workflow-orchestrator-0 -- bash -c 'for i in {1..6}; do echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"error\",\"service\":\"workflow-orchestrator\",\"msg\":\"authentication failed\",\"user_id\":\"attacker@example.com\",\"source_ip\":\"192.168.1.100\",\"api_key\":\"invalid-key-$i\",\"status\":\"rejected\"}" | logger -t workflow-orchestrator; sleep 30; done'

# Verify alert
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "101002"
```

### Test 3: Privilege Escalation

```bash
# Generate privilege escalation log
kubectl exec -n payment-switch workflow-orchestrator-0 -- bash -c 'echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"error\",\"service\":\"workflow-orchestrator\",\"msg\":\"privilege escalation attempt detected\",\"workflow_type\":\"AdminWorkflow\",\"workflow_id\":\"wf-admin-test\",\"user_id\":\"regular-user@example.com\",\"source_ip\":\"10.0.1.50\",\"authorization_level\":2,\"required_authorization_level\":10,\"status\":\"blocked\"}" | logger -t workflow-orchestrator'

# Verify alert
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "101005"

# Verify OpenCTI incident
# This should create an incident immediately as it's a level 12 alert
```

## Troubleshooting

### Issue: No Logs Reaching Wazuh

**Check Fluentd:**

```bash
# Check Fluentd pods
kubectl get pods -n security -l app=fluentd

# Check Fluentd logs
kubectl logs -n security -l app=fluentd --tail=100

# Test connectivity to Wazuh syslog
kubectl exec -n security fluentd-workflow-collector-xxxxx -- nc -zv wazuh-syslog.security.svc.cluster.local 514
```

**Check Wazuh Syslog:**

```bash
# Check if Wazuh is listening on port 514
kubectl exec -n security wazuh-manager-0 -- netstat -tuln | grep 514

# Check Wazuh logs
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/ossec.log
```

### Issue: Alerts Not Generated

**Check Decoders:**

```bash
# Test decoder
kubectl exec -n security wazuh-manager-0 -- /var/ossec/bin/wazuh-logtest
# Paste a sample log entry and press Ctrl+D
```

**Check Rules:**

```bash
# Verify rules are loaded
kubectl exec -n security wazuh-manager-0 -- grep "101000" /var/ossec/etc/rules/workflow-orchestrator-rules.xml

# Check rule statistics
kubectl exec -n security wazuh-manager-0 -- /var/ossec/bin/wazuh-logtest -v
```

### Issue: OpenCTI Integration Not Working

**Check Integration Configuration:**

```bash
# Verify integration is configured
kubectl exec -n security wazuh-manager-0 -- grep "custom-opencti" /var/ossec/etc/ossec.conf

# Check integration logs
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/integrations.log
```

## Best Practices

1.  **Log Format Consistency**: Ensure all workflow orchestrator logs follow the same JSON format.
2.  **Authorization Levels**: Implement a clear authorization level system (1-10) for workflows.
3.  **API Key Management**: Rotate API keys regularly and monitor for invalid key attempts.
4.  **Rate Limiting**: Implement rate limiting at the application level to prevent DoS attacks.
5.  **Audit Logging**: Log all workflow executions, including successful ones, for audit purposes.
6.  **Alert Tuning**: Regularly review and tune alert thresholds based on your environment.
7.  **Incident Response**: Establish clear incident response procedures for critical alerts.

## Compliance Mapping

The workflow orchestrator monitoring rules are mapped to the following compliance frameworks:

*   **PCI DSS**: 10.2.4, 10.2.5, 10.6.1, 11.4
*   **GDPR**: IV_35.7.d, IV_32.2
*   **HIPAA**: 164.312.b
*   **NIST 800-53**: AU.14, AC.7, SI.4, AU.6, AC.3, AC.6
*   **TSC**: CC6.1, CC6.8, CC7.2, CC7.3

## Conclusion

This monitoring solution provides comprehensive security coverage for the Python Workflow Orchestrator, detecting a wide range of threats from unauthorized execution attempts to infrastructure attacks. By integrating with OpenCTI, critical alerts are automatically enriched with threat intelligence, enabling faster and more effective incident response.
