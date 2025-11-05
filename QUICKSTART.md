# Fullscript Scraper Service - Quick Start

Get the scraper running on Railway in 10 minutes.

## 🚀 Super Fast Deployment (3 Steps)

### 1. Push to GitHub
```bash
cd fullscript-scraper-service
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/fullscript-scraper.git
git push -u origin main
```

### 2. Deploy to Railway
1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your repo → Deploy
4. Add environment variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key
5. Generate public domain (Settings → Networking)

### 3. Configure Aviado
1. Copy Railway URL (e.g., `https://your-app.up.railway.app`)
2. In Supabase Dashboard:
   - Project Settings → Edge Functions → Configuration
   - Add: `RAILWAY_SCRAPER_URL=https://your-app.up.railway.app`
3. Deploy edge function:
   ```bash
   supabase functions deploy fullscript-scrape-product
   ```

## ✅ Test It

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test scrape (replace with real credentials)
curl -X POST https://your-app.up.railway.app/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "email": "your-fullscript-email",
      "password": "your-password"
    },
    "mode": "brand",
    "filter": "Thorne",
    "limit": 5
  }'
```

## 📊 Use in Aviado

1. Login as admin
2. Admin Panel → Content → "Fullscript Scraper"
3. Enter Fullscript credentials
4. Select mode (Brand, Category, Search, or Full Catalog)
5. Set filter and limit
6. Click "Start Scrape"
7. Watch real-time progress!

## 📖 Full Documentation

See `DEPLOYMENT_GUIDE.md` for comprehensive instructions, troubleshooting, and advanced configuration.

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "RAILWAY_SCRAPER_URL not set" | Add env var to Supabase Edge Functions config |
| Health check fails | Check Railway deployment logs |
| Login fails | Verify Fullscript credentials |
| No products found | Fullscript changed HTML - update selectors |
| Memory errors | Reduce limit or upgrade Railway plan |

## 📝 Environment Variables

**Railway (Required)**:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Supabase Edge Functions (Required)**:
```
RAILWAY_SCRAPER_URL=https://your-app.up.railway.app
```

That's it! 🎉
