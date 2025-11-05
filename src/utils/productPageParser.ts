/**
 * Product Page Parser
 *
 * Parses HTML from Fullscript product pages to extract detailed supplement information
 * including ingredients with amounts, certifications, suggested use, and more.
 */

import { IngredientV2 } from '../types/v2Schema';

/**
 * Parse the "More" section HTML to extract structured supplement facts
 *
 * Extracts:
 * - Suggested use: /<strong>Suggested Use:<\/strong>.*?<br>(.*?)<br/
 * - Serving size: /<strong>Serving Size:<\/strong>\s*(.*?)<\/p>/
 * - Ingredients: /<strong>Amount Per Serving<\/strong>.*?<strong>(.*?)<\/strong>\s*...\s*([\d.]+\s*\w+)/g
 * - Other ingredients: /<strong>Other Ingredients:<\/strong>\s*(.*?)<br/
 *
 * @param html - Raw HTML from the "More" section
 * @returns Parsed supplement facts
 */
export function parseMoreSection(html: string): {
  suggestedUse: string | null;
  servingSize: string | null;
  ingredients: IngredientV2[];
  otherIngredients: string | null;
} {
  // Clean HTML (remove excessive whitespace, normalize)
  const cleanHtml = html.replace(/\s+/g, ' ').trim();

  // Improvement 6.1: More robust regex with multiline support
  // Extract suggested use (handle multiline with /s flag)
  const suggestedUseMatch = html.match(
    /<strong>Suggested Use:<\/strong>(?:<br[^>]*>|\s+)(.*?)(?:<br|<\/p>|$)/is
  );
  const suggestedUse = suggestedUseMatch?.[1]
    ?.replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim() || null;

  // Extract serving size (handle multi-paragraph serving size)
  const servingSizeMatch = html.match(
    /<strong>Serving Size:<\/strong>\s*(.*?)(?:<br|<\/p>|$)/is
  );
  const servingSize = servingSizeMatch?.[1]
    ?.replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim() || null;

  // Extract ingredients with amounts
  // Improvement 3.1: Enhanced parsing for multi-line ingredients with standardization
  const ingredients: IngredientV2[] = [];

  // Extract entire "Amount Per Serving" block first (preserve original HTML structure)
  const amountPerServingMatch = html.match(/<strong>Amount Per Serving<\/strong>(?:<br[^>]*>|\s+)(.*?)(?=<p><strong>Other Ingredients|<\/p>|$)/is);

  if (amountPerServingMatch) {
    const block = amountPerServingMatch[1];
    
    // Split by </p> tags to get individual ingredient paragraphs
    // Handle both <p> tags and <br> tags as separators
    const ingredientBlocks = block.split(/<\/p>\s*<p>/).filter(b => b.trim().length > 0);
    
    // If no <p> tags, try splitting by <br> tags
    if (ingredientBlocks.length === 1) {
      const brSplit = block.split(/<br[^>]*>/i).filter(b => b.trim().length > 0);
      if (brSplit.length > 1) {
        ingredientBlocks.push(...brSplit.slice(1)); // Skip first (header)
      }
    }

    for (const block of ingredientBlocks) {
      // Extract name from <strong> tag
      const nameMatch = block.match(/<strong>([^<]+)<\/strong>/);
      if (!nameMatch) continue;

      const name = nameMatch[1].trim();

      // Skip headers
      if (name.toLowerCase().includes('amount per serving') ||
          name.toLowerCase().includes('supplement facts')) {
        continue;
      }

      // Extract amount/unit (handle "..." or spaces)
      const amountMatch = block.match(/(?:\.{3,}|\s+)\s*([\d.,]+)\s*([a-zA-Z%]+)/);
      
      // Extract standardization from <i> tag (improvement 3.1)
      const standardizationMatch = block.match(/<i>([^<]+)<\/i>/);
      const standardization = standardizationMatch ? standardizationMatch[1].trim() : null;

      // Handle proprietary blends (no amount)
      if (!amountMatch && (name.toLowerCase().includes('blend') || name.toLowerCase().includes('proprietary'))) {
        ingredients.push({
          name: name.trim(),
          amount: null,
          unit: null,
          standardization: null,
          equivalent: null,
          parent_ingredient_id: null,
        });
        continue;
      }

      if (amountMatch) {
        const amountStr = amountMatch[1].replace(',', '');
        const unit = amountMatch[2].toLowerCase();
        const amount = parseFloat(amountStr);

        ingredients.push({
          name: name.trim(),
          amount: isNaN(amount) ? null : amount,
          unit: unit,
          standardization: standardization,
          equivalent: standardization ? standardization : null,
          parent_ingredient_id: null,
        });
      } else {
        // Ingredient without amount (proprietary blend component)
        ingredients.push({
          name: name.trim(),
          amount: null,
          unit: null,
          standardization: standardization,
          equivalent: standardization ? standardization : null,
          parent_ingredient_id: null,
        });
      }
    }
  }

  // Pattern 2: Fallback to simple list format if no structured data found
  // Example: "EPA 800 mg, DHA 600 mg"
  if (ingredients.length === 0) {
    const listPattern = /([A-Z][a-z0-9 ()-]+)\s+([\d.]+)\s*(\w+)/g;
    let match;
    while ((match = listPattern.exec(cleanHtml)) !== null) {
      const [, name, amountStr, unit] = match;
      const ingredient = parseIngredientLine(`${name} ${amountStr} ${unit}`);
      if (ingredient) {
        ingredients.push(ingredient);
      }
    }
  }

  // Improvement 6.2: Better Other Ingredients parsing
  // Extract other ingredients (handle comma-separated lists with parentheses)
  const otherIngredientsMatch = html.match(
    /<strong>Other Ingredients:<\/strong>\s*(.*?)(?:<br|<\/p>|$)/is
  );

  let otherIngredients: string | null = null;
  if (otherIngredientsMatch) {
    const cleaned = otherIngredientsMatch[1]
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp;
      .trim();

    // Smart split that respects parentheses (e.g., "cellulose (water)")
    // Split by comma, but only if not inside parentheses
    const ingredients: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        if (current.trim()) {
          ingredients.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      ingredients.push(current.trim());
    }

    otherIngredients = ingredients.length > 0 ? ingredients.join(', ') : cleaned;
  }

  return {
    suggestedUse,
    servingSize,
    ingredients,
    otherIngredients,
  };
}

/**
 * Parse ingredient line like "DHEA ... 10mg" or "Vitamin D3 ... 2000 IU"
 *
 * Supports patterns:
 * - "Vitamin D3 (as cholecalciferol) 1000 IU"
 * - "EPA 800 mg"
 * - "Magnesium (from Magnesium Citrate) 200mg"
 * - "DHEA ... 10mg"
 *
 * @param line - Single ingredient line
 * @returns Parsed ingredient or null
 */
export function parseIngredientLine(line: string): IngredientV2 | null {
  // Remove dots used as spacers
  const cleanLine = line.replace(/\.{2,}/g, ' ').trim();

  if (!cleanLine) return null;

  // Pattern 1: Name (form/source) Amount Unit
  // Example: "Vitamin D3 (as cholecalciferol) 1000 IU"
  const fullPattern = /^(.+?)\s*\(([^)]+)\)\s*([\d.]+)\s*([a-zA-Z]+)$/;
  const fullMatch = cleanLine.match(fullPattern);

  if (fullMatch) {
    const [, name, form, amountStr, unit] = fullMatch;

    // Detect standardization in parentheses
    // Example: "(dehydroepiandrosterone, C19H28O2)"
    const standardizationPattern = /([a-z]+(?:\s+[a-z]+)?),?\s*([A-Z][0-9]+[A-Z][0-9]+)/i;
    const standardizationMatch = form.match(standardizationPattern);

    let standardization: string | null = null;
    let equivalent: string | null = form.trim();

    if (standardizationMatch) {
      standardization = standardizationMatch[2]; // Chemical formula
      equivalent = standardizationMatch[1]; // Name
    }

    return {
      name: name.trim(),
      amount: parseFloat(amountStr),
      unit: unit.toLowerCase(),
      standardization,
      equivalent,
      parent_ingredient_id: null,
    };
  }

  // Pattern 2: Name Amount Unit (no form/source)
  // Example: "EPA 800 mg"
  const simplePattern = /^(.+?)\s+([\d.]+)\s*([a-zA-Z]+)$/;
  const simpleMatch = cleanLine.match(simplePattern);

  if (simpleMatch) {
    const [, name, amountStr, unit] = simpleMatch;

    return {
      name: name.trim(),
      amount: parseFloat(amountStr),
      unit: unit.toLowerCase(),
      standardization: null,
      equivalent: null,
      parent_ingredient_id: null,
    };
  }

  // Pattern 3: Name only (no amount/unit)
  // Example: "Organic Turmeric Root"
  if (cleanLine.length > 0) {
    return {
      name: cleanLine.trim(),
      amount: null,
      unit: null,
      standardization: null,
      equivalent: null,
      parent_ingredient_id: null,
    };
  }

  return null;
}

/**
 * Extract dietary restriction tags from top of page
 *
 * Common tags: "Gluten-Free", "Vegan", "Non-GMO", "Dairy-Free", etc.
 *
 * @param html - Raw HTML from product page
 * @returns Array of dietary tags
 */
export function parseDietaryTags(html: string): string[] {
  const tags: string[] = [];

  // Pattern 1: Badge/chip elements
  // Example: <span class="badge">Gluten-Free</span>
  const badgePattern = /<(?:span|div)[^>]*class="[^"]*(?:badge|tag|chip)[^"]*"[^>]*>(.*?)<\/(?:span|div)>/gi;
  let match;

  while ((match = badgePattern.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();

    // Filter for dietary tags
    if (isDietaryTag(text)) {
      tags.push(text);
    }
  }

  // Pattern 2: List items in attributes section
  // Example: <li>Gluten-Free</li>
  const listPattern = /<li[^>]*>([^<]+)<\/li>/gi;

  while ((match = listPattern.exec(html)) !== null) {
    const text = match[1].trim();

    if (isDietaryTag(text)) {
      tags.push(text);
    }
  }

  // Remove duplicates and return
  return Array.from(new Set(tags));
}

/**
 * Check if text is a valid dietary tag
 *
 * @param text - Text to check
 * @returns True if text is a dietary tag
 */
function isDietaryTag(text: string): boolean {
  const dietaryKeywords = [
    'gluten-free',
    'gluten free',
    'vegan',
    'vegetarian',
    'non-gmo',
    'organic',
    'dairy-free',
    'dairy free',
    'soy-free',
    'soy free',
    'sugar-free',
    'sugar free',
    'allergen-free',
    'kosher',
    'halal',
    'paleo',
    'keto',
    'low-carb',
  ];

  const lowerText = text.toLowerCase().trim();
  return dietaryKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract certifications from product page
 *
 * Common certifications: "NSF Certified", "GMP", "Organic", "USP Verified", etc.
 *
 * @param html - Raw HTML from product page
 * @returns Array of certifications
 */
export function parseCertifications(html: string): string[] {
  const certifications: string[] = [];

  // Pattern 1: Image alt text (certifications often shown as badges)
  // Example: <img alt="NSF Certified" src="...">
  const imgPattern = /<img[^>]+alt="([^"]+)"[^>]*>/gi;
  let match;

  while ((match = imgPattern.exec(html)) !== null) {
    const alt = match[1].trim();

    if (isCertification(alt)) {
      certifications.push(alt);
    }
  }

  // Pattern 2: Text with "Certified" or "Verified"
  const certPattern = /([A-Z][A-Za-z0-9\s]+(?:Certified|Verified|Approved))/g;

  while ((match = certPattern.exec(html)) !== null) {
    const cert = match[1].trim();

    if (isCertification(cert)) {
      certifications.push(cert);
    }
  }

  // Remove duplicates and return
  return Array.from(new Set(certifications));
}

/**
 * Check if text is a valid certification
 *
 * @param text - Text to check
 * @returns True if text is a certification
 */
function isCertification(text: string): boolean {
  const certificationKeywords = [
    'nsf',
    'gmp',
    'usp',
    'organic',
    'usda',
    'non-gmo',
    'certified',
    'verified',
    'approved',
    'tested',
    'third-party',
    'quality',
  ];

  const lowerText = text.toLowerCase().trim();
  return certificationKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Clean HTML text by removing tags and normalizing whitespace
 *
 * @param html - Raw HTML
 * @returns Cleaned text
 */
export function cleanHtmlText(html: string): string {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&') // Replace &amp;
    .replace(/&lt;/g, '<') // Replace &lt;
    .replace(/&gt;/g, '>') // Replace &gt;
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract warnings/cautions from product page
 *
 * Common sections: "Warnings", "Caution", "Contraindications"
 *
 * @param html - Raw HTML from product page
 * @returns Warning text or null
 */
export function parseWarnings(html: string): string | null {
  // Look for warnings section
  const warningPattern = /<strong>(?:Warnings?|Caution|Contraindications):<\/strong>\s*(.*?)(?:<br|<\/p>|<\/div>)/i;
  const match = html.match(warningPattern);

  if (match) {
    return cleanHtmlText(match[1]);
  }

  return null;
}
