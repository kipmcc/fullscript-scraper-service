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

const FULLSCRIPT_BASE_URL = 'https://fullscript.com';
const FULLSCRIPT_LOGIN_URL = `${FULLSCRIPT_BASE_URL}/login`;
const FULLSCRIPT_CATALOG_URL = `${FULLSCRIPT_BASE_URL}/catalog`;

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

    // Check if login was successful
    const currentUrl = this.page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Login failed - still on login page');
    }

    console.log('[Scraper] Login successful');
  }

  /**
   * Navigate to catalog and apply filters
   */
  private async navigateToCatalog(config: ScraperConfig): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[Scraper] Navigating to catalog...');

    let catalogUrl = FULLSCRIPT_CATALOG_URL;

    // Apply mode-specific filters
    if (config.mode === 'category' && config.filter) {
      catalogUrl += `?category=${encodeURIComponent(config.filter)}`;
    } else if (config.mode === 'brand' && config.filter) {
      catalogUrl += `?brand=${encodeURIComponent(config.filter)}`;
    } else if (config.mode === 'search' && config.filter) {
      catalogUrl += `?q=${encodeURIComponent(config.filter)}`;
    }

    await this.page.goto(catalogUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    console.log('[Scraper] Catalog loaded');
  }

  /**
   * Extract product data from current page and convert to v2 schema
   */
  private async extractProductsFromPage(): Promise<ProductV2[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[Scraper] Extracting products from page...');

    // Wait for product cards to load
    await this.page.waitForSelector('[data-testid="product-card"], .product-card, .product-item', {
      timeout: 10000,
    }).catch(() => {
      console.warn('[Scraper] Product cards not found, attempting alternative selectors...');
    });

    // Extract raw product data from page
    const rawProducts = await this.page.evaluate(() => {
      const productCards = document.querySelectorAll('[data-testid="product-card"], .product-card, .product-item, article');
      const extracted: any[] = [];

      productCards.forEach((card: Element) => {
        try {
          // Extract brand
          const brandEl = card.querySelector('[data-testid="brand"], .brand, .product-brand');
          const brand = brandEl?.textContent?.trim() || 'Unknown Brand';

          // Extract product name
          const nameEl = card.querySelector('[data-testid="product-name"], .product-name, h2, h3, h4');
          const product_name = nameEl?.textContent?.trim() || 'Unknown Product';

          // Extract description
          const descEl = card.querySelector('[data-testid="description"], .description, p');
          const description = descEl?.textContent?.trim();

          // Extract image URL
          const imgEl = card.querySelector('img');
          const image_url = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');

          // Extract product URL
          const linkEl = card.querySelector('a[href*="/products/"]');
          const product_url = linkEl?.getAttribute('href');

          // Extract serving size / dose info
          const servingEl = card.querySelector('[data-testid="serving"], .serving-size, .dosage');
          const serving_size = servingEl?.textContent?.trim();

          // Extract ingredient facts (if visible on card)
          const ingredientsEl = card.querySelector('[data-testid="ingredients"], .ingredients, .supplement-facts');
          const ingredients_text = ingredientsEl?.textContent?.trim();

          // Extract certifications
          const certBadges = card.querySelectorAll('[data-testid="certification"], .badge, .certification');
          const certifications = Array.from(certBadges)
            .map(badge => badge.textContent?.trim())
            .filter(Boolean);

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

    // Convert raw products to v2 schema
    const v2Products: ProductV2[] = [];
    const currentTime = new Date().toISOString();

    for (const raw of rawProducts) {
      try {
        // Detect enums
        const dosage_form = detectDosageForm(raw.product_name, raw.description);
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
          ? `${FULLSCRIPT_BASE_URL}${raw.product_url}`
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
          recommended_dose_label: raw.serving_size,
          key_ingredients_text,
          certifications: raw.certifications,
          notes: raw.description,
          front_label_image_url: raw.image_url,
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

    console.log(`[Scraper] Extracted ${v2Products.length} products from page (v2 schema)`);
    return v2Products;
  }

  /**
   * Click next page button
   */
  private async goToNextPage(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      // Look for next page button
      const nextButton = await this.page.$('[data-testid="next-page"], .pagination-next, button:has-text("Next")');

      if (!nextButton) {
        console.log('[Scraper] No next page button found');
        return false;
      }

      const isDisabled = await nextButton.evaluate((el) =>
        el.hasAttribute('disabled') || el.classList.contains('disabled')
      );

      if (isDisabled) {
        console.log('[Scraper] Next page button is disabled');
        return false;
      }

      console.log('[Scraper] Clicking next page...');
      await nextButton.click();
      await randomDelay(2000, 3000);

      // Wait for page to update
      await this.page.waitForLoadState('domcontentloaded');

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
          mode: config.mode === 'full_catalog' ? 'full' :
                config.mode === 'search' ? 'single' : 'incremental',
          metadata: {
            filter: config.filter,
            limit: config.limit,
          },
        })
        .select()
        .single();

      if (importError) throw importError;
      importId = importRecord.id;

      console.log(`[Scraper] Created import record: ${importId}`);

      // Navigate to catalog
      await this.navigateToCatalog(config);

      // Scrape pages until limit reached
      let pageCount = 0;
      let hasNextPage = true;

      while (hasNextPage && allProducts.length < config.limit) {
        pageCount++;
        console.log(`[Scraper] Scraping page ${pageCount}...`);

        // Extract products from current page
        const pageProducts = await this.extractProductsFromPage();
        allProducts.push(...pageProducts);

        console.log(`[Scraper] Total products: ${allProducts.length}/${config.limit}`);

        // Update progress
        await supabase
          .from('fullscript_imports')
          .update({
            total_products: allProducts.length,
            successful_products: allProducts.length,
          })
          .eq('id', importId);

        // Check if we've reached the limit
        if (allProducts.length >= config.limit) {
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
      const finalProducts = allProducts.slice(0, config.limit);

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
            error_message: errorMessage,
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
