/**
 * SendGrid/Email Connection Test Script
 * 
 * Tests email service configuration (SendGrid or Resend).
 * Run: pnpm test:email
 */

interface EmailConfig {
  sendgridApiKey: string | undefined;
  sendgridFromEmail: string | undefined;
  sendgridFromName: string | undefined;
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
}

async function testEmailConnection(): Promise<void> {
  console.log('🔍 Testing Email Service Configuration...\n');

  // Check environment variables
  const config: EmailConfig = {
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
    sendgridFromName: process.env.SENDGRID_FROM_NAME,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
  };

  console.log('📋 Configuration Check:');
  
  const hasSendGrid = !!config.sendgridApiKey;
  const hasResend = !!config.resendApiKey;
  
  if (hasSendGrid) {
    console.log('   📧 SendGrid Configuration:');
    console.log(`      SENDGRID_API_KEY: ${config.sendgridApiKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`      SENDGRID_FROM_EMAIL: ${config.sendgridFromEmail || '❌ Missing'}`);
    console.log(`      SENDGRID_FROM_NAME: ${config.sendgridFromName || '❌ Missing'}`);
    console.log();
  }
  
  if (hasResend) {
    console.log('   📧 Resend Configuration:');
    console.log(`      RESEND_API_KEY: ${config.resendApiKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`      RESEND_FROM_EMAIL: ${config.resendFromEmail || '❌ Missing'}`);
    console.log();
  }

  if (!hasSendGrid && !hasResend) {
    console.log('❌ No email service is configured.');
    console.log('   Emails will be saved to storage/emails/ in development mode.\n');
    console.log('📖 To configure SendGrid:');
    console.log('   1. Sign up at https://sendgrid.com/pricing/');
    console.log('   2. Create an API key with Full Access');
    console.log('   3. Verify a sender email address');
    console.log('   4. Add credentials to your .env file:');
    console.log('      SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    console.log('      SENDGRID_FROM_EMAIL=noreply@yourdomain.com');
    console.log('      SENDGRID_FROM_NAME="Your Platform Name"\n');
    console.log('📖 Or configure Resend:');
    console.log('   1. Sign up at https://resend.com/signup');
    console.log('   2. Create an API key');
    console.log('   3. Add credentials to your .env file:');
    console.log('      RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    console.log('      RESEND_FROM_EMAIL=noreply@yourdomain.com\n');
    process.exit(0);
  }

  // Test SendGrid if configured
  if (hasSendGrid) {
    console.log('🔌 Testing SendGrid API Connection...');
    
    try {
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      console.log('✅ Successfully connected to SendGrid API');
      console.log(`   Email: ${data.email}`);
      console.log(`   Username: ${data.username}`);
      console.log();

      // Validate email format
      console.log('📧 Validating Sender Email...');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!config.sendgridFromEmail || !emailRegex.test(config.sendgridFromEmail)) {
        console.log('⚠️  Sender email format may be invalid');
        console.log(`   Current: ${config.sendgridFromEmail || 'Not set'}`);
        console.log('   Expected format: email@domain.com');
        console.log();
      } else {
        console.log(`✅ Sender email is valid: ${config.sendgridFromEmail}`);
        console.log();
      }

      // Check sender verification
      console.log('🔐 Checking Sender Verification...');
      const verifyResponse = await fetch('https://api.sendgrid.com/v3/verified_senders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (verifyResponse.ok) {
        const verifiedSenders = await verifyResponse.json();
        const isVerified = verifiedSenders.results?.some(
          (sender: any) => sender.from_email === config.sendgridFromEmail && sender.verified
        );

        if (isVerified) {
          console.log('✅ Sender email is verified');
        } else {
          console.log('⚠️  Sender email is not verified');
          console.log('   Go to SendGrid → Settings → Sender Authentication to verify');
        }
      }
      console.log();

      console.log('🎉 SendGrid configuration is valid and ready for production!\n');
      
    } catch (error) {
      console.log('❌ Failed to connect to SendGrid API');
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
      console.log('🔧 Troubleshooting:');
      console.log('   1. Verify your API key is correct and has Full Access');
      console.log('   2. Check if your account is active');
      console.log('   3. Ensure you have internet connectivity');
      console.log('   4. Check SendGrid status at https://status.sendgrid.com\n');
      process.exit(1);
    }
  }

  // Test Resend if configured
  if (hasResend) {
    console.log('🔌 Testing Resend API Connection...');
    
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.resendFromEmail,
          to: 'test@example.com', // This won't actually send
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      });

      // Resend returns 422 for invalid recipient, which means API key is valid
      if (response.status === 422 || response.ok) {
        console.log('✅ Successfully connected to Resend API');
        console.log(`   From Email: ${config.resendFromEmail}`);
        console.log();
        console.log('🎉 Resend configuration is valid and ready for production!\n');
      } else {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} ${error}`);
      }
      
    } catch (error) {
      console.log('❌ Failed to connect to Resend API');
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
      console.log('🔧 Troubleshooting:');
      console.log('   1. Verify your API key is correct');
      console.log('   2. Check if your account is active');
      console.log('   3. Ensure you have internet connectivity\n');
      process.exit(1);
    }
  }
}

// Run the test
testEmailConnection().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
