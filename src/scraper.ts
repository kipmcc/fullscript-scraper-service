/**
 * Fullscript Product Scraper
 *
 * Real Playwright-based scraper that authenticates with Fullscript
 * and extracts supplement product data.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { randomDelay } from './utils/antiDetection';
import {
  ProductV2,
  FullscriptImportV2,
  SourceType,
} from './types/v2Schema';
import {
  detectDosageForm,
  detectCategory,
  calculateConfidence,
  generateDisplayName,
  generateCanonicalId,
} from './utils/enumDetection';
import {
  parseIngredients,
  createFallbackIngredient,
  extractKeyIngredientsText,
} from './utils/ingredientParser';
import { safeValidateProduct } from './utils/v2Validator';
import { ProductPageScraper } from './scraper-productPage';

const FULLSCRIPT_LOGIN_URL = 'https://fullscript.com/login';

// Base URL and catalog URL will be determined after login based on redirect

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Scraper configuration
 */
export interface ScraperConfig {
  email: string;
  password: string;
  mode: 'full_catalog' | 'category' | 'brand' | 'search';
  filter?: string | null;
  limit: number;
}

/**
 * Scraper result
 */
export interface ScraperResult {
  success: boolean;
  products: ProductV2[];
  totalScraped: number;
  errors: string[];
  importId?: string;
}

/**
 * Main scraper class
 */
export class FullscriptScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private baseUrl: string = 'https://fullscript.com'; // Will be updated after login redirect

  /**
   * Initialize browser with anti-detection settings
   */
  private async initBrowser(): Promise<void> {
    console.log('[Scraper] Initializing browser...');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    // Create context with realistic browser settings
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
      },
    });

    this.page = await this.context.newPage();

    // Block unnecessary resources to speed up scraping
    await this.page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    console.log('[Scraper] Browser initialized');
  }

  /**
   * Authenticate with Fullscript
   */
  private async login(email: string, password: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[Scraper] Navigating to login page...');
    await this.page.goto(FULLSCRIPT_LOGIN_URL, { waitUntil: 'domcontentloaded' });

    await randomDelay(1000, 2000);

    console.log('[Scraper] Filling login form...');

    // Fill email
    await this.page.fill('input[name="email"], input[type="email"]', email);
    await randomDelay(500, 1000);

    // Fill password
    await this.page.fill('input[name="password"], input[type="password"]', password);
    await randomDelay(500, 1000);

    // Submit form
    console.log('[Scraper] Submitting login form...');
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      this.page.click('button[type="submit"], input[type="submit"]'),
    ]);

    await randomDelay(2000, 3000);

    // Check if login was successful and detect base URL from redirect
    const currentUrl = this.page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Login failed - still on login page');
    }

    // Extract base URL from post-login redirect (e.g., https://us.fullscript.com/...)
    const urlMatch = currentUrl.match(/^(https:\/\/[^\/]+)/);
    if (urlMatch) {
      this.baseUrl = urlMatch[1];
      console.log(`[Scraper] Detected base URL from login redirect: ${this.baseUrl}`);
    }

    console.log('[Scraper] Login successful');
  }

  /**
   * Navigate to catalog and apply filters
   */
  private async navigateToCatalog(config: ScraperConfig): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[Scraper] Navigating to catalog...');

    // Use detected base URL from login redirect + /u/catalog path
    let catalogUrl = `${this.baseUrl}/u/catalog`;

    // Apply mode-specific filters
    if (config.mode === 'category' && config.filter) {
      catalogUrl += `?category=${encodeURIComponent(config.filter)}`;
    } else if (config.mode === 'brand' && config.filter) {
      catalogUrl += `?brand=${encodeURIComponent(config.filter)}`;
    } else if (config.mode === 'search' && config.filter) {
      // Use ?query= with quotes for exact match (matches user's manual search)
      catalogUrl += `?query="${encodeURIComponent(config.filter)}"`;
    }

    await this.page.goto(catalogUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Verify we're on catalog page, not redirected back to login
    const currentUrl = this.page.url();
    const currentTitle = await this.page.title();
    console.log(`[Scraper] After catalog navigation - URL: ${currentUrl}, Title: ${currentTitle}`);

    if (currentUrl.includes('/login')) {
      throw new Error('Catalog navigation failed - redirected back to login (authentication issue)');
    }

    console.log('[Scraper] Catalog loaded');
  }

  /**
   * Extract product data from current page and convert to v2 schema
   */
  private async extractProductsFromPage(): Promise<ProductV2[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[Scraper] Extracting products from page...');

    // DEBUG: Log page URL and title
    const url = this.page.url();
    const title = await this.page.title();
    console.log(`[DEBUG] Current URL: ${url}`);
    console.log(`[DEBUG] Page title: ${title}`);

    // DEBUG: Log page HTML structure
    const debugInfo = await this.page.evaluate(() => {
      const allDivs = document.querySelectorAll('div, article, section');
      const productLike = Array.from(allDivs).filter(el => {
        const className = el.className.toString().toLowerCase();
        const id = el.id.toLowerCase();
        return className.includes('product') || className.includes('card') ||
               className.includes('item') || id.includes('product');
      }).slice(0, 5);

      return {
        totalElements: allDivs.length,
        productLikeElements: productLike.map(el => ({
          tag: el.tagName,
          class: el.className,
          id: el.id,
          textSample: el.textContent?.substring(0, 100)
        }))
      };
    });
    console.log('[DEBUG] Page structure:', JSON.stringify(debugInfo, null, 2));

    // Wait for product cards to load (Fullscript uses flex layout with border)
    await this.page.waitForSelector('div.flex.flex-col.rounded-lg.border', {
      timeout: 10000,
    }).catch(() => {
      console.warn('[Scraper] Product cards not found with primary selector...');
    });

    // Extract raw product data from page
    const rawProducts = await this.page.evaluate(() => {
      // Fullscript product cards: <div class="flex flex-col rounded-lg border border-border p-4">
      const productCards = document.querySelectorAll('div.flex.flex-col.rounded-lg.border');
      const extracted: any[] = [];

      productCards.forEach((card: Element) => {
        try {
          // Extract product name from h3 > a
          // Structure: <h3 class="mb-0 truncate ..."><a href="...">ProOmega® 2000</a></h3>
          const nameEl = card.querySelector('h3 a');
          const product_name = nameEl?.textContent?.trim() || 'Unknown Product';

          // Extract brand from p.truncate (sibling of h3)
          // Structure: <p class="truncate">Nordic Naturals</p>
          const brandEl = card.querySelector('div.mb-4.overflow-x-hidden p.truncate');
          const brand = brandEl?.textContent?.trim() || 'Unknown Brand';

          // Extract product URL from first a tag or h3 > a
          // Structure: <a href="/catalog/products/proomega-2000?variant=...">
          const linkEl = card.querySelector('a[href*="/catalog/products/"], a[href*="/products/"]');
          const product_url = linkEl?.getAttribute('href');

          // Extract image URL
          // Structure: <img alt="ProOmega® 2000" src="https://assets.fullscript.io/...">
          const imgEl = card.querySelector('img');
          const image_url = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');

          // Extract serving size from combobox button
          // Structure: <button role="combobox"><div><span>60 Softgels</span></div></button>
          const servingEl = card.querySelector('button[role="combobox"] span');
          const serving_size = servingEl?.textContent?.trim();

          // Note: Description and ingredients are NOT on the card - would need to visit product page
          const description = undefined;
          const ingredients_text = undefined;

          // Note: Certifications are NOT visible on cards - would need product page
          const certifications: string[] = [];

          extracted.push({
            brand,
            product_name,
            description,
            image_url: image_url || undefined,
            product_url: product_url || undefined,
            serving_size,
            ingredients_text,
            certifications: certifications.length > 0 ? certifications : undefined,
          });
        } catch (error) {
          console.error('Error extracting product:', error);
        }
      });

      return extracted;
    });

    console.log(`[Scraper] Extracted ${rawProducts.length} raw products from catalog cards`);
    return rawProducts;
  }

  /**
   * Convert raw product data to v2 schema
   * Called after Phase 2 product page scraping completes
   */
  private convertToV2Schema(rawProducts: any[]): ProductV2[] {
    const v2Products: ProductV2[] = [];
    const currentTime = new Date().toISOString();

    for (const raw of rawProducts) {
      try {
        // Detect enums (pass serving_size for better dosage_form detection)
        const dosage_form = detectDosageForm(raw.product_name, raw.description, raw.serving_size);
        const category = detectCategory(raw.product_name, raw.ingredients_text);

        // Parse ingredients
        let ingredients = raw.ingredients_text
          ? parseIngredients(raw.ingredients_text)
          : [createFallbackIngredient(raw.product_name)];

        // Generate derived fields
        const display_name = generateDisplayName(raw.brand, raw.product_name);
        const canonical_id = generateCanonicalId(raw.brand, raw.product_name);
        const key_ingredients_text = extractKeyIngredientsText(ingredients);

        // Build full product URL if partial
        const full_url = raw.product_url?.startsWith('http')
          ? raw.product_url
          : raw.product_url
          ? `${this.baseUrl}${raw.product_url}`
          : undefined;

        // Create product object
        const product: ProductV2 = {
          // Required fields
          brand: raw.brand,
          product_name: raw.product_name,
          display_name,
          canonical_id,
          dosage_form,
          category,
          ingredients,
          confidence: 0, // Calculated below
          source_metadata: {
            source_type: SourceType.MARKETPLACE,
            source_name: 'fullscript',
            source_url: full_url,
            retrieved_at: currentTime,
          },

          // Optional fields
          dose_per_unit: raw.serving_size,
          recommended_dose_label: raw.suggested_use,
          key_ingredients_text,
          certifications: raw.certifications,
          notes: raw.description,
          front_label_image_url: raw.image_url,
          back_label_image_url: raw.back_label_image_url,
          allergen_info: raw.allergen_info,
        };

        // Calculate confidence score
        product.confidence = calculateConfidence(product);

        // Validate product
        const validation = safeValidateProduct(product);
        if (validation.success) {
          v2Products.push(product);
        } else {
          console.error(`[Scraper] Product validation failed for ${product.product_name}:`, validation.error);
          // Add anyway with lower confidence
          product.confidence = Math.max(product.confidence - 0.2, 0);
          v2Products.push(product);
        }
      } catch (error: any) {
        console.error(`[Scraper] Error converting product to v2:`, error.message);
      }
    }

    console.log(`[Scraper] Converted ${v2Products.length} products to v2 schema`);
    return v2Products;
  }

  /**
   * Click next page button
   */
  private async goToNextPage(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      // Fullscript uses "Load more" button instead of traditional pagination
      // Structure: <button class="inline-flex ...">Load more</button>
      const loadMoreButton = await this.page.$('button:has-text("Load more"), button:has-text("load more")');

      if (!loadMoreButton) {
        console.log('[Scraper] No "Load more" button found - all products loaded');
        return false;
      }

      const isDisabled = await loadMoreButton.evaluate((el) =>
        el.hasAttribute('disabled') || el.classList.contains('disabled') ||
        el.getAttribute('aria-disabled') === 'true'
      );

      if (isDisabled) {
        console.log('[Scraper] "Load more" button is disabled - all products loaded');
        return false;
      }

      console.log('[Scraper] Clicking "Load more" button...');
      await loadMoreButton.click();
      await randomDelay(2000, 4000); // Wait for new products to load

      // Wait for page to update with new products
      await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        console.log('[Scraper] Network idle timeout (expected with dynamic loading)');
      });

      return true;
    } catch (error) {
      console.error('[Scraper] Error navigating to next page:', error);
      return false;
    }
  }

  /**
   * Main scraping function
   */
  async scrape(config: ScraperConfig): Promise<ScraperResult> {
    const errors: string[] = [];
    const allProducts: ProductV2[] = [];
    let importId: string | undefined;

    try {
      // Initialize browser
      await this.initBrowser();

      // Login
      await this.login(config.email, config.password);

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('fullscript_imports')
        .insert({
          status: 'running',
          scrape_mode: config.mode, // Use actual column name
          filter_value: config.filter || null, // Use actual column name
          import_source: 'fullscript_scraper',
        })
        .select()
        .single();

      if (importError) throw importError;
      importId = importRecord.id;

      console.log(`[Scraper] Created import record: ${importId}`);

      // Navigate to catalog
      await this.navigateToCatalog(config);

      // Phase 1: Scrape catalog cards
      console.log('[Scraper] Phase 1: Scraping catalog cards...');
      let pageCount = 0;
      let hasNextPage = true;
      const rawProducts: any[] = [];

      while (hasNextPage && rawProducts.length < config.limit) {
        pageCount++;
        console.log(`[Scraper] Scraping page ${pageCount}...`);

        // Extract products from current page
        const pageProducts = await this.extractProductsFromPage();
        rawProducts.push(...pageProducts);

        console.log(`[Scraper] Total products: ${rawProducts.length}/${config.limit}`);

        // Check if we've reached the limit
        if (rawProducts.length >= config.limit) {
          console.log('[Scraper] Reached product limit');
          break;
        }

        // Go to next page
        hasNextPage = await this.goToNextPage();

        if (hasNextPage) {
          await randomDelay(2000, 4000); // Rate limiting between pages
        }
      }

      // Trim to exact limit
      const limitedRawProducts = rawProducts.slice(0, config.limit);

      // Phase 2: Scrape product pages for detailed data
      console.log(`[Scraper] Phase 2: Scraping ${limitedRawProducts.length} product pages for detailed data...`);

      if (!this.page) throw new Error('Browser not initialized for Phase 2');
      const productPageScraper = new ProductPageScraper(this.page);

      for (let i = 0; i < limitedRawProducts.length; i++) {
        const raw = limitedRawProducts[i];

        if (!raw.product_url) {
          console.warn(`[Scraper] Skipping product ${i + 1}/${limitedRawProducts.length}: No URL for "${raw.product_name}"`);
          continue;
        }

        try {
          // Build full URL if needed
          const fullUrl = raw.product_url.startsWith('http')
            ? raw.product_url
            : `${this.baseUrl}${raw.product_url}`;

          console.log(`[Scraper] [${i + 1}/${limitedRawProducts.length}] Scraping product page: ${raw.product_name}`);

          // Scrape product page with timeout (45 seconds - includes accordion wait + expansion + extraction)
          const productPageData = await Promise.race([
            productPageScraper.scrapeProductPage(fullUrl),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error('Product page scraping timeout')), 45000)
            ),
          ]);

          if (productPageData) {
            // Merge product page data into raw product
            raw.description = productPageData.description || raw.description;
            raw.certifications = productPageData.certifications.length > 0
              ? productPageData.certifications
              : raw.certifications;
            raw.serving_size = productPageData.servingSize || raw.serving_size;
            raw.suggested_use = productPageData.suggestedUse;

            // Use product page ingredients if available (higher quality)
            if (productPageData.ingredients.length > 0) {
              raw.ingredients_text = productPageData.ingredients
                .map(i => `${i.name} ${i.amount || ''}${i.unit || ''}`.trim())
                .join(', ');
            }

            // Merge allergen info from dietary restrictions
            if (productPageData.dietaryRestrictions.length > 0) {
              raw.allergen_info = productPageData.dietaryRestrictions.join(', ');
            }

            // Add back label image if available
            if (productPageData.backImageUrl) {
              raw.back_label_image_url = productPageData.backImageUrl;
            }

            // Update front image if better quality available
            if (productPageData.frontImageUrl) {
              raw.image_url = productPageData.frontImageUrl;
            }

            console.log(`[Scraper] ✓ Successfully scraped ${raw.product_name}`);
          }

          // Rate limiting: 2-3 seconds between product pages
          await randomDelay(2000, 3000);
        } catch (error: any) {
          console.error(`[Scraper] ✗ Error scraping product page for "${raw.product_name}":`, error.message);
          // Continue with card-level data (Phase 1)
        }

        // Update progress
        await supabase
          .from('fullscript_imports')
          .update({
            total_products: i + 1,
            successful_products: i + 1,
          })
          .eq('id', importId);
      }

      // Phase 3: Convert to v2 schema
      console.log('[Scraper] Phase 3: Converting to v2 schema...');
      const finalProducts = this.convertToV2Schema(limitedRawProducts);

      // Wrap in v2 schema
      const importResult: FullscriptImportV2 = {
        schema_version: 'aviado.stack.current.v2',
        version: '2.1.0',
        import_metadata: {
          import_date: new Date().toISOString(),
          import_source: 'fullscript_scraper',
          llm_model: null,
          confidence_threshold: 0.8,
          notes: `Scraped ${finalProducts.length} products from Fullscript (mode: ${config.mode}, filter: ${config.filter || 'none'})`,
        },
        products: finalProducts,
      };

      // Update import record with results (using `products` column, not `products_data`)
      await supabase
        .from('fullscript_imports')
        .update({
          status: 'completed',
          total_products: finalProducts.length,
          successful_products: finalProducts.length,
          failed_products: 0,
          products: importResult, // v2 schema wrapper
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);

      console.log(`[Scraper] Scraping complete: ${finalProducts.length} products (v2 schema)`);

      return {
        success: true,
        products: finalProducts,
        totalScraped: finalProducts.length,
        errors,
        importId,
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      errors.push(errorMessage);

      console.error('[Scraper] Fatal error:', error);

      // Update import record with error
      if (importId) {
        await supabase
          .from('fullscript_imports')
          .update({
            status: 'failed',
            errors: [{ message: errorMessage, timestamp: new Date().toISOString() }],
            completed_at: new Date().toISOString(),
          })
          .eq('id', importId);
      }

      return {
        success: false,
        products: allProducts,
        totalScraped: allProducts.length,
        errors,
        importId,
      };

    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Cleanup browser resources
   */
  private async cleanup(): Promise<void> {
    console.log('[Scraper] Cleaning up...');

    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (error) {
      console.error('[Scraper] Error during cleanup:', error);
    }

    this.page = null;
    this.context = null;
    this.browser = null;

    console.log('[Scraper] Cleanup complete');
  }
}
