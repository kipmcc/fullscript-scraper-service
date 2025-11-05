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

## Scraper Response & Schema

The scraper extracts product data and stores it in Supabase for processing into the Aviado supplement stack schema.

### Raw Scraped Data Structure

Each product extracted from Fullscript contains:

```json
{
  "brand": "Pure Encapsulations",
  "product_name": "Omega-3 Plus",
  "description": "Advanced triglyceride-form omega-3 formula",
  "ingredients": "Fish Oil (Anchovy & Sardine) (1000mg), Vitamin D3 (2000 IU)",
  "serving_size": "2 softgels",
  "servings_per_container": 30,
  "price": 42.99,
  "image_url": "https://cdn.fullscript.com/...",
  "product_url": "https://fullscript.com/products/omega-3-plus",
  "category": "Fish Oil & Omegas",
  "dosage_form": "Softgel"
}
```

### V2 Schema Output Structure

After processing by the Aviado stack builder, raw scraper data is transformed into the Aviado stack schema v2:

```typescript
{
  schema_version: "aviado.stack.current.v2",
  version: "2.0.0",
  items: [
    {
      source_row_index: 0,
      name: "Omega-3 Plus",
      brand: "Pure Encapsulations",
      form: "Softgel",
      ingredients_raw: "Fish Oil (Anchovy & Sardine) (1000mg), Vitamin D3 (2000 IU)",

      dosage: {
        amount_per_serving: 1000,
        unit_per_serving: "mg",
        recommended_units: 2,
        recommended_frequency: "daily",
        total_daily_amount: 2000,
        total_daily_unit: "mg",
        raw: "2 softgels daily"
      },

      schedule: {
        timeslots: ["AM_WITH_FOOD"],
        raw: "Morning with food"
      },

      purpose: ["Cardiovascular", "Brain Health"],
      impacted_biomarkers: ["triglycerides", "inflammation"],

      status: "OK",
      issues: [],

      bundle_links: [
        {
          type: "goal",
          goal: "Cardiovascular",
          subgoal: "Lipid Profile",
          confidence: 95,
          match_method: "semantic",
          matched_keywords: ["omega-3", "fish oil", "triglycerides"]
        }
      ],

      label_image_url: "https://cdn.fullscript.com/omega3-label.jpg"
    }
  ],

  metadata: {
    created_at: "2025-11-04T12:00:00Z",
    last_modified: "2025-11-04T12:00:00Z",
    created_by: "fullscript-scraper",
    source: "fullscript_catalog",
    ai_enhancements: {
      version: "1.0.0",
      model: "gpt-4o-mini",
      confidence: 0.92,
      last_enhanced: "2025-11-04T12:00:00Z"
    }
  },

  media: {
    supplement_images: [
      {
        item_id: "omega-3-plus",
        image_url: "https://cdn.fullscript.com/omega3-label.jpg",
        image_type: "label",
        uploaded_at: "2025-11-04T12:00:00Z"
      }
    ]
  },

  issues_summary: {
    rows: 1,
    ok: 1,
    warn: 0,
    error: 0
  }
}
```

### Required Enums

**Dosage Form** (`dosage_form`):
Common values extracted from Fullscript:
- Tablet
- Capsule
- Softgel
- Powder
- Liquid
- Cream
- Oil
- Spray
- Patch
- Tea

**Category** (`category`):
Fullscript categories mapped to Aviado goals:
- Fish Oil & Omegas → Cardiovascular
- Vitamins & Minerals → Metabolic Health
- Probiotics & Prebiotics → Digestive Health
- Mushrooms & Adaptogens → Immune Support
- Herbal & Botanical → General Health
- Sleep Support → Brain/Mood
- Joint & Mobility → Structural Health

**Timeslots**:
- `AM_BEFORE_FOOD` - Morning on empty stomach
- `AM_AFTER_FOOD` - Morning with food
- `AM` - Morning (time unspecified)
- `MIDDAY` - Midday/lunch time
- `PM_BEFORE_FOOD` - Evening on empty stomach
- `PM_AFTER_FOOD` - Evening with food
- `PM` - Evening (time unspecified)
- `WITH_FOOD` - Anytime with food
- `BEDTIME` - Before sleep
- `PRE_WORKOUT` - Before exercise
- `POST_WORKOUT` - After exercise
- `UNSPECIFIED` - No timing guidance
- `ON_DECK` - Under investigation
- `OFF_CYCLE` - Temporarily paused

### Confidence Scoring Methodology

The v2 schema includes confidence scores for bundle links (0-100%):
- **90-100%**: Exact match (e.g., "Omega-3" directly matches goal keyword)
- **75-89%**: Strong semantic match (e.g., "Fish Oil" → Cardiovascular)
- **60-74%**: Moderate match (e.g., AI inference from ingredients)
- **<60%**: Weak/partial match (AI was uncertain)

Match methods:
- `exact` - Exact keyword match
- `synonym` - Matches via synonym database
- `semantic` - LLM semantic understanding
- `fuzzy` - Fuzzy string matching
- `ai` - AI-generated inference
- `partial` - Partial keyword match
- `loinc` - LOINC ontology match (for biomarkers)

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
