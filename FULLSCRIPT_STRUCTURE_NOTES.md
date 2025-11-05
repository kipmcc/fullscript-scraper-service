# Fullscript Website Structure Notes

**Updated**: 2025-11-05
**Source**: Manual inspection + ChatGPT agent analysis

---

## Catalog Page Structure

**URL**: `https://fullscript.com/catalog` (requires login)

### Grid Container
```html
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
  <!-- Product cards here -->
</div>
```

### Product Card Structure

Each product card:
```html
<div class="flex flex-col rounded-lg border border-border p-4">
  <a class="mb-4 block h-32 w-full" href="/catalog/products/creatine?variant=...">
    <img alt="Creatine" class="size-full object-contain"
         src="https://assets.fullscript.io/Product/TH0117/400_front.png">
  </a>
  <div class="mb-4 overflow-x-hidden">
    <h3 class="mb-0 truncate font-mulish text-lg font-bold">
      <a href="/catalog/products/creatine?variant=...">Creatine</a>
    </h3>
    <p class="truncate">Thorne</p>
  </div>
  <button type="button" role="combobox" class="flex h-10 items-center justify-between ...">
    <div class="flex items-center gap-2"><span>90 capsules</span></div>
    <!-- chevron icon -->
  </button>
  <p class="mb-4"><span class="blur-sm">$N/A</span> (MSRP)</p>
  <button class="inline-flex w-full items-center justify-center ...">Add to cart</button>
</div>
```

### Data Available on Cards

| Field | Selector | Example | Notes |
|-------|----------|---------|-------|
| **Brand** | `div.mb-4.overflow-x-hidden p.truncate` | "Thorne" | ✅ On card |
| **Product Name** | `h3 a` | "Creatine" | ✅ On card |
| **Image URL** | `a.mb-4.block.h-32.w-full img[src]` | `https://assets.fullscript.io/...` | ✅ On card |
| **Product URL** | `a[href*='/catalog/products/']` | `/catalog/products/creatine?variant=...` | ✅ On card |
| **Size/Packaging** | `button[role='combobox'] span` | "90 capsules" | ✅ On card |
| **Price (MSRP)** | `p.mb-4 span.blur-sm` | Blurred until login | ✅ On card |

### Data NOT on Cards (Requires Product Page Visit)

❌ **Description** - Full product description
❌ **Ingredients** - Detailed supplement facts
❌ **Serving Size** - Actual dosage (e.g., "1 scoop = 5g")
❌ **Suggested Use** - Dosing instructions
❌ **Certifications** - NSF, IFOS, etc.
❌ **Warnings** - Allergens, contraindications
❌ **Other Ingredients** - Fillers, capsule material

**To get full data**: Must visit each product page (`/catalog/products/{slug}`).

---

## Filtering

**By Brand** (e.g., Thorne):
```
/u/catalog?brands_array=%7B...%22id%22:...%22Thorne...
```

Encoded JSON in `brands_array` query parameter contains brand ID.

**Sidebar Filters**:
- Include/exclude ingredients
- Form (capsule, tablet, softgel, etc.)
- Allergens
- Certifications

---

## Pagination

**⚠️ No Traditional Pagination**

Fullscript uses **"Load more"** button instead of numbered pages.

**Structure**:
```html
<button class="inline-flex ...">Load more</button>
```

**Behavior**:
- Loads 24 products at a time
- Button disappears when all products loaded
- Products append to existing grid (no page reload)
- Total count shown in heading (e.g., "162 results")

**Scraping Strategy**:
1. Extract products from initial load
2. Click "Load more"
3. Wait for new products to render
4. Extract new products
5. Repeat until button disappears or limit reached

---

## Example Product Details (Thorne Creatine)

**Product Page**: `/catalog/products/creatine?variant=...`

### Available Fields:

```json
{
  "brand": "Thorne",
  "product_name": "Creatine",
  "display_name": "Thorne - Creatine",
  "dosage_form": "powder",
  "serving_size": "1 scoop (5g)",
  "servings_per_container": 90,
  "ingredients": [
    {
      "name": "Creatine Monohydrate",
      "amount": 5,
      "unit": "g",
      "per_serving": true
    }
  ],
  "suggested_use": "Loading phase: 15-20g/day for 5-7 days. Maintenance: 5g/day",
  "certifications": ["NSF Certified for Sport", "Informed Sport"],
  "warnings": [
    "Consult healthcare provider before use",
    "Not suitable during pregnancy"
  ],
  "other_ingredients": null,
  "image_url": "https://assets.fullscript.io/Product/TH0117/400_front.png",
  "price_msrp": 42.00
}
```

### Curcumin Phytosome Example:

```json
{
  "brand": "Thorne",
  "product_name": "Curcumin Phytosome",
  "dosage_form": "capsule",
  "serving_size": "2 capsules",
  "ingredients": [
    {
      "name": "Curcumin Phytosome",
      "amount": 1,
      "unit": "g",
      "standardization": "Meriva® (curcuma longa extract / phosphatidylcholine complex)"
    }
  ],
  "other_ingredients": [
    "Calcium citrate",
    "Hypromellose (capsule)",
    "Leucine",
    "Silicon dioxide"
  ],
  "warnings": [
    "Hypersensitivity may occur; discontinue use if allergic reaction develops",
    "May interact with chemotherapy drugs; consult healthcare provider"
  ],
  "certifications": []
}
```

---

## Current Scraper Limitations

### What We Scrape (From Cards)

✅ Brand name
✅ Product name
✅ Image URL
✅ Product page URL
✅ Package size (e.g., "90 capsules")

### What We Generate

✅ `dosage_form` - Detected from product name/packaging (e.g., "capsule", "powder")
✅ `category` - Detected from product name/ingredients keywords
✅ `display_name` - Generated as "Brand - Product Name"
✅ `canonical_id` - Slugified "brand-product-name"
✅ `confidence` - Calculated based on field completeness

### What We DON'T Scrape

❌ Detailed ingredients with amounts/units
❌ Serving size instructions
❌ Suggested use / dosing
❌ Certifications (NSF, IFOS, etc.)
❌ Warnings / contraindications
❌ Other ingredients (fillers)
❌ Actual price (requires login + cart)

**Why**: These fields are only on individual product pages, not the catalog cards.

**To get them**: Would need to:
1. Click each product link
2. Wait for product page to load
3. Extract detailed data
4. Navigate back to catalog
5. Continue pagination

**Performance impact**: ~5-10 seconds per product (vs. <1 second for card-only).

---

## Future Enhancement: Product Page Scraping

If full data is needed, add this flow:

```typescript
async extractProductDetails(productUrl: string): Promise<DetailedProduct> {
  await this.page.goto(productUrl);
  await this.page.waitForSelector('.product-details'); // Adjust selector

  const details = await this.page.evaluate(() => {
    // Extract:
    // - Serving size from supplement facts table
    // - Ingredients with amounts/units
    // - Suggested use text
    // - Certifications badges
    // - Warnings text
    // - Other ingredients list
    return { ... };
  });

  return details;
}
```

**Recommendation**: Start with card-only scraping (current implementation). Add product page scraping only if detailed data is required for Stack Builder integration.

---

## Selectors Reference

### Catalog Page

```typescript
// Product card container
'div.flex.flex-col.rounded-lg.border'

// Within each card:
{
  brand: 'div.mb-4.overflow-x-hidden p.truncate',
  productName: 'h3 a',
  image: 'a.mb-4.block.h-32.w-full img',
  productUrl: 'a[href*="/catalog/products/"]',
  packageSize: 'button[role="combobox"] span',
  price: 'p.mb-4 span.blur-sm',
  addToCart: 'button:has-text("Add to cart")'
}

// Load more button
'button:has-text("Load more")'
```

### Product Page (Not Yet Implemented)

```typescript
// Would need inspection of individual product pages
// Structure likely differs per product type
// May require multiple selector strategies
```

---

## URL Patterns

### Catalog

- Base: `https://fullscript.com/catalog`
- With filter: `https://fullscript.com/u/catalog?brands_array=%7B...%7D`
- Logged in: `https://fullscript.com/u/catalog`

### Product Pages

- Pattern: `https://fullscript.com/catalog/products/{slug}`
- With variant: `https://fullscript.com/catalog/products/{slug}?variant={id}`
- Examples:
  - `/catalog/products/creatine?variant=U3ByZWU6OlZhcmlhbnQtMTIzNDU=`
  - `/catalog/products/curcumin-phytosome?variant=...`

---

## Authentication

**Login URL**: `https://router.fullscript.com/login`

**Login Flow**:
1. Navigate to login page
2. Fill email + password
3. Submit form
4. Wait for redirect to catalog
5. Session cookie persists for scraping

**Current Implementation**: ✅ Handled in `src/scraper.ts` lines 92-147

---

## Anti-Detection Considerations

**Current Measures**:
- ✅ Random delays (1-3 seconds between actions)
- ✅ User-Agent rotation (10 common browsers)
- ✅ Rate limiting (2 requests/second)
- ✅ Exponential backoff on errors

**Fullscript Characteristics**:
- React/Next.js SPA (dynamic content)
- Cloudflare protection (CF-Ray headers)
- Session-based authentication
- No visible CAPTCHA (as of 2025-11-05)

**Risk Level**: **Low** (standard e-commerce site, not actively anti-scraping)

---

**Last Updated**: 2025-11-05
**Scraper Version**: 2.1.0
**Status**: Card-level scraping implemented ✅
