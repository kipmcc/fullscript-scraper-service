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

## Expected Output

### Raw Scraper Response (from Railway Service)

The scraper returns raw Fullscript product data:

```json
{
  "success": true,
  "import_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_products": 3,
  "message": "Scraping completed successfully"
}
```

### Stored Raw Products (Supabase Table)

Products are stored with this structure before schema transformation:

```json
[
  {
    "brand": "Pure Encapsulations",
    "product_name": "Vitamin D3 2000 IU",
    "description": "Supports bone health and immune function",
    "ingredients": "Vitamin D3 (Cholecalciferol) 2000 IU",
    "serving_size": "1 capsule",
    "servings_per_container": 120,
    "price": 24.99,
    "image_url": "https://cdn.fullscript.com/vitamin-d3-2000.jpg",
    "product_url": "https://fullscript.com/products/vitamin-d3-2000",
    "category": "Vitamins & Minerals",
    "dosage_form": "Capsule"
  },
  {
    "brand": "Pure Encapsulations",
    "product_name": "Omega-3 Plus",
    "description": "Advanced triglyceride-form omega-3",
    "ingredients": "Fish Oil (Anchovy & Sardine) 1000mg, Vitamin D3 2000 IU",
    "serving_size": "2 softgels",
    "servings_per_container": 30,
    "price": 42.99,
    "image_url": "https://cdn.fullscript.com/omega3-plus.jpg",
    "product_url": "https://fullscript.com/products/omega-3-plus",
    "category": "Fish Oil & Omegas",
    "dosage_form": "Softgel"
  }
]
```

### V2 Schema Transformed Output

After processing through AI enhancement and Aviado stack builder, products are stored as:

```json
{
  "schema_version": "aviado.stack.current.v2",
  "version": "2.0.0",
  "items": [
    {
      "source_row_index": 0,
      "name": "Vitamin D3 2000 IU",
      "brand": "Pure Encapsulations",
      "form": "Capsule",
      "ingredients_raw": "Vitamin D3 (Cholecalciferol) 2000 IU",
      "dosage": {
        "amount_per_serving": 2000,
        "unit_per_serving": "IU",
        "recommended_units": 1,
        "recommended_frequency": "daily",
        "total_daily_amount": 2000,
        "total_daily_unit": "IU",
        "raw": "1 capsule daily"
      },
      "schedule": {
        "timeslots": ["AM_WITH_FOOD"],
        "raw": "Morning with food"
      },
      "purpose": ["Metabolic Health", "Immune Support"],
      "impacted_biomarkers": ["vitamin_d", "calcium_absorption"],
      "status": "OK",
      "issues": [],
      "bundle_links": [
        {
          "type": "goal",
          "goal": "Metabolic Health",
          "subgoal": "Micronutrient Status",
          "confidence": 98,
          "match_method": "semantic",
          "matched_keywords": ["vitamin d3", "bone health", "immune"]
        }
      ],
      "label_image_url": "https://cdn.fullscript.com/vitamin-d3-2000.jpg"
    },
    {
      "source_row_index": 1,
      "name": "Omega-3 Plus",
      "brand": "Pure Encapsulations",
      "form": "Softgel",
      "ingredients_raw": "Fish Oil (Anchovy & Sardine) 1000mg, Vitamin D3 2000 IU",
      "dosage": {
        "amount_per_serving": 1000,
        "unit_per_serving": "mg",
        "recommended_units": 2,
        "recommended_frequency": "daily",
        "total_daily_amount": 2000,
        "total_daily_unit": "mg",
        "raw": "2 softgels daily"
      },
      "schedule": {
        "timeslots": ["AM_WITH_FOOD"],
        "raw": "Morning with food"
      },
      "purpose": ["Cardiovascular", "Brain Health"],
      "impacted_biomarkers": ["triglycerides", "ldl", "inflammation"],
      "status": "OK",
      "issues": [],
      "bundle_links": [
        {
          "type": "goal",
          "goal": "Cardiovascular",
          "subgoal": "Lipid Profile",
          "confidence": 96,
          "match_method": "semantic",
          "matched_keywords": ["omega-3", "fish oil", "triglycerides"]
        },
        {
          "type": "goal",
          "goal": "Brain/Mood",
          "subgoal": "Cognitive Function",
          "confidence": 85,
          "match_method": "semantic",
          "matched_keywords": ["omega-3", "brain health", "cognitive"]
        }
      ],
      "label_image_url": "https://cdn.fullscript.com/omega3-plus.jpg"
    }
  ],
  "metadata": {
    "created_at": "2025-11-04T12:30:00Z",
    "last_modified": "2025-11-04T12:30:00Z",
    "created_by": "fullscript-scraper",
    "source": "fullscript_catalog",
    "ai_enhancements": {
      "version": "1.0.0",
      "model": "gpt-4o-mini",
      "confidence": 0.94,
      "last_enhanced": "2025-11-04T12:30:00Z"
    }
  },
  "media": {
    "supplement_images": [
      {
        "item_id": "vitamin-d3-2000-iu",
        "image_url": "https://cdn.fullscript.com/vitamin-d3-2000.jpg",
        "image_type": "label",
        "uploaded_at": "2025-11-04T12:30:00Z"
      },
      {
        "item_id": "omega-3-plus",
        "image_url": "https://cdn.fullscript.com/omega3-plus.jpg",
        "image_type": "label",
        "uploaded_at": "2025-11-04T12:30:00Z"
      }
    ]
  },
  "issues_summary": {
    "rows": 2,
    "ok": 2,
    "warn": 0,
    "error": 0
  }
}
```

### Validation Notes

The v2 schema enforces the following requirements:

**Required Enums:**
- `dosage_form`: Must be one of (Tablet, Capsule, Softgel, Powder, Liquid, Cream, Oil, Spray, Patch, Tea)
- `status`: Must be one of (OK, WARN, ERROR, PROCESSING)
- `timeslots`: Array of valid timeslot values (AM_WITH_FOOD, PM_BEFORE_FOOD, BEDTIME, etc.)
- `bundle_links.type`: Either "goal" or "biomarker"
- `bundle_links.match_method`: One of (exact, synonym, semantic, fuzzy, ai, partial, loinc)

**Validation Rules:**
1. At least one item required in the `items` array
2. Dosage amounts must be non-negative numbers
3. Confidence scores (0-100) must be within range
4. Metadata timestamps must be valid ISO 8601 format
5. Image URLs must be valid HTTP(S) URLs
6. Source row index must be non-negative integer

**Conditional Rules:**
- If `bundle_links.type` is "goal": `goal` field is required
- If `bundle_links.type` is "biomarker": `lab_id` or `loinc_code` field is required
- If `status` is "WARN" or "ERROR": `issues` array should not be empty

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
