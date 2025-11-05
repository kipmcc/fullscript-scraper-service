# Railway Environment Variables Setup

## Issue Detected
Railway deployment is missing Supabase credentials. The scraper works (logged in successfully) but cannot write to database.

**Error from Railway logs**:
```
[Scraper] Fatal error: {
  message: 'Invalid API key',
  hint: 'Double check your Supabase `anon` or `service_role` API key.'
}
```

---

## Required Environment Variables

Add these in Railway Dashboard → Your Service → Variables tab:

### 1. SUPABASE_URL
```
https://vvkaehisvxvjhfrneagj.supabase.co
```

### 2. SUPABASE_SERVICE_ROLE_KEY
Get from: Supabase Dashboard → Project Settings → API → `service_role` key (secret)

**Important**: Use the **service_role** key, NOT the anon key. The scraper needs admin permissions to write to the database.

---

## Steps to Configure

1. **Go to Railway Dashboard**
   - https://railway.app/project/[your-project-id]
   - Click on "fullscript-scraper-service"

2. **Navigate to Variables Tab**
   - Click "Variables" in left sidebar

3. **Add New Variables**
   - Click "+ New Variable"
   - Name: `SUPABASE_URL`
   - Value: `https://vvkaehisvxvjhfrneagj.supabase.co`
   - Click "Add"

   - Click "+ New Variable" again
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: [paste service_role key from Supabase]
   - Click "Add"

4. **Railway Will Auto-Redeploy**
   - Wait ~2-3 minutes for deployment to complete
   - Check logs for "Server listening on port 8080"

---

## How to Get Supabase Service Role Key

1. Go to: https://supabase.com/dashboard/project/vvkaehisvxvjhfrneagj/settings/api
2. Scroll to "Project API keys"
3. Copy the `service_role` key (marked as "secret" - requires reveal click)
4. Paste into Railway variable

**Security Note**: The service_role key has admin permissions. Never commit it to git or expose it publicly. Railway's variable system keeps it encrypted.

---

## Verification

After adding environment variables and redeployment completes:

1. **Test Health Endpoint**
   ```bash
   curl https://fullscript-scraper-service-production.up.railway.app/health
   ```
   Expected: `{"status":"healthy","service":"fullscript-scraper","version":"1.0.0"}`

2. **Test Scrape via Aviado UI**
   - Go to Admin Panel → Content → Fullscript Scraper
   - Mode: Brand, Filter: Thorne, Limit: 2
   - Click "Start Scrape"
   - Should complete without "Invalid API key" error

3. **Check Railway Logs**
   Should see:
   ```
   [Scraper] Login successful
   [Scraper] Scraped X products
   [Scraper] Writing results to Supabase...
   [Scraper] Import complete: [import-id]
   ```

---

## Optional Variables

Already set automatically by Railway:
- `PORT` - Railway assigns this (usually 8080)
- `NODE_ENV` - Set to "production"

---

**Updated**: 2025-11-05
**Status**: Configuration required before first production scrape
