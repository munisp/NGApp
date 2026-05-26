## Runbook: Security Incident

**Severity:** Critical  
**Response Time:** Immediate (< 5 minutes)  
**On-Call:** Security Team + DevOps + Legal

### Symptoms

- Unauthorized access attempts
- Suspicious API activity
- Data breach alerts
- DDoS attack
- Malware detection
- Compromised credentials
- Unusual database queries

### Impact

- **User Impact:** Account compromise, data exposure
- **Business Impact:** Legal liability, reputation damage, regulatory fines
- **Data Impact:** PII exposure, financial data breach

### Triage Steps

#### 1. Verify the Incident (2 minutes)

```bash
# Check security logs
docker logs web-portal | grep -i "unauthorized\|breach\|attack"

# Check failed login attempts
docker exec mysql-db mysql -e "
  SELECT * FROM audit_logs 
  WHERE event_type = 'failed_login' 
  AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
  ORDER BY created_at DESC LIMIT 100;
"

# Check suspicious API calls
docker logs nginx-gateway | grep -E "40[13]|429" | tail -100

# Check for malware
docker exec web-portal clamscan -r /app
```

#### 2. Assess Severity

**P0 - Critical (Active Breach)**
- Confirmed unauthorized access
- Data exfiltration in progress
- Ransomware detected
- Admin account compromised

**P1 - High (Attempted Breach)**
- Multiple failed login attempts
- SQL injection attempts
- DDoS attack
- Vulnerability exploitation attempts

**P2 - Medium (Suspicious Activity)**
- Unusual traffic patterns
- Port scanning
- Brute force attempts (blocked)
- Outdated dependencies with CVEs

### Immediate Response

#### Step 1: Contain the Threat (< 5 minutes)

```bash
# 1. Enable rate limiting
docker exec nginx-gateway sh -c 'echo "limit_req_zone \$binary_remote_addr zone=emergency:10m rate=1r/s;" > /etc/nginx/conf.d/emergency.conf'
docker exec nginx-gateway nginx -s reload

# 2. Block suspicious IPs
docker exec nginx-gateway sh -c 'echo "deny 1.2.3.4;" >> /etc/nginx/conf.d/blocked-ips.conf'
docker exec nginx-gateway nginx -s reload

# 3. Disable compromised accounts
docker exec mysql-db mysql -e "
  UPDATE users SET status = 'suspended' 
  WHERE id IN (SELECT user_id FROM suspicious_activity);
"

# 4. Revoke API keys
docker exec mysql-db mysql -e "
  UPDATE api_keys SET status = 'revoked' 
  WHERE last_used_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
  AND suspicious = true;
"

# 5. Enable maintenance mode (if necessary)
curl -X POST http://localhost:3000/api/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "message": "Security maintenance"}'
```

#### Step 2: Preserve Evidence (< 10 minutes)

```bash
# Create evidence directory
mkdir -p /opt/payment-switch/security-incidents/$(date +%Y%m%d-%H%M%S)
cd /opt/payment-switch/security-incidents/$(date +%Y%m%d-%H%M%S)

# Collect logs
docker logs web-portal > web-portal.log
docker logs nginx-gateway > nginx-gateway.log
docker logs mysql-db > mysql-db.log

# Collect access logs
docker exec nginx-gateway cat /var/log/nginx/access.log > access.log
docker exec nginx-gateway cat /var/log/nginx/error.log > error.log

# Export suspicious database activity
docker exec mysql-db mysql -e "
  SELECT * FROM audit_logs 
  WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  INTO OUTFILE '/tmp/audit_logs.csv'
  FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
  LINES TERMINATED BY '\n';
"

# Take database snapshot
docker exec mysql-db mysqldump --all-databases > database-snapshot.sql

# Collect system information
docker ps -a > containers.txt
docker network ls > networks.txt
docker images > images.txt
netstat -tulpn > network-connections.txt

# Create archive
tar -czf evidence-$(date +%Y%m%d-%H%M%S).tar.gz *.log *.txt *.sql
```

### Resolution Procedures

#### Scenario A: Unauthorized Access

```bash
# 1. Identify compromised accounts
docker exec mysql-db mysql -e "
  SELECT u.*, al.* 
  FROM users u 
  JOIN audit_logs al ON u.id = al.user_id
  WHERE al.ip_address NOT IN (
    SELECT ip_address FROM known_good_ips
  )
  AND al.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR);
"

# 2. Force password reset
docker exec mysql-db mysql -e "
  UPDATE users 
  SET password_reset_required = true,
      session_token = NULL
  WHERE id IN (SELECT user_id FROM compromised_accounts);
"

# 3. Invalidate all sessions
docker exec redis-cache redis-cli FLUSHDB

# 4. Rotate secrets
./scripts/rotate-secrets.sh

# 5. Enable 2FA requirement
docker exec mysql-db mysql -e "
  UPDATE users SET require_2fa = true;
"
```

#### Scenario B: DDoS Attack

```bash
# 1. Enable aggressive rate limiting
cat > /tmp/ddos-protection.conf << 'EOF'
limit_req_zone $binary_remote_addr zone=ddos:10m rate=10r/s;
limit_req zone=ddos burst=20 nodelay;
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_conn addr 10;
EOF

docker cp /tmp/ddos-protection.conf nginx-gateway:/etc/nginx/conf.d/
docker exec nginx-gateway nginx -s reload

# 2. Enable Cloudflare "Under Attack" mode
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_level" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"value":"under_attack"}'

# 3. Block attack sources
# Get top attacking IPs
docker logs nginx-gateway | awk '{print $1}' | sort | uniq -c | sort -rn | head -20 > attacking-ips.txt

# Block them
while read count ip; do
  docker exec nginx-gateway sh -c "echo 'deny $ip;' >> /etc/nginx/conf.d/blocked-ips.conf"
done < attacking-ips.txt

docker exec nginx-gateway nginx -s reload

# 4. Enable CDN caching
# Increase cache TTL to reduce backend load
```

#### Scenario C: SQL Injection Attempt

```bash
# 1. Identify injection attempts
docker logs web-portal | grep -i "sql\|union\|select.*from\|drop table" > sql-injection-attempts.log

# 2. Block attacking IPs
grep -oP '\d+\.\d+\.\d+\.\d+' sql-injection-attempts.log | sort -u | while read ip; do
  docker exec nginx-gateway sh -c "echo 'deny $ip;' >> /etc/nginx/conf.d/blocked-ips.conf"
done

# 3. Enable WAF rules
# Add ModSecurity rules or enable cloud WAF

# 4. Review and fix vulnerable code
# Check for raw SQL queries, use parameterized queries

# 5. Run security scan
docker run --rm -v $(pwd):/src returntocorp/semgrep --config=auto /src
```

#### Scenario D: Data Breach

```bash
# 1. Stop data exfiltration
# Block outbound connections to suspicious IPs
iptables -A OUTPUT -d <suspicious-ip> -j DROP

# 2. Identify exposed data
docker exec mysql-db mysql -e "
  SELECT table_name, 
         COUNT(*) as row_count,
         MAX(updated_at) as last_modified
  FROM information_schema.tables t
  JOIN <database>.* ON 1=1
  WHERE table_schema = '<database>'
  GROUP BY table_name;
"

# 3. Assess impact
# Determine what data was accessed
docker exec mysql-db mysql -e "
  SELECT * FROM audit_logs 
  WHERE event_type = 'data_access'
  AND user_id IN (SELECT id FROM compromised_accounts)
  ORDER BY created_at DESC;
"

# 4. Notify affected users
# Send breach notification emails
docker exec web-portal node scripts/send-breach-notifications.js

# 5. Report to authorities (if required)
# GDPR: 72 hours
# CCPA: Without unreasonable delay
# PCI DSS: Immediately
```

### Communication

#### Internal Alert (Immediate)

**Slack #security-incidents:**
```
🚨 SECURITY INCIDENT - P0
Type: [Unauthorized Access/DDoS/Data Breach/etc]
Status: Investigating
Severity: [Critical/High/Medium]
Incident Commander: @security-lead
War Room: #incident-security-YYYYMMDD
DO NOT discuss details in public channels
```

#### Customer Communication (Within 24-72 hours)

**For Data Breach:**
```
Subject: Important Security Notice

Dear [Customer],

We are writing to inform you of a security incident that may have 
affected your account.

What Happened:
[Brief description of the incident]

What Information Was Involved:
[List of data types affected]

What We're Doing:
[Steps taken to secure the platform]

What You Should Do:
1. Change your password immediately
2. Enable two-factor authentication
3. Monitor your account for suspicious activity
4. Review our security recommendations

We take the security of your data very seriously and apologize for 
any concern this may cause.

For more information, please visit: [URL]

Sincerely,
Payment Switch Security Team
```

### Legal & Compliance

#### Regulatory Reporting

**GDPR (EU):**
- Report to supervisory authority within 72 hours
- Notify affected individuals without undue delay
- Document the breach and response

**CCPA (California):**
- Notify affected residents without unreasonable delay
- Provide specific information about the breach

**PCI DSS:**
- Notify payment brands immediately
- Notify affected financial institutions
- Conduct forensic investigation

#### Documentation Required

1. **Incident Timeline**
   - When breach discovered
   - When breach occurred
   - Actions taken and when

2. **Data Assessment**
   - Types of data affected
   - Number of records
   - Individuals impacted

3. **Response Actions**
   - Containment measures
   - Remediation steps
   - Prevention measures

### Post-Incident Actions

#### Immediate (Within 24 hours)

```bash
# 1. Conduct security audit
docker run --rm -v $(pwd):/src aquasec/trivy fs /src

# 2. Update all dependencies
pnpm update --latest

# 3. Rotate all credentials
./scripts/rotate-all-credentials.sh

# 4. Enable additional security measures
# - Enforce 2FA for all users
# - Increase password complexity requirements
# - Enable IP whitelisting for admin access

# 5. Review access logs
docker exec mysql-db mysql -e "
  SELECT * FROM audit_logs 
  WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
  ORDER BY created_at DESC;
"
```

#### Follow-up (Within 1 week)

1. **Conduct forensic analysis**
2. **Identify root cause**
3. **Implement security improvements**
4. **Update security policies**
5. **Conduct security training**
6. **Perform penetration testing**
7. **Review and update incident response plan**

### Prevention Measures

#### Security Monitoring

```yaml
# Prometheus security alerts
- alert: UnauthorizedAccessAttempt
  expr: rate(http_requests_total{status="401"}[5m]) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High rate of unauthorized access attempts"

- alert: SuspiciousAPIActivity
  expr: rate(api_calls_total{endpoint=~"/admin/.*"}[5m]) > 100
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Suspicious admin API activity"
```

#### Security Hardening

```bash
# 1. Enable security headers
cat > /etc/nginx/conf.d/security-headers.conf << 'EOF'
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self'" always;
EOF

# 2. Enable fail2ban
apt-get install fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 3. Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 4. Enable audit logging
docker exec mysql-db mysql -e "
  SET GLOBAL general_log = 'ON';
  SET GLOBAL log_output = 'TABLE';
"
```

### Tools & Resources

- **Security Logs:** `/opt/payment-switch/security-incidents/`
- **SIEM:** [Your SIEM URL]
- **Vulnerability Scanner:** `docker run aquasec/trivy`
- **Penetration Testing:** [Vendor contact]
- **Incident Response Team:** [Contact info]

### Related Runbooks

- [Service Outage](./service-outage.md)
- [Database Failure](./database-failure.md)
- [Disaster Recovery](./disaster-recovery.md)
- [Data Breach Response](./data-breach-response.md)
