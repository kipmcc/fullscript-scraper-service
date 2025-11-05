# Fullscript Scraper Service

Standalone Playwright-based scraper service for Fullscript supplement data. Deployed on Railway as a separate service (similar to LEG backend).

## Features

- ✅ Real Playwright browser automation
- ✅ Fullscript authentication
- ✅ Anti-detection techniques (random delays, rate limiting)
- ✅ Direct Supabase integration
- ✅ Pagination support
- ✅ Railway-optimized Docker setup

## Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  Aviado App     │──────▶│  Railway Service │──────▶│  Fullscript     │
│  (Edge Function)│       │  (This Service)  │       │  (Target Site)  │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Supabase DB    │
                          │  (Results)      │
                          └─────────────────┘
```

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "fullscript-scraper",
  "version": "1.0.0",
  "timestamp": "2025-11-04T12:00:00.000Z"
}
```

### `POST /scrape`
Trigger a scraping job.

**Request Body:**
```json
{
  "credentials": {
    "email": "user@example.com",
    "password": "password123"
  },
  "mode": "brand",
  "filter": "Thorne",
  "limit": 50
}
```

**Modes:**
- `full_catalog` - Scrape entire catalog (no filter needed)
- `category` - Filter by category (e.g., "Probiotics")
- `brand` - Filter by brand (e.g., "Thorne")
- `search` - Search query (e.g., "omega-3")

**Response:**
```json
{
  "success": true,
  "import_id": "123e4567-e89b-12d3-a456-426614174000",
  "total_products": 50,
  "message": "Scraping completed successfully"
}
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
NODE_ENV=production
```

## Local Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run install-playwright

# Start development server
npm run dev

# Test the API
curl http://localhost:3000/health
```

## Railway Deployment

### 1. Create New Project
```bash
# In Railway dashboard:
# New Project → Deploy from GitHub → Select this repo
# OR use Railway CLI:
railway init
```

### 2. Configure Environment Variables
In Railway dashboard, add:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Railway will automatically set `PORT` and `NODE_ENV=production`.

### 3. Deploy
```bash
railway up
# OR connect GitHub repo for automatic deployments
```

### 4. Get Service URL
```bash
railway status
# Copy the public URL (e.g., https://fullscript-scraper-production.up.railway.app)
```

## Integration with Aviado

Update the Aviado edge function to call this service:

```typescript
// supabase/functions/fullscript-scrape-product/index.ts

const SCRAPER_SERVICE_URL = 'https://your-railway-url.up.railway.app';

const response = await fetch(`${SCRAPER_SERVICE_URL}/scrape`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials,
    mode,
    filter,
    limit,
  }),
});

const result = await response.json();
```

## Troubleshooting

### Playwright Installation Issues
```bash
# Railway automatically handles Playwright installation
# For local dev, if browsers aren't installing:
npx playwright install chromium --with-deps
```

### Timeout Errors
- Increase `waitUntil` timeout in scraper.ts
- Check Fullscript site for changes (selectors may break)

### Rate Limiting
- Adjust delays in `antiDetection.ts`
- Currently: 2-4 seconds between pages

### Memory Issues on Railway
- Railway has 512MB RAM by default
- Upgrade plan if scraping large catalogs
- Consider processing in smaller batches

## Architecture Notes

This service is designed to run **separately** from the main Aviado application, similar to how the LEG backend is deployed. This separation provides:

1. **Isolation**: Scraper failures don't affect main app
2. **Scalability**: Can scale scraper independently
3. **Resource Management**: Playwright requires significant resources
4. **Security**: Credentials stay within scraper service

## Cost Considerations

**Railway Pricing** (as of 2025):
- Starter Plan: $5/month (512MB RAM, 1GB disk)
- Pro Plan: $20/month (8GB RAM, 100GB disk)

**Recommended**: Start with Starter plan, monitor memory usage.

## Future Improvements

- [ ] Add webhook support for async scraping
- [ ] Implement scraping queue (Redis/Bull)
- [ ] Add screenshot capture for debugging
- [ ] Proxy rotation for larger scrapes
- [ ] Captcha solving integration
