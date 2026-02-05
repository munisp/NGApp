# EAS Build Automation Guide

Complete guide for automating production builds with EAS Build for the African Fintech Mobile App.

## Overview

EAS (Expo Application Services) Build is a cloud-based build service that compiles your React Native app into native iOS and Android binaries ready for app store submission.

**Key Benefits:**
- No need for Xcode or Android Studio
- Automatic code signing and provisioning
- Cloud-based builds (no local resources needed)
- Parallel iOS and Android builds
- Build caching for faster iterations

---

## Prerequisites

✅ **Completed:**
- EAS CLI installed (v16.28.0)
- Project configured with `eas.json`
- App icons and splash screens ready
- Privacy policy and terms of service published

❌ **Required (User Action):**
- Expo account (sign up at https://expo.dev/)
- Apple Developer Account ($99/year) - for iOS builds
- Google Play Developer Account ($25 one-time) - for Android builds

---

## Step-by-Step Build Process

### Step 1: Create Expo Account

1. Go to https://expo.dev/signup
2. Sign up with email or GitHub
3. Verify your email address
4. **Note your username** (you'll need this for login)

### Step 2: Login to EAS CLI

```bash
cd /home/ubuntu/fintech-mobile-app
eas login
```

Enter your Expo credentials when prompted.

**Troubleshooting:**
- If login fails, try: `eas logout` then `eas login` again
- If 2FA is enabled, use your authenticator app code

### Step 3: Link Project to Expo

```bash
eas init
```

This will:
- Create a project in your Expo account
- Link the local project to Expo
- Generate a project ID in `app.config.ts`

**Expected output:**
```
✔ Project linked successfully
Project ID: abc123def456
```

### Step 4: Configure iOS Credentials

```bash
eas credentials
```

Select:
1. **Platform**: iOS
2. **Profile**: production
3. **Action**: "Set up a new Apple App Identifier"

Follow the prompts:
- Enter your Apple ID email
- Enter your Apple ID password (or app-specific password)
- Select your Apple Developer team (if multiple)
- Confirm bundle ID: `space.manus.fintech.mobile.app.t<timestamp>`

EAS will automatically:
- Create App ID in Apple Developer Portal
- Generate Distribution Certificate
- Create Provisioning Profile
- Store credentials securely in Expo

**Time**: 2-5 minutes

### Step 5: Configure Android Credentials

```bash
eas credentials
```

Select:
1. **Platform**: Android
2. **Profile**: production
3. **Action**: "Generate new keystore"

EAS will automatically:
- Generate Android keystore
- Store credentials securely in Expo
- Configure signing for production builds

**Time**: 1-2 minutes

### Step 6: Build iOS App

```bash
eas build --platform ios --profile production
```

**What happens:**
1. Code uploaded to Expo servers (~30 seconds)
2. Dependencies installed (~2 minutes)
3. Native code compiled (~5-10 minutes)
4. App signed with your credentials (~1 minute)
5. `.ipa` file generated and uploaded

**Total time**: 10-20 minutes

**Build output:**
```
✔ Build finished
Build ID: abc123def456
Build URL: https://expo.dev/accounts/username/projects/fintech-mobile-app/builds/abc123def456
Download: https://expo.dev/artifacts/eas/abc123def456.ipa
```

### Step 7: Build Android App

```bash
eas build --platform android --profile production
```

**What happens:**
1. Code uploaded to Expo servers (~30 seconds)
2. Dependencies installed (~2 minutes)
3. Native code compiled (~5-8 minutes)
4. App signed with your keystore (~1 minute)
5. `.aab` file generated and uploaded

**Total time**: 10-15 minutes

**Build output:**
```
✔ Build finished
Build ID: xyz789abc123
Build URL: https://expo.dev/accounts/username/projects/fintech-mobile-app/builds/xyz789abc123
Download: https://expo.dev/artifacts/eas/xyz789abc123.aab
```

### Step 8: Build Both Platforms Simultaneously

```bash
eas build --platform all --profile production
```

This builds iOS and Android in parallel, saving time.

**Total time**: 10-20 minutes (same as single platform)

---

## Monitoring Builds

### Check Build Status

```bash
eas build:list
```

**Output:**
```
┌────────────┬──────────┬─────────┬──────────────────┬──────────┐
│ Build ID   │ Platform │ Profile │ Status           │ Created  │
├────────────┼──────────┼─────────┼──────────────────┼──────────┤
│ abc123def  │ ios      │ prod    │ finished         │ 5m ago   │
│ xyz789abc  │ android  │ prod    │ in-progress      │ 3m ago   │
└────────────┴──────────┴─────────┴──────────────────┴──────────┘
```

### View Build Logs

```bash
eas build:view <build-id>
```

Or visit: `https://expo.dev/accounts/username/projects/fintech-mobile-app/builds/<build-id>`

### Download Builds

```bash
# Download specific build
eas build:download <build-id>

# Download latest iOS build
eas build:download --platform ios --profile production

# Download latest Android build
eas build:download --platform android --profile production
```

---

## Testing Builds

### iOS Testing

**Option 1: TestFlight (Recommended)**

1. Build is automatically uploaded to App Store Connect
2. Add internal testers in App Store Connect
3. Testers receive email invitation
4. Install via TestFlight app

**Option 2: Ad Hoc Distribution**

1. Build with `preview` profile:
   ```bash
   eas build --platform ios --profile preview
   ```
2. Register device UDIDs in Apple Developer Portal
3. Download `.ipa` and install via link

### Android Testing

**Option 1: Internal Testing (Recommended)**

1. Upload `.aab` to Google Play Console
2. Add internal testers
3. Testers install via Play Store

**Option 2: Direct Installation**

1. Build with `preview` profile:
   ```bash
   eas build --platform android --profile preview
   ```
2. Download `.apk`
3. Install on device (enable "Install from Unknown Sources")

---

## Submitting to App Stores

### Submit to Apple App Store

```bash
eas submit --platform ios
```

**Prerequisites:**
- App created in App Store Connect
- App Store Connect API key (or Apple ID credentials)
- Screenshots and metadata prepared

**What happens:**
1. EAS uploads `.ipa` to App Store Connect
2. App enters "Waiting for Review" status
3. Apple reviews app (24-48 hours)
4. App approved or rejected

### Submit to Google Play Store

```bash
eas submit --platform android
```

**Prerequisites:**
- App created in Google Play Console
- Google Play Service Account JSON key
- Screenshots and metadata prepared

**What happens:**
1. EAS uploads `.aab` to Google Play Console
2. App enters "In Review" status
3. Google reviews app (1-3 days)
4. App approved or rejected

---

## Build Profiles

The app has three build profiles in `eas.json`:

### 1. Development

```bash
eas build --platform ios --profile development
```

**Use case:** Internal development and debugging

**Features:**
- Development client
- Fast builds (no optimization)
- Includes dev tools
- Hot reload enabled

**Build time:** 5-10 minutes

### 2. Preview

```bash
eas build --platform ios --profile preview
```

**Use case:** Beta testing and QA

**Features:**
- Production-like build
- Optimized and minified
- Installable on devices
- No dev tools

**Build time:** 10-15 minutes

### 3. Production

```bash
eas build --platform ios --profile production
```

**Use case:** App store submission

**Features:**
- Fully optimized
- Signed for distribution
- App store ready
- Maximum performance

**Build time:** 10-20 minutes

---

## Environment Variables

Set secrets for production builds:

```bash
# Set Mixpanel token
eas secret:create --scope project --name EXPO_PUBLIC_MIXPANEL_TOKEN --value "your_token_here"

# Set API URL
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.yourfintech.app"

# List all secrets
eas secret:list

# Delete a secret
eas secret:delete --name EXPO_PUBLIC_MIXPANEL_TOKEN
```

---

## Troubleshooting

### Build Failed: "Could not resolve dependencies"

**Solution:**
```bash
# Clear cache and rebuild
eas build --platform ios --profile production --clear-cache
```

### Build Failed: "Code signing error"

**Solution:**
```bash
# Reset iOS credentials
eas credentials --platform ios
# Select "Remove all credentials"
# Then reconfigure credentials
```

### Build Failed: "Out of memory"

**Solution:**
- Reduce bundle size
- Remove unused dependencies
- Optimize images

### Build Stuck: "Waiting in queue"

**Cause:** High demand on Expo servers

**Solution:**
- Wait (usually resolves in 5-10 minutes)
- Upgrade to Expo Production plan for priority builds

### Submission Failed: "Missing required metadata"

**iOS Solution:**
- Add screenshots in App Store Connect
- Set privacy policy URL
- Complete app information

**Android Solution:**
- Add screenshots in Google Play Console
- Complete content rating questionnaire
- Set app category

---

## Cost Breakdown

### EAS Build Pricing

| Plan | Price | Builds/Month | Priority |
|------|-------|--------------|----------|
| **Free** | $0 | 30 | Standard |
| **Production** | $29/month | Unlimited | High |
| **Enterprise** | Custom | Unlimited | Highest |

### App Store Costs

| Service | Cost | Frequency |
|---------|------|-----------|
| **Apple Developer** | $99 | Annual |
| **Google Play Developer** | $25 | One-time |

**Total first year:** $99 + $25 + ($29 × 12) = $472

**Recommendation:** Start with Free tier (30 builds/month is usually sufficient)

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/eas-build.yml`:

```yaml
name: EAS Build
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Build and Submit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: pnpm install

      - name: Build iOS
        run: eas build --platform ios --profile production --non-interactive --no-wait

      - name: Build Android
        run: eas build --platform android --profile production --non-interactive --no-wait
```

**Setup:**
1. Go to https://expo.dev/accounts/[account]/settings/access-tokens
2. Create new token
3. Add to GitHub Secrets as `EXPO_TOKEN`

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build

eas-build:
  stage: build
  image: node:18
  before_script:
    - npm install -g pnpm eas-cli
    - pnpm install
  script:
    - eas build --platform all --profile production --non-interactive --no-wait
  only:
    - main
  variables:
    EXPO_TOKEN: $EXPO_TOKEN
```

**Setup:**
1. Create Expo access token
2. Add to GitLab CI/CD Variables as `EXPO_TOKEN`

---

## Best Practices

### 1. Version Management

Update version before each build:

```typescript
// app.config.ts
export default {
  version: "1.0.1", // Increment for each release
  ios: {
    buildNumber: "2", // Increment for each iOS build
  },
  android: {
    versionCode: 2, // Increment for each Android build
  },
};
```

### 2. Build Naming

Use semantic versioning:
- **1.0.0**: Initial release
- **1.0.1**: Bug fixes
- **1.1.0**: New features
- **2.0.0**: Major changes

### 3. Testing Before Build

```bash
# Run tests
pnpm test

# Check TypeScript
pnpm check

# Lint code
pnpm lint
```

### 4. Build Logs

Save build logs for debugging:

```bash
eas build:view <build-id> > build-log.txt
```

### 5. Rollback Strategy

Keep previous builds accessible:

```bash
# List all builds
eas build:list

# Download previous build if needed
eas build:download <previous-build-id>
```

---

## Next Steps After Build

1. **Download Builds**
   ```bash
   eas build:download --platform all --profile production
   ```

2. **Test on Physical Devices**
   - iOS: Install via TestFlight
   - Android: Install via Internal Testing

3. **Prepare App Store Listings**
   - Screenshots (required)
   - App description
   - Keywords
   - Privacy policy URL

4. **Submit to Stores**
   ```bash
   eas submit --platform all
   ```

5. **Monitor Reviews**
   - iOS: 24-48 hours
   - Android: 1-3 days

6. **Plan Marketing**
   - Set release date
   - Prepare press release
   - Notify users

---

## Support Resources

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **Expo Forums**: https://forums.expo.dev/
- **Discord**: https://chat.expo.dev/
- **Status Page**: https://status.expo.dev/

---

## Quick Reference

### Common Commands

```bash
# Login
eas login

# Initialize project
eas init

# Build iOS
eas build --platform ios --profile production

# Build Android
eas build --platform android --profile production

# Build both
eas build --platform all --profile production

# List builds
eas build:list

# View build
eas build:view <build-id>

# Download build
eas build:download <build-id>

# Submit iOS
eas submit --platform ios

# Submit Android
eas submit --platform android

# Manage credentials
eas credentials

# Manage secrets
eas secret:list
eas secret:create --scope project --name KEY --value "value"
eas secret:delete --name KEY
```

---

## Checklist

Before building:

- [ ] EAS CLI installed and logged in
- [ ] Project linked to Expo (`eas init`)
- [ ] iOS credentials configured
- [ ] Android credentials configured
- [ ] App version updated in `app.config.ts`
- [ ] All tests passing (`pnpm test`)
- [ ] No TypeScript errors (`pnpm check`)
- [ ] Environment variables set
- [ ] Privacy policy published
- [ ] Terms of service published

Before submitting:

- [ ] Builds tested on physical devices
- [ ] Screenshots prepared (all required sizes)
- [ ] App description written
- [ ] Keywords selected
- [ ] Privacy policy URL set
- [ ] Support URL set
- [ ] Marketing URL set (optional)
- [ ] Content rating completed (Android)
- [ ] App Store Connect app created (iOS)
- [ ] Google Play Console app created (Android)

Good luck with your builds! 🚀
