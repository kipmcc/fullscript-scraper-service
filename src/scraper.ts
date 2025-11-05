/**
 * Fullscript Product Scraper
 *
 * Real Playwright-based scraper that authenticates with Fullscript
 * and extracts supplement product data.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { randomDelay, exponentialBackoff } from './utils/antiDetection';

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
 * Scraped product data structure
 */
export interface ScrapedProduct {
  brand: string;
  product_name: string;
  description?: string;
  ingredients?: string;
  serving_size?: string;
  servings_per_container?: number;
  price?: number;
  image_url?: string;
  product_url?: string;
  category?: string;
  dosage_form?: string;
}

/**
 * Scraper result
 */
export interface ScraperResult {
  success: boolean;
  products: ScrapedProduct[];
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
   * Extract product data from current page
   */
  private async extractProductsFromPage(): Promise<ScrapedProduct[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[Scraper] Extracting products from page...');

    // Wait for product cards to load
    await this.page.waitForSelector('[data-testid="product-card"], .product-card, .product-item', {
      timeout: 10000,
    }).catch(() => {
      console.warn('[Scraper] Product cards not found, attempting alternative selectors...');
    });

    const products = await this.page.evaluate(() => {
      const productCards = document.querySelectorAll('[data-testid="product-card"], .product-card, .product-item, article');
      const extracted: ScrapedProduct[] = [];

      productCards.forEach((card) => {
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

          // Extract price
          const priceEl = card.querySelector('[data-testid="price"], .price, .product-price');
          const priceText = priceEl?.textContent?.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : undefined;

          extracted.push({
            brand,
            product_name,
            description,
            image_url: image_url || undefined,
            product_url: product_url || undefined,
            price,
          });
        } catch (error) {
          console.error('Error extracting product:', error);
        }
      });

      return extracted;
    });

    console.log(`[Scraper] Extracted ${products.length} products from page`);
    return products;
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
    const allProducts: ScrapedProduct[] = [];
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

      // Update import record with results
      await supabase
        .from('fullscript_imports')
        .update({
          status: 'completed',
          total_products: finalProducts.length,
          successful_products: finalProducts.length,
          failed_products: 0,
          products_data: finalProducts,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);

      console.log(`[Scraper] Scraping complete: ${finalProducts.length} products`);

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
