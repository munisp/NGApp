# Two-Factor Authentication - Complete Features Guide

## Overview

This crypto remittance platform now includes a comprehensive two-factor authentication (2FA) system with advanced features including trusted devices, account recovery, and admin management.

---

## Features Implemented

### 1. Core 2FA Functionality ✅

- **TOTP-based Authentication**: Time-based One-Time Password using authenticator apps (Google Authenticator, Authy, etc.)
- **QR Code Setup**: Easy enrollment with QR code scanning
- **Backup Codes**: 10 single-use backup codes for emergency access
- **Rate Limiting**: Protection against brute force attacks (5 attempts per 15 minutes)
- **Session Management**: JWT tokens with 2FA verification status

**Pages:**
- `/settings/2fa` - Enable/disable 2FA, view backup codes, regenerate codes
- `/verify-2fa` - 2FA verification during login

---

### 2. Trusted Devices ✅

Users can mark devices as "trusted" to skip 2FA verification for 30 days.

**Features:**
- Device fingerprinting based on user agent
- 30-day trust period with automatic expiration
- Device management dashboard
- Automatic cleanup of expired devices
- Security warnings for expiring devices

**How it works:**
1. User completes 2FA verification
2. Checks "Remember this device for 30 days"
3. Device fingerprint is stored in database
4. Future logins from same device skip 2FA
5. Trust expires after 30 days or manual revocation

**Pages:**
- `/settings/trusted-devices` - View and manage trusted devices

**API Endpoints:**
- `trustedDevice.trustDevice` - Mark current device as trusted
- `trustedDevice.verifyDevice` - Check if device is trusted
- `trustedDevice.listDevices` - Get all trusted devices
- `trustedDevice.revokeDevice` - Revoke single device
- `trustedDevice.revokeAllDevices` - Revoke all devices

---

### 3. Account Recovery ✅

Comprehensive recovery system for users who lose access to their authenticator app.

**Recovery Methods:**
1. **Email Recovery** - Automated recovery code sent to registered email
2. **Admin Recovery** - Manual review and approval by administrators

**Features:**
- Secure recovery code generation (12-character alphanumeric)
- 24-hour code expiration
- Rate limiting (3 requests per 24 hours)
- Email delivery (local development: logs to console + saves to files)
- Admin approval workflow
- Complete audit logging

**User Flow:**
1. Click "Lost access?" on 2FA verification page
2. Choose recovery method (email or admin)
3. For email: Receive code via email, enter code
4. For admin: Submit request, wait for admin approval
5. Complete recovery to reset 2FA

**Admin Flow:**
1. Navigate to `/admin/recovery-requests`
2. Review pending requests with user details
3. Approve or reject with notes
4. System logs all actions for audit

**Pages:**
- `/account-recovery` - User-facing recovery flow
- `/admin/recovery-requests` - Admin dashboard for recovery management

**API Endpoints:**
- `accountRecovery.initiateRecovery` - Start recovery process
- `accountRecovery.verifyCode` - Validate recovery code
- `accountRecovery.completeRecovery` - Reset 2FA after verification
- `accountRecovery.listPendingRequests` - Admin: View pending requests
- `accountRecovery.approveRequest` - Admin: Approve recovery
- `accountRecovery.rejectRequest` - Admin: Reject recovery

---

### 4. Email Service Integration ✅

**Local Development Mode:**
- Emails logged to console with full content
- Emails saved to `storage/emails/` as HTML files
- No external API keys required

**Production Mode** (optional):
- Supports Resend, SendGrid, or AWS SES
- Set `RESEND_API_KEY` and `EMAIL_FROM` environment variables
- Automatic failover to local mode if not configured

**Email Templates:**
- Recovery code email with professional HTML design
- Plain text fallback for email clients
- Security warnings and expiration notices

---

## Authentication Flow

### Standard Login (No 2FA)
```
1. User clicks "Sign In"
2. OAuth authentication with Manus
3. Session token created
4. Redirect to home page
```

### Login with 2FA (First Time)
```
1. User clicks "Sign In"
2. OAuth authentication with Manus
3. System checks: User has 2FA enabled
4. Redirect to /verify-2fa
5. User enters 6-digit code
6. Session token updated with twoFactorVerified=true
7. Redirect to intended destination
```

### Login with Trusted Device
```
1. User clicks "Sign In"
2. OAuth authentication with Manus
3. System checks: User has 2FA enabled
4. System checks: Device is trusted
5. Device is trusted → Skip 2FA, redirect to home
6. Device not trusted → Redirect to /verify-2fa
```

### Protected Route Access
```
1. User navigates to protected page
2. DashboardLayout checks authentication
3. use2FAGuard checks 2FA status
4. If 2FA required but not verified:
   - Check if device is trusted
   - If trusted: Allow access
   - If not trusted: Redirect to /verify-2fa
5. If verified or not required: Allow access
```

---

## Database Schema

### Users Table Extensions
```sql
twoFactorEnabled ENUM('true', 'false') DEFAULT 'false'
twoFactorSecret VARCHAR(255) -- Encrypted TOTP secret
twoFactorBackupCodes TEXT -- JSON array of hashed codes
```

### Trusted Devices Table
```sql
CREATE TABLE trusted_devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  deviceFingerprint VARCHAR(255) NOT NULL,
  deviceName VARCHAR(255),
  ipAddress VARCHAR(45),
  userAgent TEXT,
  trustedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lastUsedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  UNIQUE KEY (userId, deviceFingerprint)
);
```

### Account Recovery Tables
```sql
CREATE TABLE account_recovery_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  recoveryMethod ENUM('email', 'sms', 'admin'),
  recoveryCode VARCHAR(255), -- Hashed
  status ENUM('pending', 'approved', 'rejected', 'completed', 'expired'),
  requestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP NOT NULL,
  completedAt TIMESTAMP,
  reviewedBy INT,
  reviewedAt TIMESTAMP,
  reviewNotes TEXT,
  ipAddress VARCHAR(45),
  userAgent TEXT
);

CREATE TABLE account_recovery_audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  requestId INT NOT NULL,
  userId INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  performedBy INT,
  performedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  details TEXT
);
```

---

## Security Considerations

### Rate Limiting
- **2FA Verification**: 5 attempts per 15 minutes per user
- **Recovery Requests**: 3 requests per 24 hours per user
- **Account Lockout**: Automatic after failed attempts

### Code Security
- **TOTP Secrets**: Encrypted in database
- **Backup Codes**: SHA-256 hashed, single-use
- **Recovery Codes**: SHA-256 hashed, 24-hour expiration
- **Device Fingerprints**: SHA-256 hashed

### Session Management
- **JWT Tokens**: Signed with JWT_SECRET
- **2FA Verification Flag**: Included in session payload
- **Trusted Device Check**: Verified on every request
- **Cookie Security**: HttpOnly, Secure, SameSite=Strict

### Audit Logging
- All recovery actions logged with timestamps
- IP addresses and user agents recorded
- Admin actions tracked with performer ID
- Immutable audit trail

---

## Testing Guide

### Manual Testing Scenarios

#### Test 1: Enable 2FA
1. Navigate to `/settings/2fa`
2. Click "Enable Two-Factor Authentication"
3. Scan QR code with authenticator app
4. Enter 6-digit code to verify
5. Save backup codes
6. Verify 2FA is enabled

#### Test 2: Login with 2FA
1. Log out
2. Log in again
3. Verify redirect to `/verify-2fa`
4. Enter 6-digit code from authenticator
5. Verify redirect to home page

#### Test 3: Trusted Device
1. Complete 2FA verification
2. Check "Remember this device for 30 days"
3. Log out and log in again
4. Verify 2FA is skipped (direct to home)
5. Navigate to `/settings/trusted-devices`
6. Verify device is listed

#### Test 4: Account Recovery (Email)
1. Navigate to `/verify-2fa`
2. Click "Lost access?"
3. Select "Email Recovery"
4. Check console logs for recovery code
5. Check `storage/emails/` for email file
6. Enter recovery code
7. Verify 2FA is reset

#### Test 5: Account Recovery (Admin)
1. Navigate to `/verify-2fa`
2. Click "Lost access?"
3. Select "Admin Assistance"
4. Submit request
5. Log in as admin
6. Navigate to `/admin/recovery-requests`
7. Approve request
8. Return to user account
9. Verify 2FA is reset

#### Test 6: Revoke Trusted Device
1. Navigate to `/settings/trusted-devices`
2. Click revoke on a device
3. Confirm revocation
4. Log out and log in
5. Verify 2FA verification is required

---

## Configuration

### Environment Variables

```bash
# Required (auto-configured by Manus platform)
JWT_SECRET=<auto-generated>
DATABASE_URL=<auto-configured>

# Optional (for production email)
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=noreply@yourdomain.com
```

### Feature Flags

All 2FA features are enabled by default. To customize:

**Disable Trusted Devices:**
- Remove "Remember this device" checkbox from `TwoFactorVerify.tsx`
- Remove trusted device checks from OAuth callback

**Disable Email Recovery:**
- Remove "Email Recovery" option from `AccountRecovery.tsx`
- Only allow admin-assisted recovery

---

## API Reference

### tRPC Endpoints

#### Authentication
- `auth.me` - Get current user
- `auth.session2FAStatus` - Check 2FA verification status
- `auth.logout` - Log out

#### Two-Factor
- `twoFactor.getStatus` - Get 2FA status
- `twoFactor.setup` - Generate QR code and secret
- `twoFactor.enable` - Enable 2FA with verification
- `twoFactor.disable` - Disable 2FA
- `twoFactor.verify` - Verify 2FA code
- `twoFactor.regenerateBackupCodes` - Generate new backup codes

#### Trusted Devices
- `trustedDevice.getDeviceFingerprint` - Get current device fingerprint
- `trustedDevice.trustDevice` - Mark device as trusted
- `trustedDevice.verifyDevice` - Check if device is trusted
- `trustedDevice.listDevices` - Get all trusted devices
- `trustedDevice.revokeDevice` - Revoke single device
- `trustedDevice.revokeAllDevices` - Revoke all devices

#### Account Recovery
- `accountRecovery.initiateRecovery` - Start recovery
- `accountRecovery.verifyCode` - Verify recovery code
- `accountRecovery.completeRecovery` - Complete recovery
- `accountRecovery.listPendingRequests` - Admin: List pending
- `accountRecovery.approveRequest` - Admin: Approve
- `accountRecovery.rejectRequest` - Admin: Reject

---

## Troubleshooting

### Issue: 2FA verification fails
- Check authenticator app time sync
- Verify backup codes are correct format
- Check rate limiting status
- Review server logs for errors

### Issue: Trusted device not working
- Check device fingerprint generation
- Verify device hasn't expired (30 days)
- Check if device was revoked
- Clear browser cache and try again

### Issue: Recovery email not received
- Check console logs (local development)
- Check `storage/emails/` directory
- Verify user has email address
- Check email service configuration (production)

### Issue: Admin recovery not showing
- Verify user has admin role
- Check database for pending requests
- Review audit logs for errors

---

## Future Enhancements

### Potential Improvements
1. **SMS Recovery** - Add SMS-based recovery codes
2. **Hardware Keys** - Support WebAuthn/FIDO2 security keys
3. **Risk-Based Auth** - Skip 2FA for low-risk actions
4. **Biometric Auth** - Support fingerprint/face recognition
5. **Remember Device Duration** - Allow users to customize trust period
6. **Device Nicknames** - Let users name their devices
7. **Login Notifications** - Email alerts for new device logins
8. **Session Management** - View and revoke active sessions

---

## Support

For issues or questions:
1. Check this documentation
2. Review test scenarios
3. Check server logs
4. Contact support at https://help.manus.im

---

**Last Updated:** 2024
**Version:** 1.0.0
**Status:** Production Ready
