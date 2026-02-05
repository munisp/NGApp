# Production Deployment Guide

This guide walks you through deploying the African Fintech Mobile App to production on the Manus platform.

## Prerequisites

Before deploying, ensure you have:

1. **Completed all development work** - All features implemented and tested
2. **Created a checkpoint** - Use the checkpoint system to save your current state
3. **Gathered API credentials** - Obtain all required third-party API keys (see ENV_VARIABLES.md)

## Step 1: Configure Production Credentials

### Access the Secrets Panel

1. Open your project in Manus
2. Click the **Management UI** icon in the top-right corner
3. Navigate to **Settings** → **Secrets** in the left sidebar

### Required Credentials

Add the following environment variables through the Secrets panel:

#### 1. MFA Encryption Key (REQUIRED)

This key encrypts MFA backup codes using AES-256-GCM encryption.

**Variable Name**: `MFA_ENCRYPTION_KEY`

**How to Generate**:
```bash
# Run this command in your terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Format**: 64 hexadecimal characters (e.g., `a1b2c3d4e5f6...`)

**Steps**:
1. Click **+ Add Secret**
2. Enter `MFA_ENCRYPTION_KEY` as the name
3. Paste the generated 64-character hex string
4. Click **Save**

⚠️ **Important**: Store this key securely. Changing it will invalidate all existing encrypted backup codes.

#### 2. Bank API Credentials (OPTIONAL)

Only configure these if you're using bank integrations.

##### GTBank (Guaranty Trust Bank)

1. Register at [GTBank Developer Portal](https://developer.gtbank.com)
2. Create an API key and secret
3. Add three secrets:
   - `GTBANK_API_KEY` - Your API key
   - `GTBANK_API_SECRET` - Your API secret
   - `GTBANK_BASE_URL` - `https://api.gtbank.com` (or custom URL)

##### Access Bank

1. Register at [Access Bank Developer Portal](https://developer.accessbankplc.com)
2. Create an API key and secret
3. Add three secrets:
   - `ACCESS_BANK_API_KEY` - Your API key
   - `ACCESS_BANK_API_SECRET` - Your API secret
   - `ACCESS_BANK_BASE_URL` - `https://api.accessbankplc.com` (or custom URL)

##### Zenith Bank

1. Register at [Zenith Bank Developer Portal](https://developer.zenithbank.com)
2. Create an API key and secret
3. Add three secrets:
   - `ZENITH_BANK_API_KEY` - Your API key
   - `ZENITH_BANK_API_SECRET` - Your API secret
   - `ZENITH_BANK_BASE_URL` - `https://api.zenithbank.com` (or custom URL)

#### 3. OCR Service URL (OPTIONAL)

Only configure if you're using OCR features for receipt scanning.

**Variable Name**: `OCR_SERVICE_URL`

**Value**: URL of your deployed OCR service (e.g., `https://ocr.yourdomain.com`)

**Default**: `http://127.0.0.1:5001` (local development)

### Verify Configuration

After adding all secrets:

1. Restart the dev server (click the restart button in Management UI)
2. Check the server logs for confirmation messages:
   - `[Bank Integration] GTBank configured` (if GTBank keys are set)
   - `[Bank Integration] Access Bank configured` (if Access Bank keys are set)
   - `[Bank Integration] Zenith Bank configured` (if Zenith Bank keys are set)
   - `[Bank Integration] X bank(s) registered` (total count)

## Step 2: Create a Deployment Checkpoint

Before publishing, create a final checkpoint:

1. Ensure all changes are saved
2. Run tests to verify functionality
3. Create a checkpoint with a descriptive message:
   - Example: "Production release v1.0.0 - All features complete"

The checkpoint system automatically captures:
- All source code
- Database schema
- Dependencies
- Configuration files

## Step 3: Publish to Production

1. Click the **Publish** button in the Management UI header (top-right)
2. Review the deployment summary
3. Confirm the deployment

The Manus platform will:
- Build the mobile app for iOS and Android
- Deploy the backend server
- Set up the PostgreSQL database
- Configure environment variables
- Generate QR codes for testing

## Step 4: Test the Production Deployment

### Mobile App Testing

1. **Expo Go Testing** (Development):
   - Scan the QR code with Expo Go app
   - Test all features on your physical device
   - Verify bank integrations work correctly

2. **Native Build Testing** (Production):
   - Download the iOS/Android build
   - Install on test devices
   - Perform end-to-end testing

### Backend API Testing

1. Open the API URL (provided after deployment)
2. Test key endpoints:
   - `/api/health` - Health check
   - `/api/trpc` - tRPC endpoint
3. Monitor server logs for errors

### Database Testing

1. Open the Database panel in Management UI
2. Verify tables are created:
   - `users`
   - `notification_preferences`
   - `webhooks`
   - `webhook_deliveries`
   - All other tables (18 total)
3. Check data integrity

## Step 5: Monitor Production

### Server Logs

Monitor server logs in real-time:
1. Open Management UI
2. Navigate to the Logs panel
3. Filter by severity (Error, Warning, Info)

### Database Monitoring

1. Open the Database panel
2. Check table row counts
3. Monitor query performance
4. Review recent transactions

### Webhook Monitoring

Use the webhook dashboard (app/(settings)/webhooks.tsx):
1. View delivery success rates
2. Check failed deliveries
3. Retry failed webhooks
4. Monitor webhook performance

## Step 6: Post-Deployment Checklist

After deployment, verify:

- [ ] All environment variables are set correctly
- [ ] MFA encryption key is configured
- [ ] Bank API credentials are working (if configured)
- [ ] Database migrations completed successfully
- [ ] Mobile app connects to production API
- [ ] User authentication works
- [ ] Notification preferences can be saved
- [ ] Webhooks are delivering successfully
- [ ] All 16 routers are accessible
- [ ] No TypeScript compilation errors
- [ ] Server logs show no critical errors

## Rollback Procedure

If issues occur after deployment:

1. Open Management UI
2. Navigate to the Checkpoints panel
3. Find the previous stable checkpoint
4. Click **Rollback** button
5. Confirm the rollback

The platform will restore:
- Previous code version
- Database schema (if compatible)
- Environment configuration

## Security Best Practices

### Credential Management

1. **Rotate keys regularly** - Change API keys every 90 days
2. **Use strong keys** - Generate cryptographically secure random values
3. **Limit permissions** - Grant API keys only required permissions
4. **Monitor usage** - Review API key usage logs regularly
5. **Never commit secrets** - Keep `.env` files out of version control

### Database Security

1. **Enable SSL** - Use SSL connections for database access
2. **Restrict access** - Whitelist only necessary IP addresses
3. **Regular backups** - Enable automatic database backups
4. **Monitor queries** - Review slow and suspicious queries

### API Security

1. **Rate limiting** - Configure rate limits for API endpoints
2. **Authentication** - Ensure all protected endpoints require auth
3. **Input validation** - Validate all user inputs
4. **Error handling** - Don't expose sensitive error details

## Troubleshooting

### Common Issues

#### Bank Integration Not Working

**Symptoms**: Bank connections fail, no transactions retrieved

**Solutions**:
1. Verify API keys are correct (no extra spaces)
2. Check API key permissions in bank's developer portal
3. Ensure IP address is whitelisted (if required)
4. Check API rate limits
5. Review server logs for detailed error messages

#### MFA Encryption Errors

**Symptoms**: Users can't enable MFA, backup codes fail

**Solutions**:
1. Verify `MFA_ENCRYPTION_KEY` is exactly 64 hex characters
2. Regenerate the key if corrupted
3. **Warning**: Changing the key invalidates all existing backup codes

#### Database Connection Failed

**Symptoms**: `ECONNREFUSED` errors, queries fail

**Solutions**:
1. Check database credentials in Manus platform
2. Verify database is running
3. Enable SSL if required
4. Check firewall settings
5. Review connection string format

#### Webhook Deliveries Failing

**Symptoms**: Webhooks show "failed" status

**Solutions**:
1. Verify webhook URL is accessible
2. Check webhook endpoint accepts POST requests
3. Verify webhook secret validation
4. Review delivery logs for error details
5. Test webhook with the "Test" button

### Getting Help

For issues with:
- **Manus platform**: Submit a request at https://help.manus.im
- **Bank APIs**: Contact the respective bank's developer support
- **OCR service**: Check OCR service logs in `server/services/python/ocr-service/`

## Performance Optimization

### Backend Optimization

1. **Enable caching** - Cache frequently accessed data
2. **Optimize queries** - Use indexes for common queries
3. **Connection pooling** - Configure database connection pool
4. **Compression** - Enable gzip compression for API responses

### Mobile App Optimization

1. **Image optimization** - Compress images before bundling
2. **Code splitting** - Lazy load screens and components
3. **Caching** - Use AsyncStorage for offline data
4. **Network optimization** - Batch API requests when possible

## Scaling Considerations

As your user base grows:

1. **Database scaling** - Upgrade database tier for more connections
2. **Server scaling** - Increase server resources (CPU, RAM)
3. **CDN integration** - Use CDN for static assets
4. **Load balancing** - Distribute traffic across multiple servers
5. **Monitoring** - Set up application performance monitoring (APM)

## Maintenance Schedule

### Daily
- Review server logs for errors
- Monitor webhook delivery rates
- Check API response times

### Weekly
- Review database performance
- Check failed webhook deliveries
- Monitor user growth metrics

### Monthly
- Rotate API keys and secrets
- Review security logs
- Update dependencies
- Backup database manually

### Quarterly
- Performance audit
- Security audit
- Dependency updates
- Feature usage analysis

## Support and Resources

- **Documentation**: ENV_VARIABLES.md - Environment variable reference
- **Manus Help**: https://help.manus.im - Platform support
- **Project Repository**: Check version control for code history
- **Checkpoint History**: Use Management UI to view all checkpoints

## Next Steps

After successful deployment:

1. **User onboarding** - Prepare user documentation
2. **Marketing** - Announce the launch
3. **Monitoring** - Set up alerts for critical issues
4. **Feedback** - Collect user feedback for improvements
5. **Iteration** - Plan next features based on usage data

---

**Congratulations!** Your African Fintech Mobile App is now live in production. 🎉
