# API Testing Guide

Comprehensive guide for testing all external API integrations in the Payment Switch platform.

## Overview

The platform integrates with 7 external services:

1. **Email** - SendGrid or Resend
2. **SMS** - Twilio
3. **KYC** - Smile Identity
4. **Banking** - NIBSS (Nigeria)
5. **Crypto** - Coinbase Commerce
6. **Crypto** - Circle USDC
7. **Monitoring** - Slack Webhooks

## Quick Test All APIs

```bash
# Test all APIs at once
pnpm test:apis

# Expected output:
# ✅ Email Service: Connected (SendGrid)
# ✅ SMS Service: Connected (Twilio)
# ✅ KYC Service: Connected (Smile Identity)
# ✅ Banking Service: Connected (NIBSS)
# ✅ Crypto Service: Connected (Coinbase Commerce)
# ✅ Crypto Service: Connected (Circle)
# ✅ Monitoring: Connected (Slack)
```

## Individual API Tests

### 1. Email Service (SendGrid/Resend)

#### Test Script

```bash
pnpm test:email
```

#### Manual Test

```typescript
// server/scripts/test-email.ts
import { sendEmail } from '../services/emailService';

const result = await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<h1>Test</h1><p>This is a test email.</p>'
});

console.log('Email sent:', result);
```

#### Expected Response

```json
{
  "success": true,
  "messageId": "abc123",
  "provider": "sendgrid"
}
```

#### Troubleshooting

**Error: Invalid API Key**
- Verify `SENDGRID_API_KEY` in `.env`
- Check API key permissions (needs "Mail Send")
- Regenerate API key if needed

**Error: Sender not verified**
- Verify sender email in SendGrid dashboard
- Go to Settings > Sender Authentication
- Complete domain verification or single sender verification

**Error: Rate limit exceeded**
- Free tier: 100 emails/day
- Wait 24 hours or upgrade plan
- Check SendGrid dashboard for usage

### 2. SMS Service (Twilio)

#### Test Script

```bash
pnpm test:twilio
```

#### Manual Test

```typescript
// server/scripts/test-twilio.ts
import { sendSMS } from '../services/smsService';

const result = await sendSMS({
  to: '+1234567890',
  message: 'Test SMS from Payment Switch'
});

console.log('SMS sent:', result);
```

#### Expected Response

```json
{
  "success": true,
  "sid": "SM1234567890abcdef",
  "status": "queued"
}
```

#### Troubleshooting

**Error: Invalid credentials**
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`
- Check credentials in Twilio Console > Account > API credentials
- Ensure no extra spaces or quotes

**Error: Invalid phone number**
- Phone must be in E.164 format: `+[country code][number]`
- Example: `+12025551234` (US), `+442071234567` (UK)
- Verify number is not on DNC list

**Error: Trial account restrictions**
- Trial accounts can only send to verified numbers
- Verify recipient number in Twilio Console > Phone Numbers > Verified Caller IDs
- Or upgrade to paid account

### 3. KYC Service (Smile Identity)

#### Test Script

```bash
# No dedicated test script yet - use manual test
```

#### Manual Test

```typescript
// server/scripts/test-smile-identity.ts
import { verifyIdentity } from '../services/kycService';

const result = await verifyIdentity({
  userId: 'test-user-123',
  idType: 'BVN',
  idNumber: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01'
});

console.log('KYC verification:', result);
```

#### Expected Response

```json
{
  "success": true,
  "verificationId": "ver_123abc",
  "status": "verified",
  "confidence": 0.95,
  "details": {
    "fullName": "John Doe",
    "dateOfBirth": "1990-01-01",
    "idNumber": "12345678901"
  }
}
```

#### Troubleshooting

**Error: Invalid partner ID**
- Verify `SMILE_IDENTITY_PARTNER_ID` in `.env`
- Check partner ID in Smile Identity dashboard
- Ensure using correct environment (sandbox/production)

**Error: Insufficient credits**
- Check credit balance in dashboard
- Sandbox: Usually has test credits
- Production: Purchase credits

**Error: Invalid ID number**
- BVN must be 11 digits
- NIN must be 11 digits
- Passport format varies by country

### 4. Banking Service (NIBSS)

#### Test Script

```bash
# No dedicated test script yet - use manual test
```

#### Manual Test

```typescript
// server/scripts/test-nibss.ts
import { verifyBankAccount } from '../services/nibssService';

const result = await verifyBankAccount({
  accountNumber: '0123456789',
  bankCode: '058', // GTBank
});

console.log('Bank verification:', result);
```

#### Expected Response

```json
{
  "success": true,
  "accountName": "JOHN DOE",
  "accountNumber": "0123456789",
  "bankCode": "058",
  "bankName": "Guaranty Trust Bank"
}
```

#### Troubleshooting

**Error: Invalid organization code**
- Verify `NIBSS_ORGANIZATION_CODE` in `.env`
- Contact NIBSS to get valid organization code
- Ensure using correct environment

**Error: Invalid bank code**
- Bank codes are 3 digits (e.g., "058" for GTBank)
- See full list: https://nigerianbanks.xyz
- Common codes:
  - 044: Access Bank
  - 063: Diamond Bank
  - 050: Ecobank
  - 070: Fidelity Bank
  - 011: First Bank
  - 058: GTBank
  - 030: Heritage Bank
  - 301: Jaiz Bank
  - 082: Keystone Bank
  - 076: Polaris Bank
  - 101: Providus Bank
  - 221: Stanbic IBTC
  - 068: Standard Chartered
  - 232: Sterling Bank
  - 032: Union Bank
  - 033: United Bank for Africa
  - 215: Unity Bank
  - 035: Wema Bank
  - 057: Zenith Bank

**Error: Account not found**
- Verify account number is correct (10 digits)
- Account must exist and be active
- Try different bank code if unsure

### 5. Crypto Service (Coinbase Commerce)

#### Test Script

```bash
# No dedicated test script yet - use manual test
```

#### Manual Test

```typescript
// server/scripts/test-coinbase.ts
import { createCharge } from '../services/coinbaseService';

const result = await createCharge({
  name: 'Test Payment',
  description: 'Test crypto payment',
  amount: 100,
  currency: 'USD'
});

console.log('Charge created:', result);
```

#### Expected Response

```json
{
  "success": true,
  "chargeId": "ABC123",
  "hostedUrl": "https://commerce.coinbase.com/charges/ABC123",
  "addresses": {
    "bitcoin": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "ethereum": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "usdc": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  },
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

#### Troubleshooting

**Error: Invalid API key**
- Verify `COINBASE_COMMERCE_API_KEY` in `.env`
- Get API key from https://commerce.coinbase.com/dashboard/settings
- Ensure key has not been revoked

**Error: Unsupported currency**
- Supported: USD, EUR, GBP, CAD, etc.
- Not supported: NGN (must convert first)
- See: https://commerce.coinbase.com/docs/api/#currencies

**Error: Amount too small**
- Minimum: $1.00 USD equivalent
- Check current exchange rates
- Increase amount if needed

### 6. Crypto Service (Circle USDC)

#### Test Script

```bash
# No dedicated test script yet - use manual test
```

#### Manual Test

```typescript
// server/scripts/test-circle.ts
import { createPayment } from '../services/circleService';

const result = await createPayment({
  amount: 100,
  currency: 'USD',
  source: {
    type: 'card',
    id: 'card_123'
  }
});

console.log('Payment created:', result);
```

#### Expected Response

```json
{
  "success": true,
  "paymentId": "pay_123abc",
  "status": "pending",
  "amount": 100,
  "currency": "USD"
}
```

#### Troubleshooting

**Error: Invalid API key**
- Verify `CIRCLE_API_KEY` in `.env`
- Get API key from Circle dashboard
- Check key permissions

**Error: Unsupported currency**
- Circle primarily supports USD and USDC
- Convert other currencies first
- Check Circle documentation for supported currencies

**Error: KYC required**
- Circle requires KYC for large amounts
- Complete KYC in Circle dashboard
- Or use smaller test amounts

### 7. Monitoring (Slack Webhooks)

#### Test Script

```bash
# No dedicated test script yet - use manual test
```

#### Manual Test

```bash
curl -X POST \
  $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Test alert from Payment Switch",
    "username": "Payment Switch Bot",
    "icon_emoji": ":warning:"
  }'
```

#### Expected Response

```
ok
```

#### Troubleshooting

**Error: Invalid webhook URL**
- Verify `SLACK_WEBHOOK_URL` in `.env`
- URL format: `https://hooks.slack.com/services/T.../B.../...`
- Regenerate webhook if needed

**Error: No response**
- Check internet connectivity
- Verify webhook is not revoked
- Check Slack workspace status

**Error: Message not appearing**
- Verify bot is added to channel
- Check channel permissions
- Try posting to different channel

## Development Mode (No API Keys)

All services have file-based fallbacks for development:

```bash
# Set in .env
EMAIL_SERVICE=file
SMS_SERVICE=file

# Emails saved to: storage/emails/
# SMS saved to: storage/sms/
```

### View Sent Emails

```bash
ls -la storage/emails/
cat storage/emails/email-*.json
```

### View Sent SMS

```bash
ls -la storage/sms/
cat storage/sms/sms-*.json
```

## Automated Testing

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run specific service tests
pnpm test emailService
pnpm test smsService
pnpm test kycService
```

### Integration Tests

```bash
# Run integration tests (requires API keys)
pnpm test:integration

# Skip external API calls
MOCK_EXTERNAL_APIS=true pnpm test:integration
```

### End-to-End Tests

```bash
# Run E2E tests (requires running platform)
pnpm test:e2e

# Test specific flow
pnpm test:e2e --grep "payment flow"
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test-apis.yml
name: Test External APIs

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Test APIs
        env:
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
          TWILIO_ACCOUNT_SID: ${{ secrets.TWILIO_ACCOUNT_SID }}
          TWILIO_AUTH_TOKEN: ${{ secrets.TWILIO_AUTH_TOKEN }}
        run: pnpm test:apis
```

### Store Secrets

```bash
# GitHub repository settings > Secrets and variables > Actions
# Add these secrets:
SENDGRID_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
SMILE_IDENTITY_API_KEY
NIBSS_API_KEY
COINBASE_COMMERCE_API_KEY
CIRCLE_API_KEY
SLACK_WEBHOOK_URL
```

## Production Checklist

Before going live, verify:

- [ ] All API keys are production keys (not sandbox/test)
- [ ] Sender email verified in SendGrid
- [ ] Twilio account upgraded from trial
- [ ] Smile Identity production access enabled
- [ ] NIBSS production credentials obtained
- [ ] Coinbase Commerce account verified
- [ ] Circle KYC completed
- [ ] Slack webhook configured for production channel
- [ ] All tests passing: `pnpm test:apis`
- [ ] Rate limits configured appropriately
- [ ] Error handling tested
- [ ] Monitoring alerts configured
- [ ] Backup communication channels ready

## Cost Estimates

### Free Tiers

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| SendGrid | 100 emails/day | $15/mo for 40K |
| Resend | 100 emails/day | $20/mo for 50K |
| Twilio | Trial credits | $0.0075/SMS |
| Smile Identity | Test credits | $0.10-$1.00/verification |
| NIBSS | Varies | Contact NIBSS |
| Coinbase Commerce | Free | 1% transaction fee |
| Circle | Free | 0.5-1% transaction fee |
| Slack | Free | Free (unlimited webhooks) |

### Monthly Estimates

**Low Volume** (1K users, 10K transactions/month):
- Email: $15/mo (SendGrid)
- SMS: $75/mo (10K SMS × $0.0075)
- KYC: $100/mo (1K verifications × $0.10)
- **Total: ~$190/month**

**Medium Volume** (10K users, 100K transactions/month):
- Email: $80/mo (SendGrid)
- SMS: $750/mo (100K SMS × $0.0075)
- KYC: $1,000/mo (10K verifications × $0.10)
- **Total: ~$1,830/month**

**High Volume** (100K users, 1M transactions/month):
- Email: $450/mo (SendGrid)
- SMS: $7,500/mo (1M SMS × $0.0075)
- KYC: $10,000/mo (100K verifications × $0.10)
- **Total: ~$17,950/month**

## Support

- **SendGrid**: https://support.sendgrid.com
- **Twilio**: https://support.twilio.com
- **Smile Identity**: https://docs.usesmileid.com
- **NIBSS**: https://nibss-plc.com.ng/contact
- **Coinbase Commerce**: https://commerce.coinbase.com/docs
- **Circle**: https://developers.circle.com
- **Slack**: https://api.slack.com/support
