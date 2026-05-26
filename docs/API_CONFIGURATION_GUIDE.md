# External API Configuration Guide

This guide provides step-by-step instructions for configuring all external API integrations required for production deployment.

---

## Overview

The platform integrates with multiple external services for full functionality:

1. **Twilio** - SMS notifications (2FA, recovery codes, login alerts)
2. **SendGrid/Resend** - Email services (notifications, recovery codes)
3. **Smile Identity** - KYC verification for remittances
4. **NIBSS** - Nigerian banking integration
5. **Coinbase Commerce** - Cryptocurrency payment processing
6. **Circle** - USDC stablecoin processing

---

## 1. Twilio Configuration (SMS Services)

### Sign Up
1. Visit [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Create a free account (includes $15 trial credit)
3. Verify your phone number

### Get Credentials
1. Navigate to Console Dashboard
2. Copy **Account SID** and **Auth Token**
3. Get a phone number:
   - Go to Phone Numbers → Buy a Number
   - Select a number with SMS capabilities
   - Copy the phone number

### Environment Variables
Add to your `.env` file or environment configuration:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Test Configuration
```bash
# Run the test utility
pnpm test:twilio
```

### Usage in Code
The platform automatically uses Twilio when credentials are configured:
- 2FA verification codes
- Account recovery SMS
- Login notification alerts
- Rate alert notifications

---

## 2. Email Service Configuration

### Option A: SendGrid (Recommended)

#### Sign Up
1. Visit [https://sendgrid.com/pricing/](https://sendgrid.com/pricing/)
2. Create free account (100 emails/day)
3. Verify your email address

#### Get API Key
1. Go to Settings → API Keys
2. Click "Create API Key"
3. Select "Full Access"
4. Copy the API key (shown only once)

#### Verify Sender Identity
1. Go to Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in your email and details
4. Verify the confirmation email

#### Environment Variables
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME="Payment Switch Platform"
```

### Option B: Resend (Alternative)

#### Sign Up
1. Visit [https://resend.com/signup](https://resend.com/signup)
2. Create account (3,000 emails/month free)

#### Get API Key
1. Go to API Keys section
2. Click "Create API Key"
3. Copy the key

#### Environment Variables
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### Test Configuration
```bash
# Run the test utility
pnpm test:email
```

---

## 3. Smile Identity Configuration (KYC Verification)

### Sign Up
1. Visit [https://usesmileid.com/contact-sales/](https://usesmileid.com/contact-sales/)
2. Request a demo/trial account
3. Complete onboarding process

### Get Credentials
1. Access your Smile Identity dashboard
2. Navigate to Settings → API Keys
3. Copy:
   - Partner ID
   - API Key
   - Callback URL (optional)

### Environment Variables
```bash
SMILE_IDENTITY_PARTNER_ID=your_partner_id
SMILE_IDENTITY_API_KEY=your_api_key_here
SMILE_IDENTITY_ENVIRONMENT=sandbox  # or 'production'
```

### Test Configuration
```bash
# Run the test utility
pnpm test:kyc
```

### Supported Verification Types
- BVN (Bank Verification Number) - Nigeria
- NIN (National Identity Number) - Nigeria
- Document verification (ID cards, passports)
- Liveness detection
- AML screening

---

## 4. NIBSS Configuration (Nigerian Banking)

### Sign Up
1. Contact NIBSS directly: [https://nibss-plc.com.ng/](https://nibss-plc.com.ng/)
2. Request access to NIP (NIBSS Instant Payment) API
3. Complete institutional onboarding

### Get Credentials
After approval, you'll receive:
- Organization Code
- API Key
- Certificate files for mTLS

### Environment Variables
```bash
NIBSS_ORGANIZATION_CODE=your_org_code
NIBSS_API_KEY=your_api_key_here
NIBSS_ENVIRONMENT=sandbox  # or 'production'
NIBSS_CERT_PATH=/path/to/certificate.pem
NIBSS_KEY_PATH=/path/to/private_key.pem
```

### Test Configuration
```bash
# Run the test utility
pnpm test:nibss
```

### Available Services
- Name Enquiry (account verification)
- NIP Transfers (instant payments)
- BVN Verification
- Transaction status queries

---

## 5. Coinbase Commerce Configuration (Crypto Payments)

### Sign Up
1. Visit [https://commerce.coinbase.com/signup](https://commerce.coinbase.com/signup)
2. Create account and verify email
3. Complete business verification

### Get API Key
1. Go to Settings → API Keys
2. Click "Create an API Key"
3. Copy the API key

### Get Webhook Secret
1. Go to Settings → Webhook subscriptions
2. Add your webhook URL: `https://yourdomain.com/api/webhooks/coinbase`
3. Copy the webhook shared secret

### Environment Variables
```bash
COINBASE_COMMERCE_API_KEY=your_api_key_here
COINBASE_COMMERCE_WEBHOOK_SECRET=your_webhook_secret
```

### Test Configuration
```bash
# Run the test utility
pnpm test:coinbase
```

### Supported Cryptocurrencies
- Bitcoin (BTC)
- Ethereum (ETH)
- USD Coin (USDC)
- Tether (USDT)

---

## 6. Circle Configuration (USDC Processing)

### Sign Up
1. Visit [https://www.circle.com/en/circle-account](https://www.circle.com/en/circle-account)
2. Create business account
3. Complete KYB verification

### Get API Key
1. Access Circle Console
2. Navigate to Developer → API Keys
3. Create new API key
4. Copy the key

### Environment Variables
```bash
CIRCLE_API_KEY=your_api_key_here
CIRCLE_ENVIRONMENT=sandbox  # or 'production'
```

### Test Configuration
```bash
# Run the test utility
pnpm test:circle
```

---

## Configuration Validation

### Create Test Script

Create `server/scripts/validateApiConfig.ts`:

```typescript
import { testTwilioConnection } from '../services/smsService';
import { testEmailConnection } from '../services/emailService';
import { testSmileIdentity } from '../services/kycService';
import { testNIBSSConnection } from '../remittance/nibssService';
import { testCoinbaseConnection } from '../remittance/coinbaseService';
import { testCircleConnection } from '../remittance/circleService';

async function validateAllApis() {
  console.log('🔍 Validating API Configurations...\n');

  const results = {
    twilio: false,
    email: false,
    kyc: false,
    nibss: false,
    coinbase: false,
    circle: false,
  };

  // Test Twilio
  try {
    await testTwilioConnection();
    results.twilio = true;
    console.log('✅ Twilio: Connected');
  } catch (error) {
    console.log('❌ Twilio: Failed -', error.message);
  }

  // Test Email
  try {
    await testEmailConnection();
    results.email = true;
    console.log('✅ Email Service: Connected');
  } catch (error) {
    console.log('❌ Email Service: Failed -', error.message);
  }

  // Test KYC
  try {
    await testSmileIdentity();
    results.kyc = true;
    console.log('✅ Smile Identity: Connected');
  } catch (error) {
    console.log('❌ Smile Identity: Failed -', error.message);
  }

  // Test NIBSS
  try {
    await testNIBSSConnection();
    results.nibss = true;
    console.log('✅ NIBSS: Connected');
  } catch (error) {
    console.log('❌ NIBSS: Failed -', error.message);
  }

  // Test Coinbase
  try {
    await testCoinbaseConnection();
    results.coinbase = true;
    console.log('✅ Coinbase Commerce: Connected');
  } catch (error) {
    console.log('❌ Coinbase Commerce: Failed -', error.message);
  }

  // Test Circle
  try {
    await testCircleConnection();
    results.circle = true;
    console.log('✅ Circle: Connected');
  } catch (error) {
    console.log('❌ Circle: Failed -', error.message);
  }

  console.log('\n📊 Summary:');
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  console.log(`${passed}/${total} services configured correctly`);

  if (passed === total) {
    console.log('\n🎉 All API integrations are ready for production!');
  } else {
    console.log('\n⚠️  Some services need configuration. See errors above.');
  }
}

validateAllApis().catch(console.error);
```

### Run Validation
```bash
pnpm tsx server/scripts/validateApiConfig.ts
```

---

## Development vs Production

### Development Mode
When credentials are not configured, the platform uses **local simulation**:
- SMS messages logged to `storage/sms/`
- Emails saved to `storage/emails/`
- KYC returns mock success responses
- Banking operations simulated
- Crypto payments use test mode

### Production Mode
When credentials are configured:
- Real SMS sent via Twilio
- Real emails sent via SendGrid/Resend
- Actual KYC verification with Smile Identity
- Live banking transactions via NIBSS
- Real cryptocurrency processing

---

## Security Best Practices

### 1. Never Commit Credentials
Add to `.gitignore`:
```
.env
.env.local
.env.production
```

### 2. Use Environment Variables
- Store credentials in environment variables
- Use secrets management in production (AWS Secrets Manager, HashiCorp Vault)

### 3. Rotate Keys Regularly
- Rotate API keys every 90 days
- Immediately rotate if compromised

### 4. Restrict API Key Permissions
- Use least-privilege principle
- Create separate keys for different environments

### 5. Monitor API Usage
- Set up alerts for unusual activity
- Track API call volumes
- Monitor error rates

---

## Troubleshooting

### Twilio Errors
- **Error 20003**: Invalid phone number format
  - Solution: Use E.164 format (+1234567890)
- **Error 21211**: Invalid 'To' number
  - Solution: Verify phone number in trial account

### SendGrid Errors
- **401 Unauthorized**: Invalid API key
  - Solution: Regenerate API key
- **403 Forbidden**: Sender not verified
  - Solution: Complete sender authentication

### Smile Identity Errors
- **Invalid Partner ID**: Incorrect credentials
  - Solution: Verify Partner ID in dashboard
- **Insufficient Balance**: Account needs funding
  - Solution: Add credits to account

### NIBSS Errors
- **Certificate Error**: mTLS configuration issue
  - Solution: Verify certificate paths and validity
- **Invalid Organization Code**: Wrong credentials
  - Solution: Contact NIBSS support

---

## Cost Estimates

### Monthly Costs (Approximate)

**Twilio**
- $0.0075 per SMS (US)
- $0.0045 per SMS (Nigeria)
- Estimate: $50-200/month (depending on volume)

**SendGrid**
- Free: 100 emails/day
- Essentials: $19.95/month (50,000 emails)
- Pro: $89.95/month (100,000 emails)

**Smile Identity**
- Pay-per-verification model
- $0.50-2.00 per verification (varies by type)
- Estimate: $100-500/month

**NIBSS**
- Setup fee: ₦50,000-200,000
- Per-transaction fee: ₦10-50
- Monthly maintenance: ₦10,000-50,000

**Coinbase Commerce**
- Free to use
- 1% transaction fee

**Circle**
- Free for USDC transfers
- Network fees apply

**Total Estimated Monthly Cost**: $200-1,000 (varies by transaction volume)

---

## Support Contacts

- **Twilio**: [https://support.twilio.com](https://support.twilio.com)
- **SendGrid**: [https://support.sendgrid.com](https://support.sendgrid.com)
- **Smile Identity**: support@usesmileid.com
- **NIBSS**: info@nibss-plc.com.ng
- **Coinbase**: [https://help.coinbase.com](https://help.coinbase.com)
- **Circle**: support@circle.com

---

## Next Steps

After configuring all APIs:

1. ✅ Run validation script to test connections
2. ✅ Update environment variables in production
3. ✅ Test each feature end-to-end
4. ✅ Monitor API usage and errors
5. ✅ Set up billing alerts
6. ✅ Document any custom configurations

Your platform will be fully functional with all external integrations!
