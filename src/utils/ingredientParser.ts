/**
 * Ingredient Parser
 *
 * Parses raw ingredient text into structured IngredientV2 objects
 */

import { IngredientV2 } from '../types/v2Schema';

/**
 * Parse ingredients from supplement facts text
 *
 * Attempts to extract structured ingredient data from various text formats:
 * - "Vitamin D3 (as cholecalciferol) 1000 IU"
 * - "EPA 800 mg"
 * - "Magnesium (from Magnesium Citrate) 200mg"
 *
 * @param factsText - Raw supplement facts or ingredient text
 * @returns Array of structured ingredients
 *
 * @example
 * parseIngredients("Vitamin D3 1000 IU, EPA 800 mg")
 * // [
 * //   { name: "Vitamin D3", amount: 1000, unit: "IU", ... },
 * //   { name: "EPA", amount: 800, unit: "mg", ... }
 * // ]
 */
export function parseIngredients(factsText: string): IngredientV2[] {
  if (!factsText || factsText.trim() === '') {
    return [];
  }

  const ingredients: IngredientV2[] = [];

  // Split by common delimiters (newline, comma, semicolon)
  const lines = factsText
    .split(/[\n,;]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  for (const line of lines) {
    const ingredient = parseIngredientLine(line);
    if (ingredient) {
      ingredients.push(ingredient);
    }
  }

  return ingredients;
}

/**
 * Parse a single ingredient line into structured data
 *
 * Supported patterns:
 * - "Vitamin D3 (as cholecalciferol) 1000 IU"
 * - "EPA 800 mg"
 * - "Magnesium (from Magnesium Citrate) 200mg"
 * - "Vitamin C (L-Ascorbic Acid) 500 mg per 2 capsules"
 *
 * @param line - Single ingredient line
 * @returns Parsed ingredient or null if parsing fails
 */
function parseIngredientLine(line: string): IngredientV2 | null {
  // Pattern: Name (form/source) Amount Unit [standardization]
  // Example: "Vitamin D3 (as cholecalciferol) 1000 IU"
  const fullPattern = /^(.+?)\s*(?:\((.+?)\))?\s*(\d+(?:\.\d+)?)\s*([a-z]+)(?:\s+(.+))?$/i;
  const match = line.match(fullPattern);

  if (match) {
    const [, name, form, amountStr, unit, standardization] = match;

    return {
      name: name.trim(),
      amount: parseFloat(amountStr),
      unit: unit.toLowerCase(),
      standardization: standardization?.trim() || null,
      equivalent: form?.trim() || null,
      parent_ingredient_id: null,
    };
  }

  // Fallback: Try simpler pattern (Name Amount Unit)
  const simplePattern = /^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-z]+)$/i;
  const simpleMatch = line.match(simplePattern);

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

  // Fallback: Just the name (no amount/unit found)
  // This happens when parsing incomplete data
  if (line.length > 0) {
    return {
      name: line.trim(),
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
 * Create a fallback ingredient from product name
 *
 * Used when no structured ingredient data is available.
 * Extracts the main ingredient from the product name.
 *
 * @param productName - Product name
 * @returns Single ingredient object
 *
 * @example
 * createFallbackIngredient("Vitamin D3 1000 IU Softgels")
 * // { name: "Vitamin D3", amount: 1000, unit: "IU", ... }
 */
export function createFallbackIngredient(productName: string): IngredientV2 {
  // Try to extract ingredient name and amount from product name
  const pattern = /^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-z]+)/i;
  const match = productName.match(pattern);

  if (match) {
    const [, name, amountStr, unit] = match;
    return {
      name: name.trim(),
      amount: parseFloat(amountStr),
      unit: unit.toLowerCase(),
      standardization: null,
      equivalent: null,
      parent_ingredient_id: null,
    };
  }

  // No amount found - just use product name as ingredient
  return {
    name: productName.trim(),
    amount: null,
    unit: null,
    standardization: null,
    equivalent: null,
    parent_ingredient_id: null,
  };
}

/**
 * Extract key ingredients text from parsed ingredients
 *
 * Generates a human-readable summary of main ingredients.
 *
 * @param ingredients - Array of parsed ingredients
 * @param maxCount - Maximum number of ingredients to include (default: 5)
 * @returns Formatted key ingredients text
 *
 * @example
 * extractKeyIngredientsText([...]) // "EPA 800mg, DHA 600mg, Vitamin E 10 IU"
 */
export function extractKeyIngredientsText(
  ingredients: IngredientV2[],
  maxCount: number = 5
): string {
  return ingredients
    .slice(0, maxCount)
    .map(ing => {
      if (ing.amount && ing.unit) {
        return `${ing.name} ${ing.amount}${ing.unit}`;
      }
      return ing.name;
    })
    .join(', ');
}

/**
 * Normalize common unit variations
 *
 * @param unit - Unit string to normalize
 * @returns Normalized unit
 *
 * @example
 * normalizeUnit("milligrams") // "mg"
 * normalizeUnit("IU") // "IU"
 */
export function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();

  const unitMap: Record<string, string> = {
    'milligram': 'mg',
    'milligrams': 'mg',
    'microgram': 'mcg',
    'micrograms': 'mcg',
    'μg': 'mcg',
    'gram': 'g',
    'grams': 'g',
    'iu': 'IU',
    'international unit': 'IU',
    'international units': 'IU',
    'cfu': 'CFU',
    'billion cfu': 'billion CFU',
  };

  return unitMap[normalized] || normalized;
}
