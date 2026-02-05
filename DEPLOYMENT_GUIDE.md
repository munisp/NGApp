# African Fintech Mobile App - Deployment Guide

Complete guide for deploying the African Fintech Mobile App to production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Building for Production](#building-for-production)
4. [App Store Submission](#app-store-submission)
5. [Backend Deployment](#backend-deployment)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

1. **Expo Account**
   - Sign up at [expo.dev](https://expo.dev)
   - Install EAS CLI: `npm install -g eas-cli`
   - Login: `eas login`

2. **Apple Developer Account** (for iOS)
   - Enroll at [developer.apple.com](https://developer.apple.com)
   - Cost: $99/year
   - Required for App Store submission

3. **Google Play Console** (for Android)
   - Sign up at [play.google.com/console](https://play.google.com/console)
   - One-time fee: $25
   - Required for Play Store submission

4. **Payment Gateway Accounts**
   - **Paystack**: Sign up at [paystack.com](https://paystack.com)
   - **Flutterwave**: Sign up at [flutterwave.com](https://flutterwave.com)
   - Get production API keys

### Development Tools

- Node.js 22.13.0+
- pnpm 9.12.0+
- EAS CLI (latest version)
- Xcode (for iOS builds - Mac only)
- Android Studio (for Android builds)

---

## Environment Setup

### 1. Configure Environment Variables

Create `.env.production` file:

```bash
# App Configuration
NODE_ENV=production
EXPO_PUBLIC_API_URL=https://your-production-api.com
EXPO_PUBLIC_APP_VERSION=1.0.0

# Payment Gateway (Paystack)
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx

# Payment Gateway (Flutterwave)
EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxx
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_TESTxxxxxxxxxxxxx

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Push Notifications
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id

# Analytics (Optional)
SENTRY_DSN=https://xxxxxxxxxxxxx@sentry.io/xxxxxxxxxxxxx
GOOGLE_ANALYTICS_ID=UA-XXXXX-X
```

### 2. Update App Configuration

Edit `app.config.ts`:

```typescript
const env = {
  appName: "African Fintech",
  appSlug: "african-fintech",
  logoUrl: "https://your-cdn.com/logo.png", // Upload your logo
  scheme: "africanfintech",
  iosBundleId: "space.manus.african.fintech.app",
  androidPackage: "space.manus.african.fintech.app",
};
```

### 3. Configure EAS Build

The `eas.json` file is already configured. Update these fields:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      }
    }
  }
}
```

---

## Building for Production

### iOS Build

#### Step 1: Configure iOS Credentials

```bash
# Generate and configure iOS credentials
eas credentials

# Or let EAS handle it automatically
eas build --platform ios --profile production
```

#### Step 2: Build for iOS

```bash
# Build for iOS App Store
eas build --platform ios --profile production-ios

# This will:
# - Create production build
# - Generate .ipa file
# - Upload to EAS servers
```

#### Step 3: Download Build

```bash
# Download the .ipa file
eas build:download --platform ios --latest
```

### Android Build

#### Step 1: Generate Keystore

```bash
# EAS will generate keystore automatically
# Or provide your own in eas.json
eas build --platform android --profile production-android
```

#### Step 2: Build for Android

```bash
# Build Android App Bundle (.aab)
eas build --platform android --profile production-android

# This will:
# - Create production build
# - Generate .aab file
# - Sign with keystore
# - Upload to EAS servers
```

#### Step 3: Download Build

```bash
# Download the .aab file
eas build:download --platform android --latest
```

### Build Both Platforms

```bash
# Build for both iOS and Android
eas build --platform all --profile production
```

---

## App Store Submission

### iOS App Store

#### Step 1: Prepare App Store Assets

Create the following in `app-store-assets/ios/`:

1. **Screenshots** (required for all device sizes):
   - iPhone 6.7" (1290x2796)
   - iPhone 6.5" (1242x2688)
   - iPhone 5.5" (1242x2208)
   - iPad Pro 12.9" (2048x2732)

2. **App Icon** (1024x1024, no transparency)

3. **App Preview Video** (optional, 30 seconds max)

#### Step 2: Create App Store Connect Listing

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in app information:
   - **Name**: African Fintech
   - **Primary Language**: English
   - **Bundle ID**: space.manus.african.fintech.app
   - **SKU**: african-fintech-001

4. Add app description:

```
African Fintech is your all-in-one financial management app designed for Africa. 
Send money, pay bills, invest, save, and manage your finances with ease.

Features:
• Multi-currency support (NGN, GHS, KES, ZAR, USD)
• Instant P2P payments
• Bill payments and utilities
• Investment portfolio tracking
• Cryptocurrency wallet
• AI-powered financial advisor
• Budget tracking and alerts
• Credit score monitoring
• And 70+ more features!

Secure, fast, and built for Africa.
```

5. Upload screenshots and app icon

6. Set pricing (Free with in-app purchases)

#### Step 3: Submit for Review

```bash
# Submit to App Store using EAS
eas submit --platform ios --latest

# Or manually upload .ipa to App Store Connect
```

#### Step 4: App Review Information

Provide test account credentials:
- **Email**: testuser@africanfintech.com
- **Password**: SecurePass123!

Add review notes explaining key features and how to test.

### Android Play Store

#### Step 1: Prepare Play Store Assets

Create the following in `app-store-assets/android/`:

1. **Screenshots** (required):
   - Phone (1080x1920 minimum)
   - 7-inch tablet (1024x600 minimum)
   - 10-inch tablet (1280x800 minimum)

2. **Feature Graphic** (1024x500)

3. **App Icon** (512x512)

#### Step 2: Create Play Console Listing

1. Go to [Google Play Console](https://play.google.com/console)
2. Click "Create app"
3. Fill in app details:
   - **App name**: African Fintech
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free

4. Complete the store listing:
   - **Short description** (80 characters max)
   - **Full description** (4000 characters max)
   - Upload screenshots and graphics
   - Set content rating
   - Select target audience
   - Add privacy policy URL

5. Set up pricing and distribution:
   - **Countries**: Select African countries
   - **Pricing**: Free
   - **In-app purchases**: Yes

#### Step 3: Submit for Review

```bash
# Submit to Play Store using EAS
eas submit --platform android --latest

# Or manually upload .aab to Play Console
```

#### Step 4: Release

1. Go to "Production" → "Create new release"
2. Upload the .aab file
3. Add release notes
4. Review and roll out to production

---

## Backend Deployment

### Option 1: Deploy to AWS

#### Prerequisites
- AWS account
- AWS CLI installed
- Docker installed

#### Steps

1. **Deploy Python ML Services**

```bash
# Navigate to Python services
cd python-services

# Build Docker image
docker build -t african-fintech-ml .

# Push to AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker tag african-fintech-ml:latest YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/african-fintech-ml:latest
docker push YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/african-fintech-ml:latest

# Deploy to ECS or Lambda
```

2. **Deploy Express.js API**

```bash
# Build production bundle
pnpm build

# Deploy to AWS Elastic Beanstalk or ECS
eb init
eb create african-fintech-api-prod
eb deploy
```

3. **Set up PostgreSQL Database**

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier african-fintech-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username admin \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 20
```

4. **Configure Environment Variables**

```bash
# Set environment variables in AWS
aws elasticbeanstalk update-environment \
  --environment-name african-fintech-api-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value=postgresql://... \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=PAYSTACK_SECRET_KEY,Value=sk_live_...
```

### Option 2: Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create african-fintech-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Set environment variables
heroku config:set PAYSTACK_SECRET_KEY=sk_live_xxxxx
heroku config:set FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx

# Deploy
git push heroku main

# Run migrations
heroku run pnpm db:push
```

### Option 3: Deploy to Vercel/Railway

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or use Railway
railway login
railway init
railway up
```

---

## Post-Deployment

### 1. Monitor Application

#### Set up Sentry for Error Tracking

```bash
# Install Sentry
pnpm add @sentry/react-native

# Configure in app/_layout.tsx
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://xxxxx@sentry.io/xxxxx",
  environment: "production",
});
```

#### Set up Analytics

```bash
# Install analytics
pnpm add @react-native-firebase/analytics

# Or use Amplitude, Mixpanel, etc.
```

### 2. Set up Push Notifications

```bash
# Configure FCM (Firebase Cloud Messaging)
# 1. Create Firebase project
# 2. Download google-services.json (Android)
# 3. Download GoogleService-Info.plist (iOS)
# 4. Add to project
```

### 3. Configure Webhooks

Set up webhooks for payment gateways:

**Paystack Webhook URL:**
```
https://your-api.com/webhooks/paystack
```

**Flutterwave Webhook URL:**
```
https://your-api.com/webhooks/flutterwave
```

### 4. Set up CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

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
          node-version: 22
      - run: pnpm install
      - run: pnpm test
      - run: eas build --platform all --profile production --non-interactive
```

### 5. Database Backups

```bash
# Set up automated backups
# AWS RDS: Enable automated backups
# Heroku: heroku pg:backups:schedule --at '02:00 America/Los_Angeles'
```

---

## Troubleshooting

### Build Failures

**Issue**: iOS build fails with provisioning profile error

**Solution**:
```bash
eas credentials
# Select "Remove all credentials"
# Then rebuild: eas build --platform ios --profile production
```

**Issue**: Android build fails with keystore error

**Solution**:
```bash
# Generate new keystore
eas credentials
# Select "Set up a new keystore"
```

### App Store Rejection

**Common reasons**:
1. Missing privacy policy
2. Incomplete app description
3. Crashes during review
4. Missing test account credentials

**Solution**: Address the issue in App Store Connect and resubmit

### Runtime Errors

**Issue**: App crashes on launch

**Solution**:
1. Check Sentry for error logs
2. Test with production build locally
3. Verify environment variables are set
4. Check API endpoints are accessible

### Payment Gateway Issues

**Issue**: Payments failing in production

**Solution**:
1. Verify you're using live API keys (not test keys)
2. Check webhook URLs are configured
3. Verify SSL certificates are valid
4. Test with small amounts first

---

## Checklist

### Pre-Deployment
- [ ] All features tested and working
- [ ] Environment variables configured
- [ ] API keys updated to production
- [ ] Database migrations run
- [ ] Privacy policy created
- [ ] Terms of service created
- [ ] App icons and screenshots prepared

### iOS Deployment
- [ ] Apple Developer account active
- [ ] App Store Connect listing created
- [ ] Screenshots uploaded
- [ ] App description complete
- [ ] Test account credentials provided
- [ ] Build submitted for review

### Android Deployment
- [ ] Google Play Console account active
- [ ] Play Store listing created
- [ ] Screenshots uploaded
- [ ] Content rating completed
- [ ] Privacy policy URL added
- [ ] Build submitted for review

### Backend Deployment
- [ ] API deployed to production
- [ ] Database configured and migrated
- [ ] Environment variables set
- [ ] Webhooks configured
- [ ] SSL certificates installed
- [ ] Monitoring set up

### Post-Deployment
- [ ] Push notifications tested
- [ ] Payment gateway tested
- [ ] Error tracking configured
- [ ] Analytics set up
- [ ] Backups configured
- [ ] CI/CD pipeline set up

---

## Support

For deployment issues:
- **Expo Documentation**: [docs.expo.dev](https://docs.expo.dev)
- **EAS Build**: [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)
- **App Store Connect**: [developer.apple.com/support](https://developer.apple.com/support)
- **Google Play Console**: [support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer)

---

**Last Updated**: January 22, 2026  
**Version**: 1.0.0  
**Status**: Production Ready
