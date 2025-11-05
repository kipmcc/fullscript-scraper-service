# Fullscript Selector Issue - Debug Guide

**Issue**: Scraper successfully logs in and loads catalog, but extracts 0 products.

**Error Log**:
```
[Scraper] Product cards not found, attempting alternative selectors...
[Scraper] Extracted 0 products from page (v2 schema)
```

---

## Root Cause

The CSS selectors in the scraper don't match Fullscript's current HTML structure. Web scraping is brittle - when websites update their HTML/CSS, selectors break.

**Current selectors** (src/scraper.ts lines 190-198):
```typescript
// Waiting for product cards
await this.page.waitForSelector('[data-testid="product-card"], .product-card, .product-item'

// Finding product cards
const productCards = document.querySelectorAll('[data-testid="product-card"], .product-card, .product-item, article');
```

These selectors are **guesses** based on common e-commerce patterns. They likely don't match Fullscript's actual HTML.

---

## Solution Options

### Option 1: Manual Inspection (Recommended)

**You need to**:
1. Visit Fullscript catalog page while logged in
2. Open browser DevTools (F12)
3. Inspect a product card element
4. Find the actual HTML structure and class names
5. Update the selectors in `src/scraper.ts`

**What to look for**:
- Container div for each product (e.g., `<div class="actual-product-class">`)
- Brand element (e.g., `<span class="actual-brand-class">Thorne</span>`)
- Product name element (e.g., `<h3 class="actual-title-class">Vitamin D3</h3>`)
- Image element
- Link element

**Example of what you might find**:
```html
<div class="fs-product-card"> <!-- ← This is what we need! -->
  <a href="/products/vitamin-d3-2000">
    <img src="..." />
    <div class="fs-brand">Thorne</div>
    <h3 class="fs-product-title">Vitamin D3 2000 IU</h3>
  </div>
</div>
```

Then update selectors to:
```typescript
// Line 190
await this.page.waitForSelector('.fs-product-card', { timeout: 10000 });

// Line 198
const productCards = document.querySelectorAll('.fs-product-card');

// Line 204
const brandEl = card.querySelector('.fs-brand');

// Line 208
const nameEl = card.querySelector('.fs-product-title');
```

---

### Option 2: Screenshot Debugging (Quick Diagnostic)

Add screenshot capability to see what the scraper is actually seeing:

**Add to scraper.ts after login** (around line 407):
```typescript
// After catalog loads, take screenshot
await this.page.screenshot({
  path: './debug-screenshot.png',
  fullPage: true
});
console.log('[DEBUG] Screenshot saved to debug-screenshot.png');
```

This will show you exactly what the page looks like when the scraper tries to extract products.

**Upload screenshot to Railway**:
Railway doesn't persist files, but you can base64 encode and log it:
```typescript
const screenshot = await this.page.screenshot({ encoding: 'base64' });
console.log('[DEBUG] Screenshot base64:', screenshot.substring(0, 100) + '...');
```

---

### Option 3: Dump HTML for Analysis

Add HTML logging to see actual page structure:

**Add to scraper.ts after line 187**:
```typescript
// Get page HTML for debugging
const html = await this.page.content();
console.log('[DEBUG] Page HTML length:', html.length);
console.log('[DEBUG] Page HTML sample:', html.substring(0, 500));

// Try to find ANY divs/articles that might be products
const potentialCards = await this.page.evaluate(() => {
  const allDivs = document.querySelectorAll('div, article');
  return Array.from(allDivs).slice(0, 10).map(el => ({
    tagName: el.tagName,
    className: el.className,
    id: el.id,
    textContent: el.textContent?.substring(0, 50)
  }));
});
console.log('[DEBUG] Potential product containers:', JSON.stringify(potentialCards, null, 2));
```

This will log what HTML elements exist on the page.

---

### Option 4: Use More Generic Selectors

Update the scraper to use very broad selectors and filter results:

**Replace line 198 with**:
```typescript
const productCards = document.querySelectorAll('div[class*="product"], div[class*="card"], div[data-*], article');
```

This will match ANY div with "product" or "card" in the class name, or any div with data attributes.

---

## Recommended Next Steps

**IMMEDIATE** (5 minutes):
1. You manually visit https://fullscript.com/catalog (logged in)
2. Open DevTools (F12) → Elements tab
3. Click the "Select element" tool (top-left of DevTools)
4. Click on a Thorne product card
5. Look at the HTML in DevTools - what's the class name?
6. Share the class name with me

**SHORT-TERM** (if you can't access Fullscript):
1. Add HTML dump logging (Option 3 above)
2. Push to Railway
3. Run another scrape
4. Check Railway logs for the HTML dump
5. Share the log output with me
6. I'll identify the correct selectors

---

## Quick Fix Template

Once you know the correct selectors, here's what to update in `src/scraper.ts`:

```typescript
// Line 190 - Wait for product cards
await this.page.waitForSelector('.ACTUAL_PRODUCT_CLASS', {
  timeout: 10000,
});

// Line 198 - Query product cards
const productCards = document.querySelectorAll('.ACTUAL_PRODUCT_CLASS');

// Line 204 - Brand selector
const brandEl = card.querySelector('.ACTUAL_BRAND_CLASS');

// Line 208 - Product name selector
const nameEl = card.querySelector('.ACTUAL_NAME_CLASS');

// Line 216 - Image selector
const imgEl = card.querySelector('img'); // Usually works

// Line 220 - Link selector
const linkEl = card.querySelector('a[href*="/products/"]'); // Usually works
```

Replace `ACTUAL_PRODUCT_CLASS`, `ACTUAL_BRAND_CLASS`, `ACTUAL_NAME_CLASS` with the real class names from Fullscript.

---

## Why This Happens

Web scraping is inherently fragile because:
1. **No API contract**: Websites can change HTML anytime without notice
2. **Dynamic content**: Modern sites use JavaScript frameworks (React, etc.) that render HTML dynamically
3. **Class name obfuscation**: Some sites intentionally scramble class names for anti-scraping
4. **A/B testing**: Sites may show different HTML to different users

**Long-term solution**: Ask Fullscript for an API. Web scraping should be a last resort.

---

## Status

- ✅ Login: Working
- ✅ Catalog navigation: Working
- ✅ Database writes: Working
- ✅ V2 schema: Working
- ❌ Product extraction: **SELECTORS DON'T MATCH**

**Blocker**: Need correct CSS selectors for Fullscript's current HTML structure.

---

**Created**: 2025-11-05
**Priority**: P0 - Blocking all scraping functionality
