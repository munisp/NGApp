# KYC/KYB RBAC Architecture

## Overview

Role-Based Access Control (RBAC) implementation for 27 KYC/KYB API endpoints using Keycloak for authentication and Permify for fine-grained authorization.

## Roles Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    System Administrator                  │
│              (Full access to all operations)             │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐ ┌────▼─────────┐ ┌───▼──────────────┐
│ Compliance     │ │   KYC         │ │   Risk           │
│ Officer        │ │   Analyst     │ │   Manager        │
│                │ │               │ │                  │
│ • AML Review   │ │ • Document    │ │ • Risk Review    │
│ • PEP Review   │ │   Verification│ │ • Score Override │
│ • Sanctions    │ │ • Liveness    │ │ • DD Level       │
└────────────────┘ └───────────────┘ └──────────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                ┌────────▼────────┐
                │   KYC Operator  │
                │                 │
                │ • View Only     │
                │ • Basic Checks  │
                └─────────────────┘
```

## Role Definitions

### 1. System Administrator
**Description**: Full system access for platform administrators

**Permissions**:
- All KYC/KYB operations
- User management
- Configuration changes
- Audit log access
- System monitoring

**Use Cases**:
- Platform setup and configuration
- Emergency interventions
- System maintenance
- Troubleshooting

### 2. Compliance Officer
**Description**: Regulatory compliance and AML oversight

**Permissions**:
- View all AML screenings
- Initiate AML screenings
- Review AML hits
- Access sanctions lists
- View PEP checks
- Generate compliance reports
- View risk scores (read-only)

**Use Cases**:
- AML/CFT compliance
- Regulatory reporting
- Sanctions screening
- PEP monitoring

### 3. KYC Analyst
**Description**: Identity verification and document review

**Permissions**:
- Initiate document verification
- View document verification results
- Initiate liveness checks
- View liveness check results
- Match faces
- Extract document features
- View customer verification history

**Use Cases**:
- Customer onboarding
- Identity verification
- Document review
- Liveness verification

### 4. Risk Manager
**Description**: Risk assessment and decision making

**Permissions**:
- Calculate risk scores
- View risk scores
- View risk factors
- Override risk levels (with audit)
- Adjust DD levels
- View customer risk history
- Generate risk reports

**Use Cases**:
- Risk assessment
- Due diligence level assignment
- Risk-based decision making
- Portfolio risk management

### 5. KYC Operator
**Description**: Basic operational tasks

**Permissions**:
- View document verification status
- View liveness check status
- View AML screening status (summary only)
- View risk scores (read-only)
- No write operations

**Use Cases**:
- Customer support
- Status inquiries
- Basic reporting

## API Endpoint Permissions Matrix

### Liveness Detection Service (9 endpoints)

| Endpoint | Method | System Admin | Compliance Officer | KYC Analyst | Risk Manager | KYC Operator |
|----------|--------|--------------|-------------------|-------------|--------------|--------------|
| `/api/v1/liveness/check` | POST | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/api/v1/liveness/{id}` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/liveness/customer/{id}` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/liveness/match-faces` | POST | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/api/v1/liveness/extract-features` | POST | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/health` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |

### AML Screening Service (9 endpoints)

| Endpoint | Method | System Admin | Compliance Officer | KYC Analyst | Risk Manager | KYC Operator |
|----------|--------|--------------|-------------------|-------------|--------------|--------------|
| `/api/v1/aml/screen` | POST | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/aml/screening/{id}` | GET | ✅ | ✅ | ✅ | ✅ | ✅ (summary) |
| `/api/v1/aml/customer/{id}/screenings` | GET | ✅ | ✅ | ✅ | ✅ | ✅ (summary) |
| `/health` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |

### Risk Scoring Service (9 endpoints)

| Endpoint | Method | System Admin | Compliance Officer | KYC Analyst | Risk Manager | KYC Operator |
|----------|--------|--------------|-------------------|-------------|--------------|--------------|
| `/api/v1/risk/score` | POST | ✅ | ❌ | ❌ | ✅ | ❌ |
| `/api/v1/risk/score/{id}` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/risk/customer/{id}/scores` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/risk/customer/{id}/latest` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/health` | GET | ✅ | ✅ | ✅ | ✅ | ✅ |

## Permission Actions

### Liveness Service
- `liveness.check.create` - Initiate liveness check
- `liveness.check.read` - View liveness check results
- `liveness.face.match` - Match faces
- `liveness.features.extract` - Extract facial features

### AML Service
- `aml.screen.create` - Initiate AML screening
- `aml.screen.read` - View AML screening results
- `aml.screen.read.summary` - View summary only (no sensitive details)

### Risk Service
- `risk.score.create` - Calculate risk score
- `risk.score.read` - View risk scores
- `risk.score.override` - Override risk level (audit logged)

## Resource Ownership

### Customer Data Isolation
- Users can only access customers within their organization
- Multi-tenant isolation enforced at database level
- Permify checks organization membership

### Hierarchical Access
- Managers can access subordinate analyst data
- Compliance officers have cross-team visibility
- System admins have global access

## Audit Requirements

All privileged operations must be audited:
- Risk score overrides
- AML screening initiations
- Sensitive data access
- Configuration changes

Audit log includes:
- User ID
- Role
- Action
- Resource
- Timestamp
- IP address
- Result (success/failure)

## Security Controls

### Authentication (Keycloak)
- OAuth2/OIDC
- Multi-factor authentication (MFA)
- Session management
- Token refresh

### Authorization (Permify)
- Fine-grained permissions
- Attribute-based access control (ABAC)
- Relationship-based access control (ReBAC)
- Policy evaluation caching

### Rate Limiting
- Per role limits
- Per endpoint limits
- Burst protection

### Data Masking
- PII masking for KYC Operators
- Sensitive field redaction
- Role-based field visibility
