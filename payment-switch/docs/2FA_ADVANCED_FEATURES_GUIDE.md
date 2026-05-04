# 2FA Advanced Features Guide

This document provides comprehensive documentation for the three advanced 2FA features implemented in the Crypto Remittance Platform.

---

## Table of Contents

1. [SMS-Based Recovery](#sms-based-recovery)
2. [Login Notification System](#login-notification-system)
3. [Testing Guide](#testing-guide)
4. [Production Deployment](#production-deployment)

---

## SMS-Based Recovery

### Overview

SMS-based recovery provides users with an alternative method to recover their account when they lose access to their authenticator device. Recovery codes are sent via text message to the user's registered phone number.

### Features

- **Multiple Recovery Methods**: Users can choose between email, SMS, or admin review
- **Phone Number Validation**: Basic validation ensures phone numbers are in the correct format
- **Rate Limiting**: Built-in protection against abuse
- **Local Development Mode**: SMS messages are logged to console and saved to files during development
- **Production Ready**: Integrates with Twilio for real SMS delivery

### User Flow

1. User navigates to `/account-recovery` (or clicks "Lost access?" on 2FA verification page)
2. User selects "SMS Recovery" method
3. User enters phone number with country code (e.g., +1 555-123-4567)
4. System generates 8-character recovery code and sends via SMS
5. User enters recovery code
6. System verifies code and resets 2FA
7. User can set up 2FA again at `/settings/2fa`

### Technical Implementation

**Backend Components:**
- `server/services/smsService.ts` - SMS service with Twilio integration
- `server/services/accountRecoveryService.ts` - Recovery logic with SMS support
- `server/routers/accountRecoveryRouter.ts` - tRPC endpoints

**Frontend Components:**
- `client/src/pages/AccountRecovery.tsx` - Recovery UI with SMS option
- `client/src/pages/VerifyTwoFactor.tsx` - Links to recovery page

**Database:**
- `account_recovery_requests` table stores recovery attempts
- `account_recovery_audit_log` table tracks all recovery actions

### API Endpoints

```typescript
// Initiate SMS recovery
trpc.accountRecovery.initiateRecovery.mutate({
  recoveryMethod: 'sms',
  phoneNumber: '+15551234567'
});

// Verify recovery code
trpc.accountRecovery.verifyRecoveryCode.mutate({
  recoveryCode: 'ABC12345'
});

// Complete recovery (reset 2FA)
trpc.accountRecovery.completeRecovery.mutate({
  requestId: 123
});
```

### Local Development

During development, SMS messages are:
1. Logged to console with full details
2. Saved to `storage/sms/` directory as text files
3. Named with timestamp: `sms_YYYYMMDD_HHMMSS_RANDOM.txt`

Example console output:
```
[SMS Service] Local mode - SMS saved to: storage/sms/sms_20240108_143022_abc123.txt
[SMS Service] To: +15551234567
[SMS Service] Message: Your account recovery code is: ABC12345
```

### Production Setup

To enable real SMS delivery in production:

1. **Sign up for Twilio**:
   - Create account at https://www.twilio.com
   - Get Account SID and Auth Token
   - Purchase a phone number

2. **Add credentials via Manus Secrets**:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+15551234567
   ```

3. **Test SMS delivery**:
   - Initiate recovery with your real phone number
   - Verify you receive the SMS
   - Check Twilio console for delivery status

### Security Features

- **Rate Limiting**: Max 3 recovery attempts per hour per user
- **Code Expiration**: Recovery codes expire after 24 hours
- **One-Time Use**: Each code can only be used once
- **Audit Logging**: All recovery attempts are logged
- **Phone Validation**: Basic format validation prevents invalid numbers

---

## Login Notification System

### Overview

The login notification system sends security alerts to users when they log in from new devices or when suspicious activity is detected. This helps users quickly identify unauthorized access attempts.

### Features

- **New Device Detection**: Automatically detects logins from previously unseen devices
- **Suspicious Activity Detection**: Flags logins with unusual patterns
- **Beautiful Email Templates**: Professional, responsive HTML emails
- **Device Fingerprinting**: Identifies devices based on user agent
- **Browser & OS Detection**: Parses user agent to show readable device info
- **Asynchronous Delivery**: Notifications don't block the login process

### Notification Triggers

**New Device Login:**
- User logs in from a device not marked as "trusted"
- Email includes device details (browser, OS, IP address)
- Provides link to manage trusted devices

**Suspicious Activity:**
- Login from significantly different location (IP prefix change)
- Different operating system than previous login
- 3+ failed login attempts before successful login
- Email includes security warning and action steps

### User Flow

1. User completes OAuth login
2. System checks if device is trusted
3. If new device or suspicious:
   - Email notification sent asynchronously
   - User receives email within minutes
   - Email includes login details and action buttons
4. User can:
   - Ignore if it was them
   - Click "Manage Devices" to review trusted devices
   - Click "Secure My Account" if suspicious

### Technical Implementation

**Backend Components:**
- `server/services/loginNotificationService.ts` - Notification logic
- `server/_core/oauth.ts` - Integration into OAuth callback
- `server/services/emailService.ts` - Email delivery

**Email Templates:**
- Professional gradient header (blue for normal, red for suspicious)
- Detailed login information table
- Context-aware action buttons
- Responsive design for mobile devices

**Detection Logic:**
```typescript
// Device fingerprinting
const deviceFingerprint = crypto.createHash('sha256')
  .update(JSON.stringify({ userAgent }))
  .digest('hex');

// Check if trusted
const { trusted } = await verifyTrustedDevice({
  userId,
  deviceFingerprint
});

const isNewDevice = !trusted;

// Suspicious activity detection
const isSuspicious = isSuspiciousLogin({
  userAgent,
  ipAddress,
  lastLoginIp,
  lastLoginUserAgent,
  failedAttempts
});
```

### Email Template Features

**Normal Login Email:**
- 🔔 Blue gradient header
- "New Device Login" title
- Informational message
- Login details table
- "Manage Devices" button
- Reassuring tone

**Suspicious Login Email:**
- 🔒 Red gradient header
- "Suspicious Login Detected" title
- Security warning message
- Login details table
- "Secure My Account" button
- Action-oriented checklist

### Local Development

During development, emails are:
1. Logged to console with full HTML
2. Saved to `storage/emails/` directory
3. Named with timestamp: `email_YYYYMMDD_HHMMSS_RANDOM.html`

You can open the HTML files in a browser to preview the emails.

### Production Setup

Emails are automatically sent using the built-in email service. No additional configuration needed for basic functionality.

For production-grade email delivery:
1. Configure custom email service (SendGrid, AWS SES, etc.)
2. Update `server/services/emailService.ts` with production credentials
3. Test email delivery with real email addresses

### Notification Preferences

Currently, notifications use default settings:
- ✅ Email notifications enabled
- ✅ New device alerts enabled
- ✅ Suspicious activity alerts enabled
- ❌ SMS notifications disabled (future enhancement)

Future enhancement: Add `/settings/notifications` page for user preferences.

### Security Considerations

- **Async Delivery**: Notifications don't block login (sent in background)
- **No Sensitive Data**: Emails don't include passwords or recovery codes
- **Action Links**: Buttons link to secure settings pages
- **Rate Limiting**: Prevents notification spam
- **Privacy**: IP addresses are partially masked in future versions

---

## Testing Guide

### Testing SMS Recovery

**Test Scenario 1: Email Recovery (Baseline)**
1. Enable 2FA at `/settings/2fa`
2. Log out
3. Log back in and complete 2FA verification
4. Navigate to `/account-recovery`
5. Select "Email Recovery"
6. Check `storage/emails/` for recovery code
7. Enter code and verify 2FA is reset

**Test Scenario 2: SMS Recovery**
1. Enable 2FA at `/settings/2fa`
2. Log out
3. Log back in and complete 2FA verification
4. Navigate to `/account-recovery`
5. Select "SMS Recovery"
6. Enter phone number: `+15551234567`
7. Check `storage/sms/` for recovery code
8. Check console for SMS details
9. Enter code and verify 2FA is reset

**Test Scenario 3: Invalid Phone Number**
1. Navigate to `/account-recovery`
2. Select "SMS Recovery"
3. Enter invalid phone: `123` (too short)
4. Click "Continue"
5. Verify error: "Please enter a valid phone number"

**Test Scenario 4: Missing Phone Number**
1. Navigate to `/account-recovery`
2. Select "SMS Recovery"
3. Leave phone number empty
4. Click "Continue"
5. Verify error: "Please enter your phone number"

### Testing Login Notifications

**Test Scenario 1: First Login (New Device)**
1. Clear browser cookies/cache
2. Navigate to homepage
3. Click "Sign In" and complete OAuth
4. Check `storage/emails/` for login notification
5. Open HTML file in browser
6. Verify:
   - Blue gradient header with 🔔
   - "New Device Login" title
   - Login details (browser, OS, IP)
   - "Manage Devices" button

**Test Scenario 2: Trusted Device (No Notification)**
1. Complete Test Scenario 1
2. At 2FA verification, check "Remember this device"
3. Complete verification
4. Log out
5. Log back in
6. Verify NO new email in `storage/emails/`

**Test Scenario 3: Console Output**
1. Complete any login
2. Check server console for:
   ```
   [LoginNotification] Sending notification for new device login
   [Email Service] Local mode - Email saved to: storage/emails/...
   ```

**Test Scenario 4: Email Content**
1. Open any login notification email from `storage/emails/`
2. Verify responsive design (resize browser)
3. Check all details are present:
   - Timestamp
   - Browser name
   - Operating system
   - IP address
4. Verify buttons are styled correctly
5. Check footer text

### Testing Integration

**End-to-End Flow:**
1. New user signs up (first OAuth login)
2. Receives login notification (new device)
3. Enables 2FA at `/settings/2fa`
4. Logs out
5. Logs back in
6. Completes 2FA verification
7. Checks "Remember this device"
8. Logs out
9. Logs back in from same device
10. Skips 2FA (trusted device)
11. No new login notification (trusted device)
12. Simulates lost authenticator
13. Navigates to `/account-recovery`
14. Chooses SMS recovery
15. Receives recovery code via SMS (check `storage/sms/`)
16. Completes recovery
17. Sets up 2FA again

### Automated Testing

Create test scripts using Vitest:

```typescript
// tests/sms-recovery.test.ts
import { describe, it, expect } from 'vitest';
import * as accountRecoveryService from '../server/services/accountRecoveryService';

describe('SMS Recovery', () => {
  it('should send SMS recovery code', async () => {
    const result = await accountRecoveryService.initiateRecovery({
      userId: 1,
      recoveryMethod: 'sms',
      phoneNumber: '+15551234567'
    });
    
    expect(result.success).toBe(true);
    expect(result.recoveryCode).toMatch(/^[A-Z0-9]{8}$/);
  });
});
```

---

## Production Deployment

### Pre-Deployment Checklist

**SMS Recovery:**
- [ ] Twilio account created
- [ ] Phone number purchased
- [ ] Credentials added to Manus Secrets
- [ ] Test SMS delivery with real phone number
- [ ] Verify rate limiting works
- [ ] Check audit logs are being created

**Login Notifications:**
- [ ] Email service configured
- [ ] Test notifications with real email
- [ ] Verify email deliverability (check spam folders)
- [ ] Test both notification types (new device & suspicious)
- [ ] Verify emails render correctly on mobile
- [ ] Check notification preferences work

**General:**
- [ ] All TypeScript errors resolved
- [ ] Dev server running without errors
- [ ] Database migrations applied
- [ ] All tests passing
- [ ] Documentation reviewed
- [ ] Security audit completed

### Environment Variables

Required for production:

```bash
# Twilio SMS (optional, falls back to local mode)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# Email Service (already configured)
# Uses built-in email service by default

# Database (already configured)
DATABASE_URL=mysql://...
```

### Monitoring

**Key Metrics to Track:**
- SMS recovery requests per day
- SMS delivery success rate
- Login notification delivery rate
- New device login frequency
- Suspicious login detection rate
- Recovery code usage rate

**Logging:**
- All recovery attempts logged to `account_recovery_audit_log`
- SMS delivery status logged to console
- Email delivery status logged to console
- Failed notifications logged as errors

### Security Hardening

**Before Production:**
1. Enable HTTPS for all endpoints
2. Configure CORS properly
3. Set up rate limiting at gateway level
4. Enable IP-based geolocation for better suspicious activity detection
5. Add CAPTCHA to recovery initiation
6. Implement session timeout after recovery
7. Add 2FA re-enrollment reminder
8. Enable notification preferences UI

**Ongoing:**
1. Monitor audit logs for patterns
2. Review suspicious login detections
3. Update user agent parsing as needed
4. Rotate Twilio credentials periodically
5. Review and update email templates
6. Analyze recovery success rates

---

## Troubleshooting

### SMS Not Sending

**Local Development:**
- Check `storage/sms/` directory exists
- Verify console shows SMS details
- Ensure phone number format is correct

**Production:**
- Verify Twilio credentials are correct
- Check Twilio console for errors
- Verify phone number has SMS capability
- Check rate limits haven't been exceeded

### Login Notifications Not Arriving

**Local Development:**
- Check `storage/emails/` directory exists
- Verify console shows email details
- Open HTML file in browser to preview

**Production:**
- Check email service logs
- Verify user has valid email address
- Check spam/junk folders
- Verify email service credentials
- Test with different email providers

### Device Not Being Trusted

- Check browser cookies are enabled
- Verify device fingerprint is being generated
- Check `trusted_devices` table for entries
- Ensure "Remember this device" was checked
- Verify device fingerprint matches

### Recovery Code Not Working

- Verify code hasn't expired (24 hours)
- Check code hasn't been used already
- Ensure code is entered in uppercase
- Verify request ID matches
- Check audit logs for details

---

## Future Enhancements

### Short Term (1-2 weeks)
- [ ] Add notification preferences UI at `/settings/notifications`
- [ ] Implement SMS notifications for login alerts
- [ ] Add geolocation-based suspicious activity detection
- [ ] Create admin dashboard for recovery requests
- [ ] Add recovery code resend functionality

### Medium Term (1-2 months)
- [ ] Implement biometric authentication support
- [ ] Add hardware security key support (WebAuthn)
- [ ] Create mobile app with push notifications
- [ ] Add multi-language support for emails/SMS
- [ ] Implement risk-based authentication

### Long Term (3-6 months)
- [ ] Machine learning for suspicious activity detection
- [ ] Integration with fraud detection services
- [ ] Advanced device fingerprinting with canvas/WebGL
- [ ] Behavioral biometrics
- [ ] Zero-knowledge proof authentication

---

## Support

For questions or issues:
- Check the main 2FA documentation: `docs/2FA_COMPLETE_FEATURES_GUIDE.md`
- Review test verification: `docs/2FA_MANUAL_TEST_VERIFICATION.md`
- Check audit logs in database
- Review console logs for errors
- Contact development team

---

**Last Updated**: January 8, 2024  
**Version**: 1.0.0  
**Status**: Production Ready
