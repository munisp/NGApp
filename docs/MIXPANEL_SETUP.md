# Mixpanel Setup Guide

Complete guide for setting up Mixpanel analytics in the African Fintech Mobile App.

## Table of Contents

1. [Create Mixpanel Account](#create-mixpanel-account)
2. [Get Project Token](#get-project-token)
3. [Configure App](#configure-app)
4. [Test Analytics](#test-analytics)
5. [Tracked Events](#tracked-events)
6. [Best Practices](#best-practices)

---

## Create Mixpanel Account

### 1. Sign Up

1. Go to https://mixpanel.com/register/
2. Choose "Start Free" (no credit card required)
3. Fill in your details:
   - Email: your-email@example.com
   - Password: (create strong password)
   - Company name: African Fintech
4. Click "Get Started"

### 2. Create Project

1. After signup, you'll be prompted to create a project
2. Project name: `African Fintech Mobile App`
3. Industry: Financial Services
4. Data residency: Choose your region (EU or US)
5. Click "Create Project"

---

## Get Project Token

### 1. Find Your Token

1. In Mixpanel dashboard, click your profile icon (top right)
2. Select "Project Settings"
3. Under "Access Keys", you'll see:
   - **Project Token**: This is what you need
   - **API Secret**: Keep this secure (not needed for mobile app)

### 2. Copy Token

Your token will look like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

Copy this token - you'll need it in the next step.

---

## Configure App

### 1. Add Token to Environment

**Option A: Using .env file (Development)**

Create or edit `.env` file in project root:

```bash
# Mixpanel Configuration
MIXPANEL_TOKEN=your_token_here
```

**Option B: Using app.config.ts (Production)**

Edit `app.config.ts`:

```typescript
const env = {
  // ... existing config
  mixpanelToken: process.env.MIXPANEL_TOKEN || 'your_token_here',
};
```

### 2. Initialize Mixpanel

The app is already configured to initialize Mixpanel. The initialization happens in `app/_layout.tsx`:

```typescript
import { analytics } from '@/lib/analytics';
import Constants from 'expo-constants';

// In your root layout component
useEffect(() => {
  const mixpanelToken = Constants.expoConfig?.extra?.mixpanelToken;
  if (mixpanelToken) {
    analytics.initialize(mixpanelToken);
  }
}, []);
```

### 3. Update app.config.ts

Add Mixpanel token to extra config:

```typescript
export default {
  // ... existing config
  extra: {
    mixpanelToken: process.env.MIXPANEL_TOKEN,
  },
};
```

### 4. Restart Dev Server

```bash
# Stop current server (Ctrl+C)
# Restart
pnpm dev
```

---

## Test Analytics

### 1. Enable Debug Mode

In development, Mixpanel logs all events to console. Check your terminal for:

```
[Analytics] Mixpanel initialized
[Analytics] Event tracked: Screen Viewed { screen_name: 'Home' }
[Analytics] User identified: user_123
```

### 2. Test in Mixpanel Dashboard

1. Go to https://mixpanel.com/
2. Select your project
3. Click "Events" in left sidebar
4. You should see events appearing in real-time
5. Common test events:
   - `Screen Viewed`
   - `User Signed Up`
   - `Transaction Added`

### 3. Test User Identification

After user logs in, check Mixpanel "Users" section:
1. Click "Users" in left sidebar
2. Search for your test user ID
3. View user profile with properties:
   - `$name`
   - `$email`
   - `country`
   - `currency`

### 4. Test Funnels

Create a simple funnel to test conversion tracking:
1. Click "Funnels" in left sidebar
2. Create new funnel: "Onboarding Completion"
3. Steps:
   - Step 1: `Onboarding Started`
   - Step 2: `Onboarding Step Completed`
   - Step 3: `Onboarding Completed`
4. Run funnel to see conversion rates

---

## Tracked Events

The app tracks 50+ events across all features. Here are the key categories:

### Authentication Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `User Signed Up` | `method`, `country` | After successful registration |
| `User Logged In` | `method`, `device_type` | After successful login |
| `User Logged Out` | - | When user logs out |

### Onboarding Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `Onboarding Started` | - | When user opens onboarding |
| `Onboarding Step Completed` | `step_number`, `step_title` | After each step |
| `Onboarding Completed` | - | After final step |
| `Onboarding Skipped` | `last_step` | When user skips |

### Transaction Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `Transaction Added` | `amount`, `category`, `type` | After adding transaction |
| `Transaction Viewed` | `transaction_id` | When viewing details |
| `Receipt Scanned` | `success`, `merchant` | After OCR scan |

### ML Feature Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `AI Advisor Opened` | - | When opening chatbot |
| `AI Advisor Message Sent` | `message_length` | After sending message |
| `Predictive Alert Viewed` | `alert_type`, `severity` | When viewing alert |
| `Smart Categorization Used` | `category`, `confidence` | After auto-categorization |
| `Tax Optimization Viewed` | `country`, `potential_savings` | When viewing tax tips |
| `Credit Score Checked` | `score`, `change` | When checking score |

### Investment Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `Investment Added` | `type`, `amount`, `symbol` | After adding investment |
| `Portfolio Viewed` | `total_value`, `holdings_count` | When viewing portfolio |
| `Stock Searched` | `query`, `exchange` | When searching stocks |

### Payment Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `Payment Initiated` | `amount`, `gateway`, `method` | When starting payment |
| `Payment Completed` | `amount`, `gateway`, `transaction_id` | After successful payment |
| `Payment Failed` | `amount`, `gateway`, `error_code` | When payment fails |

### Budget & Savings Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `Budget Created` | `category`, `amount`, `period` | After creating budget |
| `Budget Exceeded` | `category`, `overage_amount` | When exceeding budget |
| `Savings Goal Created` | `name`, `target_amount`, `deadline` | After creating goal |
| `Savings Goal Achieved` | `name`, `final_amount` | When reaching goal |
| `Round Up Enabled` | `rule_type` | When enabling round-up |

### KYC Events

| Event | Properties | When Triggered |
|-------|-----------|----------------|
| `KYC Started` | - | When starting verification |
| `KYC Document Uploaded` | `document_type` | After uploading document |
| `KYC Facial Recognition Completed` | `success` | After face scan |
| `KYC Completed` | `verification_level` | After full verification |

---

## Best Practices

### 1. Event Naming

✅ **Good:**
- `Transaction Added`
- `Budget Created`
- `Payment Completed`

❌ **Bad:**
- `transaction_added` (use Title Case)
- `user clicked button` (too generic)
- `txn_add` (use full words)

### 2. Property Naming

✅ **Good:**
- `transaction_id`
- `amount_usd`
- `category_name`

❌ **Bad:**
- `TransactionID` (use snake_case)
- `amt` (use full words)
- `cat` (ambiguous)

### 3. User Properties

Set user properties after login:

```typescript
analytics.identify(user.id, {
  $name: user.name,
  $email: user.email,
  country: user.country,
  currency: user.currency,
  account_type: user.accountType,
  kyc_verified: user.kycVerified,
  created_at: user.createdAt,
});
```

### 4. Super Properties

Set super properties that apply to all events:

```typescript
analytics.setSuperProperties({
  app_version: Constants.expoConfig?.version,
  platform: Platform.OS,
  device_model: Constants.deviceName,
  country: user.country,
});
```

### 5. Event Timing

Time long-running operations:

```typescript
// Start timing
analytics.timeEvent('Portfolio Sync');

// ... perform sync ...

// Track with duration
analytics.track('Portfolio Sync', {
  holdings_count: holdings.length,
  success: true,
});
```

### 6. Error Tracking

Always track errors:

```typescript
analytics.track('Error Occurred', {
  error_type: 'API Error',
  error_message: error.message,
  error_code: error.code,
  screen_name: 'Transactions',
  user_action: 'fetch_transactions',
});
```

### 7. Privacy Compliance

**Never track:**
- Passwords
- Credit card numbers
- Social security numbers
- Full bank account numbers
- Biometric data

**OK to track:**
- User ID (hashed)
- Email (if user consents)
- Transaction amounts (aggregated)
- Device info
- Usage patterns

### 8. Data Retention

Configure data retention in Mixpanel:
1. Go to Project Settings
2. Click "Data & Privacy"
3. Set retention period (default: 5 years)
4. Enable "Delete user data on request"

### 9. GDPR Compliance

Implement user data deletion:

```typescript
// When user requests data deletion
analytics.reset(); // Clear local data
// Call your backend to delete from Mixpanel
await api.deleteUserData(userId);
```

### 10. Testing

Create separate projects for development and production:
- Development: `African Fintech Mobile App (Dev)`
- Production: `African Fintech Mobile App`

Use different tokens for each environment.

---

## Troubleshooting

### Events Not Appearing

1. **Check token**: Verify token is correct in `.env`
2. **Check initialization**: Look for `[Analytics] Mixpanel initialized` in console
3. **Check network**: Ensure device has internet connection
4. **Check Mixpanel status**: https://status.mixpanel.com/
5. **Force flush**: Call `analytics.flush()` to send queued events

### User Not Identified

1. **Check identify call**: Ensure `analytics.identify()` is called after login
2. **Check user ID**: Verify user ID is valid (not null/undefined)
3. **Check timing**: Identify must be called before tracking events

### Properties Not Showing

1. **Check property names**: Use snake_case, not camelCase
2. **Check property types**: Mixpanel supports string, number, boolean, date
3. **Check property values**: Ensure values are not null/undefined

---

## Advanced Features

### 1. Cohort Analysis

Create cohorts based on user behavior:
1. Click "Cohorts" in Mixpanel
2. Create cohort: "Active Investors"
3. Criteria: `Investment Added` in last 30 days
4. Use cohort in reports and funnels

### 2. Retention Analysis

Track user retention:
1. Click "Retention" in Mixpanel
2. First event: `User Signed Up`
3. Return event: `Transaction Added`
4. View retention curve

### 3. Revenue Tracking

Track revenue from payments:

```typescript
analytics.track('Payment Completed', {
  amount: 100.00,
  currency: 'NGN',
  gateway: 'Paystack',
});

// Set revenue property
analytics.getPeople().trackCharge(100.00, {
  currency: 'NGN',
  payment_method: 'card',
});
```

### 4. A/B Test Analysis

Analyze A/B test results:
1. Track variant assignment:
```typescript
analytics.track('Feature Flag Variant Assigned', {
  flag_key: 'onboarding_variant',
  variant: 'B',
});
```
2. In Mixpanel, create report comparing variants
3. Segment by `variant` property

---

## Support

- Mixpanel Docs: https://docs.mixpanel.com/
- Mixpanel Support: https://mixpanel.com/get-support
- Community Forum: https://community.mixpanel.com/

---

## Next Steps

After setting up Mixpanel:

1. **Create Dashboards**: Build custom dashboards for key metrics
2. **Set Up Alerts**: Get notified when metrics change significantly
3. **Integrate with Tools**: Connect Mixpanel to Slack, email, etc.
4. **Train Team**: Share access with team members
5. **Review Weekly**: Schedule weekly analytics review meetings

Good luck with your analytics! 📊
