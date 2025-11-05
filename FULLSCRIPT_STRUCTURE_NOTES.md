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

## Current Scraper Capabilities

### Phase 1: Catalog Card Scraping

✅ Brand name
✅ Product name
✅ Front image URL (card thumbnail)
✅ Product page URL
✅ Package size (e.g., "90 capsules")

### Phase 2: Product Page Scraping (NEW - v2.2.0)

✅ **Detailed ingredients** with amounts/units (from "More" section)
✅ **Serving size** instructions (from "More" section)
✅ **Suggested use** / dosing instructions (from "More" section)
✅ **Certifications** (NSF, IFOS, etc.) (from Certifications accordion)
✅ **Warnings** / contraindications (from Warnings accordion)
✅ **Other ingredients** (fillers, capsule material) (from "More" section)
✅ **Full description** (from Description accordion)
✅ **Dietary restrictions** (from Dietary restrictions accordion)
✅ **Back label image** (supplement facts panel)

### What We Generate

✅ `dosage_form` - Detected from product name/packaging/serving size
✅ `category` - Detected from product name/ingredients keywords
✅ `display_name` - Generated as "Brand - Product Name"
✅ `canonical_id` - Slugified "brand-product-name"
✅ `confidence` - Calculated based on field completeness (now 0.85-0.95 with product page data)

### Two-Phase Scraping Architecture

The scraper now uses a two-phase approach for 100% v2 schema coverage:

**Phase 1 - Catalog Scraping** (~1 second per product):
1. Load catalog page with filters
2. Extract product cards (brand, name, thumbnail, URL)
3. Handle "Load more" pagination
4. Build list of product URLs

**Phase 2 - Product Page Scraping** (~2-3 seconds per product):
1. Visit each product page individually
2. Extract accordion sections (Description, Warnings, Certifications, etc.)
3. Parse "More" section for structured data (ingredients, serving size, suggested use)
4. Extract back label image URL
5. Merge with catalog data

**Performance impact**: ~3-4 seconds per product total (vs. <1 second for card-only).

---

## Product Page Structure

### URL Pattern
```
https://fullscript.com/catalog/products/{slug}?variant={variant_id}
```

### Accordion Sections

Product pages use collapsible accordions powered by the CSS class `.css-1l74dbd-HTML-styles-GenericCollapsible-styles`:

```html
<!-- Each accordion section -->
<div class="accordion-container">
  <h5>Description</h5> <!-- or "Warnings", "Certifications", etc. -->
  <div class="css-1l74dbd-HTML-styles-GenericCollapsible-styles">
    <!-- Content here -->
  </div>
</div>
```

### Accordion Sections & Selectors

| Section | Header Selector | Content Selector | Data Extracted |
|---------|----------------|------------------|----------------|
| **Description** | `h5:has-text("Description")` | Parent `.css-1l74dbd-...` | Full product description |
| **Warnings** | `h5:has-text("Warnings")` | Parent `.css-1l74dbd-...` | Contraindications, allergens |
| **Dietary restrictions** | `h5:has-text("Dietary restrictions")` | Parent `.css-1l74dbd-...` | Gluten-free, vegan, etc. |
| **Certifications** | `h5:has-text("Certifications")` | Parent `.css-1l74dbd-...` | NSF, IFOS, GMP, etc. |
| **More** | `h5:has-text("More")` | Parent `.css-1l74dbd-...` | **Structured data** (see below) |

### "More" Section - Critical Structured Data

The "More" accordion contains the most important data in HTML paragraph format:

```html
<div class="css-1l74dbd-HTML-styles-GenericCollapsible-styles">
  <p><strong>Suggested Use:</strong><br>Take 1 capsule per day, with a meal.</p>

  <p><strong>Serving Size:</strong> 1 Capsule</p>

  <p><strong>Amount Per Serving</strong><br>
     <strong>DHEA</strong> ... 10mg<br>
     <i>(dehydroepiandrosterone, C19H28O2) (micronized)</i>
  </p>

  <p><strong>Other Ingredients:</strong> hypoallergenic plant fiber (cellulose),
     vegetarian capsule (cellulose, water)</p>
</div>
```

### Parsing Patterns for "More" Section

**Suggested Use**:
```typescript
// Extract: "Take 1 capsule per day, with a meal."
const suggestedUseMatch = html.match(/<strong>Suggested Use:<\/strong><br>(.*?)<\/p>/s);
const suggestedUse = suggestedUseMatch ? suggestedUseMatch[1].trim() : null;
```

**Serving Size**:
```typescript
// Extract: "1 Capsule"
const servingSizeMatch = html.match(/<strong>Serving Size:<\/strong>\s*(.*?)<\/p>/s);
const servingSize = servingSizeMatch ? servingSizeMatch[1].trim() : null;
```

**Ingredients with Amounts**:
```typescript
// Extract ingredient blocks like:
// "DHEA ... 10mg\n(dehydroepiandrosterone, C19H28O2) (micronized)"
const ingredientsMatch = html.match(/<strong>Amount Per Serving<\/strong><br>(.*?)<\/p>/s);
if (ingredientsMatch) {
  const ingredientLines = ingredientsMatch[1].split('<br>').filter(line => line.trim());
  // Parse each line for: name, amount, unit, standardization
}
```

**Other Ingredients**:
```typescript
// Extract: "hypoallergenic plant fiber (cellulose), vegetarian capsule..."
const otherIngredientsMatch = html.match(/<strong>Other Ingredients:<\/strong>\s*(.*?)<\/p>/s);
const otherIngredients = otherIngredientsMatch ? otherIngredientsMatch[1].trim() : null;
```

### Image URLs

Fullscript uses predictable CDN URLs:

```typescript
// Front label (product image)
const frontImageUrl = `https://assets.fullscript.io/Product/${productId}/1000_front.webp`;

// Back label (supplement facts panel)
const backImageUrl = `https://assets.fullscript.io/Product/${productId}/1000_label.webp`;
```

**Note**: `productId` can be extracted from internal product data or discovered through page inspection.

### Implementation Strategy

```typescript
async extractProductPageDetails(productUrl: string): Promise<ProductPageData> {
  await this.page.goto(productUrl);

  // Wait for accordions to render
  await this.page.waitForSelector('h5:has-text("More")', { timeout: 10000 });

  // Extract all accordion sections
  const pageData = await this.page.evaluate(() => {
    const extractAccordion = (headerText: string): string | null => {
      const header = Array.from(document.querySelectorAll('h5'))
        .find(h => h.textContent?.includes(headerText));

      if (!header) return null;

      const content = header.parentElement?.querySelector('.css-1l74dbd-HTML-styles-GenericCollapsible-styles');
      return content?.innerHTML || null;
    };

    return {
      description: extractAccordion('Description'),
      warnings: extractAccordion('Warnings'),
      certifications: extractAccordion('Certifications'),
      dietaryRestrictions: extractAccordion('Dietary restrictions'),
      moreSection: extractAccordion('More'), // Contains structured data
    };
  });

  // Parse "More" section for structured data
  const parsedData = parseMoreSection(pageData.moreSection);

  return { ...pageData, ...parsedData };
}
```

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
**Scraper Version**: 2.2.0
**Status**: Two-phase scraping (catalog + product pages) implemented ✅
**Coverage**: 100% v2 schema field population
