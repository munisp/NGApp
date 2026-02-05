# Data Protection Policy

**Document Version:** 1.0  
**Effective Date:** January 23, 2026  
**Last Review Date:** January 23, 2026  
**Next Review Date:** January 23, 2027  
**Owner:** Data Protection Officer (DPO)  
**Classification:** Internal

---

## 1. Purpose

This Data Protection Policy establishes the framework for protecting personal data processed by the African Fintech Mobile App platform in compliance with the General Data Protection Regulation (GDPR), local African data protection laws, and industry best practices. This policy ensures that personal data is collected, processed, stored, and disposed of in a lawful, fair, and transparent manner.

---

## 2. Scope

This policy applies to:

- All personal data processed by the organization
- All employees, contractors, and third-party processors
- All systems, applications, and databases containing personal data
- All data processing activities, regardless of location

---

## 3. Legal Basis

The organization processes personal data under the following legal bases:

- **Consent**: Explicit consent for marketing communications and optional features
- **Contract**: Processing necessary for KYC verification and financial services
- **Legal Obligation**: Compliance with AML/CFT and financial regulations
- **Legitimate Interest**: Fraud prevention, security monitoring, service improvement

---

## 4. Data Protection Principles

### 4.1 Lawfulness, Fairness, and Transparency

Personal data is processed lawfully, fairly, and in a transparent manner. Data subjects are informed about data collection and processing activities through clear privacy notices.

### 4.2 Purpose Limitation

Personal data is collected for specified, explicit, and legitimate purposes and not further processed in a manner incompatible with those purposes.

### 4.3 Data Minimization

Only personal data that is adequate, relevant, and limited to what is necessary for the processing purposes is collected.

### 4.4 Accuracy

Personal data is accurate and, where necessary, kept up to date. Reasonable steps are taken to ensure inaccurate data is erased or rectified without delay.

### 4.5 Storage Limitation

Personal data is kept in a form that permits identification of data subjects for no longer than necessary for the purposes for which the data is processed.

### 4.6 Integrity and Confidentiality

Personal data is processed in a manner that ensures appropriate security, including protection against unauthorized or unlawful processing and against accidental loss, destruction, or damage.

### 4.7 Accountability

The organization is responsible for and able to demonstrate compliance with all data protection principles.

---

## 5. Data Subject Rights

### 5.1 Right to Be Informed

**Implementation:**
- Privacy notice provided at data collection
- Clear explanation of processing purposes
- Information about data retention periods
- Contact details for DPO

**Response Time:** Privacy notice provided immediately at collection

### 5.2 Right of Access

**Implementation:**
- Data subjects can request a copy of their personal data
- Provided in commonly used electronic format
- Includes information about processing purposes and recipients

**Response Time:** 30 days from request

### 5.3 Right to Rectification

**Implementation:**
- Data subjects can request correction of inaccurate data
- Supplementary information can be added
- Third parties notified of corrections where applicable

**Response Time:** 30 days from request

### 5.4 Right to Erasure ("Right to be Forgotten")

**Implementation:**
- Data subjects can request deletion of personal data
- Applies when data no longer necessary for original purpose
- Exceptions: Legal obligations, public interest, legal claims

**Response Time:** 30 days from request

### 5.5 Right to Restrict Processing

**Implementation:**
- Data subjects can request restriction of processing
- Data can be stored but not processed
- Applies during accuracy disputes or objection periods

**Response Time:** 30 days from request

### 5.6 Right to Data Portability

**Implementation:**
- Data subjects can receive personal data in structured, machine-readable format
- Data can be transmitted to another controller
- Applies to data provided by data subject

**Response Time:** 30 days from request

### 5.7 Right to Object

**Implementation:**
- Data subjects can object to processing based on legitimate interests
- Automatic cessation unless compelling legitimate grounds exist
- Absolute right to object to direct marketing

**Response Time:** Immediate for marketing, 30 days for other objections

### 5.8 Rights Related to Automated Decision-Making

**Implementation:**
- Data subjects informed of automated decision-making
- Right to human review of automated decisions
- Right to contest automated decisions

**Response Time:** 30 days from request

---

## 6. Data Processing Activities

### 6.1 Data Collection

**Personal Data Collected:**

| Data Category | Data Elements | Purpose | Legal Basis |
|---------------|---------------|---------|-------------|
| **Identity Data** | Name, date of birth, nationality, ID number | KYC verification | Legal obligation |
| **Contact Data** | Email, phone number, address | Communication, service delivery | Contract |
| **Financial Data** | Transaction history, account balance | Financial services | Contract |
| **Biometric Data** | Facial image, liveness detection | Identity verification | Legal obligation |
| **Device Data** | IP address, device ID, OS version | Security, fraud prevention | Legitimate interest |
| **Usage Data** | App interactions, feature usage | Service improvement | Legitimate interest |

**Collection Methods:**
- Direct collection via mobile app
- Automated collection via analytics
- Third-party sources (credit bureaus, identity verification services)

### 6.2 Data Processing

**Processing Activities:**

| Activity | Purpose | Data Categories | Retention |
|----------|---------|-----------------|-----------|
| **KYC Verification** | Identity verification, AML compliance | Identity, biometric, contact | 7 years |
| **Transaction Processing** | Financial services | Financial, identity, contact | 7 years |
| **Fraud Detection** | Security, risk management | All categories | 2 years |
| **Customer Support** | Service delivery | Identity, contact, usage | 2 years |
| **Marketing** | Product promotion (consent-based) | Contact | Until consent withdrawn |
| **Analytics** | Service improvement | Usage, device (anonymized) | 2 years |

### 6.3 Data Sharing

**Third-Party Recipients:**

| Recipient | Purpose | Data Shared | Safeguards |
|-----------|---------|-------------|------------|
| **Cloud Providers** | Infrastructure hosting | All data (encrypted) | DPA, SOC 2 certification |
| **Payment Processors** | Payment processing | Financial data | PCI DSS compliance |
| **Identity Verification** | KYC verification | Identity, biometric | DPA, GDPR compliance |
| **Analytics Providers** | Usage analytics | Anonymized usage data | DPA, data minimization |
| **Regulators** | Legal compliance | As required by law | Legal obligation |

**Data Transfer Mechanisms:**
- Standard Contractual Clauses (SCCs) for EU transfers
- Adequacy decisions where applicable
- Binding Corporate Rules (BCRs) for intra-group transfers

---

## 7. Data Security

### 7.1 Technical Measures

**Encryption:**
- **At Rest**: AES-256 encryption for all databases and file storage
- **In Transit**: TLS 1.3 for all network communications
- **End-to-End**: Available for sensitive communications

**Access Controls:**
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) for admin accounts
- Principle of least privilege
- Quarterly access reviews

**Monitoring:**
- 24/7 security monitoring via Wazuh SIEM
- Automated threat detection
- Real-time alerts for suspicious activity
- Comprehensive audit logging

### 7.2 Organizational Measures

**Policies and Procedures:**
- Information Security Policy
- Access Control Policy
- Incident Response Policy
- Data Breach Response Plan

**Training:**
- Annual data protection training for all staff
- Specialized training for data processors
- Regular security awareness campaigns

**Vendor Management:**
- Due diligence before onboarding
- Data Processing Agreements (DPAs) with all processors
- Annual security assessments
- Right to audit vendor controls

---

## 8. Data Retention and Disposal

### 8.1 Retention Periods

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| **KYC Documents** | 7 years after account closure | AML/CFT regulations |
| **Transaction Records** | 7 years after transaction | Financial regulations |
| **Customer Support Records** | 2 years after resolution | Service quality, legal claims |
| **Marketing Data** | Until consent withdrawn | Consent-based processing |
| **Audit Logs** | 2 years | Security monitoring |
| **Backup Data** | 30 days | Disaster recovery |

### 8.2 Disposal Procedures

**Electronic Data:**
- Cryptographic erasure for encrypted data
- Secure deletion (DoD 5220.22-M standard)
- Verification of deletion completion
- Deletion certificates retained for 2 years

**Physical Media:**
- Degaussing for magnetic media
- Physical destruction (shredding, pulverization)
- Certificate of destruction obtained
- Destruction witnessed and documented

**Backup Data:**
- Backups deleted after retention period
- Restoration testing before deletion
- Deletion verified across all backup locations

---

## 9. Data Breach Management

### 9.1 Breach Detection

**Monitoring:**
- 24/7 security monitoring
- Automated anomaly detection
- User-reported incidents
- Third-party notifications

**Indicators:**
- Unauthorized access to personal data
- Accidental disclosure of personal data
- Loss or theft of devices containing personal data
- Ransomware or malware infections

### 9.2 Breach Response

**Immediate Actions (0-1 hour):**
1. Contain the breach (isolate affected systems)
2. Notify incident response team
3. Preserve evidence for investigation
4. Assess scope and severity

**Short-Term Actions (1-24 hours):**
1. Conduct detailed investigation
2. Determine data subjects affected
3. Assess risk to data subjects
4. Notify DPO and senior management

**Regulatory Notification (within 72 hours):**
- Notify supervisory authority if high risk to data subjects
- Provide description of breach
- Describe likely consequences
- Describe measures taken or proposed

**Data Subject Notification (without undue delay):**
- Notify affected data subjects if high risk
- Describe nature of breach in clear language
- Provide contact point for further information
- Describe likely consequences and mitigation measures

### 9.3 Post-Breach Activities

**Documentation:**
- Document all breach details
- Record actions taken
- Maintain breach register
- Report to management and board

**Lessons Learned:**
- Conduct post-incident review within 7 days
- Identify root cause
- Implement corrective actions
- Update policies and procedures

---

## 10. Privacy by Design and Default

### 10.1 Privacy by Design

**Implementation:**
- Privacy considerations in all new projects
- Data Protection Impact Assessments (DPIAs) for high-risk processing
- Privacy requirements in system design
- Regular privacy reviews

**Principles:**
- Proactive not reactive
- Privacy as default setting
- Privacy embedded into design
- Full functionality (positive-sum, not zero-sum)
- End-to-end security
- Visibility and transparency
- Respect for user privacy

### 10.2 Privacy by Default

**Implementation:**
- Minimal data collection by default
- Shortest retention periods by default
- Strictest privacy settings by default
- Opt-in for non-essential processing

---

## 11. Data Protection Impact Assessment (DPIA)

### 11.1 When Required

DPIAs are mandatory for:
- Systematic and extensive profiling
- Large-scale processing of special category data
- Systematic monitoring of publicly accessible areas
- New technologies with high privacy risk

### 11.2 DPIA Process

**Steps:**
1. **Describe Processing**: Purpose, scope, data flows
2. **Assess Necessity**: Justify processing and proportionality
3. **Identify Risks**: Risks to data subjects' rights and freedoms
4. **Mitigation Measures**: Technical and organizational measures
5. **Consultation**: Consult DPO and data subjects where appropriate
6. **Approval**: Senior management approval required
7. **Review**: Annual review or when processing changes

**Documentation:**
- DPIA report maintained for each high-risk processing activity
- DPO consulted throughout process
- Supervisory authority consulted if high residual risk

---

## 12. International Data Transfers

### 12.1 Transfer Mechanisms

**Adequacy Decisions:**
- Transfers to countries with adequacy decisions (e.g., UK, Switzerland)
- No additional safeguards required

**Standard Contractual Clauses (SCCs):**
- SCCs signed with all non-adequate country processors
- Supplementary measures implemented where necessary
- Transfer Impact Assessments (TIAs) conducted

**Binding Corporate Rules (BCRs):**
- BCRs for intra-group transfers
- Approved by lead supervisory authority

### 12.2 Transfer Restrictions

**Prohibited Transfers:**
- No transfers to countries without adequate protection
- No transfers without appropriate safeguards
- No transfers for surveillance purposes

**Monitoring:**
- All international transfers logged
- Quarterly review of transfer mechanisms
- Annual assessment of third-country laws

---

## 13. Children's Data

### 13.1 Age Verification

**Requirements:**
- Minimum age: 18 years for financial services
- Age verification during registration
- Parental consent required for users under 18 (where applicable)

**Implementation:**
- Date of birth collected during registration
- ID verification confirms age
- Account creation blocked for underage users

### 13.2 Special Protections

**Enhanced Measures:**
- Additional privacy protections for minors
- No profiling or targeted advertising for minors
- Enhanced parental controls
- Simplified privacy notices for minors

---

## 14. Roles and Responsibilities

### 14.1 Data Protection Officer (DPO)

**Responsibilities:**
- Monitor compliance with GDPR and local laws
- Advise on data protection obligations
- Conduct DPIAs
- Cooperate with supervisory authorities
- Act as contact point for data subjects

**Independence:**
- Reports directly to highest management level
- No instructions regarding performance of tasks
- No dismissal or penalty for performing tasks

### 14.2 Data Controllers

**Responsibilities:**
- Determine purposes and means of processing
- Ensure lawful processing
- Implement appropriate technical and organizational measures
- Maintain records of processing activities
- Demonstrate compliance

### 14.3 Data Processors

**Responsibilities:**
- Process data only on controller's instructions
- Implement appropriate security measures
- Assist controller with data subject requests
- Notify controller of data breaches
- Delete or return data after processing

### 14.4 All Employees

**Responsibilities:**
- Protect personal data
- Follow data protection policies
- Report data breaches immediately
- Complete data protection training
- Respect data subject rights

---

## 15. Compliance and Audit

### 15.1 Compliance Monitoring

**Activities:**
- Quarterly compliance audits
- Annual external assessment
- Continuous monitoring via SIEM
- Regular policy reviews

**Metrics:**
- Data subject request response times
- Data breach notification times
- DPIA completion rates
- Training completion rates

### 15.2 Records of Processing Activities

**Maintained Records:**
- Name and contact details of controller and DPO
- Purposes of processing
- Categories of data subjects and personal data
- Categories of recipients
- International data transfers
- Retention periods
- Security measures

**Review:** Records reviewed and updated quarterly

---

## 16. Training and Awareness

### 16.1 General Training

**Topics:**
- Data protection principles
- Data subject rights
- Security best practices
- Breach reporting procedures

**Frequency:**
- Onboarding: Within first week
- Annual: Mandatory refresher
- Ad-hoc: After policy changes or incidents

### 16.2 Specialized Training

**Role-Specific Training:**
- **DPO**: Advanced GDPR training, certification
- **Developers**: Privacy by design, secure coding
- **Support Staff**: Data subject request handling
- **Managers**: Privacy impact assessments

---

## 17. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Chief Executive Officer (CEO)** | [To be assigned] | _________________ | __________ |
| **Data Protection Officer (DPO)** | [To be assigned] | _________________ | __________ |
| **Chief Information Security Officer (CISO)** | [To be assigned] | _________________ | __________ |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-23 | DPO | Initial policy creation |

---

**For questions or clarifications regarding this policy, contact:**

**Data Protection Officer (DPO)**  
Email: dpo@africanfintech.com  
Phone: [To be assigned]
