#!/bin/bash

# External API Credentials Setup Script
# Interactive wizard to configure all external API credentials

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ENV_FILE="${1:-.env.production}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Payment Switch - External API Setup Wizard           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "This wizard will help you configure all external API credentials."
echo -e "Environment file: ${CYAN}$ENV_FILE${NC}"
echo ""

# Check if .env file exists
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠ Warning: $ENV_FILE already exists.${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
    # Backup existing file
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓ Backed up existing file${NC}"
fi

# Start with empty file
> "$ENV_FILE"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  1/6: Email Service (SendGrid or Resend)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Choose your email service provider:"
echo "  1) SendGrid (recommended, 100 emails/day free)"
echo "  2) Resend (100 emails/day free)"
echo "  3) Skip (use file-based fallback for development)"
echo ""
read -p "Enter choice (1-3): " email_choice

case $email_choice in
    1)
        echo ""
        echo "SendGrid Setup:"
        echo "1. Sign up at https://sendgrid.com"
        echo "2. Go to Settings > API Keys"
        echo "3. Create new API key with 'Mail Send' permission"
        echo ""
        read -p "Enter SendGrid API Key: " sendgrid_key
        read -p "Enter sender email (verified in SendGrid): " sender_email
        
        echo "EMAIL_SERVICE=sendgrid" >> "$ENV_FILE"
        echo "SENDGRID_API_KEY=$sendgrid_key" >> "$ENV_FILE"
        echo "EMAIL_FROM=$sender_email" >> "$ENV_FILE"
        echo -e "${GREEN}✓ SendGrid configured${NC}"
        ;;
    2)
        echo ""
        echo "Resend Setup:"
        echo "1. Sign up at https://resend.com"
        echo "2. Go to API Keys"
        echo "3. Create new API key"
        echo ""
        read -p "Enter Resend API Key: " resend_key
        read -p "Enter sender email (verified in Resend): " sender_email
        
        echo "EMAIL_SERVICE=resend" >> "$ENV_FILE"
        echo "RESEND_API_KEY=$resend_key" >> "$ENV_FILE"
        echo "EMAIL_FROM=$sender_email" >> "$ENV_FILE"
        echo -e "${GREEN}✓ Resend configured${NC}"
        ;;
    3)
        echo "EMAIL_SERVICE=file" >> "$ENV_FILE"
        echo -e "${YELLOW}⚠ Using file-based email fallback${NC}"
        ;;
esac

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  2/6: SMS Service (Twilio)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Do you want to configure Twilio for SMS? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Twilio Setup:"
    echo "1. Sign up at https://www.twilio.com/try-twilio"
    echo "2. Get your Account SID and Auth Token from console"
    echo "3. Get a phone number from Phone Numbers > Manage > Buy a number"
    echo ""
    read -p "Enter Twilio Account SID: " twilio_sid
    read -p "Enter Twilio Auth Token: " twilio_token
    read -p "Enter Twilio Phone Number (with +): " twilio_phone
    
    echo "SMS_SERVICE=twilio" >> "$ENV_FILE"
    echo "TWILIO_ACCOUNT_SID=$twilio_sid" >> "$ENV_FILE"
    echo "TWILIO_AUTH_TOKEN=$twilio_token" >> "$ENV_FILE"
    echo "TWILIO_PHONE_NUMBER=$twilio_phone" >> "$ENV_FILE"
    echo -e "${GREEN}✓ Twilio configured${NC}"
else
    echo "SMS_SERVICE=file" >> "$ENV_FILE"
    echo -e "${YELLOW}⚠ Using file-based SMS fallback${NC}"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  3/6: KYC Service (Smile Identity)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Do you want to configure Smile Identity for KYC? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Smile Identity Setup:"
    echo "1. Sign up at https://www.usesmileid.com"
    echo "2. Get API Key and Partner ID from dashboard"
    echo "3. Choose environment (sandbox or production)"
    echo ""
    read -p "Enter Smile Identity Partner ID: " smile_partner_id
    read -p "Enter Smile Identity API Key: " smile_api_key
    read -p "Environment (sandbox/production) [sandbox]: " smile_env
    smile_env=${smile_env:-sandbox}
    
    echo "SMILE_IDENTITY_PARTNER_ID=$smile_partner_id" >> "$ENV_FILE"
    echo "SMILE_IDENTITY_API_KEY=$smile_api_key" >> "$ENV_FILE"
    echo "SMILE_IDENTITY_ENVIRONMENT=$smile_env" >> "$ENV_FILE"
    echo -e "${GREEN}✓ Smile Identity configured${NC}"
else
    echo -e "${YELLOW}⚠ Smile Identity not configured (KYC will be simulated)${NC}"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  4/6: Banking Service (NIBSS - Nigeria)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Do you want to configure NIBSS for Nigerian banking? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "NIBSS Setup:"
    echo "1. Register at https://nibss-plc.com.ng"
    echo "2. Get API credentials from NIBSS"
    echo "3. Choose environment (sandbox or production)"
    echo ""
    read -p "Enter NIBSS Organization Code: " nibss_org_code
    read -p "Enter NIBSS API Key: " nibss_api_key
    read -p "Environment (sandbox/production) [sandbox]: " nibss_env
    nibss_env=${nibss_env:-sandbox}
    
    echo "NIBSS_ORGANIZATION_CODE=$nibss_org_code" >> "$ENV_FILE"
    echo "NIBSS_API_KEY=$nibss_api_key" >> "$ENV_FILE"
    echo "NIBSS_ENVIRONMENT=$nibss_env" >> "$ENV_FILE"
    echo -e "${GREEN}✓ NIBSS configured${NC}"
else
    echo -e "${YELLOW}⚠ NIBSS not configured (banking will be simulated)${NC}"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  5/6: Crypto Payment Service${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Choose your crypto payment provider:"
echo "  1) Coinbase Commerce (recommended)"
echo "  2) Circle USDC"
echo "  3) Both"
echo "  4) Skip"
echo ""
read -p "Enter choice (1-4): " crypto_choice

case $crypto_choice in
    1|3)
        echo ""
        echo "Coinbase Commerce Setup:"
        echo "1. Sign up at https://commerce.coinbase.com"
        echo "2. Go to Settings > API Keys"
        echo "3. Create new API key"
        echo ""
        read -p "Enter Coinbase Commerce API Key: " coinbase_key
        
        echo "COINBASE_COMMERCE_API_KEY=$coinbase_key" >> "$ENV_FILE"
        echo -e "${GREEN}✓ Coinbase Commerce configured${NC}"
        
        if [ "$crypto_choice" = "3" ]; then
            echo ""
            echo "Circle USDC Setup:"
            echo "1. Sign up at https://www.circle.com"
            echo "2. Get API key from developer dashboard"
            echo ""
            read -p "Enter Circle API Key: " circle_key
            
            echo "CIRCLE_API_KEY=$circle_key" >> "$ENV_FILE"
            echo -e "${GREEN}✓ Circle configured${NC}"
        fi
        ;;
    2)
        echo ""
        echo "Circle USDC Setup:"
        echo "1. Sign up at https://www.circle.com"
        echo "2. Get API key from developer dashboard"
        echo ""
        read -p "Enter Circle API Key: " circle_key
        
        echo "CIRCLE_API_KEY=$circle_key" >> "$ENV_FILE"
        echo -e "${GREEN}✓ Circle configured${NC}"
        ;;
    4)
        echo -e "${YELLOW}⚠ Crypto payments not configured${NC}"
        ;;
esac

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  6/6: Monitoring & Alerting${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Do you want to configure Slack alerts? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Slack Webhook Setup:"
    echo "1. Go to https://api.slack.com/apps"
    echo "2. Create new app > Incoming Webhooks"
    echo "3. Copy webhook URL"
    echo ""
    read -p "Enter Slack Webhook URL: " slack_webhook
    
    echo "SLACK_WEBHOOK_URL=$slack_webhook" >> "$ENV_FILE"
    echo -e "${GREEN}✓ Slack alerts configured${NC}"
else
    echo -e "${YELLOW}⚠ Slack alerts not configured${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup Complete!                                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Configuration saved to: ${CYAN}$ENV_FILE${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Review the configuration:"
echo -e "   ${CYAN}cat $ENV_FILE${NC}"
echo ""
echo "2. Test API connections:"
echo -e "   ${CYAN}pnpm test:apis${NC}"
echo ""
echo "3. Start the platform:"
echo -e "   ${CYAN}docker-compose -f docker-compose.unified.yml --env-file $ENV_FILE up -d${NC}"
echo ""
echo "4. Run health checks:"
echo -e "   ${CYAN}./scripts/health-check.sh${NC}"
echo ""
echo -e "${YELLOW}⚠ Security Note:${NC}"
echo -e "   Keep $ENV_FILE secure and never commit it to version control!"
echo ""
