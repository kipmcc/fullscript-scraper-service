/**
 * Product Page Scraper
 *
 * Scrapes detailed product information from Fullscript product pages
 * including ingredients with amounts, certifications, suggested use, warnings, etc.
 */

import { Page } from 'playwright';
import { IngredientV2 } from './types/v2Schema';
import {
  parseMoreSection,
  parseDietaryTags,
  parseCertifications,
  cleanHtmlText,
} from './utils/productPageParser';

/**
 * Product page data structure
 */
export interface ProductPageData {
  description: string;
  warnings: string | null;
  dietaryRestrictions: string[];
  certifications: string[];
  suggestedUse: string | null;
  servingSize: string | null;
  ingredients: IngredientV2[];
  otherIngredients: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  dietaryTags: string[];
}

/**
 * Product Page Scraper Class
 */
export class ProductPageScraper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to product page and extract all data
   *
   * @param productUrl - Full URL to product page
   * @returns Structured product page data
   */
  async scrapeProductPage(productUrl: string): Promise<ProductPageData> {
    try {
      // Navigate to product page (20s timeout - Fullscript pages load slowly)
      await this.page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Wait for React to render (Fullscript uses data-e2e attributes)
      await this.page
        .waitForSelector('[data-e2e^="product-name-"], h1, .product-name', { timeout: 10000 })
        .catch(() => {
          console.warn('[ProductPageScraper] Product name selector not found');
        });

      // Expand all accordion sections (this now waits for accordions to exist)
      await this.expandAllAccordions();

      // Extract data from each section
      const description = await this.extractDescription();
      const warnings = await this.extractWarnings();
      const dietaryRestrictions = await this.extractDietaryRestrictions();
      const certifications = await this.extractCertifications();
      const moreSection = await this.extractMoreSection();

      // Extract images
      const images = await this.extractImages();

      // Extract dietary tags from top of page
      const dietaryTags = await this.extractDietaryTags();

      return {
        description,
        warnings,
        dietaryRestrictions,
        certifications,
        suggestedUse: moreSection.suggestedUse,
        servingSize: moreSection.servingSize,
        ingredients: moreSection.ingredients,
        otherIngredients: moreSection.otherIngredients,
        frontImageUrl: images.front,
        backImageUrl: images.back,
        dietaryTags,
      };
    } catch (error: any) {
      console.error('[ProductPageScraper] Error scraping product page:', error.message);
      throw error;
    }
  }

  /**
   * Expand all accordion sections to access hidden content
   */
  private async expandAllAccordions(): Promise<void> {
    try {
      // Wait for at least one accordion to be present (React hydration)
      await this.page.waitForSelector('h5:has-text("Description"), h5:has-text("More")', { timeout: 5000 })
        .catch(() => {
          console.warn('[ProductPageScraper] No accordions found on page');
        });

      // Target only product information accordions by their h5 header text
      const accordionSections = [
        'Description',
        'Warnings',
        'Dietary restrictions',
        'Certifications',
        'More',
      ];

      console.log(`[ProductPageScraper] Attempting to expand ${accordionSections.length} product accordions`);

      for (const sectionName of accordionSections) {
        try {
          // Find the h5 header with this text
          const header = this.page.locator(`h5:has-text("${sectionName}")`);

          // Navigate to parent button (h5 is inside the button)
          const button = header.locator('..');

          // Wait for button to be present and get expanded state
          const ariaExpanded = await button.getAttribute('aria-expanded', { timeout: 2000 }).catch(() => null);

          if (ariaExpanded === 'false') {
            console.log(`[ProductPageScraper] Expanding "${sectionName}" accordion`);
            await button.click({ timeout: 2000 });
            await this.page.waitForTimeout(300); // Wait for expansion animation
          } else {
            console.log(`[ProductPageScraper] "${sectionName}" accordion already expanded`);
          }
        } catch (error: any) {
          console.warn(`[ProductPageScraper] Failed to expand "${sectionName}" accordion:`, error.message);
        }
      }
    } catch (error: any) {
      console.warn('[ProductPageScraper] Error expanding accordions:', error.message);
    }
  }

  /**
   * Extract product description
   */
  private async extractDescription(): Promise<string> {
    try {
      // Look for Description section
      const descriptionSection = this.page.locator('h5:has-text("Description")').locator('..').locator('..').locator('...');
      const descriptionContent = descriptionSection.locator('.css-1l74dbd-HTML-styles-GenericCollapsible-styles, p, div.text-content');

      const html = await descriptionContent.innerHTML({ timeout: 3000 }).catch(() => '');

      return cleanHtmlText(html);
    } catch (error) {
      console.warn('[ProductPageScraper] Description not found:', error);
      return '';
    }
  }

  /**
   * Extract warnings/cautions
   */
  private async extractWarnings(): Promise<string | null> {
    try {
      // Look for Warnings section
      const warningsSection = this.page.locator('h5:has-text("Warnings"), h5:has-text("Caution")').locator('..').locator('..').locator('...');
      const warningsContent = warningsSection.locator('.css-1l74dbd-HTML-styles-GenericCollapsible-styles, p, div.text-content');

      const html = await warningsContent.innerHTML({ timeout: 3000 }).catch(() => '');

      if (html) {
        return cleanHtmlText(html);
      }

      // Alternative: Parse from raw HTML (skip this - too slow)
      return null;
    } catch (error) {
      console.warn('[ProductPageScraper] Warnings not found:', error);
      return null;
    }
  }

  /**
   * Extract dietary restrictions
   */
  private async extractDietaryRestrictions(): Promise<string[]> {
    try {
      // Look for dietary badges/tags
      const badges = await this.page
        .locator('[class*="badge"], [class*="tag"], [class*="chip"]')
        .allTextContents();

      const restrictions = badges
        .filter(text => {
          const lower = text.toLowerCase();
          return (
            lower.includes('free') ||
            lower.includes('vegan') ||
            lower.includes('vegetarian') ||
            lower.includes('organic')
          );
        })
        .map(text => text.trim());

      return Array.from(new Set(restrictions));
    } catch (error) {
      console.warn('[ProductPageScraper] Dietary restrictions not found:', error);
      return [];
    }
  }

  /**
   * Extract certifications
   */
  private async extractCertifications(): Promise<string[]> {
    try {
      // Look for certification images
      const certImages = await this.page
        .locator('img[alt*="Certified"], img[alt*="Verified"], img[alt*="NSF"], img[alt*="GMP"], img[alt*="USP"]')
        .all();

      const certifications: string[] = [];

      for (const img of certImages) {
        const alt = await img.getAttribute('alt');
        if (alt) {
          certifications.push(alt.trim());
        }
      }

      // Alternative: Parse from raw HTML
      if (certifications.length === 0) {
        const pageHtml = await this.page.content();
        return parseCertifications(pageHtml);
      }

      return Array.from(new Set(certifications));
    } catch (error) {
      console.warn('[ProductPageScraper] Certifications not found:', error);
      return [];
    }
  }

  /**
   * Extract "More" section with supplement facts
   */
  private async extractMoreSection(): Promise<{
    suggestedUse: string | null;
    servingSize: string | null;
    ingredients: IngredientV2[];
    otherIngredients: string | null;
  }> {
    try {
      // Look for "More" section or "Supplement Facts"
      const moreSection = this.page.locator(
        'h5:has-text("More"), h5:has-text("Supplement Facts"), h5:has-text("Ingredients")'
      ).locator('..').locator('..').locator('...');

      const html = await moreSection.innerHTML({ timeout: 3000 }).catch(() => '');

      if (html) {
        return parseMoreSection(html);
      }

      // Alternative: Try to find supplement facts table directly
      const factsTable = await this.page
        .locator('table.supplement-facts, [class*="supplement-facts"]')
        .innerHTML({ timeout: 3000 })
        .catch(() => '');

      if (factsTable) {
        return parseMoreSection(factsTable);
      }

      return {
        suggestedUse: null,
        servingSize: null,
        ingredients: [],
        otherIngredients: null,
      };
    } catch (error) {
      console.warn('[ProductPageScraper] More section not found:', error);
      return {
        suggestedUse: null,
        servingSize: null,
        ingredients: [],
        otherIngredients: null,
      };
    }
  }

  /**
   * Extract product images (front and back labels)
   */
  private async extractImages(): Promise<{
    front: string | null;
    back: string | null;
  }> {
    try {
      // Get all product images
      const images = await this.page
        .locator('img[alt*="product"], img[src*="assets.fullscript"], .product-image img')
        .all();

      const imageUrls: string[] = [];

      for (const img of images) {
        const src = await img.getAttribute('src');
        if (src) {
          imageUrls.push(src);
        }
      }

      // Typically: first image = front, second = back
      return {
        front: imageUrls[0] || null,
        back: imageUrls[1] || null,
      };
    } catch (error) {
      console.warn('[ProductPageScraper] Images not found:', error);
      return {
        front: null,
        back: null,
      };
    }
  }

  /**
   * Extract dietary tags from top of page
   */
  private async extractDietaryTags(): Promise<string[]> {
    try {
      // Get entire page HTML
      const pageHtml = await this.page.content();

      return parseDietaryTags(pageHtml);
    } catch (error) {
      console.warn('[ProductPageScraper] Dietary tags not found:', error);
      return [];
    }
  }
}
