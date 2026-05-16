# InsurePortal Mobile App

React Native mobile application for iOS and Android platforms.

## Business Requirement

**BR-CUST-004: Omnichannel Access (Mobile Apps)**
- Native iOS and Android applications
- Feature parity with web portal
- Offline capabilities
- Push notifications
- Biometric authentication
- Camera integration for document upload

## Features

### Core Features
- **Authentication**: Login, registration, biometric auth
- **Dashboard**: Overview of policies, claims, payments
- **Policies**: View, renew, download policy documents
- **Claims**: File new claims, track status, upload documents
- **Payments**: View payment history, make payments
- **Profile**: Update personal information, preferences
- **Referrals**: Refer friends, track rewards
- **Reviews**: Rate agents and services

### Mobile-Specific Features
- **Push Notifications**: Real-time claim updates, payment reminders
- **Biometric Auth**: Fingerprint/Face ID login
- **Camera Integration**: Capture claim photos, scan documents
- **Offline Mode**: View cached data when offline
- **Share**: Share referral codes via SMS, WhatsApp, email
- **Deep Linking**: Open specific screens from notifications

## Tech Stack

- **Framework**: React Native 0.73
- **Navigation**: React Navigation 6
- **State Management**: React Query (TanStack Query)
- **UI Library**: React Native Paper
- **HTTP Client**: Axios
- **Storage**: AsyncStorage
- **Icons**: React Native Vector Icons
- **Biometrics**: React Native Biometrics
- **Camera**: React Native Camera
- **Notifications**: React Native Push Notification

## Project Structure

```
insurance-mobile-app/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components
│   │   ├── Auth/         # Login, Register
│   │   ├── Dashboard/    # Dashboard screen
│   │   ├── Policies/     # Policy screens
│   │   ├── Claims/       # Claim screens
│   │   ├── Payments/     # Payment screens
│   │   ├── Profile/      # Profile screen
│   │   ├── Referrals/    # Referral screens
│   │   └── Reviews/      # Review screens
│   ├── navigation/       # Navigation configuration
│   ├── services/         # API services, auth context
│   └── utils/            # Theme, helpers, constants
├── assets/               # Images, fonts
├── __tests__/            # Test files
├── android/              # Android native code
├── ios/                  # iOS native code
└── App.tsx               # Root component
```

## Setup Instructions

### Prerequisites
- Node.js >= 18
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)
- CocoaPods (for iOS dependencies)

### Installation

```bash
# Install dependencies
npm install

# iOS specific
cd ios && pod install && cd ..

# Android specific (if needed)
cd android && ./gradlew clean && cd ..
```

### Running the App

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Building for Production

```bash
# Android APK
npm run build:android
# Output: android/app/build/outputs/apk/release/app-release.apk

# iOS Archive
npm run build:ios
# Open Xcode to archive and upload to App Store
```

## Configuration

### API Endpoint
Update `src/services/api.ts` with your backend URL:
```typescript
const API_BASE_URL = 'https://api.insureportal.ng/api';
```

### Push Notifications
Configure Firebase Cloud Messaging (FCM) for Android and Apple Push Notification Service (APNS) for iOS.

### Deep Linking
Configure deep linking in `android/app/src/main/AndroidManifest.xml` and `ios/InsurePortal/Info.plist`.

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

## Features Implementation Status

### Completed ✅
- Project structure and navigation
- Authentication flow
- Dashboard screen
- API service layer
- Theme configuration
- Auth context

### In Progress 🚧
- All feature screens (Policies, Claims, Payments, etc.)
- Push notifications
- Biometric authentication
- Camera integration
- Offline mode

### Planned 📋
- App Store deployment
- Analytics integration
- Crash reporting
- Performance monitoring

## Integration with Backend

The mobile app connects to the same backend API as the web portal:
- Base URL: `https://api.insureportal.ng/api`
- Authentication: JWT tokens stored in AsyncStorage
- API endpoints match web portal tRPC procedures

## Platform-Specific Notes

### iOS
- Minimum iOS version: 13.0
- Requires Xcode 14+
- Uses CocoaPods for dependencies
- Requires Apple Developer account for deployment

### Android
- Minimum SDK: 21 (Android 5.0)
- Target SDK: 34 (Android 14)
- Requires Android Studio
- Uses Gradle for build management

## Security

- Biometric authentication for quick login
- Secure token storage with AsyncStorage
- SSL pinning for API calls
- Encrypted local storage for sensitive data
- Auto-logout on inactivity

## Performance

- Lazy loading of screens
- Image optimization
- API response caching with React Query
- Offline data persistence
- Background sync for notifications

## Deployment

### iOS App Store
1. Configure signing in Xcode
2. Archive the app
3. Upload to App Store Connect
4. Submit for review

### Google Play Store
1. Generate signed APK/AAB
2. Upload to Google Play Console
3. Complete store listing
4. Submit for review

## Support

For issues or questions, contact the development team or refer to the main platform documentation.

## License

Proprietary - InsurePortal Nigeria
