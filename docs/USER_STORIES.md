# 30 User Stories for Payment Switch Platform

## Overview

These user stories are based on **existing implemented features** in the platform. Each story leverages real database tables, UI pages, and API endpoints that are already built. Stories are grouped by user persona and include implementation status.

---

## Merchant User Stories

### US-001: Merchant Onboarding Journey
**As a** new merchant  
**I want to** complete the participant onboarding process  
**So that** I can start accepting payments on my website

**Existing Features Used:**
- ✅ `participantApplications` table
- ✅ `OnboardingHome` page
- ✅ `TechnicalOnboarding` page
- ✅ `merchants` table
- ✅ Merchant router

**Journey Steps:**
1. Submit application with business details
2. Technical onboarding review (admin approval)
3. Receive API credentials
4. Configure integration environment
5. Complete testing & certification
6. Production go-live

**Missing Features:**
- ❌ Email verification workflow
- ❌ Document upload for KYC
- ❌ Automated approval workflow

---

### US-002: API Key Management
**As a** merchant  
**I want to** create and manage multiple API keys with different permissions  
**So that** I can securely integrate different services

**Existing Features Used:**
- ✅ `apiCredentials` table
- ✅ `apiKeyPermissions` table
- ✅ `apiKeyHistory` table
- ✅ `DeveloperPortal` page
- ✅ `apiKeys` router

**Journey Steps:**
1. Navigate to Developer Portal
2. Create new API key with specific permissions
3. Copy API key and secret
4. Test API key in sandbox environment
5. Monitor API key usage statistics
6. Rotate API key when needed

**Missing Features:**
- None - fully implemented

---

### US-003: Customize Checkout Branding
**As a** merchant  
**I want to** customize the checkout page appearance  
**So that** it matches my brand identity

**Existing Features Used:**
- ✅ `merchants` table (branding columns)
- ✅ `BrandingSettings` page
- ✅ `BrandingPreview` page
- ✅ `previewSessions` table

**Journey Steps:**
1. Navigate to Branding Settings
2. Upload logo
3. Select primary and secondary colors
4. Choose font family
5. Adjust border radius
6. Preview changes in real-time
7. Generate shareable preview link
8. Save branding configuration

**Missing Features:**
- None - fully implemented

---

### US-004: Monitor Transaction Analytics
**As a** merchant  
**I want to** view real-time transaction analytics  
**So that** I can track business performance

**Existing Features Used:**
- ✅ `transactions` table
- ✅ `Analytics` page
- ✅ `Dashboard` page
- ✅ Transaction analytics endpoints

**Journey Steps:**
1. Navigate to Analytics dashboard
2. View transaction volume chart
3. Analyze revenue over time
4. Check payment method distribution
5. Review transaction status breakdown
6. Filter by date range
7. Export data for reporting

**Missing Features:**
- ❌ CSV/Excel export functionality
- ❌ Scheduled report delivery

---

### US-005: Configure Webhooks
**As a** merchant  
**I want to** set up webhook endpoints  
**So that** I receive real-time payment notifications

**Existing Features Used:**
- ✅ `webhooks` table
- ✅ `webhookEvents` table
- ✅ `webhookDeliveryLogs` table
- ✅ Webhook configuration UI
- ✅ Webhook router

**Journey Steps:**
1. Navigate to Webhook settings
2. Add webhook endpoint URL
3. Select events to subscribe to
4. Generate webhook secret
5. Test webhook delivery
6. Monitor webhook delivery logs
7. Retry failed deliveries

**Missing Features:**
- None - fully implemented

---

### US-006: Manage Refunds
**As a** merchant  
**I want to** process full and partial refunds  
**So that** I can handle customer returns

**Existing Features Used:**
- ✅ `refunds` table
- ✅ `transactions` table
- ✅ Refund processing endpoint
- ✅ Dashboard refund management

**Journey Steps:**
1. Navigate to Transactions
2. Select transaction to refund
3. Choose full or partial refund
4. Enter refund amount and reason
5. Confirm refund
6. Track refund status
7. Receive webhook notification when complete

**Missing Features:**
- ❌ Bulk refund processing
- ❌ Refund approval workflow (for large amounts)

---

### US-007: Integration Testing
**As a** merchant developer  
**I want to** test my integration in sandbox environment  
**So that** I can verify functionality before going live

**Existing Features Used:**
- ✅ `integrationEnvironments` table
- ✅ `integrationTests` table
- ✅ `testScenarios` table
- ✅ `testExecutions` table
- ✅ `IntegrationDevelopment` page
- ✅ `TestingCertification` page

**Journey Steps:**
1. Access sandbox environment
2. Download SDK for preferred language
3. Create test payment session
4. Execute test scenarios
5. Review test results
6. Fix integration issues
7. Schedule automated test runs
8. Complete certification checklist

**Missing Features:**
- None - fully implemented

---

### US-008: Production Go-Live
**As a** merchant  
**I want to** deploy my integration to production  
**So that** I can start processing real payments

**Existing Features Used:**
- ✅ `goLiveChecklist` table
- ✅ `productionCredentials` table
- ✅ `productionMonitoring` table
- ✅ `ProductionGoLive` page

**Journey Steps:**
1. Complete all sandbox testing
2. Review go-live checklist
3. Submit production access request
4. Receive production API credentials
5. Configure production webhook
6. Enable production monitoring
7. Process first live transaction
8. Monitor production metrics

**Missing Features:**
- ❌ Automated go-live approval
- ❌ Production readiness score

---

### US-009: Set Up Rate Alerts
**As a** merchant processing international payments  
**I want to** receive alerts when exchange rates are favorable  
**So that** I can optimize currency conversion timing

**Existing Features Used:**
- ✅ `alertNotifications` table
- ✅ `monitoringAlertRules` table
- ✅ `RateAlerts` page
- ✅ `RateAlertAnalytics` page
- ✅ `rateAlertRouter`

**Journey Steps:**
1. Navigate to Rate Alerts
2. Select currency pair
3. Set target exchange rate
4. Choose notification channel (email/SMS/Slack)
5. Enable alert
6. Receive notification when rate is met
7. View rate trend analytics
8. Adjust alert thresholds

**Missing Features:**
- None - fully implemented

---

### US-010: Review Compliance Documents
**As a** merchant  
**I want to** upload and manage compliance documents  
**So that** I meet regulatory requirements

**Existing Features Used:**
- ✅ `complianceDocuments` table
- ✅ `complianceChecks` table
- ✅ `ocrCorrectionPatterns` table
- ✅ `ocrFeedback` table
- ✅ OCR processing

**Journey Steps:**
1. Navigate to Compliance section
2. Upload required documents (business license, tax ID, etc.)
3. OCR automatically extracts document data
4. Review and correct OCR results
5. Submit for compliance check
6. Track compliance status
7. Receive approval/rejection notification

**Missing Features:**
- ❌ Document expiry tracking
- ❌ Automated renewal reminders

---

## Customer User Stories

### US-011: Complete Card Payment
**As a** customer  
**I want to** pay with my credit/debit card  
**So that** I can complete my purchase

**Existing Features Used:**
- ✅ `paymentSessions` table
- ✅ `transactions` table
- ✅ `Checkout` page
- ✅ Payment processing endpoint
- ✅ 3D Secure flow

**Journey Steps:**
1. Click "Pay Now" on merchant website
2. Redirected to hosted checkout page
3. See merchant branding
4. Enter card details
5. Complete 3D Secure authentication
6. Fraud detection check
7. Payment authorization
8. Redirect to success page
9. Receive email receipt

**Missing Features:**
- ❌ Email receipt generation
- ❌ Customer portal to view transaction history
- ❌ Save card for future use

---

### US-012: Pay with Bank Transfer
**As a** customer  
**I want to** pay via bank transfer  
**So that** I can avoid card fees

**Existing Features Used:**
- ✅ `paymentSessions` table
- ✅ `transactions` table
- ✅ `Checkout` page (payment method selection)
- ✅ Payment method enum includes `bank_transfer`

**Journey Steps:**
1. Select "Bank Transfer" payment method
2. View bank account details
3. Complete transfer via online banking
4. Upload transfer receipt
5. Payment verification
6. Confirmation notification

**Missing Features:**
- ❌ Bank transfer verification workflow
- ❌ Receipt upload functionality
- ❌ Automated bank statement reconciliation

---

### US-013: Pay with QR Code
**As a** customer  
**I want to** pay by scanning a QR code  
**So that** I can use my mobile wallet

**Existing Features Used:**
- ✅ `paymentSessions` table
- ✅ `transactions` table
- ✅ `Checkout` page
- ✅ Payment method enum includes `qr_code`

**Journey Steps:**
1. Select "QR Code" payment method
2. QR code displayed on checkout page
3. Scan QR code with mobile wallet app
4. Confirm payment in wallet app
5. Real-time payment status update
6. Redirect to success page

**Missing Features:**
- ❌ QR code generation service
- ❌ Mobile wallet integration (Alipay, WeChat Pay, etc.)
- ❌ Real-time payment status websocket

---

### US-014: Recover Failed Payment
**As a** customer  
**I want to** retry a failed payment  
**So that** I can complete my purchase without starting over

**Existing Features Used:**
- ✅ `paymentSessions` table
- ✅ `transactions` table
- ✅ Transaction status tracking
- ✅ Error code and message storage

**Journey Steps:**
1. Payment fails (insufficient funds, card declined, etc.)
2. View error message
3. Click "Try Again"
4. Update payment details
5. Retry payment
6. Success or alternative payment method

**Missing Features:**
- ❌ Payment retry UI component
- ❌ Alternative payment method suggestion

---

### US-015: Track Remittance Transfer
**As a** customer sending money abroad  
**I want to** track my remittance transfer  
**So that** I know when funds will arrive

**Existing Features Used:**
- ✅ `RemittanceDemo` page
- ✅ `remittanceRouter`
- ✅ Transaction tracking

**Journey Steps:**
1. Initiate remittance transfer
2. Enter recipient details
3. Select currency and amount
4. View exchange rate and fees
5. Confirm transfer
6. Track transfer status
7. Receive notification when complete
8. Recipient receives funds

**Missing Features:**
- ❌ Remittance transaction table
- ❌ Recipient management
- ❌ Transfer status tracking UI

---

## Admin User Stories

### US-016: Review Onboarding Applications
**As an** admin  
**I want to** review and approve merchant onboarding applications  
**So that** only legitimate merchants can join the platform

**Existing Features Used:**
- ✅ `participantApplications` table
- ✅ `technicalOnboardingReviews` table
- ✅ `TechnicalOnboardingReview` page
- ✅ Admin dashboard

**Journey Steps:**
1. Navigate to Admin Dashboard
2. View pending onboarding applications
3. Review business details
4. Check compliance documents
5. Verify technical integration
6. Approve or reject application
7. Send notification to merchant
8. Track application status

**Missing Features:**
- None - fully implemented

---

### US-017: Monitor Platform Health
**As an** admin  
**I want to** monitor system health and performance  
**So that** I can proactively address issues

**Existing Features Used:**
- ✅ `productionMonitoring` table
- ✅ `monitoringAlerts` table
- ✅ `monitoringAlertRules` table
- ✅ Admin dashboard

**Journey Steps:**
1. Navigate to Monitoring Dashboard
2. View system health metrics
3. Check transaction success rates
4. Monitor API response times
5. Review error rates
6. Investigate alerts
7. Acknowledge incidents
8. Track resolution

**Missing Features:**
- ❌ Real-time metrics dashboard
- ❌ Grafana/Prometheus integration UI

---

### US-018: Manage Account Recovery Requests
**As an** admin  
**I want to** review and approve account recovery requests  
**So that** users can regain access to their accounts securely

**Existing Features Used:**
- ✅ `accountRecoveryRequests` table
- ✅ `accountRecoveryAuditLog` table
- ✅ `RecoveryRequests` page (admin)
- ✅ `accountRecoveryRouter`

**Journey Steps:**
1. Navigate to Recovery Requests
2. View pending recovery requests
3. Verify user identity
4. Check recovery attempt history
5. Approve or reject request
6. Send recovery link to user
7. Log recovery action
8. Monitor for abuse

**Missing Features:**
- None - fully implemented

---

### US-019: Configure Notification Channels
**As an** admin  
**I want to** configure system-wide notification channels  
**So that** users receive alerts via their preferred method

**Existing Features Used:**
- ✅ `notificationChannels` table
- ✅ `notificationPreferences` table
- ✅ `notificationDeliveries` table
- ✅ `NotificationPreferences` page (admin)
- ✅ `notificationChannels` router

**Journey Steps:**
1. Navigate to Notification Settings
2. Configure email provider (SendGrid/SES)
3. Configure SMS provider (Twilio)
4. Configure Slack webhook
5. Set up notification templates
6. Test notification delivery
7. Enable/disable channels
8. Monitor delivery rates

**Missing Features:**
- None - fully implemented

---

### US-020: Manage Reminder Emails
**As an** admin  
**I want to** configure automated reminder emails  
**So that** merchants complete required actions

**Existing Features Used:**
- ✅ `reminderEmailConfig` table
- ✅ `reminderEmailLog` table
- ✅ `ReminderEmailManagement` page
- ✅ Email scheduling

**Journey Steps:**
1. Navigate to Reminder Email Management
2. Create reminder email template
3. Set trigger conditions (e.g., incomplete onboarding)
4. Configure send schedule
5. Enable reminder
6. Monitor email delivery
7. Track completion rates
8. Adjust reminder frequency

**Missing Features:**
- None - fully implemented

---

### US-021: Review Security Incidents
**As an** admin  
**I want to** review security incidents and suspicious activity  
**So that** I can protect the platform from fraud

**Existing Features Used:**
- ✅ `incidentReports` table
- ✅ `auditLogs` table
- ✅ `loginHistory` table
- ✅ Admin dashboard

**Journey Steps:**
1. Navigate to Security Dashboard
2. View recent security incidents
3. Investigate suspicious login attempts
4. Review audit logs
5. Block suspicious IP addresses
6. Suspend compromised accounts
7. Send security alerts
8. Document incident response

**Missing Features:**
- ❌ Security incident dashboard UI
- ❌ IP blocking interface
- ❌ Automated threat detection

---

### US-022: Configure OCR Correction Patterns
**As an** admin  
**I want to** manage OCR correction patterns  
**So that** document processing accuracy improves over time

**Existing Features Used:**
- ✅ `ocrCorrectionPatterns` table
- ✅ `ocrCorrectionSettings` table
- ✅ `ocrFeedback` table
- ✅ `CorrectionPatternsAdmin` page

**Journey Steps:**
1. Navigate to OCR Correction Patterns
2. Review OCR feedback from merchants
3. Identify common correction patterns
4. Create correction rules
5. Test pattern matching
6. Enable pattern
7. Monitor correction accuracy
8. Refine patterns based on feedback

**Missing Features:**
- None - fully implemented

---

## Developer User Stories

### US-023: Download SDK
**As a** developer  
**I want to** download the SDK for my programming language  
**So that** I can integrate payments quickly

**Existing Features Used:**
- ✅ `sdkDownloads` table
- ✅ `DeveloperPortal` page
- ✅ SDK download tracking

**Journey Steps:**
1. Navigate to Developer Portal
2. Browse available SDKs
3. Select preferred language (Node.js, Python, PHP, Ruby, etc.)
4. Download SDK package
5. View integration examples
6. Follow quickstart guide
7. Test integration in sandbox

**Missing Features:**
- ❌ SDK package hosting
- ❌ SDK version management
- ❌ Automated SDK generation

---

### US-024: Test API Endpoints
**As a** developer  
**I want to** test API endpoints in sandbox  
**So that** I can verify my integration

**Existing Features Used:**
- ✅ `integrationEnvironments` table
- ✅ `integrationTests` table
- ✅ `testExecutions` table
- ✅ `DeveloperPortal` page

**Journey Steps:**
1. Navigate to API Documentation
2. Select endpoint to test
3. View request/response examples
4. Use API playground to test
5. View test results
6. Save test scenarios
7. Schedule automated tests

**Missing Features:**
- ❌ Interactive API playground (Swagger/Postman-like)
- ❌ Request/response logging

---

### US-025: Monitor API Usage
**As a** developer  
**I want to** monitor my API usage and rate limits  
**So that** I can optimize my integration

**Existing Features Used:**
- ✅ `apiKeyUsageLogs` table
- ✅ `apiKeyUsageStats` table
- ✅ `DeveloperPortal` page
- ✅ Usage analytics

**Journey Steps:**
1. Navigate to API Usage Dashboard
2. View request count by endpoint
3. Check rate limit status
4. Analyze response times
5. Review error rates
6. Identify slow endpoints
7. Optimize API calls

**Missing Features:**
- None - fully implemented

---

### US-026: Configure Test Schedules
**As a** developer  
**I want to** schedule automated integration tests  
**So that** I can catch regressions early

**Existing Features Used:**
- ✅ `testSchedules` table
- ✅ `scheduledTestRuns` table
- ✅ `testExecutions` table
- ✅ Test scheduling UI

**Journey Steps:**
1. Navigate to Test Automation
2. Create test suite
3. Select test scenarios
4. Configure schedule (daily, weekly, etc.)
5. Enable notifications for failures
6. Run tests on demand
7. View test history
8. Debug failed tests

**Missing Features:**
- None - fully implemented

---

### US-027: Compare Configurations
**As a** developer  
**I want to** compare sandbox and production configurations  
**So that** I can ensure consistency

**Existing Features Used:**
- ✅ `savedComparisons` table
- ✅ `SharedComparisonView` page
- ✅ Configuration comparison tool

**Journey Steps:**
1. Navigate to Configuration Comparison
2. Select sandbox configuration
3. Select production configuration
4. View side-by-side comparison
5. Identify differences
6. Export comparison report
7. Save comparison for future reference

**Missing Features:**
- None - fully implemented

---

## Security User Stories

### US-028: Enable Two-Factor Authentication
**As a** merchant or admin  
**I want to** enable two-factor authentication  
**So that** my account is more secure

**Existing Features Used:**
- ✅ `users` table (2FA fields)
- ✅ `TwoFactorSettings` page
- ✅ `VerifyTwoFactor` page
- ✅ `twoFactorRouter`
- ✅ Backup codes

**Journey Steps:**
1. Navigate to Security Settings
2. Click "Enable 2FA"
3. Scan QR code with authenticator app
4. Enter verification code
5. Save backup codes
6. Enable 2FA
7. Test 2FA on next login
8. Manage trusted devices

**Missing Features:**
- None - fully implemented

---

### US-029: Manage Trusted Devices
**As a** user  
**I want to** manage my trusted devices  
**So that** I can control where I'm logged in

**Existing Features Used:**
- ✅ `trustedDevices` table
- ✅ `TrustedDevices` page
- ✅ `trustedDeviceRouter`
- ✅ Device fingerprinting

**Journey Steps:**
1. Navigate to Trusted Devices
2. View list of trusted devices
3. See device details (browser, OS, location, last used)
4. Remove untrusted devices
5. Require 2FA for new devices
6. Receive notification for new device login

**Missing Features:**
- None - fully implemented

---

### US-030: Review Account Activity
**As a** user  
**I want to** review my account activity and login history  
**So that** I can detect unauthorized access

**Existing Features Used:**
- ✅ `loginHistory` table
- ✅ `auditLogs` table
- ✅ `AccountActivity` page
- ✅ `accountActivityRouter`

**Journey Steps:**
1. Navigate to Account Activity
2. View recent login attempts
3. See IP addresses and locations
4. Check failed login attempts
5. Review account changes
6. Report suspicious activity
7. Initiate account recovery if compromised

**Missing Features:**
- None - fully implemented

---

## Implementation Summary

### Fully Implemented Stories (No Missing Features)
- US-002: API Key Management
- US-003: Customize Checkout Branding
- US-005: Configure Webhooks
- US-007: Integration Testing
- US-009: Set Up Rate Alerts
- US-016: Review Onboarding Applications
- US-018: Manage Account Recovery Requests
- US-019: Configure Notification Channels
- US-020: Manage Reminder Emails
- US-022: Configure OCR Correction Patterns
- US-025: Monitor API Usage
- US-026: Configure Test Schedules
- US-027: Compare Configurations
- US-028: Enable Two-Factor Authentication
- US-029: Manage Trusted Devices
- US-030: Review Account Activity

**Total: 16/30 stories fully implemented**

### Stories Requiring Minor Enhancements
- US-001: Merchant Onboarding (needs email verification, document upload)
- US-004: Monitor Transaction Analytics (needs export functionality)
- US-006: Manage Refunds (needs bulk processing)
- US-008: Production Go-Live (needs automated approval)
- US-010: Review Compliance Documents (needs expiry tracking)
- US-011: Complete Card Payment (needs receipt generation)
- US-017: Monitor Platform Health (needs real-time dashboard)

**Total: 7/30 stories need minor enhancements**

### Stories Requiring Major Implementation
- US-012: Pay with Bank Transfer (needs verification workflow)
- US-013: Pay with QR Code (needs QR generation, wallet integration)
- US-014: Recover Failed Payment (needs retry UI)
- US-015: Track Remittance Transfer (needs remittance tables)
- US-021: Review Security Incidents (needs security dashboard)
- US-023: Download SDK (needs SDK hosting)
- US-024: Test API Endpoints (needs API playground)

**Total: 7/30 stories need major implementation**

---

## Next Steps

1. **Validate Stories**: Confirm these stories align with business requirements
2. **Prioritize Implementation**: Focus on stories with missing features
3. **Design Orchestration**: Create Temporal workflows for each user journey
4. **Implement Missing Features**: Build required components for incomplete stories
5. **Update UI/UX**: Enhance PWA and mobile experience for all journeys
6. **Integration Testing**: Test end-to-end flows for each story
7. **Documentation**: Create user guides for each journey
