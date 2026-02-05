# African Fintech Mobile App - Authentication Credentials

## Platform Access

### Test User Credentials

**Email:** `testuser@africanfintech.com`  
**Password:** `SecurePass123!`

**Alternative Test Account:**  
**Email:** `demo@africanfintech.com`  
**Password:** `Demo2026!`

---

## Authentication Methods

The application supports multiple authentication methods:

### 1. Email/Password Authentication
- Standard email and password login
- Password reset functionality via email
- Account creation with email verification

### 2. Biometric Authentication
- **Face ID** (iOS devices with Face ID capability)
- **Touch ID** (iOS devices with Touch ID)
- **Fingerprint** (Android devices with fingerprint sensor)
- Biometric authentication is enabled after initial login with email/password

### 3. Quick Login
- Biometric quick login for returning users
- Session management with secure token storage
- Auto-logout after 30 days of inactivity

---

## Security Features

### Data Protection
- All sensitive data encrypted using `expo-secure-store`
- Biometric data stored locally on device (never transmitted)
- Session tokens encrypted and stored securely
- HSM integration for cryptographic operations

### Authentication Flow
1. **Initial Login:** Email/password authentication
2. **Biometric Setup:** Optional biometric enrollment after first login
3. **Subsequent Logins:** Biometric quick login or email/password
4. **Session Management:** Automatic token refresh and session validation

### Security Best Practices
- Passwords must be at least 8 characters
- Password complexity requirements enforced
- Account lockout after 5 failed login attempts
- Two-factor authentication available (optional)

---

## Testing the Application

### Using Expo Go (Mobile Device)

1. **Install Expo Go:**
   - iOS: Download from App Store
   - Android: Download from Google Play Store

2. **Scan QR Code:**
   - Open Expo Go app
   - Scan the QR code from the development server
   - App will load on your device

3. **Login:**
   - Use test credentials provided above
   - Enable biometric authentication when prompted
   - Test all features with biometric quick access

### Using Web Browser

1. **Access URL:** `https://8081-izyqnt0a5eg8bumha4b9w-707b577a.us1.manus.computer`
2. **Login:** Use test credentials
3. **Note:** Biometric features are disabled on web platform

### Using iOS Simulator

1. **Start Simulator:** `pnpm ios`
2. **Login:** Use test credentials
3. **Test Face ID:** Hardware > Face ID > Enrolled
4. **Trigger Face ID:** Hardware > Face ID > Matching Face

### Using Android Emulator

1. **Start Emulator:** `pnpm android`
2. **Login:** Use test credentials
3. **Test Fingerprint:** Settings > Security > Fingerprint (in emulator)
4. **Trigger Fingerprint:** Use emulator fingerprint sensor

---

## API Access

### Backend API Endpoint
**Base URL:** `https://3000-izyqnt0a5eg8bumha4b9w-707b577a.us1.manus.computer`

### Authentication Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Sample API Request
```bash
curl -X POST https://3000-izyqnt0a5eg8bumha4b9w-707b577a.us1.manus.computer/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser@africanfintech.com", "password": "SecurePass123!"}'
```

---

## Troubleshooting

### Cannot Login
- Verify email and password are correct
- Check network connectivity
- Ensure backend server is running
- Clear app cache and try again

### Biometric Authentication Not Working
- Verify device has biometric capability
- Check biometric enrollment in device settings
- Re-enable biometric authentication in app settings
- Grant biometric permissions to the app

### Session Expired
- Login again with email/password
- Session tokens expire after 30 days
- Biometric quick login will prompt for re-authentication

---

## Support

For authentication issues or account access problems:
- Check application logs in development console
- Review backend API logs for authentication errors
- Verify database connection and user records
- Contact development team for assistance

---

**Last Updated:** January 22, 2026  
**Version:** 1.0.0  
**Platform:** African Fintech Mobile Application
