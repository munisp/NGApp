# Wazuh and OpenCTI Integration for Go Ledger Service Monitoring

This document provides a comprehensive example of how to configure Wazuh to monitor the Go Ledger service for suspicious activity and integrate with OpenCTI for threat intelligence correlation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Configuration Files](#configuration-files)
3. [Deployment Steps](#deployment-steps)
4. [Verification and Testing](#verification-and-testing)
5. [Troubleshooting](#troubleshooting)

## Architecture Overview

This integration leverages Wazuh for real-time log analysis and security monitoring of the Go Ledger service. Custom Wazuh rules and decoders are used to detect suspicious activity, and a custom integration script sends critical alerts to OpenCTI to create incidents, observables, and indicators.

### Data Flow

1.  **Log Collection**: The Wazuh agent on the Go Ledger service pod collects application logs.
2.  **Log Analysis**: The Wazuh manager decodes and analyzes the logs using custom decoders and rules.
3.  **Alert Generation**: When a rule is triggered, Wazuh generates an alert.
4.  **Integration Trigger**: If the alert level is 12 or higher and belongs to the `opencti_integration` group, the custom integration script is executed.
5.  **OpenCTI Enrichment**: The script creates an incident in OpenCTI, extracts indicators from the alert, and queries OpenCTI for existing threat intelligence.

## Configuration Files

*   **`wazuh-decoders/go-ledger-decoder.xml`**: Custom Wazuh decoder for parsing Go Ledger service logs.
*   **`wazuh-rules/go-ledger-rules.xml`**: Custom Wazuh rules for detecting suspicious activity.
*   **`scripts/wazuh_opencti_integration.py`**: Python script that sends alerts to OpenCTI.
*   **`configs/wazuh-integration-config.xml`**: Wazuh configuration for the custom integration.
*   **`configs/wazuh-custom-config.yaml`**: Kubernetes ConfigMaps for deploying the custom rules, decoders, and integration script.

## Deployment Steps

### Step 1: Apply Kubernetes ConfigMaps

```bash
kubectl apply -f configs/wazuh-custom-config.yaml
```

### Step 2: Update Wazuh Manager Configuration

Add the following to your `ossec.conf` file on the Wazuh manager:

```xml
<integration>
  <name>custom-opencti</name>
  <hook_url>/var/ossec/integrations/wazuh_opencti_integration.py</hook_url>
  <level>12</level>
  <group>opencti_integration</group>
  <alert_format>json</alert_format>
</integration>
```

### Step 3: Restart Wazuh Manager

```bash
kubectl rollout restart statefulset wazuh-manager -n security
```

## Verification and Testing

### Step 1: Generate a Test Log

From the Go Ledger service pod, generate a log entry that will trigger a critical alert:

```bash
echo '{"level":"error","service":"go-ledger","msg":"authentication failed","source_ip":"1.2.3.4","user_id":"testuser"}' >> /var/log/go-ledger.log
```

### Step 2: Check Wazuh Alerts

Check the Wazuh alerts for the generated alert:

```bash
kubectl exec -it -n security wazuh-manager-0 -- /var/ossec/bin/wazuh-logtest
```

### Step 3: Check OpenCTI Incidents

Check the OpenCTI UI for a new incident created from the Wazuh alert.

## Troubleshooting

*   **Integration Not Triggering**: Check the Wazuh manager logs (`/var/ossec/logs/ossec.log`) for errors related to the integration script.
*   **Script Errors**: Check the integration script logs (`/var/ossec/logs/integrations.log`) for Python errors.
*   **OpenCTI Errors**: Check the OpenCTI platform logs for errors related to incident creation.
