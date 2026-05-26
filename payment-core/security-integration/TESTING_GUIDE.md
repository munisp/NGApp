# Wazuh-OpenCTI Integration Testing and Verification Guide

This guide provides step-by-step instructions and sample log entries to verify that the Wazuh-OpenCTI integration is successfully detecting and reporting suspicious transactions in the Go Ledger service.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Scenarios](#test-scenarios)
3. [Step-by-Step Testing](#step-by-step-testing)
4. [Verification Procedures](#verification-procedures)
5. [Expected Results](#expected-results)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before testing, ensure the following are deployed and running:

1. Wazuh manager with custom rules and decoders
2. Wazuh agent on the Go Ledger service pod
3. OpenCTI platform
4. Wazuh-OpenCTI integration script

### Verify Prerequisites

```bash
# Check Wazuh manager status
kubectl get pods -n security -l app=wazuh,component=manager

# Check OpenCTI platform status
kubectl get pods -n security -l app=opencti,component=platform

# Check if custom rules are loaded
kubectl exec -n security wazuh-manager-0 -- cat /var/ossec/etc/rules/go-ledger-rules.xml

# Check if custom decoders are loaded
kubectl exec -n security wazuh-manager-0 -- cat /var/ossec/etc/decoders/go-ledger-decoder.xml

# Check if integration script exists
kubectl exec -n security wazuh-manager-0 -- ls -la /var/ossec/integrations/wazuh_opencti_integration.py
```

## Test Scenarios

We will test the following scenarios:

1. **Authentication Failure Attack** (Rule 100002)
2. **Large Transaction Detection** (Rule 100010)
3. **Multiple Large Transactions** (Rule 100011)
4. **Rapid Fire Transactions** (Rule 100012)
5. **Unauthorized Access Attempts** (Rule 100031)

## Step-by-Step Testing

### Test Scenario 1: Authentication Failure Attack

This test simulates a brute-force authentication attack that should trigger rule 100002 and create an OpenCTI incident.

#### Step 1: Prepare the Test Environment

```bash
# Get the Go Ledger service pod name
export LEDGER_POD=$(kubectl get pods -n payment-switch -l app=ledger-service -o jsonpath='{.items[0].metadata.name}')

# Verify the pod is running
kubectl get pod $LEDGER_POD -n payment-switch
```

#### Step 2: Generate Authentication Failure Logs

Create a script to generate multiple authentication failures:

```bash
# Create a test script on the Go Ledger pod
kubectl exec -n payment-switch $LEDGER_POD -- bash -c 'cat > /tmp/test_auth_failures.sh << "EOF"
#!/bin/bash
for i in {1..6}; do
  echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"error\",\"service\":\"go-ledger\",\"msg\":\"authentication failed\",\"source_ip\":\"192.168.1.100\",\"user_id\":\"attacker@example.com\",\"transaction_id\":\"txn-auth-fail-$i\",\"status_code\":401}" | logger -t go-ledger
  sleep 2
done
EOF
chmod +x /tmp/test_auth_failures.sh'

# Execute the test script
kubectl exec -n payment-switch $LEDGER_POD -- /tmp/test_auth_failures.sh
```

**Sample Log Entries:**

```json
{"time":"2024-01-15T10:30:01+00:00","level":"error","service":"go-ledger","msg":"authentication failed","source_ip":"192.168.1.100","user_id":"attacker@example.com","transaction_id":"txn-auth-fail-1","status_code":401}
{"time":"2024-01-15T10:30:03+00:00","level":"error","service":"go-ledger","msg":"authentication failed","source_ip":"192.168.1.100","user_id":"attacker@example.com","transaction_id":"txn-auth-fail-2","status_code":401}
{"time":"2024-01-15T10:30:05+00:00","level":"error","service":"go-ledger","msg":"authentication failed","source_ip":"192.168.1.100","user_id":"attacker@example.com","transaction_id":"txn-auth-fail-3","status_code":401}
{"time":"2024-01-15T10:30:07+00:00","level":"error","service":"go-ledger","msg":"authentication failed","source_ip":"192.168.1.100","user_id":"attacker@example.com","transaction_id":"txn-auth-fail-4","status_code":401}
{"time":"2024-01-15T10:30:09+00:00","level":"error","service":"go-ledger","msg":"authentication failed","source_ip":"192.168.1.100","user_id":"attacker@example.com","transaction_id":"txn-auth-fail-5","status_code":401}
{"time":"2024-01-15T10:30:11+00:00","level":"error","service":"go-ledger","msg":"authentication failed","source_ip":"192.168.1.100","user_id":"attacker@example.com","transaction_id":"txn-auth-fail-6","status_code":401}
```

#### Step 3: Verify Wazuh Alert

```bash
# Check Wazuh alerts
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "100002"

# Or use the Wazuh API
kubectl exec -n security wazuh-manager-0 -- curl -u wazuh:wazuh -k -X GET "https://localhost:55000/security/user/authenticate"
```

#### Step 4: Verify OpenCTI Incident

```bash
# Check integration logs
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/integrations.log

# Access OpenCTI UI and check for new incident
kubectl port-forward -n security svc/opencti-platform 8080:8080
# Open http://localhost:8080 in your browser
# Navigate to: Analysis > Incidents
# Look for: "Wazuh Alert: Go Ledger: Multiple authentication failures from 192.168.1.100"
```

---

### Test Scenario 2: Large Transaction Detection

This test simulates a large transaction that should trigger rule 100010.

#### Step 1: Generate Large Transaction Log

```bash
# Generate a large transaction log entry
kubectl exec -n payment-switch $LEDGER_POD -- bash -c 'echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"info\",\"service\":\"go-ledger\",\"msg\":\"transfer completed\",\"operation\":\"transfer\",\"from_account\":\"acc-12345\",\"to_account\":\"acc-67890\",\"amount\":50000000,\"currency\":\"USD\",\"transaction_id\":\"txn-large-001\",\"user_id\":\"user@example.com\",\"source_ip\":\"10.0.1.50\",\"status_code\":200}" | logger -t go-ledger'
```

**Sample Log Entry:**

```json
{"time":"2024-01-15T10:35:00+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-12345","to_account":"acc-67890","amount":50000000,"currency":"USD","transaction_id":"txn-large-001","user_id":"user@example.com","source_ip":"10.0.1.50","status_code":200}
```

#### Step 2: Verify Alert

```bash
# Check for rule 100010 alert
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "100010"
```

---

### Test Scenario 3: Multiple Large Transactions (Critical Alert)

This test simulates multiple large transactions from the same account, which should trigger rule 100011 and create an OpenCTI incident.

#### Step 1: Generate Multiple Large Transactions

```bash
# Create a test script for multiple large transactions
kubectl exec -n payment-switch $LEDGER_POD -- bash -c 'cat > /tmp/test_large_transactions.sh << "EOF"
#!/bin/bash
for i in {1..6}; do
  echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"info\",\"service\":\"go-ledger\",\"msg\":\"transfer completed\",\"operation\":\"transfer\",\"from_account\":\"acc-suspicious-123\",\"to_account\":\"acc-dest-$i\",\"amount\":$((10000000 + i * 1000000)),\"currency\":\"USD\",\"transaction_id\":\"txn-large-multi-$i\",\"user_id\":\"suspicious-user@example.com\",\"source_ip\":\"203.0.113.50\",\"status_code\":200}" | logger -t go-ledger
  sleep 5
done
EOF
chmod +x /tmp/test_large_transactions.sh'

# Execute the test script
kubectl exec -n payment-switch $LEDGER_POD -- /tmp/test_large_transactions.sh
```

**Sample Log Entries:**

```json
{"time":"2024-01-15T10:40:00+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-suspicious-123","to_account":"acc-dest-1","amount":11000000,"currency":"USD","transaction_id":"txn-large-multi-1","user_id":"suspicious-user@example.com","source_ip":"203.0.113.50","status_code":200}
{"time":"2024-01-15T10:40:05+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-suspicious-123","to_account":"acc-dest-2","amount":12000000,"currency":"USD","transaction_id":"txn-large-multi-2","user_id":"suspicious-user@example.com","source_ip":"203.0.113.50","status_code":200}
{"time":"2024-01-15T10:40:10+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-suspicious-123","to_account":"acc-dest-3","amount":13000000,"currency":"USD","transaction_id":"txn-large-multi-3","user_id":"suspicious-user@example.com","source_ip":"203.0.113.50","status_code":200}
{"time":"2024-01-15T10:40:15+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-suspicious-123","to_account":"acc-dest-4","amount":14000000,"currency":"USD","transaction_id":"txn-large-multi-4","user_id":"suspicious-user@example.com","source_ip":"203.0.113.50","status_code":200}
{"time":"2024-01-15T10:40:20+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-suspicious-123","to_account":"acc-dest-5","amount":15000000,"currency":"USD","transaction_id":"txn-large-multi-5","user_id":"suspicious-user@example.com","source_ip":"203.0.113.50","status_code":200}
{"time":"2024-01-15T10:40:25+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-suspicious-123","to_account":"acc-dest-6","amount":16000000,"currency":"USD","transaction_id":"txn-large-multi-6","user_id":"suspicious-user@example.com","source_ip":"203.0.113.50","status_code":200}
```

#### Step 2: Verify Critical Alert and OpenCTI Incident

```bash
# Check for rule 100011 alert
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "100011"

# Check for rule 100080 (critical alert trigger)
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "100080"

# Check integration execution
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/integrations.log

# Verify OpenCTI incident creation
# Access OpenCTI UI and look for: "Wazuh Alert: Go Ledger: Multiple large transactions from account acc-suspicious-123"
```

---

### Test Scenario 4: Rapid Fire Transactions

This test simulates rapid-fire transactions that may indicate automated fraud.

#### Step 1: Generate Rapid Transactions

```bash
# Create a test script for rapid transactions
kubectl exec -n payment-switch $LEDGER_POD -- bash -c 'cat > /tmp/test_rapid_transactions.sh << "EOF"
#!/bin/bash
for i in {1..25}; do
  echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"info\",\"service\":\"go-ledger\",\"msg\":\"transfer completed\",\"operation\":\"transfer\",\"from_account\":\"acc-rapid-fire\",\"to_account\":\"acc-target-$((i % 5))\",\"amount\":$((1000 + i * 100)),\"currency\":\"USD\",\"transaction_id\":\"txn-rapid-$i\",\"user_id\":\"bot-user@example.com\",\"source_ip\":\"198.51.100.25\",\"status_code\":200}" | logger -t go-ledger
  sleep 0.5
done
EOF
chmod +x /tmp/test_rapid_transactions.sh'

# Execute the test script
kubectl exec -n payment-switch $LEDGER_POD -- /tmp/test_rapid_transactions.sh
```

**Sample Log Entries (first 5):**

```json
{"time":"2024-01-15T10:45:00+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-rapid-fire","to_account":"acc-target-1","amount":1100,"currency":"USD","transaction_id":"txn-rapid-1","user_id":"bot-user@example.com","source_ip":"198.51.100.25","status_code":200}
{"time":"2024-01-15T10:45:01+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-rapid-fire","to_account":"acc-target-2","amount":1200,"currency":"USD","transaction_id":"txn-rapid-2","user_id":"bot-user@example.com","source_ip":"198.51.100.25","status_code":200}
{"time":"2024-01-15T10:45:02+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-rapid-fire","to_account":"acc-target-3","amount":1300,"currency":"USD","transaction_id":"txn-rapid-3","user_id":"bot-user@example.com","source_ip":"198.51.100.25","status_code":200}
{"time":"2024-01-15T10:45:03+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-rapid-fire","to_account":"acc-target-4","amount":1400,"currency":"USD","transaction_id":"txn-rapid-4","user_id":"bot-user@example.com","source_ip":"198.51.100.25","status_code":200}
{"time":"2024-01-15T10:45:04+00:00","level":"info","service":"go-ledger","msg":"transfer completed","operation":"transfer","from_account":"acc-rapid-fire","to_account":"acc-target-0","amount":1500,"currency":"USD","transaction_id":"txn-rapid-5","user_id":"bot-user@example.com","source_ip":"198.51.100.25","status_code":200}
```

#### Step 2: Verify Alert

```bash
# Check for rule 100012 alert
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "100012"
```

---

### Test Scenario 5: Unauthorized Access Attempts

This test simulates multiple unauthorized access attempts that should trigger rule 100031 and create an OpenCTI incident.

#### Step 1: Generate Unauthorized Access Logs

```bash
# Create a test script for unauthorized access attempts
kubectl exec -n payment-switch $LEDGER_POD -- bash -c 'cat > /tmp/test_unauthorized_access.sh << "EOF"
#!/bin/bash
for i in {1..6}; do
  echo "{\"time\":\"$(date -Iseconds)\",\"level\":\"warn\",\"service\":\"go-ledger\",\"msg\":\"unauthorized access attempt\",\"operation\":\"balance_query\",\"account_id\":\"acc-protected-789\",\"user_id\":\"unauthorized-user@example.com\",\"source_ip\":\"192.0.2.100\",\"status_code\":403,\"transaction_id\":\"txn-unauth-$i\"}" | logger -t go-ledger
  sleep 10
done
EOF
chmod +x /tmp/test_unauthorized_access.sh'

# Execute the test script
kubectl exec -n payment-switch $LEDGER_POD -- /tmp/test_unauthorized_access.sh
```

**Sample Log Entries:**

```json
{"time":"2024-01-15T10:50:00+00:00","level":"warn","service":"go-ledger","msg":"unauthorized access attempt","operation":"balance_query","account_id":"acc-protected-789","user_id":"unauthorized-user@example.com","source_ip":"192.0.2.100","status_code":403,"transaction_id":"txn-unauth-1"}
{"time":"2024-01-15T10:50:10+00:00","level":"warn","service":"go-ledger","msg":"unauthorized access attempt","operation":"balance_query","account_id":"acc-protected-789","user_id":"unauthorized-user@example.com","source_ip":"192.0.2.100","status_code":403,"transaction_id":"txn-unauth-2"}
{"time":"2024-01-15T10:50:20+00:00","level":"warn","service":"go-ledger","msg":"unauthorized access attempt","operation":"balance_query","account_id":"acc-protected-789","user_id":"unauthorized-user@example.com","source_ip":"192.0.2.100","status_code":403,"transaction_id":"txn-unauth-3"}
{"time":"2024-01-15T10:50:30+00:00","level":"warn","service":"go-ledger","msg":"unauthorized access attempt","operation":"balance_query","account_id":"acc-protected-789","user_id":"unauthorized-user@example.com","source_ip":"192.0.2.100","status_code":403,"transaction_id":"txn-unauth-4"}
{"time":"2024-01-15T10:50:40+00:00","level":"warn","service":"go-ledger","msg":"unauthorized access attempt","operation":"balance_query","account_id":"acc-protected-789","user_id":"unauthorized-user@example.com","source_ip":"192.0.2.100","status_code":403,"transaction_id":"txn-unauth-5"}
{"time":"2024-01-15T10:50:50+00:00","level":"warn","service":"go-ledger","msg":"unauthorized access attempt","operation":"balance_query","account_id":"acc-protected-789","user_id":"unauthorized-user@example.com","source_ip":"192.0.2.100","status_code":403,"transaction_id":"txn-unauth-6"}
```

#### Step 2: Verify Critical Alert and OpenCTI Incident

```bash
# Check for rule 100031 alert
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "100031"

# Check for rule 100080 (critical alert trigger)
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/alerts/alerts.json | grep "100080"

# Verify OpenCTI incident
# Look for: "Wazuh Alert: Go Ledger: Multiple unauthorized access attempts from 192.0.2.100"
```

---

## Verification Procedures

### 1. Verify Wazuh Alert Generation

```bash
# View all recent alerts
kubectl exec -n security wazuh-manager-0 -- tail -100 /var/ossec/logs/alerts/alerts.json

# View alerts for a specific rule
kubectl exec -n security wazuh-manager-0 -- grep "rule_id\":\"100011" /var/ossec/logs/alerts/alerts.json

# Check alert statistics
kubectl exec -n security wazuh-manager-0 -- /var/ossec/bin/wazuh-logtest
```

### 2. Verify Integration Script Execution

```bash
# Check integration logs
kubectl exec -n security wazuh-manager-0 -- tail -f /var/ossec/logs/integrations.log

# Expected output:
# Processing Wazuh alert 100011 for OpenCTI integration
# Created OpenCTI incident: <incident-id>
# Created observable: <observable-id>
# Successfully processed alert and created OpenCTI incident <incident-id>
```

### 3. Verify OpenCTI Incident Creation

```bash
# Port forward to OpenCTI
kubectl port-forward -n security svc/opencti-platform 8080:8080

# Access OpenCTI UI at http://localhost:8080
# Login with: admin@opencti.io / ChangeMe

# Navigate to: Analysis > Incidents
# Verify the following incidents are created:
# 1. "Wazuh Alert: Go Ledger: Multiple authentication failures from 192.168.1.100"
# 2. "Wazuh Alert: Go Ledger: Multiple large transactions from account acc-suspicious-123"
# 3. "Wazuh Alert: Go Ledger: Multiple unauthorized access attempts from 192.0.2.100"
```

### 4. Verify OpenCTI Observables

```bash
# In OpenCTI UI, navigate to: Observations > Observables
# Verify the following observables are created:
# - IPv4-Addr: 192.168.1.100
# - IPv4-Addr: 203.0.113.50
# - IPv4-Addr: 192.0.2.100
# - User-Account: attacker@example.com
# - User-Account: suspicious-user@example.com
# - Text: acc-suspicious-123
```

### 5. Verify OpenCTI Indicators

```bash
# In OpenCTI UI, navigate to: Observations > Indicators
# Verify indicators are created for malicious IPs
```

---

## Expected Results

### For Each Test Scenario

| Test Scenario | Wazuh Rule | Alert Level | OpenCTI Incident | Expected Behavior |
|---|---|---|---|---|
| Authentication Failure Attack | 100002 | 10 | ✅ Yes | Incident created with IP and user observables |
| Large Transaction | 100010 | 8 | ❌ No | Alert generated but no incident (level < 12) |
| Multiple Large Transactions | 100011 | 10 | ✅ Yes | Incident created with account ID observable |
| Rapid Fire Transactions | 100012 | 9 | ❌ No | Alert generated but no incident (level < 12) |
| Unauthorized Access Attempts | 100031 | 10 | ✅ Yes | Incident created with IP and user observables |

### OpenCTI Incident Structure

Each incident should contain:

*   **Name**: "Wazuh Alert: [Rule Description]"
*   **Severity**: Based on alert level (critical, high, medium, low)
*   **Description**: Detailed alert information including rule ID, timestamp, and alert data
*   **Observables**: Extracted from the alert (IPs, users, accounts)
*   **Indicators**: Created for malicious IPs
*   **MITRE ATT&CK**: Mapped techniques from the Wazuh rule

---

## Troubleshooting

### Issue: No Alerts Generated

**Possible Causes:**
1. Wazuh agent not collecting logs
2. Custom decoders not loaded
3. Custom rules not loaded

**Solutions:**

```bash
# Check if Wazuh agent is running
kubectl exec -n payment-switch $LEDGER_POD -- ps aux | grep wazuh

# Restart Wazuh agent
kubectl exec -n payment-switch $LEDGER_POD -- /var/ossec/bin/wazuh-control restart

# Verify decoders are loaded
kubectl exec -n security wazuh-manager-0 -- /var/ossec/bin/wazuh-logtest -v

# Restart Wazuh manager
kubectl rollout restart statefulset wazuh-manager -n security
```

### Issue: Integration Script Not Executing

**Possible Causes:**
1. Integration not configured
2. Python dependencies missing
3. Script permissions incorrect

**Solutions:**

```bash
# Check if integration is configured
kubectl exec -n security wazuh-manager-0 -- grep "custom-opencti" /var/ossec/etc/ossec.conf

# Check script permissions
kubectl exec -n security wazuh-manager-0 -- ls -la /var/ossec/integrations/wazuh_opencti_integration.py

# Make script executable
kubectl exec -n security wazuh-manager-0 -- chmod +x /var/ossec/integrations/wazuh_opencti_integration.py

# Check Python dependencies
kubectl exec -n security wazuh-manager-0 -- pip3 list | grep pycti
```

### Issue: OpenCTI Incident Not Created

**Possible Causes:**
1. OpenCTI API credentials incorrect
2. Network connectivity issues
3. OpenCTI API errors

**Solutions:**

```bash
# Check integration logs for errors
kubectl exec -n security wazuh-manager-0 -- tail -100 /var/ossec/logs/integrations.log

# Test OpenCTI connectivity
kubectl exec -n security wazuh-manager-0 -- curl -H "Authorization: Bearer ChangeMe" http://opencti-platform.security.svc.cluster.local:8080/graphql

# Verify OpenCTI credentials
kubectl get secret opencti-credentials -n security -o yaml

# Check OpenCTI platform logs
kubectl logs -n security -l app=opencti,component=platform --tail=100
```

---

## Cleanup

After testing, clean up the test logs and scripts:

```bash
# Remove test scripts
kubectl exec -n payment-switch $LEDGER_POD -- rm -f /tmp/test_*.sh

# Clear Wazuh alerts (optional)
kubectl exec -n security wazuh-manager-0 -- truncate -s 0 /var/ossec/logs/alerts/alerts.json

# Delete test incidents in OpenCTI (via UI)
# Navigate to each incident and click "Delete"
```

---

## Conclusion

This testing guide provides comprehensive procedures to verify the Wazuh-OpenCTI integration. By following these steps and generating the sample log entries, you can confirm that your security monitoring system is correctly detecting suspicious activity in the Go Ledger service and automatically creating incidents in OpenCTI for threat intelligence correlation.
