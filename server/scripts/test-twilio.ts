/**
 * Twilio Connection Test Script
 * 
 * Tests Twilio SMS service configuration and connectivity.
 * Run: pnpm test:twilio
 */

import { ENV } from '../_core/env';

interface TwilioConfig {
  accountSid: string | undefined;
  authToken: string | undefined;
  phoneNumber: string | undefined;
}

async function testTwilioConnection(): Promise<void> {
  console.log('🔍 Testing Twilio Configuration...\n');

  // Check environment variables
  const config: TwilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  };

  console.log('📋 Configuration Check:');
  console.log(`   TWILIO_ACCOUNT_SID: ${config.accountSid ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TWILIO_AUTH_TOKEN: ${config.authToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TWILIO_PHONE_NUMBER: ${config.phoneNumber ? '✅ Set' : '❌ Missing'}`);
  console.log();

  if (!config.accountSid || !config.authToken || !config.phoneNumber) {
    console.log('❌ Twilio is not configured.');
    console.log('   SMS messages will be saved to storage/sms/ in development mode.\n');
    console.log('📖 To configure Twilio:');
    console.log('   1. Sign up at https://www.twilio.com/try-twilio');
    console.log('   2. Get your Account SID and Auth Token from the console');
    console.log('   3. Purchase a phone number with SMS capabilities');
    console.log('   4. Add credentials to your .env file:');
    console.log('      TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    console.log('      TWILIO_AUTH_TOKEN=your_auth_token');
    console.log('      TWILIO_PHONE_NUMBER=+1234567890\n');
    process.exit(0);
  }

  // Test API connection
  console.log('🔌 Testing API Connection...');
  
  try {
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    console.log('✅ Successfully connected to Twilio API');
    console.log(`   Account Status: ${data.status}`);
    console.log(`   Account Type: ${data.type}`);
    console.log(`   Friendly Name: ${data.friendly_name}`);
    console.log();

    // Validate phone number format
    console.log('📱 Validating Phone Number...');
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    
    if (!phoneRegex.test(config.phoneNumber)) {
      console.log('⚠️  Phone number format may be invalid');
      console.log(`   Current: ${config.phoneNumber}`);
      console.log('   Expected format: E.164 (e.g., +1234567890)');
      console.log();
    } else {
      console.log('✅ Phone number format is valid');
      console.log();
    }

    // Test SMS capability (optional - requires a verified test number)
    console.log('💡 To test SMS sending:');
    console.log('   1. Verify a test phone number in Twilio console (for trial accounts)');
    console.log('   2. Use the SMS service in your application');
    console.log('   3. Check Twilio logs at https://console.twilio.com/logs\n');

    console.log('🎉 Twilio configuration is valid and ready for production!\n');
    
  } catch (error) {
    console.log('❌ Failed to connect to Twilio API');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    console.log();
    console.log('🔧 Troubleshooting:');
    console.log('   1. Verify your Account SID and Auth Token are correct');
    console.log('   2. Check if your account is active (not suspended)');
    console.log('   3. Ensure you have internet connectivity');
    console.log('   4. Check Twilio status at https://status.twilio.com\n');
    process.exit(1);
  }
}

// Run the test
testTwilioConnection().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
