# Configuration Guide - Step by Step

## Overview

This guide will walk you through configuring the Document Intelligence Platform to connect all services and enable full functionality.

**Time Required:** 5 minutes  
**Difficulty:** Easy

## Prerequisites Check

Before starting, verify all services are running:

```bash
# Check OCR Service (should return "status": "healthy")
curl http://localhost:8001/health

# Check API Gateway (should return "status": "healthy")
curl http://localhost:8002/health

# Check UI (should return HTML)
curl -I http://localhost:3000
```

✅ **All services are already running!** You just need to connect them.

## Step 1: Access Settings Panel

1. Open your browser and navigate to: **http://localhost:3000**
2. You'll see the Welcome modal - click **"Get Started"** or **"Skip"**
3. Look at the top-right corner of the page
4. Click the **Settings icon** (⚙️) or the **user profile icon**
5. From the dropdown menu, select **"Settings"**

## Step 2: Navigate to Secrets

1. In the Settings panel, look at the left sidebar
2. You'll see several options:
   - General
   - Domains
   - Notifications
   - **Secrets** ← Click this one
3. The Secrets panel will open

## Step 3: Add OCR Service URL

This connects your UI to the OCR processing service.

1. In the Secrets panel, click **"Add New Secret"** or **"+ Add Secret"**
2. Fill in the form:
   - **Key:** `OCR_SERVICE_URL`
   - **Value:** `http://localhost:8001`
   - **Description (optional):** "OCR ensemble service endpoint"
3. Click **"Save"** or **"Add"**
4. You should see a success message

**What this does:** Enables document upload and OCR processing features

## Step 4: Add API Gateway URL

This connects your UI to the analytics and lakehouse backend.

1. Click **"Add New Secret"** again
2. Fill in the form:
   - **Key:** `PYTHON_API_URL`
   - **Value:** `http://localhost:8002`
   - **Description (optional):** "API Gateway for lakehouse and analytics"
3. Click **"Save"** or **"Add"**
4. You should see a success message

**What this does:** Enables analytics dashboard and lakehouse explorer features

## Step 5: Wait for Server Restart

After adding both secrets:

1. The development server will automatically restart (takes ~10 seconds)
2. You may see a loading screen or "Reconnecting..." message
3. Wait for the page to reload completely
4. The **"Disconnected"** badge should change to **"Connected"** (green)

**If the page doesn't reload automatically:**
- Refresh your browser manually (F5 or Cmd+R)
- Wait 10 seconds for the server to fully restart

## Step 6: Verify Configuration

### Check Connection Status

Look at the top-right corner of the page:
- ✅ **"Connected"** badge (green) = Everything is working!
- ❌ **"Disconnected"** badge (red) = Wait a few more seconds or refresh

### Test OCR Service Connection

1. Navigate to the **Upload** page
2. You should see the upload form without any errors
3. If you see an error message about OCR service, double-check the URL

### Test API Gateway Connection

1. Navigate to the **Analytics** page
2. The dashboard should load without errors
3. If you see connection errors, double-check the PYTHON_API_URL

## Troubleshooting

### Problem: "Disconnected" Badge Won't Turn Green

**Solutions:**
1. Wait 15 seconds for auto-reconnect
2. Refresh the browser page
3. Check browser console for errors (F12 → Console tab)
4. Verify both secrets were added correctly in Settings → Secrets

### Problem: Can't Find Settings Icon

**Solution:**
- Look in the top-right corner
- It might be a gear icon (⚙️) or user avatar
- Try clicking your username or profile picture

### Problem: Secrets Panel is Empty

**Solution:**
- Make sure you're on the "Secrets" tab in Settings
- Look for an "Add" or "+" button
- If you don't see it, check if you're logged in

### Problem: Server Won't Restart

**Solution:**
```bash
# Manually restart the dev server
cd /home/ubuntu/document_intelligence_ui
# Stop existing server (Ctrl+C in the terminal where it's running)
# Then start again:
pnpm dev
```

### Problem: OCR Service URL Not Working

**Verification:**
```bash
# Test the OCR service directly
curl http://localhost:8001/health

# Should return:
# {
#   "status": "healthy",
#   "available_engines": ["easy", "tesseract"],
#   "total_engines": 2
# }
```

If this fails, restart the OCR service:
```bash
cd /home/ubuntu/document_intelligence_platform
PORT=8001 python3 ocr_pipeline/ensemble_ocr_service.py > logs/ocr_service.log 2>&1 &
```

### Problem: API Gateway URL Not Working

**Verification:**
```bash
# Test the API Gateway directly
curl http://localhost:8002/health

# Should return:
# {
#   "status": "healthy",
#   "services": {
#     "spark": true,
#     "delta_lake": true,
#     "ingestion": true
#   }
# }
```

If this fails, restart the API Gateway:
```bash
cd /home/ubuntu/document_intelligence_platform
PORT=8002 python3 platform_api_gateway.py > logs/api_gateway.log 2>&1 &
```

## What's Next?

After configuration is complete:

### 1. Test Document Upload (2 minutes)
- Go to Upload page
- Upload a test document
- Watch for real-time processing notifications
- Verify OCR results

### 2. Explore Analytics (2 minutes)
- Go to Analytics page
- View processing trends
- Check category statistics
- Test date range filters

### 3. Try Batch Upload (3 minutes)
- Go to Batch Upload page
- Upload multiple documents
- Watch concurrent processing
- Check batch status

### 4. Test Lakehouse Explorer (2 minutes)
- Go to Analytics page
- Scroll to Lakehouse Explorer section
- Browse available tables
- Query data

## Configuration Summary

After completing this guide, you should have:

✅ OCR_SERVICE_URL configured and connected  
✅ PYTHON_API_URL configured and connected  
✅ WebSocket showing "Connected" status  
✅ All features enabled and ready to use

## Environment Variables Reference

For your reference, here are the two secrets you just added:

| Key | Value | Purpose |
|-----|-------|---------|
| `OCR_SERVICE_URL` | `http://localhost:8001` | Connects UI to OCR processing service (EasyOCR + Tesseract) |
| `PYTHON_API_URL` | `http://localhost:8002` | Connects UI to API Gateway (Spark, Delta Lake, Analytics) |

**Security Note:** These URLs are for local development. In production, use HTTPS URLs with proper authentication.

## Production Configuration

When deploying to production, you'll need to:

1. **Update URLs to production endpoints:**
   - OCR_SERVICE_URL: `https://ocr.your-domain.com`
   - PYTHON_API_URL: `https://api.your-domain.com`

2. **Add additional secrets:**
   - Database credentials
   - S3 access keys
   - OAuth configuration
   - JWT secrets

3. **Use environment variables instead of UI:**
   - Set via deployment platform (Vercel, AWS, etc.)
   - Use `.env.production` file
   - Configure via CI/CD pipeline

See `docs/DEPLOYMENT_CHECKLIST.md` for complete production setup.

## Support

If you encounter any issues:

1. Check the [Quick Start Guide](./QUICK_START.md)
2. Review the [Troubleshooting section](#troubleshooting) above
3. Check service logs:
   ```bash
   tail -f /home/ubuntu/document_intelligence_platform/logs/ocr_service.log
   tail -f /home/ubuntu/document_intelligence_platform/logs/api_gateway.log
   ```
4. Verify all services are running:
   ```bash
   ps aux | grep -E "(ensemble_ocr|platform_api|tsx watch)"
   ```

---

**Congratulations!** Your Document Intelligence Platform is now fully configured and ready to process documents! 🎉

**Next:** Follow the [End-to-End Testing Guide](./END_TO_END_TESTING.md) to verify all features.
