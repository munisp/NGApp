# App Store Submission Guide

Complete guide for submitting the African Fintech Mobile App to Apple App Store and Google Play Store.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [App Store Connect Setup (iOS)](#app-store-connect-setup-ios)
3. [Google Play Console Setup (Android)](#google-play-console-setup-android)
4. [Building with EAS Build](#building-with-eas-build)
5. [App Store Assets](#app-store-assets)
6. [App Descriptions](#app-descriptions)
7. [Privacy Policy & Terms](#privacy-policy--terms)
8. [Submission Checklist](#submission-checklist)
9. [Post-Submission](#post-submission)

---

## Prerequisites

### 1. Expo Account

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Initialize EAS in project
cd /home/ubuntu/fintech-mobile-app
eas init
```

### 2. Apple Developer Account

- Cost: $99/year
- Sign up: https://developer.apple.com/programs/
- Verify identity (takes 24-48 hours)

### 3. Google Play Developer Account

- Cost: $25 one-time fee
- Sign up: https://play.google.com/console/signup
- Verify identity (takes 24-48 hours)

---

## App Store Connect Setup (iOS)

### 1. Create App ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click "+" to create new identifier
3. Select "App IDs" → Continue
4. Select "App" → Continue
5. Fill in details:
   - Description: `African Fintech Mobile App`
   - Bundle ID: `space.manus.fintech.mobile.app.t20260122093135` (from app.config.ts)
   - Capabilities: Enable the following:
     - ✅ Associated Domains
     - ✅ Push Notifications
     - ✅ Sign in with Apple (if using)
     - ✅ Apple Pay (if using)
6. Click "Continue" → "Register"

### 2. Create Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click "+" to create new profile
3. Select "App Store" → Continue
4. Select your App ID → Continue
5. Select your certificate → Continue
6. Name it: `African Fintech App Store Profile`
7. Click "Generate" → Download

### 3. Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com/
2. Click "My Apps" → "+" → "New App"
3. Fill in details:
   - Platform: iOS
   - Name: `African Fintech`
   - Primary Language: English (U.S.)
   - Bundle ID: Select your registered bundle ID
   - SKU: `african-fintech-001`
   - User Access: Full Access
4. Click "Create"

### 4. Fill in App Information

**App Information:**
- Subtitle: `Smart Banking for Africa`
- Category: Primary - Finance, Secondary - Productivity
- Content Rights: Check if you own all rights

**Pricing and Availability:**
- Price: Free
- Availability: All countries (or select specific African countries)

**App Privacy:**
- Privacy Policy URL: `https://yourfintech.app/privacy`
- Data Collection: Fill in based on your data practices
  - Financial Info: Yes (transactions, budgets, investments)
  - Contact Info: Yes (email, phone)
  - Identifiers: Yes (user ID)
  - Usage Data: Yes (analytics)

**Age Rating:**
- Answer questionnaire (likely 4+)

---

## Google Play Console Setup (Android)

### 1. Create App

1. Go to https://play.google.com/console/
2. Click "Create app"
3. Fill in details:
   - App name: `African Fintech`
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
   - Declarations: Check all boxes
4. Click "Create app"

### 2. Set Up App Content

**App access:**
- All functionality is available without restrictions: Yes

**Ads:**
- Does your app contain ads? No (or Yes if you plan to add)

**Content rating:**
- Fill out questionnaire
- Category: Finance
- Select "No" for violence, mature content, etc.

**Target audience:**
- Age group: 18+ (financial app)

**News app:**
- Is this a news app? No

**Data safety:**
- Does your app collect or share user data? Yes
- Data types collected:
  - Financial info (transactions, account balance)
  - Personal info (name, email, phone)
  - Location (for branch finder)
- Data security: Encrypted in transit and at rest

**Government apps:**
- Is this a government app? No

### 3. Store Listing

**App details:**
- App name: `African Fintech`
- Short description (80 chars): `Smart banking, investments & savings for Africa. AI-powered financial insights.`
- Full description: (See [App Descriptions](#app-descriptions) section)

**Graphics:**
- App icon: 512 x 512 px (see assets/images/icon.png)
- Feature graphic: 1024 x 500 px
- Phone screenshots: At least 2 (see [App Store Assets](#app-store-assets))
- 7-inch tablet screenshots: At least 2
- 10-inch tablet screenshots: At least 2

**Categorization:**
- App category: Finance
- Tags: banking, fintech, investments, savings, budget

**Contact details:**
- Email: support@yourfintech.app
- Phone: +234-XXX-XXX-XXXX (optional)
- Website: https://yourfintech.app

**Privacy policy:**
- URL: https://yourfintech.app/privacy

---

## Building with EAS Build

### 1. Configure EAS Build

The `eas.json` file is already configured. Review it:

```bash
cat eas.json
```

### 2. Build for iOS

```bash
# Build for iOS App Store
eas build --platform ios --profile production

# This will:
# 1. Ask for Apple credentials
# 2. Create certificates and provisioning profiles
# 3. Build the app on Expo servers
# 4. Provide download link for .ipa file
```

### 3. Build for Android

```bash
# Build for Google Play Store
eas build --platform android --profile production

# This will:
# 1. Ask for keystore password (or generate new one)
# 2. Build the app on Expo servers
# 3. Provide download link for .aab file
```

### 4. Submit Builds

**iOS:**
```bash
# Submit directly to App Store Connect
eas submit --platform ios

# Or manually:
# 1. Download .ipa from EAS Build
# 2. Use Transporter app to upload to App Store Connect
```

**Android:**
```bash
# Submit directly to Google Play Console
eas submit --platform android

# Or manually:
# 1. Download .aab from EAS Build
# 2. Upload to Google Play Console → Production → Create new release
```

---

## App Store Assets

### Required Sizes

**iOS App Icon:**
- 1024 x 1024 px (App Store)
- Already in: `assets/images/icon.png`

**iOS Screenshots:**
- 6.5" Display (iPhone 14 Pro Max, 15 Pro Max): 1290 x 2796 px (at least 3)
- 5.5" Display (iPhone 8 Plus): 1242 x 2208 px (at least 3)
- 12.9" iPad Pro: 2048 x 2732 px (at least 2)

**Android App Icon:**
- 512 x 512 px (Google Play)
- Already in: `assets/images/icon.png`

**Android Screenshots:**
- Phone: 1080 x 1920 px or higher (at least 2)
- 7" Tablet: 1200 x 1920 px (at least 2)
- 10" Tablet: 1600 x 2560 px (at least 2)

### Screenshot Guidelines

**Recommended Screenshots (in order):**

1. **Home Dashboard**
   - Show account balance, recent transactions
   - Highlight AI insights card

2. **Budget Tracking**
   - Display budget categories with progress bars
   - Show spending alerts

3. **Investment Portfolio**
   - Show stock holdings with real-time prices
   - Display portfolio performance chart

4. **AI Financial Advisor**
   - Show chatbot conversation
   - Highlight personalized recommendations

5. **Savings Goals**
   - Display savings goals with progress
   - Show automated round-up feature

6. **Transaction History**
   - Show categorized transactions
   - Highlight smart categorization

### Creating Screenshots

**Option 1: Use Expo Go on Physical Device**
```bash
# Generate QR code
cd /home/ubuntu/fintech-mobile-app
pnpm qr

# Scan with Expo Go app
# Navigate through app and take screenshots
```

**Option 2: Use iOS Simulator**
```bash
# Start iOS simulator
pnpm ios

# Take screenshots: Cmd + S
# Screenshots saved to Desktop
```

**Option 3: Use Android Emulator**
```bash
# Start Android emulator
pnpm android

# Take screenshots: Ctrl + S (Windows/Linux) or Cmd + S (Mac)
```

**Option 4: Use Screenshot Tools**
- Figma: Design mockups with app screenshots
- Canva: Create marketing screenshots with text overlays
- Screenshot Maker: https://screenshots.pro/

---

## App Descriptions

### iOS App Store Description

```
AFRICAN FINTECH - Smart Banking for Africa

Take control of your finances with Africa's most intelligent fintech app. Built specifically for African users, African Fintech combines traditional banking with cutting-edge AI technology to help you save, invest, and grow your wealth.

🤖 AI-POWERED FINANCIAL INSIGHTS
• Get personalized financial advice from our AI chatbot
• Receive predictive alerts before you overspend
• Smart transaction categorization with 95% accuracy
• Tax optimization recommendations for your country

💰 SMART SAVINGS & INVESTMENTS
• Automated savings with intelligent round-up
• Track cryptocurrency portfolios (Bitcoin, Ethereum)
• Real-time stock prices from NSE, JSE, and GSE
• Investment risk assessment with portfolio optimization

📊 COMPREHENSIVE MONEY MANAGEMENT
• Track all your accounts in one place
• Set budgets and monitor spending in real-time
• Visualize your financial health with beautiful charts
• Export tax reports for Nigeria, Kenya, Ghana, South Africa

🔒 BANK-LEVEL SECURITY
• Biometric authentication (Face ID, Fingerprint)
• End-to-end encryption
• KYC verification for enhanced security
• Secure payment gateway integration

🌍 BUILT FOR AFRICA
• Support for Naira, Shilling, Cedi, Rand
• Integration with Paystack and Flutterwave
• Real-time African stock market data
• Country-specific tax calculations

FEATURES:
✓ Account aggregation
✓ Budget tracking
✓ Bill reminders
✓ Savings goals
✓ Investment tracking
✓ Credit score monitoring
✓ Expense forecasting
✓ Receipt scanning (OCR)
✓ Multi-currency support
✓ Dark mode

Download African Fintech today and join thousands of Africans taking control of their financial future.

---

Privacy Policy: https://yourfintech.app/privacy
Terms of Service: https://yourfintech.app/terms
Support: support@yourfintech.app
```

### Google Play Store Description

```
AFRICAN FINTECH - Smart Banking for Africa

🚀 Africa's #1 AI-Powered Financial App

Take control of your money with African Fintech - the smart banking app built specifically for African users. Combine traditional banking with cutting-edge AI technology to save more, invest better, and achieve your financial goals.

🤖 AI FINANCIAL ADVISOR
Get personalized financial advice 24/7 from our intelligent chatbot. Ask questions about budgeting, saving, investing, or taxes and receive instant, tailored recommendations based on your financial situation.

💸 AUTOMATED SAVINGS
Save money effortlessly with our intelligent round-up feature. Every transaction is rounded up to the nearest amount, and the difference is automatically saved. Our AI analyzes your spending patterns to maximize savings without impacting your cash flow.

📈 INVESTMENT TRACKING
Track your investments across stocks, crypto, and mutual funds. Get real-time prices from Nigerian Stock Exchange (NSE), Johannesburg Stock Exchange (JSE), and Ghana Stock Exchange (GSE). Monitor Bitcoin and Ethereum portfolios with live price updates.

🎯 SMART BUDGETING
Set budgets for different categories and receive predictive alerts before you overspend. Our AI learns your spending patterns and warns you when you're at risk of exceeding your budget.

🧾 RECEIPT SCANNING
Snap a photo of any receipt and our OCR technology automatically extracts the merchant, amount, and category. No more manual data entry!

💳 PAYMENT INTEGRATION
Send and receive money with Paystack and Flutterwave integration. Support for bank transfers, mobile money, USSD, and card payments across Nigeria, Kenya, Ghana, and South Africa.

📊 TAX OPTIMIZATION
Get country-specific tax calculations and optimization tips for Nigeria, Kenya, Ghana, and South Africa. Automatically detect tax-deductible expenses and generate tax reports.

🔐 SECURITY FIRST
• Biometric authentication (fingerprint, face unlock)
• End-to-end encryption
• KYC verification
• Bank-level security standards
• Regular security audits

🌍 MULTI-CURRENCY SUPPORT
Track accounts in Naira (₦), Shilling (KSh), Cedi (₵), and Rand (R). Automatic currency conversion for international transactions.

COMPLETE FEATURE LIST:
✓ Account aggregation (link all your bank accounts)
✓ Real-time transaction tracking
✓ Smart categorization with ML
✓ Budget creation and monitoring
✓ Savings goals with progress tracking
✓ Bill reminders and recurring payments
✓ Investment portfolio management
✓ Cryptocurrency tracking
✓ Credit score monitoring
✓ Expense forecasting
✓ Financial insights and reports
✓ Receipt OCR scanning
✓ Tax calculation and export
✓ Multi-user support
✓ Dark mode
✓ Offline mode

WHY AFRICAN FINTECH?
• Built specifically for African markets
• AI-powered insights and recommendations
• Support for local payment methods
• Real-time African stock market data
• Country-specific tax calculations
• Free to use with no hidden fees

Join thousands of Africans who are already using African Fintech to achieve their financial goals. Download now and take the first step towards financial freedom!

---

📧 Support: support@yourfintech.app
🌐 Website: https://yourfintech.app
📄 Privacy: https://yourfintech.app/privacy
📜 Terms: https://yourfintech.app/terms
```

---

## Privacy Policy & Terms

### Privacy Policy Template

Create a file at `https://yourfintech.app/privacy` with the following content:

```markdown
# Privacy Policy

Last updated: January 22, 2026

## Introduction

African Fintech ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.

## Information We Collect

### Personal Information
- Name, email address, phone number
- Date of birth, address
- Government-issued ID (for KYC verification)
- Biometric data (for authentication)

### Financial Information
- Bank account details
- Transaction history
- Budget and savings goals
- Investment holdings
- Credit score data

### Usage Information
- Device information (model, OS version)
- App usage analytics
- Location data (for branch finder)
- Crash reports and diagnostics

## How We Use Your Information

- Provide and improve our services
- Process transactions and payments
- Generate personalized financial insights
- Send notifications and alerts
- Comply with legal obligations
- Prevent fraud and enhance security

## Data Security

We implement industry-standard security measures:
- End-to-end encryption
- Secure data storage
- Regular security audits
- Access controls and authentication

## Data Sharing

We do not sell your personal information. We may share data with:
- Payment processors (Paystack, Flutterwave)
- Banking partners (with your consent)
- Service providers (cloud hosting, analytics)
- Law enforcement (when required by law)

## Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your account and data
- Export your data
- Opt-out of marketing communications

## Contact Us

For privacy concerns, contact us at:
Email: privacy@yourfintech.app
Address: [Your Company Address]

## Changes to This Policy

We may update this policy from time to time. We will notify you of any changes by posting the new policy on this page.
```

### Terms of Service Template

Create a file at `https://yourfintech.app/terms` with standard terms of service.

---

## Submission Checklist

### Pre-Submission

- [ ] App builds successfully on EAS
- [ ] All features tested on physical devices
- [ ] No crashes or critical bugs
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Support email active
- [ ] App icon finalized (1024x1024)
- [ ] Screenshots prepared (all sizes)
- [ ] App descriptions written
- [ ] Keywords researched
- [ ] Age rating determined

### iOS Submission

- [ ] Apple Developer account active
- [ ] App ID created
- [ ] Provisioning profile generated
- [ ] App created in App Store Connect
- [ ] App information filled
- [ ] Pricing set (Free)
- [ ] Privacy details completed
- [ ] Age rating completed
- [ ] Build uploaded via EAS or Transporter
- [ ] Build selected for submission
- [ ] Screenshots uploaded (all sizes)
- [ ] App description added
- [ ] Keywords added (max 100 characters)
- [ ] Support URL added
- [ ] Marketing URL added (optional)
- [ ] App review information completed
- [ ] Export compliance answered
- [ ] Submitted for review

### Android Submission

- [ ] Google Play Developer account active
- [ ] App created in Play Console
- [ ] Store listing completed
- [ ] Graphics uploaded (icon, feature graphic)
- [ ] Screenshots uploaded (all sizes)
- [ ] App description added
- [ ] Content rating completed
- [ ] Target audience set
- [ ] Data safety completed
- [ ] Pricing set (Free)
- [ ] Countries selected
- [ ] Build uploaded (.aab file)
- [ ] Release notes added
- [ ] Internal testing completed (optional)
- [ ] Submitted for review

---

## Post-Submission

### Review Timeline

**iOS:**
- Typical review time: 24-48 hours
- Can take up to 7 days
- Check status in App Store Connect

**Android:**
- Typical review time: 1-3 days
- Can take up to 7 days
- Check status in Play Console

### Common Rejection Reasons

**iOS:**
1. Incomplete information
2. Crashes or bugs
3. Privacy policy issues
4. Misleading screenshots
5. Guideline violations

**Android:**
1. Content policy violations
2. Broken functionality
3. Misleading content
4. Privacy policy missing
5. Permissions not justified

### If Rejected

1. Read rejection reason carefully
2. Fix the issues
3. Test thoroughly
4. Resubmit with explanation

### After Approval

1. Announce launch on social media
2. Monitor reviews and ratings
3. Respond to user feedback
4. Track analytics and metrics
5. Plan updates and improvements

---

## App Store Optimization (ASO)

### Keywords Research

**iOS Keywords (100 characters max):**
```
fintech,banking,budget,savings,investment,crypto,stocks,africa,money,finance,wallet,payment,tax
```

**Android Keywords (unlimited):**
- Primary: fintech, banking, budget, savings, investment
- Secondary: cryptocurrency, stocks, africa, money management
- Long-tail: african banking app, budget tracker nigeria, investment app kenya

### App Name Optimization

**iOS:**
- App Name: African Fintech
- Subtitle: Smart Banking for Africa

**Android:**
- App Name: African Fintech - Smart Banking

### Localization

Consider translating to:
- French (for West Africa)
- Swahili (for East Africa)
- Afrikaans (for South Africa)

---

## Support

For submission help:
- Email: support@yourfintech.app
- Expo Forums: https://forums.expo.dev/
- EAS Build Docs: https://docs.expo.dev/build/introduction/

Good luck with your submission! 🚀
