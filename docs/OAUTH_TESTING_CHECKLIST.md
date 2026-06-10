# OAuth and 2FA Testing Checklist

This comprehensive checklist guides you through manual testing of the complete authentication flow including OAuth, 2FA, trusted devices, and account recovery.

---

## Prerequisites

### Required Setup
- ✅ Platform deployed and accessible via public URL
- ✅ Database migrations applied (`pnpm db:push`)
- ✅ Dev server running (`pnpm dev`)
- ✅ Browser with developer tools (Chrome/Firefox recommended)
- ✅ Mobile authenticator app (Google Authenticator, Authy, or similar)
- ✅ Test email account for notifications
- ✅ Test phone number for SMS (if Twilio configured)

### Test User Accounts
Create at least 3 test accounts with different roles:
1. **Admin User** - Full platform access
2. **Regular User** - Standard participant access
3. **New User** - For testing first-time flows

---

## Phase 1: Basic OAuth Login Flow

### Test 1.1: First-Time Login (No 2FA)

**Steps:**
1. Navigate to homepage
2. Click "Sign In" button
3. Complete OAuth flow with Manus
4. Verify successful login

**Expected Results:**
- ✅ Redirected to Manus OAuth portal
- ✅ After authentication, redirected back to platform
- ✅ Session cookie set (`payment_switch_session`)
- ✅ User sees dashboard/home page
- ✅ User profile displayed in header

**Verification:**
```javascript
// Open browser console and check:
document.cookie.includes('payment_switch_session')
// Should return: true
```

**Database Check:**
```sql
SELECT * FROM users WHERE email = 'your-test-email@example.com';
-- Should show: user record with lastSignedIn timestamp
```

---

### Test 1.2: Subsequent Login (Existing User)

**Steps:**
1. Log out from platform
2. Click "Sign In" again
3. Complete OAuth flow

**Expected Results:**
- ✅ Same OAuth flow as first login
- ✅ User record updated (lastSignedIn timestamp)
- ✅ No duplicate user records created

**Database Check:**
```sql
SELECT COUNT(*) FROM users WHERE email = 'your-test-email@example.com';
-- Should return: 1 (no duplicates)
```

---

### Test 1.3: Session Persistence

**Steps:**
1. Log in successfully
2. Refresh the page
3. Close browser and reopen
4. Navigate to platform URL

**Expected Results:**
- ✅ User remains logged in after page refresh
- ✅ User remains logged in after browser restart
- ✅ Session persists for configured duration (7 days default)

---

## Phase 2: Two-Factor Authentication Setup

### Test 2.1: Enable 2FA

**Steps:**
1. Log in to platform
2. Navigate to Settings → 2FA Settings (`/settings/2fa`)
3. Click "Enable Two-Factor Authentication"
4. Scan QR code with authenticator app
5. Enter verification code from app
6. Save backup codes

**Expected Results:**
- ✅ QR code displayed with secret key
- ✅ Authenticator app successfully scans code
- ✅ Verification code accepted
- ✅ 10 backup codes generated and displayed
- ✅ Success message shown
- ✅ 2FA status shows "Enabled"

**Database Check:**
```sql
SELECT twoFactorEnabled, twoFactorSecret, twoFactorBackupCodes 
FROM users 
WHERE email = 'your-test-email@example.com';
-- Should show: twoFactorEnabled = 1, secret and backup codes present
```

---

### Test 2.2: Login with 2FA Verification

**Steps:**
1. Log out from platform
2. Click "Sign In"
3. Complete OAuth flow
4. **Should be redirected to `/verify-2fa`**
5. Open authenticator app
6. Enter 6-digit TOTP code
7. Submit verification

**Expected Results:**
- ✅ After OAuth, redirected to 2FA verification page (not dashboard)
- ✅ Verification page shows "Enter your 6-digit code"
- ✅ Code from authenticator app is accepted
- ✅ After successful verification, redirected to dashboard
- ✅ Session token updated with `twoFactorVerified: true`

**Console Verification:**
```javascript
// After successful 2FA verification:
fetch('/api/trpc/auth.session2FAStatus')
  .then(r => r.json())
  .then(console.log)
// Should show: { verified: true, needsVerification: false }
```

---

### Test 2.3: Backup Code Usage

**Steps:**
1. Log out
2. Log in via OAuth
3. On 2FA verification page, click "Use backup code"
4. Enter one of the saved backup codes
5. Submit

**Expected Results:**
- ✅ Backup code input field appears
- ✅ Valid backup code is accepted
- ✅ Successfully logged in
- ✅ Backup code is marked as used (cannot be reused)

**Database Check:**
```sql
SELECT twoFactorBackupCodes FROM users WHERE email = 'your-test-email@example.com';
-- Should show: one code marked as used
```

---

### Test 2.4: Invalid 2FA Code

**Steps:**
1. Log out
2. Log in via OAuth
3. Enter incorrect 6-digit code (e.g., "000000")
4. Submit

**Expected Results:**
- ✅ Error message: "Invalid verification code"
- ✅ User remains on verification page
- ✅ Can retry with correct code

---

### Test 2.5: Rate Limiting

**Steps:**
1. Log out
2. Log in via OAuth
3. Enter incorrect code 5 times in a row

**Expected Results:**
- ✅ After 5 failed attempts, account temporarily locked
- ✅ Error message: "Too many failed attempts. Please try again in 15 minutes."
- ✅ Cannot attempt verification for 15 minutes

**Database Check:**
```sql
SELECT * FROM twoFactorRateLimits WHERE userId = <user_id>;
-- Should show: attemptCount = 5, lockedUntil = <timestamp 15 min from now>
```

---

## Phase 3: Trusted Devices

### Test 3.1: Trust Device During 2FA

**Steps:**
1. Log out
2. Log in via OAuth
3. On 2FA verification page, check "Remember this device for 30 days"
4. Enter valid TOTP code
5. Submit

**Expected Results:**
- ✅ Verification successful
- ✅ Device fingerprint stored in database
- ✅ Device marked as trusted for 30 days

**Database Check:**
```sql
SELECT * FROM trusted_devices WHERE userId = <user_id>;
-- Should show: new device record with expiresAt = 30 days from now
```

---

### Test 3.2: Login from Trusted Device (Skip 2FA)

**Steps:**
1. Log out
2. Log in via OAuth again (same browser/device)

**Expected Results:**
- ✅ After OAuth, **directly redirected to dashboard** (no 2FA prompt)
- ✅ Session token has `twoFactorVerified: true` automatically
- ✅ No verification page shown

**Console Verification:**
```javascript
// Check session status:
fetch('/api/trpc/auth.session2FAStatus')
  .then(r => r.json())
  .then(console.log)
// Should show: { verified: true, needsVerification: false }
```

---

### Test 3.3: Manage Trusted Devices

**Steps:**
1. Navigate to Settings → Trusted Devices (`/settings/trusted-devices`)
2. View list of trusted devices
3. Click "Revoke" on one device
4. Confirm revocation

**Expected Results:**
- ✅ List shows all trusted devices with details (device name, last used, created date)
- ✅ Revoke button removes device from list
- ✅ Success message shown
- ✅ Next login from that device will require 2FA

**Database Check:**
```sql
SELECT * FROM trusted_devices WHERE userId = <user_id> AND revokedAt IS NULL;
-- Should show: remaining trusted devices (revoked device excluded)
```

---

### Test 3.4: Revoke All Devices

**Steps:**
1. On Trusted Devices page
2. Click "Revoke All Devices"
3. Confirm action
4. Log out and log in again

**Expected Results:**
- ✅ All devices removed from list
- ✅ Success message shown
- ✅ Next login requires 2FA verification (no trusted devices)

---

## Phase 4: Account Recovery

### Test 4.1: Initiate Email Recovery

**Steps:**
1. Log out
2. Log in via OAuth
3. On 2FA verification page, click "Lost access to your authenticator?"
4. Select "Email" recovery method
5. Submit request

**Expected Results:**
- ✅ Recovery request created
- ✅ 12-character recovery code generated (format: XXXX-XXXX-XXXX)
- ✅ **Development Mode:** Code displayed on screen
- ✅ **Production Mode:** Code sent to user's email
- ✅ Success message: "Recovery code sent to your email"

**Database Check:**
```sql
SELECT * FROM account_recovery_requests WHERE userId = <user_id> ORDER BY requestedAt DESC LIMIT 1;
-- Should show: status = 'pending', recoveryMethod = 'email', expiresAt = 24 hours from now
```

---

### Test 4.2: Complete Email Recovery

**Steps:**
1. Copy the recovery code (from screen in dev mode, or from email in production)
2. On recovery page, enter the 12-character code
3. Submit

**Expected Results:**
- ✅ Recovery code accepted
- ✅ 2FA disabled for user account
- ✅ Success message: "Your 2FA has been reset. Please set up 2FA again."
- ✅ Redirected to dashboard
- ✅ Can now access platform without 2FA

**Database Check:**
```sql
SELECT twoFactorEnabled FROM users WHERE id = <user_id>;
-- Should show: twoFactorEnabled = 0 (disabled)

SELECT status FROM account_recovery_requests WHERE userId = <user_id> ORDER BY requestedAt DESC LIMIT 1;
-- Should show: status = 'completed'
```

---

### Test 4.3: Admin-Assisted Recovery

**Steps:**
1. Initiate recovery and select "Admin Assistance"
2. Log in as admin user
3. Navigate to Admin → Recovery Requests (`/admin/recovery-requests`)
4. Find the pending request
5. Click "Approve"
6. Add review notes
7. Submit approval

**Expected Results:**
- ✅ Admin sees pending recovery request in dashboard
- ✅ Request shows user details, method, timestamp
- ✅ Approval dialog appears with notes field
- ✅ After approval, user's 2FA is reset
- ✅ User receives notification of approval

**Database Check:**
```sql
SELECT status, reviewedBy, reviewNotes FROM account_recovery_requests WHERE userId = <user_id> ORDER BY requestedAt DESC LIMIT 1;
-- Should show: status = 'approved', reviewedBy = <admin_id>, reviewNotes present
```

---

### Test 4.4: Recovery Rate Limiting

**Steps:**
1. Initiate recovery request
2. Immediately initiate another recovery request
3. Initiate a third recovery request

**Expected Results:**
- ✅ First request: Success
- ✅ Second request: Success
- ✅ Third request: Success
- ✅ Fourth request: Error - "You have reached the maximum number of recovery requests (3) in 24 hours"

---

### Test 4.5: Expired Recovery Code

**Steps:**
1. Initiate recovery request
2. Wait 24 hours (or manually update database to expire)
3. Try to use the recovery code

**Expected Results:**
- ✅ Error message: "Recovery code has expired. Please request a new one."
- ✅ Code cannot be used

**Manual Expiration (for testing):**
```sql
UPDATE account_recovery_requests 
SET expiresAt = DATE_SUB(NOW(), INTERVAL 1 HOUR) 
WHERE userId = <user_id> AND status = 'pending';
```

---

## Phase 5: Login Notifications

### Test 5.1: New Device Login Notification

**Steps:**
1. Log in from a new browser/device (or use incognito mode)
2. Complete OAuth and 2FA
3. Check email inbox

**Expected Results:**
- ✅ Email received: "New device login detected"
- ✅ Email contains device details (browser, OS, location)
- ✅ Email contains timestamp
- ✅ Email contains "If this wasn't you" warning

**Database Check:**
```sql
SELECT * FROM login_history WHERE userId = <user_id> ORDER BY loginAt DESC LIMIT 1;
-- Should show: isNewDevice = 1
```

---

### Test 5.2: Suspicious Activity Alert

**Steps:**
1. Log in from a significantly different location (use VPN to change IP)
2. Complete authentication

**Expected Results:**
- ✅ Email received: "Suspicious login activity detected"
- ✅ Email shows location change
- ✅ Email contains security recommendations

---

### Test 5.3: Notification Preferences

**Steps:**
1. Navigate to Settings → Notifications (`/settings/notifications`)
2. Disable "New device login" email notifications
3. Log in from new device
4. Check email

**Expected Results:**
- ✅ Notification preferences page shows all notification types
- ✅ Toggle switches for email and SMS
- ✅ After disabling, no email received for new device login
- ✅ In-app notification still shown (if enabled)

**Database Check:**
```sql
SELECT * FROM notification_preferences WHERE userId = <user_id>;
-- Should show: newDeviceEmail = 0
```

---

## Phase 6: Account Activity Dashboard

### Test 6.1: View Login History

**Steps:**
1. Navigate to Settings → Activity (`/settings/activity`)
2. View login history table

**Expected Results:**
- ✅ Table shows all recent logins
- ✅ Columns: Date/Time, Device, Location, IP Address, Status
- ✅ Current session highlighted
- ✅ Pagination works for >10 logins

---

### Test 6.2: Terminate Active Session

**Steps:**
1. Open platform in two different browsers
2. Log in to both
3. In Browser A, go to Activity page
4. Find Browser B's session
5. Click "Terminate" button

**Expected Results:**
- ✅ Browser B's session appears in active sessions list
- ✅ Terminate button available
- ✅ After termination, Browser B is logged out
- ✅ Browser B shows "Session expired" message

---

## Phase 7: Session Timeout and Idle Detection

### Test 7.1: Idle Detection Warning

**Steps:**
1. Log in to platform
2. Stay on any page without interaction for 13 minutes
3. Wait for warning modal

**Expected Results:**
- ✅ After 13 minutes of inactivity, warning modal appears
- ✅ Modal shows countdown timer (2 minutes)
- ✅ Modal has "Stay Logged In" button
- ✅ Clicking "Stay Logged In" resets idle timer

---

### Test 7.2: Auto-Logout After Idle

**Steps:**
1. Log in to platform
2. Stay idle for 15 minutes (do not interact with warning modal)

**Expected Results:**
- ✅ After 15 minutes total, automatically logged out
- ✅ Redirected to login page
- ✅ Message shown: "You have been logged out due to inactivity"
- ✅ Session cookie cleared

---

### Test 7.3: Session Expiration

**Steps:**
1. Log in without "Remember me"
2. Wait 7 days (or manually expire session)
3. Try to access protected page

**Expected Results:**
- ✅ Session expires after 7 days
- ✅ User redirected to login page
- ✅ Message: "Your session has expired. Please log in again."

**Manual Expiration (for testing):**
```sql
-- Sessions are stored in JWT, so you need to wait or manually clear cookie
document.cookie = 'payment_switch_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
```

---

### Test 7.4: Remember Me (Extended Session)

**Steps:**
1. Log in and check "Remember me for 30 days"
2. Verify session duration

**Expected Results:**
- ✅ Session lasts 30 days instead of 7 days
- ✅ Cookie expiration set to 30 days

---

## Phase 8: Security Edge Cases

### Test 8.1: Direct URL Access Without 2FA

**Steps:**
1. Log in via OAuth (with 2FA enabled)
2. **Do not complete 2FA verification**
3. Manually navigate to `/dashboard` or other protected route

**Expected Results:**
- ✅ Automatically redirected to `/verify-2fa`
- ✅ Cannot access protected pages without 2FA
- ✅ After verification, redirected to originally requested page

---

### Test 8.2: Session Token Tampering

**Steps:**
1. Log in successfully
2. Open browser console
3. Modify session cookie value
4. Refresh page

**Expected Results:**
- ✅ Invalid session detected
- ✅ User logged out
- ✅ Redirected to login page

---

### Test 8.3: Concurrent Sessions

**Steps:**
1. Log in from Browser A
2. Log in from Browser B (same account)
3. Verify both sessions work

**Expected Results:**
- ✅ Both sessions remain active
- ✅ Can use platform from both browsers simultaneously
- ✅ Activity dashboard shows both sessions

---

## Testing Summary Checklist

### OAuth & Basic Auth
- [ ] First-time login works
- [ ] Subsequent login works
- [ ] Session persists across page refresh
- [ ] Session persists across browser restart

### Two-Factor Authentication
- [ ] 2FA setup with QR code works
- [ ] TOTP verification works
- [ ] Backup codes work
- [ ] Invalid code shows error
- [ ] Rate limiting works (5 attempts)

### Trusted Devices
- [ ] Trust device checkbox works
- [ ] Trusted device skips 2FA
- [ ] Manage trusted devices page works
- [ ] Revoke device works
- [ ] Revoke all devices works

### Account Recovery
- [ ] Email recovery initiation works
- [ ] Recovery code delivery works (email/screen)
- [ ] Recovery code verification works
- [ ] Admin-assisted recovery works
- [ ] Recovery rate limiting works (3 per 24h)
- [ ] Expired recovery code rejected

### Login Notifications
- [ ] New device notification sent
- [ ] Suspicious activity alert sent
- [ ] Notification preferences work
- [ ] Email/SMS toggle works

### Account Activity
- [ ] Login history displays correctly
- [ ] Active sessions shown
- [ ] Terminate session works
- [ ] Current session highlighted

### Session Management
- [ ] Idle detection warning shows (13 min)
- [ ] Auto-logout after idle (15 min)
- [ ] Session expires after 7 days
- [ ] Remember me extends to 30 days

### Security
- [ ] Cannot access protected pages without 2FA
- [ ] Session token tampering detected
- [ ] Concurrent sessions work
- [ ] Rate limiting enforced

---

## Reporting Issues

If any test fails, document the following:

1. **Test Number**: (e.g., Test 2.2)
2. **Expected Behavior**: What should happen
3. **Actual Behavior**: What actually happened
4. **Steps to Reproduce**: Exact steps taken
5. **Browser**: Chrome/Firefox/Safari + version
6. **Screenshots**: If applicable
7. **Console Errors**: Any JavaScript errors
8. **Network Logs**: Failed API requests
9. **Database State**: Relevant table records

---

## Next Steps After Testing

Once all tests pass:

1. ✅ Document any configuration-specific notes
2. ✅ Update production deployment guide with findings
3. ✅ Configure monitoring and alerting for production
4. ✅ Set up error tracking (Sentry, LogRocket, etc.)
5. ✅ Deploy to staging environment
6. ✅ Repeat testing in staging
7. ✅ Deploy to production

Your authentication system is production-ready! 🎉
