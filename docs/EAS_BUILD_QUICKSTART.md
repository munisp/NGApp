# EAS Build Quick Start Guide

Fast-track guide to building and submitting the African Fintech Mobile App to app stores using EAS Build.

## Prerequisites

1. **Expo Account** (free)
2. **Apple Developer Account** ($99/year) - for iOS
3. **Google Play Developer Account** ($25 one-time) - for Android
4. **EAS CLI** installed globally

---

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

---

## Step 2: Login to Expo

```bash
eas login
```

Enter your Expo credentials.

---

## Step 3: Initialize EAS in Project

```bash
cd /home/ubuntu/fintech-mobile-app
eas init
```

This will:
- Link your project to Expo
- Create `eas.json` (already exists)
- Set up project ID

---

## Step 4: Configure Credentials

### For iOS

```bash
eas credentials
```

Select:
1. iOS
2. Production
3. "Set up a new Apple App Identifier"
4. Enter Apple ID credentials
5. Select team (if multiple)

EAS will automatically:
- Create App ID
- Generate certificates
- Create provisioning profiles

### For Android

```bash
eas credentials
```

Select:
1. Android
2. Production
3. "Generate new keystore"

EAS will automatically generate and store your Android keystore.

---

## Step 5: Build for iOS

```bash
eas build --platform ios --profile production
```

This will:
1. Upload your code to Expo servers
2. Install dependencies
3. Build the app
4. Generate `.ipa` file
5. Provide download link

**Build time**: 10-20 minutes

---

## Step 6: Build for Android

```bash
eas build --platform android --profile production
```

This will:
1. Upload your code to Expo servers
2. Install dependencies
3. Build the app
4. Generate `.aab` file
5. Provide download link

**Build time**: 10-15 minutes

---

## Step 7: Submit to App Stores

### Submit to Apple App Store

```bash
eas submit --platform ios
```

You'll need:
- Apple ID
- App-specific password
- App Store Connect app created

EAS will automatically upload the `.ipa` to App Store Connect.

### Submit to Google Play Store

```bash
eas submit --platform android
```

You'll need:
- Google Play Service Account JSON key
- App created in Google Play Console

EAS will automatically upload the `.aab` to Google Play Console.

---

## Step 8: Monitor Build Status

### Check Build Status

```bash
eas build:list
```

### View Build Logs

```bash
eas build:view <build-id>
```

### Download Build

```bash
eas build:download <build-id>
```

---

## Troubleshooting

### Build Failed

1. **Check build logs**:
   ```bash
   eas build:view <build-id>
   ```

2. **Common issues**:
   - Missing dependencies: Check `package.json`
   - TypeScript errors: Run `pnpm check`
   - Native module issues: Check `package.json` for incompatible versions

3. **Re-run build**:
   ```bash
   eas build --platform ios --profile production --clear-cache
   ```

### Submission Failed

1. **iOS submission issues**:
   - Missing app in App Store Connect
   - Incorrect bundle ID
   - Missing required screenshots
   - Privacy policy URL not set

2. **Android submission issues**:
   - Missing app in Google Play Console
   - Incorrect package name
   - Missing required graphics
   - Content rating not completed

---

## Quick Reference

### Build Commands

```bash
# Build for both platforms
eas build --platform all --profile production

# Build for iOS only
eas build --platform ios --profile production

# Build for Android only
eas build --platform android --profile production

# Build with specific profile
eas build --platform ios --profile preview

# Clear cache and rebuild
eas build --platform ios --profile production --clear-cache
```

### Submit Commands

```bash
# Submit iOS
eas submit --platform ios

# Submit Android
eas submit --platform android

# Submit specific build
eas submit --platform ios --id <build-id>
```

### Credential Commands

```bash
# Manage iOS credentials
eas credentials --platform ios

# Manage Android credentials
eas credentials --platform android

# Reset credentials
eas credentials:reset
```

---

## Build Profiles

The app has three build profiles configured in `eas.json`:

### 1. Development

```bash
eas build --platform ios --profile development
```

- For internal testing
- Development client
- Fast builds

### 2. Preview

```bash
eas build --platform ios --profile preview
```

- For beta testing
- Production-like build
- Installable on devices

### 3. Production

```bash
eas build --platform ios --profile production
```

- For app store submission
- Optimized and minified
- Signed for distribution

---

## Testing Builds

### iOS Testing

**Option 1: TestFlight**
1. Submit to App Store Connect
2. Add internal testers
3. Distribute via TestFlight

**Option 2: Ad Hoc Distribution**
1. Build with `preview` profile
2. Register device UDIDs
3. Install via link

### Android Testing

**Option 1: Internal Testing**
1. Upload to Google Play Console
2. Add internal testers
3. Distribute via Play Store

**Option 2: Direct Installation**
1. Build with `preview` profile
2. Download `.apk`
3. Install on device

---

## Environment Variables

Set environment variables for production builds:

```bash
# Set Mixpanel token
eas secret:create --scope project --name EXPO_PUBLIC_MIXPANEL_TOKEN --value "your_token_here"

# Set API URL
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.yourfintech.app"

# List secrets
eas secret:list

# Delete secret
eas secret:delete --name EXPO_PUBLIC_MIXPANEL_TOKEN
```

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/eas-build.yml`:

```yaml
name: EAS Build
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install -g eas-cli
      - run: eas build --platform all --non-interactive --no-wait
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
eas-build:
  image: node:18
  script:
    - npm install -g eas-cli
    - eas build --platform all --non-interactive --no-wait
  only:
    - main
```

---

## Cost Estimation

### EAS Build Pricing

- **Free tier**: 30 builds/month
- **Production tier**: $29/month (unlimited builds)
- **Enterprise tier**: Custom pricing

### App Store Costs

- **Apple Developer**: $99/year
- **Google Play Developer**: $25 one-time

**Total first year**: $99 + $25 = $124

---

## Next Steps

After successful build and submission:

1. **Monitor Review Status**
   - iOS: 24-48 hours
   - Android: 1-3 days

2. **Prepare Marketing Materials**
   - App Store screenshots
   - Promotional text
   - App preview video (optional)

3. **Plan Launch Strategy**
   - Set release date
   - Prepare press release
   - Notify users

4. **Set Up Analytics**
   - Configure Mixpanel
   - Set up crash reporting
   - Monitor user feedback

---

## Support

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **Expo Forums**: https://forums.expo.dev/
- **Discord**: https://chat.expo.dev/

---

## Checklist

Before building:

- [ ] All features tested
- [ ] No TypeScript errors (`pnpm check`)
- [ ] No console errors
- [ ] App icon finalized
- [ ] Splash screen configured
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Environment variables set
- [ ] EAS CLI installed
- [ ] Expo account created
- [ ] Apple Developer account active (iOS)
- [ ] Google Play Developer account active (Android)

Good luck with your build! 🚀
