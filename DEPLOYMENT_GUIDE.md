# Fullscript Scraper Service - Deployment Guide

Complete step-by-step guide for deploying the Fullscript scraper to Railway and integrating with Aviado.

## Prerequisites

- Railway account (https://railway.app)
- Supabase project with service role key
- GitHub account (recommended for automatic deployments)

## Architecture Overview

```
User Request (Aviado UI)
    ↓
Aviado Edge Function (fullscript-scrape-product)
    ↓
Railway Service (This Service)
    ↓
Fullscript Website (Playwright Scraper)
    ↓
Supabase Database (Results Storage)
```

---

## Part 1: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. **Push code to GitHub**
   ```bash
   cd fullscript-scraper-service
   git init
   git add .
   git commit -m "Initial commit: Fullscript scraper service"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/fullscript-scraper-service.git
   git push -u origin main
   ```

2. **Create Railway project**
   - Go to https://railway.app/new
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Click "Deploy Now"

3. **Railway will automatically**:
   - Detect the Dockerfile
   - Build the image
   - Deploy the service
   - Assign a public URL

### Option B: Deploy with Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize project**
   ```bash
   cd fullscript-scraper-service
   railway init
   # Select "Create new project"
   # Name it "fullscript-scraper"
   ```

4. **Deploy**
   ```bash
   railway up
   ```

---

## Part 2: Configure Environment Variables

In Railway dashboard:

1. **Navigate to your project**
   - Click on the service
   - Go to "Variables" tab

2. **Add required variables**:

   ```
   SUPABASE_URL=https://vvkaehisvxvjhfrneagj.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

3. **Optional variables** (Railway sets these automatically):
   - `PORT` - Set by Railway
   - `NODE_ENV=production` - Set by Railway

4. **Click "Deploy"** to restart with new environment variables

---

## Part 3: Get Service URL

### Via Railway Dashboard
1. Go to your service in Railway dashboard
2. Click "Settings" tab
3. Under "Networking", find "Public Networking"
4. Click "Generate Domain"
5. Copy the URL (e.g., `https://fullscript-scraper-production.up.railway.app`)

### Via Railway CLI
```bash
railway status
# Look for "Public URL"
```

### Test the deployment
```bash
# Replace with your Railway URL
curl https://your-service.up.railway.app/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "fullscript-scraper",
#   "version": "1.0.0",
#   "timestamp": "2025-11-04T12:00:00.000Z"
# }
```

---

## Part 4: Configure Aviado Edge Function

1. **Go to Supabase Dashboard**
   - Navigate to Project Settings → Edge Functions → Configuration

2. **Add environment variable**:
   ```
   RAILWAY_SCRAPER_URL=https://your-service.up.railway.app
   ```

3. **Deploy edge function**:
   ```bash
   cd /path/to/aviado
   supabase functions deploy fullscript-scrape-product
   ```

4. **Verify deployment**:
   ```bash
   supabase functions list
   # Should show fullscript-scrape-product with "deployed" status
   ```

---

## Part 5: Test End-to-End Flow

### Via Aviado Admin Panel

1. **Login to Aviado as admin**
2. **Navigate to Admin Panel** → Content dropdown → "Fullscript Scraper"
3. **Enter Fullscript credentials**
4. **Configure scraper**:
   - Mode: "Brand"
   - Filter: "Thorne"
   - Limit: 10
5. **Click "Start Scrape"**
6. **Monitor progress** in real-time
7. **Check Import History** tab for results

### Via cURL (Direct Railway Test)

```bash
# Replace with your Railway URL
RAILWAY_URL="https://your-service.up.railway.app"

# Test scrape
curl -X POST "$RAILWAY_URL/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "email": "your-email@example.com",
      "password": "your-password"
    },
    "mode": "brand",
    "filter": "Thorne",
    "limit": 5
  }'

# Expected response (takes 30-60 seconds):
# {
#   "success": true,
#   "import_id": "123e4567-e89b-12d3-a456-426614174000",
#   "total_products": 5,
#   "message": "Scraping completed successfully"
# }
```

### Via Supabase Edge Function

```bash
# Get your Supabase project reference from dashboard
SUPABASE_URL="https://vvkaehisvxvjhfrneagj.supabase.co"
ANON_KEY="your-anon-key"

# Must authenticate as admin user
curl -X POST "$SUPABASE_URL/functions/v1/fullscript-scrape-product" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "email": "your-fullscript-email",
      "password": "your-fullscript-password"
    },
    "mode": "brand",
    "filter": "Pure Encapsulations",
    "limit": 10
  }'
```

---

## Monitoring & Troubleshooting

### View Railway Logs

**Via Dashboard:**
1. Go to Railway dashboard
2. Click on your service
3. Go to "Deployments" tab
4. Click on latest deployment
5. View real-time logs

**Via CLI:**
```bash
railway logs
# or for continuous streaming:
railway logs --follow
```

### Common Issues

#### 1. "RAILWAY_SCRAPER_URL environment variable not set"
**Solution**: Add `RAILWAY_SCRAPER_URL` to Supabase Edge Function environment variables (Part 4, step 2)

#### 2. "Playwright installation failed"
**Solution**: Railway Dockerfile uses official Playwright image. If issues occur:
```dockerfile
# In Dockerfile, ensure this line is present:
FROM mcr.microsoft.com/playwright:v1.40.0-jammy
```

#### 3. "Memory limit exceeded"
**Solution**: Upgrade Railway plan or reduce `limit` parameter in scrape requests

#### 4. "Timeout errors"
**Solution**: Increase timeout in scraper.ts or split large scrapes into smaller batches

#### 5. "Login failed - still on login page"
**Solution**:
- Verify Fullscript credentials are correct
- Check if Fullscript login page structure changed (update selectors in scraper.ts)

#### 6. "No products found"
**Solution**:
- Fullscript may have changed product card selectors
- Update selectors in `extractProductsFromPage()` function

### Performance Metrics

**Expected Timings**:
- Login: 5-10 seconds
- Page load: 2-4 seconds
- Product extraction: 1-3 seconds per page
- Total for 50 products: 60-120 seconds

**Railway Resources** (Starter Plan):
- RAM: ~200-400MB during scraping
- CPU: ~20-40% during scraping
- Disk: ~1GB (Playwright + dependencies)

---

## Scaling Considerations

### Vertical Scaling (Railway Plans)
- **Starter ($5/mo)**: Good for <100 products/scrape
- **Pro ($20/mo)**: Handles up to 500 products/scrape

### Horizontal Scaling (Future)
Consider adding:
- Job queue (Bull/BullMQ with Redis)
- Multiple scraper instances
- Load balancer

### Cost Optimization
- Batch requests (scrape 50-100 products at a time)
- Cache results in Supabase (avoid re-scraping)
- Use incremental updates instead of full catalog scrapes

---

## Security Notes

### Credentials
- **Never commit credentials** to GitHub
- Use Railway environment variables
- Rotate Fullscript credentials regularly

### API Security
- Railway service is public but only accepts requests from Aviado edge function
- Add API key authentication if needed (future enhancement)

### Rate Limiting
- Current: 2-4 seconds between page loads
- Adjust in `antiDetection.ts` if needed
- Monitor for Fullscript rate limiting

---

## Maintenance

### Updating the Service

**Via GitHub (automatic deployments)**:
```bash
git add .
git commit -m "Update scraper logic"
git push
# Railway automatically redeploys
```

**Via Railway CLI**:
```bash
railway up
```

### Updating Selectors

If Fullscript changes their HTML structure:

1. **Inspect product pages** in browser DevTools
2. **Update selectors** in `src/scraper.ts`:
   ```typescript
   // Line ~165
   await this.page.waitForSelector('[data-testid="product-card"], .product-card, .NEW_SELECTOR')
   ```
3. **Test locally** with `npm run dev`
4. **Deploy** to Railway

### Monitoring

Set up alerts:
- Railway Dashboard → Alerts → Add webhook
- Monitor for deployment failures
- Track memory/CPU usage

---

## Rollback Plan

If something goes wrong:

### Railway Dashboard
1. Go to "Deployments" tab
2. Find previous working deployment
3. Click "Redeploy"

### Railway CLI
```bash
railway rollback
```

### Edge Function
```bash
# Redeploy previous version
git checkout <previous-commit>
supabase functions deploy fullscript-scrape-product
```

---

## Next Steps

After successful deployment:

1. ✅ Test with small scrapes (10-20 products)
2. ✅ Gradually increase to 50-100 products
3. ✅ Monitor Railway metrics and logs
4. ✅ Document any Fullscript selector changes
5. ✅ Set up error alerts
6. ✅ Consider adding webhook support for async scraping

---

## Support & Resources

- **Railway Docs**: https://docs.railway.app
- **Playwright Docs**: https://playwright.dev/docs/intro
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **LEG Backend Reference**: `/leg_celery/README_VENV.md` (similar Railway setup)

---

**Deployment Date**: 2025-11-04
**Service Version**: 1.0.0
**Maintainer**: Aviado Team
