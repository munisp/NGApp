# API Documentation

This document provides comprehensive reference documentation for the Payment Switch Participant Onboarding Portal API. The API is built using tRPC, providing end-to-end type safety and automatic client generation.

## Overview

The API is organized into logical routers corresponding to different functional areas of the portal. All endpoints require authentication via Manus OAuth unless explicitly marked as public. The API uses JSON for request and response payloads with automatic validation through Zod schemas.

## Authentication

### OAuth Flow

Users authenticate through Manus OAuth, which redirects to the OAuth provider, handles the callback at `/api/oauth/callback`, and establishes a session cookie. The session cookie is automatically included in subsequent requests from the web application.

### Session Management

Sessions are stored as signed JWT tokens in HTTP-only cookies with the name defined in `COOKIE_NAME`. Session expiration is managed server-side with automatic renewal on activity. To log out, call the `auth.logout` mutation which clears the session cookie.

### Authorization

Protected procedures require a valid session. Admin procedures additionally require the user to have the `admin` role. Authorization is enforced server-side through tRPC middleware that validates the session and user role before executing the procedure.

## Merchant Router

Handles participant registration, profile management, and merchant data operations.

### createMerchant

Creates a new merchant participant registration.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  organizationName: string;
  businessType: 'bank' | 'payment_service_provider' | 'merchant' | 'fintech';
  registrationNumber: string;
  taxId: string;
  website?: string;
  description?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  address: string;
  city: string;
  postalCode: string;
  settlementCurrency: string;
  settlementBankName?: string;
  settlementAccountNumber?: string;
}
```

**Output**:
```typescript
{
  id: number;
  organizationName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}
```

### updateMerchant

Updates an existing merchant profile.

**Type**: Mutation  
**Auth**: Protected  
**Input**: Same as createMerchant with additional `id: number` field  
**Output**: Updated merchant object

### getMerchant

Retrieves merchant details by ID.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ id: number }`  
**Output**: Complete merchant object with all fields

### listMerchants

Lists all merchants with pagination and filtering (admin only).

**Type**: Query  
**Auth**: Admin  
**Input**:
```typescript
{
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected';
  businessType?: 'bank' | 'payment_service_provider' | 'merchant' | 'fintech';
}
```

**Output**:
```typescript
{
  merchants: Merchant[];
  total: number;
  page: number;
  limit: number;
}
```

## Technical Onboarding Router

Manages technical configuration, security credentials, network settings, and compliance documentation.

### saveTechnicalConfig

Saves technical specifications for a participant.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  applicationId: number;
  apiEndpoint: string;
  apiVersion: string;
  supportedProtocols: string; // JSON array
  maxTransactionAmount: number;
  dailyTransactionLimit: number;
  supportedCurrencies: string; // JSON array
  supportedPaymentMethods: string; // JSON array
  webhookUrl?: string;
  callbackUrl?: string;
  ipWhitelist?: string; // JSON array
  rateLimitPerMinute?: number;
  timeoutSeconds?: number;
  retryPolicy?: string; // JSON object
}
```

**Output**: `{ id: number; status: string }`

### saveSecurityCredentials

Saves security credentials including certificates and API keys.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  applicationId: number;
  sslCertificate?: string;
  sslCertificateExpiry?: Date;
  apiKeyPrefix?: string;
  publicKey?: string;
  encryptionAlgorithm?: string;
  hashingAlgorithm?: string;
  tokenExpiry?: number;
  mfaEnabled: boolean;
  ipRestrictionEnabled: boolean;
}
```

**Output**: `{ id: number }`

### saveNetworkConfig

Saves network configuration details.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  applicationId: number;
  vpnRequired: boolean;
  vpnType?: string;
  vpnEndpoint?: string;
  loadBalancerUrl?: string;
  primaryDataCenter?: string;
  backupDataCenter?: string;
  healthCheckEndpoint?: string;
  healthCheckInterval?: number;
}
```

**Output**: `{ id: number }`

### uploadComplianceDoc

Uploads a compliance document.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  applicationId: number;
  documentType: 'pci_dss' | 'soc2' | 'iso27001' | 'business_license' | 'other';
  documentName: string;
  documentUrl: string; // S3 URL after upload
  issueDate?: Date;
  expiryDate?: Date;
  issuingAuthority?: string;
}
```

**Output**: `{ id: number; status: string }`

### submitForReview

Submits technical onboarding for admin review.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ applicationId: number }`  
**Output**: `{ success: boolean; reviewId: number }`

### getTechnicalOnboarding

Retrieves technical onboarding data for an application.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ applicationId: number }`  
**Output**:
```typescript
{
  technicalConfig: TechnicalConfiguration | null;
  securityCredentials: SecurityCredentials | null;
  networkConfig: NetworkConfiguration | null;
  complianceDocuments: ComplianceDocument[];
  reviewStatus: 'pending' | 'approved' | 'rejected' | null;
}
```

### validateCertificate

Validates an SSL certificate.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ certificate: string }`  
**Output**: `{ valid: boolean; expiryDate?: Date; error?: string }`

### testEndpointConnectivity

Tests connectivity to an API endpoint.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ endpoint: string }`  
**Output**: `{ reachable: boolean; responseTime?: number; error?: string }`

### reviewTechnicalOnboarding (Admin)

Reviews and approves/rejects technical onboarding submission.

**Type**: Mutation  
**Auth**: Admin  
**Input**:
```typescript
{
  applicationId: number;
  status: 'approved' | 'rejected';
  comments?: string;
}
```

**Output**: `{ success: boolean }`

## Integration Router

Provides sandbox environment management and integration testing capabilities.

### provisionSandbox

Provisions a sandbox environment for a participant.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ credentialId: number }`  
**Output**:
```typescript
{
  environmentId: number;
  apiBaseUrl: string;
  sandboxId: string;
  status: 'active';
}
```

### getApiCredentials

Retrieves API credentials for sandbox or production.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ credentialId: number; environment: 'sandbox' | 'production' }`  
**Output**:
```typescript
{
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  baseUrl: string;
}
```

### runIntegrationTests

Executes integration test suite.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  credentialId: number;
  testSuite: string;
  configuration?: object;
}
```

**Output**: `{ executionId: number; status: 'running' }`

### getTestResults

Retrieves integration test results.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ executionId: number }`  
**Output**:
```typescript
{
  executionId: number;
  status: 'running' | 'passed' | 'failed';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
}
```

## Testing & Certification Router

Manages mandatory test scenarios and certification tracking.

### listTestScenarios

Lists available test scenarios.

**Type**: Query  
**Auth**: Protected  
**Output**:
```typescript
{
  scenarios: Array<{
    id: number;
    name: string;
    description: string;
    category: 'connectivity' | 'authentication' | 'transaction' | 'webhook' | 'security' | 'performance';
    isRequired: boolean;
    passingCriteria: string;
  }>;
}
```

### executeTest

Executes a specific test scenario.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  credentialId: number;
  scenarioId: number;
  testData?: object;
}
```

**Output**: `{ executionId: number; status: 'running' }`

### getTestExecution

Retrieves test execution details and results.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ executionId: number }`  
**Output**:
```typescript
{
  id: number;
  scenarioId: number;
  status: 'running' | 'passed' | 'failed';
  executionLog: string;
  errorMessage?: string;
  executedAt: Date;
  completedAt?: Date;
}
```

### getCertificationStatus

Retrieves overall certification status.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ credentialId: number }`  
**Output**:
```typescript
{
  overallStatus: 'not_started' | 'in_progress' | 'passed' | 'failed';
  requiredTests: number;
  completedTests: number;
  passedTests: number;
  failedTests: number;
  scenarios: Array<{
    scenarioId: number;
    name: string;
    status: 'not_started' | 'passed' | 'failed';
    lastExecuted?: Date;
  }>;
}
```

### saveComparison

Saves a test comparison for later reference.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  credentialId: number;
  comparisonName: string;
  testExecutionIds: number[]; // Array of 2 execution IDs
  notes?: string;
}
```

**Output**: `{ id: number; shareToken?: string }`

### getComparisons

Lists saved comparisons for a credential.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ credentialId: number }`  
**Output**: Array of saved comparison objects

### generateShareLink

Generates a shareable link for a comparison.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ comparisonId: number }`  
**Output**: `{ shareUrl: string; shareToken: string }`

### getSharedComparison

Retrieves a shared comparison (public endpoint).

**Type**: Query  
**Auth**: Public  
**Input**: `{ shareToken: string }`  
**Output**: Comparison details with test results

## Production Go-Live Router

Manages production credentials, monitoring, incidents, and alerts.

### requestProductionAccess

Requests production credentials after certification.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ applicationId: number }`  
**Output**: `{ requestId: number; status: 'pending' }`

### getProductionCredentials

Retrieves production API credentials (after approval).

**Type**: Query  
**Auth**: Protected  
**Input**: `{ credentialId: number }`  
**Output**:
```typescript
{
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  baseUrl: string;
  activatedAt: Date;
}
```

### initializeChecklist

Initializes go-live checklist for an application.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ applicationId: number }`  
**Output**: `{ checklistId: number }`

### updateChecklistItem

Updates a checklist item status.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  checklistId: number;
  itemKey: string;
  completed: boolean;
  notes?: string;
}
```

**Output**: `{ success: boolean }`

### getMonitoringData

Retrieves production monitoring metrics.

**Type**: Query  
**Auth**: Protected  
**Input**:
```typescript
{
  credentialId: number;
  startDate?: Date;
  endDate?: Date;
}
```

**Output**:
```typescript
{
  metrics: Array<{
    timestamp: Date;
    transactionVolume: number;
    successRate: number;
    errorRate: number;
    avgResponseTime: number;
    systemUptime: number;
  }>;
}
```

### createIncident

Reports a production incident.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  credentialId: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'technical' | 'security' | 'operational' | 'compliance';
}
```

**Output**: `{ incidentId: number }`

### createAlertRule

Creates a monitoring alert rule.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  credentialId: number;
  ruleName: string;
  metricType: 'transaction_volume' | 'success_rate' | 'error_rate' | 'response_time' | 'system_uptime' | 'data_throughput';
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  thresholdValue: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}
```

**Output**: `{ ruleId: number }`

### getActiveAlerts

Retrieves currently active alerts.

**Type**: Query  
**Auth**: Protected  
**Input**: `{ credentialId: number }`  
**Output**: Array of active alert objects

### acknowledgeAlert

Acknowledges an alert.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ alertId: number }`  
**Output**: `{ success: boolean }`

### resolveAlert

Marks an alert as resolved.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ alertId: number }`  
**Output**: `{ success: boolean }`

### configureSlackWebhook

Configures Slack webhook for alert notifications.

**Type**: Mutation  
**Auth**: Protected  
**Input**:
```typescript
{
  credentialId: number;
  webhookUrl: string;
  channelName: string;
}
```

**Output**: `{ id: number; updated: boolean }`

### testSlackWebhook

Sends a test message to verify Slack configuration.

**Type**: Mutation  
**Auth**: Protected  
**Input**: `{ webhookUrl: string }`  
**Output**: `{ success: boolean; error?: string }`

## Error Handling

The API uses tRPC error codes to indicate different error conditions:

- `BAD_REQUEST`: Invalid input data or validation failure
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions for the operation
- `NOT_FOUND`: Requested resource does not exist
- `INTERNAL_SERVER_ERROR`: Unexpected server error

Error responses include a message describing the error and may include additional context in the `data` field.

## Rate Limiting

API endpoints are rate limited to prevent abuse. The default limit is 100 requests per minute per user. Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when the limit resets

When rate limits are exceeded, the API returns a `429 Too Many Requests` error.

## Versioning

The API follows semantic versioning. The current version is included in the API base URL. Breaking changes will result in a new major version. Backward-compatible additions will increment the minor version.

## Support

For API support or to report issues, contact the development team through the incident reporting system or email support. API status and maintenance windows are announced through the notification system.
