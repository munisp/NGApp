# Security Monitoring Setup Guide

Complete security monitoring stack for African Fintech Mobile App with Wazuh SIEM, Openappsec WAF, and Open Policy Agent (OPA).

## Overview

**Security Stack:**
- **Wazuh 4.14.2**: SIEM for log aggregation, threat detection, compliance monitoring
- **Openappsec**: Web Application Firewall (WAF) and API security
- **Open Policy Agent (OPA)**: Policy-based access control for KYC data

**Monitored Components:**
- Python FastAPI KYC service (port 5010)
- Facial recognition service (port 5009)
- OCR services (ports 5001-5008)
- Express.js API server (port 3000)
- MySQL database (TiDB Cloud)

---

## 1. Wazuh SIEM Installation

### Install Wazuh Agent

```bash
# Add Wazuh repository
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | sudo gpg --no-default-keyring --keyring gnupg-ring:/usr/share/keyrings/wazuh.gpg --import
sudo chmod 644 /usr/share/keyrings/wazuh.gpg
echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" | sudo tee /etc/apt/sources.list.d/wazuh.list

# Install agent
sudo apt-get update
sudo apt-get install -y wazuh-agent

# Configure manager address (replace with your Wazuh manager IP)
sudo sed -i 's/<address>MANAGER_IP<\/address>/<address>YOUR_WAZUH_MANAGER_IP<\/address>/' /var/ossec/etc/ossec.conf

# Start agent
sudo systemctl daemon-reload
sudo systemctl enable wazuh-agent
sudo systemctl start wazuh-agent
```

### Configure KYC Monitoring

Create `/var/ossec/etc/local_internal_options.conf`:

```conf
# Monitor KYC service logs
logcollector.remote_commands=1
```

Create `/var/ossec/etc/ossec.conf` custom rules:

```xml
<ossec_config>
  <localfile>
    <log_format>json</log_format>
    <location>/tmp/kyc-service.log</location>
  </localfile>
  
  <localfile>
    <log_format>json</log_format>
    <location>/tmp/face-verification.log</location>
  </localfile>
  
  <localfile>
    <log_format>syslog</log_format>
    <location>/var/log/auth.log</location>
  </localfile>
</ossec_config>
```

### Custom KYC Rules

Create `/var/ossec/ruleset/rules/kyc_rules.xml`:

```xml
<group name="kyc,">
  <rule id="100001" level="3">
    <decoded_as>json</decoded_as>
    <field name="event">kyc_submission</field>
    <description>KYC submission received</description>
  </rule>

  <rule id="100002" level="5">
    <if_sid>100001</if_sid>
    <field name="status">approved</field>
    <description>KYC submission approved</description>
  </rule>

  <rule id="100003" level="7">
    <if_sid>100001</if_sid>
    <field name="status">rejected</field>
    <description>KYC submission rejected</description>
  </rule>

  <rule id="100004" level="10">
    <decoded_as>json</decoded_as>
    <field name="event">kyc_access_denied</field>
    <description>Unauthorized KYC data access attempt</description>
  </rule>

  <rule id="100005" level="12">
    <decoded_as>json</decoded_as>
    <field name="event">facial_recognition_failed</field>
    <match>confidence</match>
    <regex>0\.[0-5]</regex>
    <description>Facial recognition failed (low confidence)</description>
  </rule>

  <rule id="100006" level="8">
    <decoded_as>json</decoded_as>
    <field name="event">pii_data_accessed</field>
    <description>PII data accessed (audit trail)</description>
  </rule>
</group>
```

### Wazuh Dashboards

**KYC Security Dashboard:**
- Total KYC submissions (last 24h)
- Approval/rejection rate
- Failed facial recognition attempts
- Unauthorized access attempts
- PII data access audit trail

**Compliance Dashboard:**
- GDPR data access logs
- Nigerian Data Protection Regulation compliance
- PCI-DSS audit events
- Data retention policy violations

---

## 2. Openappsec WAF Installation

### Install Openappsec

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Pull Openappsec image
docker pull openappsec/agent:latest

# Run Openappsec for KYC service
docker run -d \
  --name openappsec-kyc \
  --network host \
  -v /etc/openappsec:/etc/cp/conf \
  -v /var/log/openappsec:/var/log/nano_agent \
  openappsec/agent:latest \
  --standalone \
  --hybrid-mode \
  --token YOUR_OPENAPPSEC_TOKEN
```

### Configure WAF Rules for KYC

Create `/etc/openappsec/kyc-policy.json`:

```json
{
  "name": "KYC API Protection",
  "mode": "prevent",
  "rules": [
    {
      "name": "Rate Limiting",
      "action": "block",
      "conditions": [
        {
          "type": "rate",
          "path": "/api/kyc/submit",
          "limit": 10,
          "window": 60
        }
      ]
    },
    {
      "name": "SQL Injection Protection",
      "action": "block",
      "conditions": [
        {
          "type": "sqli",
          "severity": "high"
        }
      ]
    },
    {
      "name": "XSS Protection",
      "action": "block",
      "conditions": [
        {
          "type": "xss",
          "severity": "medium"
        }
      ]
    },
    {
      "name": "File Upload Validation",
      "action": "block",
      "conditions": [
        {
          "type": "file_upload",
          "max_size": 10485760,
          "allowed_types": ["image/jpeg", "image/png", "image/heic"]
        }
      ]
    },
    {
      "name": "PII Data Leak Prevention",
      "action": "redact",
      "conditions": [
        {
          "type": "regex",
          "pattern": "\\b[A-Z]{2}\\d{11}\\b",
          "description": "Nigerian BVN number"
        },
        {
          "type": "regex",
          "pattern": "\\b\\d{13}\\b",
          "description": "South African ID number"
        }
      ]
    }
  ]
}
```

---

## 3. Open Policy Agent (OPA) Installation

### Install OPA

```bash
# Download OPA binary
curl -L -o opa https://openpolicyagent.org/downloads/v0.69.0/opa_linux_amd64_static
chmod 755 opa
sudo mv opa /usr/local/bin/

# Create OPA service
sudo tee /etc/systemd/system/opa.service > /dev/null <<EOF
[Unit]
Description=Open Policy Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/opa run --server --addr=0.0.0.0:8181 /etc/opa/policies
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Create policies directory
sudo mkdir -p /etc/opa/policies

# Start OPA
sudo systemctl daemon-reload
sudo systemctl enable opa
sudo systemctl start opa
```

### KYC Access Control Policies

Create `/etc/opa/policies/kyc_access.rego`:

```rego
package kyc.access

import rego.v1

# Default deny
default allow := false

# Admin can access all KYC submissions
allow if {
    input.user.role == "admin"
    input.action in ["read", "approve", "reject"]
}

# Compliance officers can read and audit
allow if {
    input.user.role == "compliance_officer"
    input.action in ["read", "audit"]
}

# Users can only access their own KYC data
allow if {
    input.user.role == "user"
    input.action == "read"
    input.resource.user_id == input.user.id
}

# Users can submit KYC
allow if {
    input.user.role == "user"
    input.action == "submit"
}

# PII data access requires additional consent
allow_pii_access if {
    allow
    input.user.has_pii_consent == true
    input.action == "read_pii"
}

# Audit log for all access
audit_log contains entry if {
    entry := {
        "timestamp": time.now_ns(),
        "user_id": input.user.id,
        "action": input.action,
        "resource": input.resource,
        "allowed": allow
    }
}
```

### Integrate OPA with KYC Service

Update `/home/ubuntu/fintech-mobile-app/python-services/kyc/kyc_service.py`:

```python
import requests

OPA_URL = "http://localhost:8181/v1/data/kyc/access/allow"

def check_opa_policy(user_id: str, role: str, action: str, resource: dict) -> bool:
    """Check OPA policy for KYC access control."""
    payload = {
        "input": {
            "user": {"id": user_id, "role": role},
            "action": action,
            "resource": resource
        }
    }
    
    try:
        response = requests.post(OPA_URL, json=payload, timeout=2)
        result = response.json()
        return result.get("result", False)
    except Exception as e:
        logger.error(f"OPA policy check failed: {e}")
        return False  # Fail closed

# Use in endpoints
@app.get("/api/kyc/submissions/{submission_id}")
async def get_kyc_submission(submission_id: str, user_id: str, role: str):
    # Check OPA policy
    if not check_opa_policy(user_id, role, "read", {"submission_id": submission_id}):
        raise HTTPException(status_code=403, detail="Access denied by policy")
    
    # Proceed with request...
```

---

## 4. Monitoring Dashboards

### Grafana Integration

**Wazuh + Grafana:**
1. Install Grafana: `sudo apt-get install -y grafana`
2. Add Wazuh datasource (Elasticsearch)
3. Import Wazuh dashboard templates

**Key Metrics:**
- KYC submissions per hour
- Facial recognition success rate
- OCR accuracy by document type
- Security events (blocked attacks, unauthorized access)
- API response times
- Database query performance

### Alert Rules

**Critical Alerts (PagerDuty/Slack):**
- 5+ failed facial recognition attempts in 5 minutes
- Unauthorized PII data access
- SQL injection attempt detected
- KYC service down > 2 minutes
- Database connection pool exhausted

**Warning Alerts (Email):**
- KYC approval rate < 70%
- OCR confidence < 0.7 for 10+ submissions
- API response time > 500ms (P95)
- Disk space < 20%

---

## 5. Compliance Features

### GDPR Compliance

**Right to Access:**
```bash
curl -X GET http://localhost:5010/api/kyc/gdpr/export/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

**Right to Erasure:**
```bash
curl -X DELETE http://localhost:5010/api/kyc/gdpr/delete/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

### Nigerian Data Protection Regulation (NDPR)

- Data localization: Store Nigerian user data in Nigerian data centers
- Consent management: Explicit consent for PII processing
- Data breach notification: Alert within 72 hours
- Audit trail: 7-year retention for compliance

### PCI-DSS (if handling payments)

- Encrypt cardholder data (AES-256)
- Implement strong access control (OPA policies)
- Regularly test security systems (penetration testing)
- Maintain audit logs (Wazuh SIEM)

---

## 6. Testing Security Monitoring

### Test Wazuh Alerts

```bash
# Trigger KYC submission event
curl -X POST http://localhost:5010/api/kyc/submit \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test123", "document_type": "national_id"}'

# Check Wazuh alerts
sudo tail -f /var/ossec/logs/alerts/alerts.json
```

### Test Openappsec WAF

```bash
# Test SQL injection protection
curl -X POST http://localhost:5010/api/kyc/submit \
  -d "user_id=1' OR '1'='1"

# Test rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:5010/api/kyc/submit
done
```

### Test OPA Policies

```bash
# Test admin access (should allow)
curl -X POST http://localhost:8181/v1/data/kyc/access/allow \
  -d '{"input": {"user": {"role": "admin"}, "action": "approve"}}'

# Test user access to other user's data (should deny)
curl -X POST http://localhost:8181/v1/data/kyc/access/allow \
  -d '{"input": {"user": {"id": "user1", "role": "user"}, "action": "read", "resource": {"user_id": "user2"}}}'
```

---

## 7. Production Deployment Checklist

- [ ] Wazuh manager deployed on separate server
- [ ] Wazuh agent installed on all app servers
- [ ] Custom KYC rules configured
- [ ] Openappsec WAF deployed with rate limiting
- [ ] OPA policies tested and validated
- [ ] Grafana dashboards configured
- [ ] Alert rules configured (PagerDuty/Slack)
- [ ] GDPR compliance endpoints tested
- [ ] NDPR data localization implemented
- [ ] Security monitoring tested end-to-end
- [ ] Incident response playbook created
- [ ] Security team trained on dashboards

---

## Cost Estimate

| Component | Hosting | Monthly Cost |
|-----------|---------|--------------|
| Wazuh Manager (4 vCPU, 8GB RAM) | AWS EC2 t3.large | $60 |
| Openappsec (included in app servers) | - | $0 |
| OPA (lightweight, runs on app servers) | - | $0 |
| Grafana Cloud (Pro tier) | Grafana Cloud | $49 |
| **Total** | | **$109/month** |

**Self-hosted alternative:** $0/month (run all on existing servers, but requires more maintenance)

---

## Support

- Wazuh documentation: https://documentation.wazuh.com/
- Openappsec documentation: https://docs.openappsec.io/
- OPA documentation: https://www.openpolicyagent.org/docs/

For KYC-specific security questions, contact: security@africanfintech.app
