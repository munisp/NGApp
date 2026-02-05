# Access Control Policy

**Document Version:** 1.0  
**Effective Date:** January 23, 2026  
**Last Review Date:** January 23, 2026  
**Next Review Date:** January 23, 2027  
**Owner:** Chief Information Security Officer (CISO)  
**Classification:** Internal

---

## 1. Purpose

This Access Control Policy defines the standards and procedures for granting, managing, and revoking access to information systems and data within the African Fintech Mobile App platform. The policy ensures that only authorized individuals have access to resources necessary for their job functions, following the principles of least privilege and segregation of duties.

---

## 2. Scope

This policy applies to:

- All employees, contractors, and third-party personnel
- All systems, applications, and data repositories
- All access methods (local, remote, API, database)
- All environments (production, staging, development)

---

## 3. Access Control Principles

### 3.1 Least Privilege

Users are granted the minimum level of access required to perform their job duties. Excessive permissions are prohibited and regularly audited.

### 3.2 Segregation of Duties

Critical operations require multiple individuals to complete, preventing fraud and errors. No single individual has complete control over critical processes.

### 3.3 Need-to-Know

Access to sensitive information is granted only when there is a legitimate business need. Curiosity or convenience are not valid justifications.

### 3.4 Defense in Depth

Multiple layers of access controls protect critical assets. Compromise of one control does not result in complete system compromise.

---

## 4. User Account Management

### 4.1 Account Provisioning

**Process:**

1. **Request**: Manager submits access request via IT ticketing system
2. **Approval**: Department head and CISO approve request
3. **Provisioning**: IT creates account with appropriate permissions
4. **Notification**: User receives credentials via secure channel
5. **Acknowledgment**: User signs acceptable use agreement

**Timeline:** Accounts provisioned within 24 hours of approval for standard access, 48 hours for privileged access.

### 4.2 Account Types

| Account Type | Description | MFA Required | Review Frequency |
|--------------|-------------|--------------|------------------|
| **Standard User** | Regular employee access | Recommended | Annual |
| **Admin** | System administration | Mandatory | Quarterly |
| **Service Account** | Application-to-application | N/A | Quarterly |
| **Temporary** | Contractors, consultants | Mandatory | Per engagement |
| **Emergency** | Break-glass access | Mandatory | After each use |

### 4.3 Account Deprovisioning

**Termination:**
- Accounts disabled immediately upon termination notification
- Access credentials revoked within 1 hour
- Data access logged for audit purposes
- Equipment and access badges collected

**Role Change:**
- Permissions adjusted within 24 hours of role change
- Unnecessary permissions removed immediately
- New permissions granted after approval

**Dormant Accounts:**
- Accounts inactive for 90 days automatically disabled
- Accounts inactive for 180 days automatically deleted
- Reactivation requires manager approval

---

## 5. Authentication

### 5.1 Password Requirements

**Complexity:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot contain username or common words

**Management:**
- Passwords expire every 90 days
- Password history: last 12 passwords cannot be reused
- Account lockout: 5 failed attempts, 15-minute lockout
- Password reset: Self-service with MFA verification

### 5.2 Multi-Factor Authentication (MFA)

**Requirements:**
- **Mandatory**: All admin accounts, remote access, privileged operations
- **Recommended**: All user accounts
- **Methods**: TOTP (Google Authenticator, Authy), SMS (fallback only)
- **Backup Codes**: 10 single-use codes provided during enrollment

**Enrollment:**
- Users enroll in MFA within 7 days of account creation
- Admin accounts cannot be used until MFA is enabled
- Backup codes must be stored securely

### 5.3 Single Sign-On (SSO)

- SSO enabled for all integrated applications
- OAuth 2.0 / SAML 2.0 protocols used
- Session timeout: 30 minutes of inactivity
- Reauthentication required for sensitive operations

---

## 6. Authorization

### 6.1 Role-Based Access Control (RBAC)

**Standard Roles:**

| Role | Description | Permissions |
|------|-------------|-------------|
| **User** | Standard mobile app user | View own data, submit KYC, manage profile |
| **Support Agent** | Customer support staff | View user data (read-only), create support tickets |
| **KYC Reviewer** | KYC verification specialist | Review KYC submissions, approve/reject documents |
| **Admin** | System administrator | Full system access, user management, configuration |
| **Auditor** | Compliance auditor | Read-only access to all data and logs |
| **Developer** | Software developer | Access to development/staging environments only |

**Custom Roles:**
- Custom roles require CISO approval
- Documented justification required
- Reviewed quarterly for continued necessity

### 6.2 Privilege Escalation

**Temporary Elevation:**
- Developers can request temporary production access
- Maximum duration: 4 hours
- Approval required from manager and CISO
- All actions logged and reviewed

**Emergency Access:**
- Break-glass accounts for critical incidents
- Requires two-person authorization
- Automatically expires after 1 hour
- Post-incident review mandatory

### 6.3 Data Access Controls

**Sensitive Data Access:**

| Data Type | Access Level | Justification Required | Logging |
|-----------|--------------|------------------------|---------|
| **PII** | Role-based | Yes | All access logged to Wazuh |
| **Financial Data** | Role-based | Yes | All access logged to Wazuh |
| **KYC Documents** | KYC Reviewer only | Yes | All access logged to Wazuh |
| **Audit Logs** | Auditor, Admin | Yes | Immutable logs |
| **System Credentials** | Admin only | Yes | Encrypted, access logged |

---

## 7. Remote Access

### 7.1 VPN Access

**Requirements:**
- Company-issued device or approved BYOD device
- MFA required for all VPN connections
- Full-tunnel VPN (no split-tunneling)
- Antivirus and firewall enabled on endpoint

**Monitoring:**
- All VPN sessions logged
- Anomalous activity triggers alerts
- Quarterly review of VPN access lists

### 7.2 Remote Desktop

- Remote desktop access requires VPN connection
- Session timeout: 30 minutes of inactivity
- Screen lock after 5 minutes of inactivity
- Remote sessions recorded for audit purposes

### 7.3 Third-Party Access

**Vendor Access:**
- Temporary accounts created for specific engagements
- Access limited to necessary systems only
- Supervised access for high-risk operations
- Accounts disabled immediately after engagement

**Audit Rights:**
- Vendors must allow security audits
- Access logs provided upon request
- Incident notification within 24 hours

---

## 8. Privileged Access Management

### 8.1 Admin Accounts

**Requirements:**
- Separate admin account from standard user account
- MFA mandatory, no exceptions
- Admin accounts cannot be used for email or web browsing
- All admin actions logged to immutable storage

**Usage:**
- Admin access used only when necessary
- Standard account used for routine tasks
- Admin sessions limited to 4 hours
- Reauthentication required after timeout

### 8.2 Root/Superuser Access

**Restrictions:**
- Root access restricted to emergency situations only
- Requires approval from two senior administrators
- All commands logged and reviewed
- Post-access report required within 24 hours

**Alternatives:**
- Use sudo with individual accountability
- Implement role-based sudo rules
- Prefer configuration management tools over manual changes

### 8.3 Service Accounts

**Management:**
- Unique credentials for each service
- Credentials stored in encrypted vault (HashiCorp Vault)
- Automatic credential rotation every 90 days
- No interactive login allowed

**Monitoring:**
- All service account activity logged
- Anomaly detection for unusual patterns
- Quarterly review of service account permissions

---

## 9. Access Reviews

### 9.1 User Access Review

**Frequency:**
- **Quarterly**: Admin and privileged accounts
- **Annually**: Standard user accounts
- **Ad-hoc**: After organizational changes

**Process:**
1. IT generates access report for each department
2. Department managers review and certify access
3. Unnecessary access removed within 7 days
4. Results documented and reported to CISO

### 9.2 Role Review

**Frequency:** Annual review of all RBAC roles

**Process:**
1. Review role definitions and permissions
2. Identify over-privileged or redundant roles
3. Update role permissions as needed
4. Communicate changes to affected users

### 9.3 Exception Review

**Frequency:** Quarterly review of all access exceptions

**Process:**
1. Review all documented exceptions
2. Verify business justification still valid
3. Implement compensating controls where possible
4. Expire or renew exceptions

---

## 10. Physical Access Control

### 10.1 Facility Access

**Badge System:**
- RFID badges issued to all employees
- Access rights based on job role and location
- Lost badges reported immediately and deactivated
- Visitor badges issued at reception, escort required

**Access Levels:**

| Level | Areas | Personnel |
|-------|-------|-----------|
| **Level 1** | Public areas, reception | All visitors |
| **Level 2** | Office areas | Employees, escorted visitors |
| **Level 3** | Server rooms, data centers | IT staff, authorized personnel |
| **Level 4** | Secure storage, backup media | Senior IT staff, security team |

### 10.2 Data Center Access

**Requirements:**
- Biometric authentication (fingerprint or retina scan)
- Two-person rule for sensitive operations
- Video surveillance with 90-day retention
- Access logs reviewed weekly

**Visitor Access:**
- Advance approval required (48 hours)
- Escort mandatory at all times
- Sign non-disclosure agreement
- No photography or recording devices

---

## 11. Monitoring and Logging

### 11.1 Access Logging

**Logged Events:**
- Successful and failed login attempts
- Privilege escalation
- Access to sensitive data
- Configuration changes
- Account creation, modification, deletion

**Log Retention:**
- Security logs: 2 years
- Audit logs: 7 years (regulatory requirement)
- System logs: 90 days

### 11.2 Monitoring

**Real-Time Alerts:**
- Multiple failed login attempts
- Access from unusual locations
- Privilege escalation
- Access to sensitive data outside business hours
- Bulk data downloads

**Response:**
- P1 alerts: 15-minute response time
- P2 alerts: 1-hour response time
- P3 alerts: 4-hour response time

---

## 12. Compliance

### 12.1 Regulatory Requirements

- **GDPR Article 32**: Technical and organizational measures
- **PCI DSS Requirement 7**: Restrict access to cardholder data
- **PCI DSS Requirement 8**: Identify and authenticate access
- **SOC 2 CC6.1**: Logical and physical access controls

### 12.2 Audit and Assessment

- **Internal Audits**: Quarterly access control audits
- **External Audits**: Annual third-party assessment
- **Penetration Testing**: Bi-annual testing of access controls
- **Compliance Scanning**: Continuous monitoring

---

## 13. Exceptions

### 13.1 Exception Process

**Request:**
1. Submit written request to CISO
2. Include business justification and risk assessment
3. Propose compensating controls
4. Specify duration of exception

**Approval:**
- CISO approval required for all exceptions
- Exceptions documented in exception register
- Automatic expiration after 1 year
- Quarterly review of all active exceptions

### 13.2 Emergency Access

**Break-Glass Procedures:**
- Used only for critical incidents
- Requires two-person authorization
- Automatically expires after 1 hour
- Post-incident review within 24 hours
- All actions logged and audited

---

## 14. Training

### 14.1 User Training

**Topics:**
- Password security and MFA usage
- Recognizing phishing and social engineering
- Proper use of access credentials
- Reporting suspicious activity
- Acceptable use of systems

**Frequency:**
- Onboarding: Within first week of employment
- Annual: Mandatory refresher training
- Ad-hoc: After security incidents or policy changes

### 14.2 Admin Training

**Additional Topics:**
- Privileged access management
- Secure configuration practices
- Incident response procedures
- Audit and compliance requirements

**Frequency:**
- Onboarding: Before admin access granted
- Quarterly: Security updates and best practices

---

## 15. Policy Enforcement

### 15.1 Violations

Access control policy violations will result in disciplinary action:

- **First Violation**: Written warning, mandatory retraining
- **Second Violation**: Suspension of access privileges
- **Third Violation**: Termination of employment or contract
- **Severe Violations**: Immediate termination, possible legal action

### 15.2 Reporting

- Users must report suspected violations immediately
- Anonymous reporting available via security hotline
- No retaliation for good-faith reporting
- Whistleblower protections apply

---

## 16. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Chief Executive Officer (CEO)** | [To be assigned] | _________________ | __________ |
| **Chief Information Security Officer (CISO)** | [To be assigned] | _________________ | __________ |
| **Chief Technology Officer (CTO)** | [To be assigned] | _________________ | __________ |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-23 | Security Team | Initial policy creation |

---

**For questions or clarifications regarding this policy, contact:**

**Chief Information Security Officer (CISO)**  
Email: security@africanfintech.com  
Phone: [To be assigned]
