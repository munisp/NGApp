# Environment Variables Configuration

This document lists all environment variables required for the African Fintech Mobile App.

## Database

- `DATABASE_URL` - PostgreSQL connection string (automatically configured by Manus platform)

## Authentication & Security

- `MFA_ENCRYPTION_KEY` - 64-character hex string for encrypting MFA backup codes using AES-256-GCM
  - **Format**: 64 hexadecimal characters (e.g., `a1b2c3d4e5f6...`)
  - **Generation**: Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - **Required**: Yes (falls back to random key if not set, but not recommended for production)

## Bank Integrations

### GTBank (Guaranty Trust Bank)
- `GTBANK_API_KEY` - API key for GTBank Open Banking API
  - **How to obtain**: Register at [GTBank Developer Portal](https://developer.gtbank.com)
  - **Required**: Optional (only if using GTBank integration)
  
- `GTBANK_API_SECRET` - API secret for GTBank
  - **How to obtain**: Generated when creating API key in GTBank Developer Portal
  - **Required**: Optional (only if using GTBank integration)

- `GTBANK_BASE_URL` - Base URL for GTBank API
  - **Default**: `https://api.gtbank.com`
  - **Required**: No (uses default if not set)

### Access Bank
- `ACCESS_BANK_API_KEY` - API key for Access Bank Open Banking API
  - **How to obtain**: Register at [Access Bank Developer Portal](https://developer.accessbankplc.com)
  - **Required**: Optional (only if using Access Bank integration)
  
- `ACCESS_BANK_API_SECRET` - API secret for Access Bank
  - **How to obtain**: Generated when creating API key in Access Bank Developer Portal
  - **Required**: Optional (only if using Access Bank integration)

- `ACCESS_BANK_BASE_URL` - Base URL for Access Bank API
  - **Default**: `https://api.accessbankplc.com`
  - **Required**: No (uses default if not set)

### Zenith Bank
- `ZENITH_BANK_API_KEY` - API key for Zenith Bank Open Banking API
  - **How to obtain**: Register at [Zenith Bank Developer Portal](https://developer.zenithbank.com)
  - **Required**: Optional (only if using Zenith Bank integration)
  
- `ZENITH_BANK_API_SECRET` - API secret for Zenith Bank
  - **How to obtain**: Generated when creating API key in Zenith Bank Developer Portal
  - **Required**: Optional (only if using Zenith Bank integration)

- `ZENITH_BANK_BASE_URL` - Base URL for Zenith Bank API
  - **Default**: `https://api.zenithbank.com`
  - **Required**: No (uses default if not set)

## OCR Service

- `OCR_SERVICE_URL` - URL for the Python OCR microservice
  - **Default**: `http://127.0.0.1:5001`
  - **Format**: Full URL including protocol (e.g., `http://localhost:5001` or `https://ocr.example.com`)
  - **Required**: Optional (only if using OCR features for receipt scanning)
  - **Note**: The OCR service must be running separately. See `server/services/python/ocr-service/README.md` for setup instructions.

## How to Configure

### For Local Development
Create a `.env` file in the project root:

```bash
# Security
MFA_ENCRYPTION_KEY=your_64_char_hex_key_here

# Bank APIs (optional)
GTBANK_API_KEY=your_gtbank_key
GTBANK_API_SECRET=your_gtbank_secret

ACCESS_BANK_API_KEY=your_access_bank_key
ACCESS_BANK_API_SECRET=your_access_bank_secret

ZENITH_BANK_API_KEY=your_zenith_bank_key
ZENITH_BANK_API_SECRET=your_zenith_bank_secret

# OCR Service (optional)
OCR_SERVICE_URL=http://localhost:5001
```

### For Production (Manus Platform)
1. Open the project in Manus
2. Click the **Management UI** icon (top-right)
3. Navigate to **Settings** → **Secrets**
4. Add each environment variable:
   - Click **+ Add Secret**
   - Enter the variable name (e.g., `MFA_ENCRYPTION_KEY`)
   - Enter the value
   - Click **Save**

## Security Best Practices

1. **Never commit** `.env` files to version control
2. **Rotate keys** regularly (at least every 90 days)
3. **Use strong keys**: Generate cryptographically secure random values
4. **Limit access**: Only grant API keys the minimum required permissions
5. **Monitor usage**: Regularly review API key usage logs

## Verification

After configuring environment variables, you can verify they're loaded correctly:

```bash
# In the project directory
pnpm dev

# Check server logs for:
# - "[Bank Integration] GTBank configured" (if GTBank keys are set)
# - "[Bank Integration] Access Bank configured" (if Access Bank keys are set)
# - "[Bank Integration] Zenith Bank configured" (if Zenith Bank keys are set)
# - "[OCR Service] Connected to http://..." (if OCR_SERVICE_URL is set)
```

## Troubleshooting

### Bank Integration Not Working
- Verify API keys are correct (no extra spaces or line breaks)
- Check API key permissions in the bank's developer portal
- Ensure your IP address is whitelisted (if required by the bank)
- Check API rate limits

### OCR Service Connection Failed
- Verify the OCR service is running: `curl http://localhost:5001/health`
- Check firewall settings
- Ensure the URL format is correct (include `http://` or `https://`)

### MFA Encryption Issues
- Verify the key is exactly 64 hexadecimal characters
- Regenerate the key if corrupted
- **Warning**: Changing the key will invalidate all existing encrypted backup codes

## Support

For issues with:
- **Manus platform**: Submit a request at https://help.manus.im
- **Bank APIs**: Contact the respective bank's developer support
- **OCR service**: Check the OCR service logs in `server/services/python/ocr-service/`
