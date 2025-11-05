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
          // Improvement 1.1: Use more reliable button finding with ancestor selector
          const headerLocator = this.page.locator(`h5:has-text("${sectionName}")`);
          
          // Check if header exists
          const headerCount = await headerLocator.count();
          if (headerCount === 0) {
            console.warn(`[ProductPageScraper] Header "${sectionName}" not found`);
            continue;
          }

          // Find button that contains the h5 header (using XPath ancestor)
          const button = headerLocator.locator('xpath=ancestor::button').first();

          // Wait for button to be present and get expanded state
          const ariaExpanded = await button.getAttribute('aria-expanded', { timeout: 2000 }).catch(() => null);

          if (ariaExpanded === 'false') {
            console.log(`[ProductPageScraper] Expanding "${sectionName}" accordion`);
            await button.click({ timeout: 2000 });
            
            // Improvement 1.3: Increase wait time and verify expansion
            await this.page.waitForTimeout(500); // Increased from 300ms
            
            // Improvement 1.2: Verify expansion with aria-expanded attribute
            try {
              await this.page.waitForFunction(
                (sectionName) => {
                  const headers = Array.from(document.querySelectorAll('h5'));
                  const header = headers.find(h => h.textContent?.includes(sectionName));
                  if (!header) return false;
                  const button = header.closest('button');
                  return button?.getAttribute('aria-expanded') === 'true';
                },
                sectionName,
                { timeout: 5000 }
              );
              console.log(`[ProductPageScraper] ✓ Verified "${sectionName}" accordion expanded`);
            } catch (verifyError) {
              console.warn(`[ProductPageScraper] Could not verify expansion for "${sectionName}", continuing anyway`);
            }
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
   * Extract content from collapsed accordion (fallback strategy)
   * Improvement 2.2: Extract from both expanded AND collapsed states
   */
  private async extractCollapsedContent(sectionName: string): Promise<string | null> {
    try {
      const html = await this.page.evaluate((sectionName) => {
        const headers = Array.from(document.querySelectorAll('h5'));
        const header = headers.find(h => h.textContent?.trim() === sectionName);
        if (!header) return null;

        // Try to find content even if accordion is collapsed
        // Some sites include content in DOM even when collapsed
        const accordionContainer = header.closest('[role="button"], button')?.parentElement;
        if (!accordionContainer) return null;

        // Look for hidden content divs
        const hiddenDivs = Array.from(accordionContainer.querySelectorAll('div[hidden], div[style*="display: none"], div[style*="display:none"]'));
        for (const div of hiddenDivs) {
          const text = div.textContent?.trim() || '';
          if (text.length > 10) {
            return div.innerHTML;
          }
        }

        return null;
      }, sectionName);

      return html ? cleanHtmlText(html) : null;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Extract content with logging and retry mechanism
   * Improvement 4.1-4.2: Better error handling & logging
   */
  private async extractWithLogging<T>(
    sectionName: string,
    extractor: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await extractor();
        if (result) {
          console.log(`[ProductPageScraper] ✓ Extracted "${sectionName}": found`);
          return result;
        } else if (attempt === maxRetries - 1) {
          console.warn(`[ProductPageScraper] ✗ Extracted "${sectionName}": not found (after ${maxRetries} attempts)`);
        }
      } catch (error: any) {
        console.error(`[ProductPageScraper] ✗ Failed to extract "${sectionName}" (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          await this.page.waitForTimeout(1000 * (attempt + 1));
        }
      }
    }

    // Log HTML context for debugging
    try {
      const html = await this.page.content();
      const sectionIndex = html.indexOf(sectionName);
      if (sectionIndex > 0) {
        const context = html.substring(Math.max(0, sectionIndex - 100), Math.min(html.length, sectionIndex + 500));
        console.log(`[ProductPageScraper] HTML context for "${sectionName}":`, context.substring(0, 200) + '...');
      }
    } catch (error) {
      // Ignore logging errors
    }

    return null;
  }

  /**
   * Extract product description
   * Improvement 2.1: Use page.evaluate with direct DOM access and multiple selector strategies
   * Improvement 2.2: Fallback to collapsed content extraction
   */
  private async extractDescription(): Promise<string> {
    // Try expanded first, then fallback to collapsed
    const expandedContent = await this.extractWithLogging('Description', async () => {
      const html = await this.page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('h5'));
        const descHeader = headers.find(h => h.textContent?.trim() === 'Description');
        if (!descHeader) return null;

        // Find the accordion container (parent of parent)
        const accordionContainer = descHeader.closest('[role="button"], button')?.parentElement;
        if (!accordionContainer) return null;

        // Improvement 5.1: Try multiple selector strategies
        const contentSelectors = [
          '[class*="Collapsible"]',
          '[class*="accordion-content"]',
          'div:has(p)',
          'div:not(:has(button)):not(:has(h5))',
        ];

        for (const selector of contentSelectors) {
          const content = accordionContainer.querySelector(selector);
          if (content && content.textContent?.trim().length > 10) {
            return content.innerHTML;
          }
        }

        // Fallback: Find div with substantial content
        const allDivs = Array.from(accordionContainer.querySelectorAll('div'));
        const contentDiv = allDivs.find(div => {
          const text = div.textContent?.trim() || '';
          return text.length > 10 && 
                 !div.querySelector('button') && 
                 !div.querySelector('h5') &&
                 div !== descHeader.parentElement;
        });

        return contentDiv?.innerHTML || null;
      });

      if (!html) {
        return null;
      }

      return cleanHtmlText(html);
    });

    if (expandedContent) {
      return expandedContent;
    }

    // Fallback: Try collapsed content
    const collapsedContent = await this.extractCollapsedContent('Description');
    return collapsedContent || '';
  }

  /**
   * Extract warnings/cautions
   * Improvement 2.1: Use page.evaluate with direct DOM access
   * Improvement 2.2: Fallback to collapsed content extraction
   */
  private async extractWarnings(): Promise<string | null> {
    // Try expanded first, then fallback to collapsed
    const expandedContent = await this.extractWithLogging('Warnings', async () => {
      const html = await this.page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('h5'));
        const warningsHeader = headers.find(h => 
          h.textContent?.trim() === 'Warnings' || 
          h.textContent?.trim() === 'Caution'
        );
        if (!warningsHeader) return null;

        // Find the accordion container
        const accordionContainer = warningsHeader.closest('[role="button"], button')?.parentElement;
        if (!accordionContainer) return null;

        // Try multiple selector strategies
        const contentSelectors = [
          '[class*="Collapsible"]',
          '[class*="accordion-content"]',
          'div:has(p)',
          'div:not(:has(button)):not(:has(h5))',
        ];

        for (const selector of contentSelectors) {
          const content = accordionContainer.querySelector(selector);
          if (content && content.textContent?.trim().length > 10) {
            return content.innerHTML;
          }
        }

        // Fallback: Find div with substantial content
        const allDivs = Array.from(accordionContainer.querySelectorAll('div'));
        const contentDiv = allDivs.find(div => {
          const text = div.textContent?.trim() || '';
          return text.length > 10 && 
                 !div.querySelector('button') && 
                 !div.querySelector('h5') &&
                 div !== warningsHeader.parentElement;
        });

        return contentDiv?.innerHTML || null;
      });

      if (html) {
        return cleanHtmlText(html);
      }

      return null;
    });

    if (expandedContent) {
      return expandedContent;
    }

    // Fallback: Try collapsed content
    return await this.extractCollapsedContent('Warnings');
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
   * Improvement 7.1: Extract from both accordion and page badges
   */
  private async extractCertifications(): Promise<string[]> {
    try {
      const certifications: string[] = [];

      // First try: Extract from Certifications accordion
      const accordionCerts = await this.extractCertificationsFromAccordion();
      certifications.push(...accordionCerts);

      // Second try: Extract from page badges (top of page)
      const pageCerts = await this.extractCertificationsFromBadges();
      certifications.push(...pageCerts);

      // Third try: Parse from raw HTML (fallback)
      if (certifications.length === 0) {
        const pageHtml = await this.page.content();
        const parsedCerts = parseCertifications(pageHtml);
        certifications.push(...parsedCerts);
      }

      // Remove duplicates and return
      return Array.from(new Set(certifications));
    } catch (error) {
      console.warn('[ProductPageScraper] Certifications not found:', error);
      return [];
    }
  }

  /**
   * Extract certifications from Certifications accordion section
   */
  private async extractCertificationsFromAccordion(): Promise<string[]> {
    try {
      const html = await this.page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('h5'));
        const certHeader = headers.find(h => h.textContent?.trim() === 'Certifications');
        if (!certHeader) return null;

        const accordionContainer = certHeader.closest('[role="button"], button')?.parentElement;
        if (!accordionContainer) return null;

        // Try multiple selector strategies
        const contentSelectors = [
          '[class*="Collapsible"]',
          '[class*="accordion-content"]',
          'div:has(p)',
          'div:not(:has(button)):not(:has(h5))',
        ];

        for (const selector of contentSelectors) {
          const content = accordionContainer.querySelector(selector);
          if (content && content.textContent?.trim().length > 10) {
            return content.innerHTML;
          }
        }

        return null;
      });

      if (html) {
        // Parse certifications from HTML
        const parsed = parseCertifications(html);
        return parsed;
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract certifications from page badges (top of page, not in accordion)
   */
  private async extractCertificationsFromBadges(): Promise<string[]> {
    try {
      const certifications: string[] = [];

      // Look for certification images anywhere on the page
      const certImages = await this.page
        .locator('img[alt*="Certified"], img[alt*="Verified"], img[alt*="NSF"], img[alt*="GMP"], img[alt*="USP"], img[alt*="IFOS"]')
        .all();

      for (const img of certImages) {
        const alt = await img.getAttribute('alt');
        if (alt) {
          const cleaned = alt.trim();
          // Verify it's actually a certification
          const lower = cleaned.toLowerCase();
          if (lower.includes('certified') || lower.includes('verified') || 
              lower.includes('nsf') || lower.includes('gmp') || 
              lower.includes('usp') || lower.includes('ifos')) {
            certifications.push(cleaned);
          }
        }
      }

      // Also look for text badges with certifications
      const textBadges = await this.page
        .locator('[class*="badge"], [class*="tag"], [class*="chip"]')
        .allTextContents();

      for (const badge of textBadges) {
        const lower = badge.toLowerCase();
        if (lower.includes('certified') || lower.includes('verified') || 
            lower.includes('nsf') || lower.includes('gmp') || 
            lower.includes('usp') || lower.includes('ifos')) {
          certifications.push(badge.trim());
        }
      }

      return certifications;
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract "More" section with supplement facts
   * Improvement 2.1: Use page.evaluate with direct DOM access and multiple selector strategies
   */
  private async extractMoreSection(): Promise<{
    suggestedUse: string | null;
    servingSize: string | null;
    ingredients: IngredientV2[];
    otherIngredients: string | null;
  }> {
    try {
      const html = await this.page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('h5'));
        const moreHeader = headers.find(h =>
          h.textContent?.trim() === 'More' ||
          h.textContent?.includes('Supplement Facts') ||
          h.textContent?.includes('Ingredients')
        );

        if (!moreHeader) return null;

        // Find the accordion container
        const accordionContainer = moreHeader.closest('[role="button"], button')?.parentElement;
        if (!accordionContainer) return null;

        // Try multiple selector strategies
        const contentSelectors = [
          '[class*="Collapsible"]',
          '[class*="accordion-content"]',
          'div:has(p)',
          'div:not(:has(button)):not(:has(h5))',
        ];

        for (const selector of contentSelectors) {
          const content = accordionContainer.querySelector(selector);
          if (content && content.textContent?.trim().length > 10) {
            return content.innerHTML;
          }
        }

        // Fallback: Find div with substantial content
        const allDivs = Array.from(accordionContainer.querySelectorAll('div'));
        const contentDiv = allDivs.find(div => {
          const text = div.textContent?.trim() || '';
          return text.length > 10 && 
                 !div.querySelector('button') && 
                 !div.querySelector('h5') &&
                 div !== moreHeader.parentElement;
        });

        return contentDiv?.innerHTML || null;
      });

      if (html) {
        return parseMoreSection(html);
      }

      console.warn('[ProductPageScraper] More section content not found in DOM');
      return {
        suggestedUse: null,
        servingSize: null,
        ingredients: [],
        otherIngredients: null,
      };
    } catch (error: any) {
      console.error('[ProductPageScraper] More section extraction error:', error.message);
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
