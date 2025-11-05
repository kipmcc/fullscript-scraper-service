/**
 * Enum Detection Utilities
 *
 * Smart detection of dosage_form and category from product data
 */

import { DosageForm, Category } from '../types/v2Schema';

/**
 * Detect dosage form from product name, description, and serving size
 *
 * @param productName - Product name
 * @param description - Product description (optional)
 * @param servingSize - Package size text (e.g., "90 capsules", "60 Softgels") (optional)
 * @returns Detected DosageForm enum value
 *
 * @example
 * detectDosageForm("Vitamin D3 1000 IU Softgels") // DosageForm.SOFTGEL
 * detectDosageForm("Magnesium Citrate Powder") // DosageForm.POWDER
 * detectDosageForm("Magnesium", undefined, "90 capsules") // DosageForm.CAPSULE
 */
export function detectDosageForm(
  productName: string,
  description?: string,
  servingSize?: string
): DosageForm {
  const text = `${productName} ${description || ''} ${servingSize || ''}`.toLowerCase();

  // Order matters - check more specific forms first
  if (text.match(/\bsoftgel|soft gel|soft-gel\b/i)) return DosageForm.SOFTGEL;
  if (text.match(/\bcapsule|vcap|veggie cap\b/i)) return DosageForm.CAPSULE;
  if (text.match(/\btablet|tab\b/i)) return DosageForm.TABLET;
  if (text.match(/\bliquid|tincture|drops|syrup\b/i)) return DosageForm.LIQUID;
  if (text.match(/\bpowder|pwd\b/i)) return DosageForm.POWDER;
  if (text.match(/\bgummy|gummies|chewable\b/i)) return DosageForm.GUMMY;
  if (text.match(/\bspray\b/i)) return DosageForm.SPRAY;
  if (text.match(/\bpatch|transdermal\b/i)) return DosageForm.PATCH;
  if (text.match(/\bcream|lotion|topical|gel\b/i)) return DosageForm.CREAM;
  if (text.match(/\boil\b/i)) return DosageForm.OIL;

  // Default fallback
  return DosageForm.OTHER;
}

/**
 * Detect category from product name and ingredients
 *
 * @param productName - Product name
 * @param ingredients - Ingredients text (optional)
 * @returns Detected Category enum value
 *
 * @example
 * detectCategory("Vitamin D3 1000 IU") // Category.VITAMIN
 * detectCategory("Nordic Naturals Omega-3") // Category.OIL_FATTY_ACID
 * detectCategory("Garden of Life Probiotic") // Category.PROBIOTIC
 */
export function detectCategory(
  productName: string,
  ingredients?: string
): Category {
  const text = `${productName} ${ingredients || ''}`.toLowerCase();

  // Vitamins - check first as they're common
  if (text.match(/\bvitamin [a-k]|ascorbic acid|tocopherol|retinol|cholecalciferol|cobalamin|niacin|riboflavin|thiamine|biotin|folate|folic acid\b/i)) {
    return Category.VITAMIN;
  }

  // Minerals
  if (text.match(/\bmagnesium|zinc|iron|calcium|selenium|potassium|chromium|copper|manganese|iodine\b/i)) {
    return Category.MINERAL;
  }

  // Oil/Fatty Acids (no word boundary before "omega" to catch "ProOmega", "Klean Omega-3", etc.)
  if (text.match(/omega|fish oil|krill oil|cod liver|epa|dha|eicosapentaenoic|docosahexaenoic|marine triglyceride|fatty acid|flax|chia/i)) {
    return Category.OIL_FATTY_ACID;
  }

  // Probiotics
  if (text.match(/\bprobiotic|lactobacillus|bifidobacterium|saccharomyces boulardii|cfu\b/i)) {
    return Category.PROBIOTIC;
  }

  // Digestive Enzymes
  if (text.match(/\bdigestive enzyme|protease|amylase|lipase|lactase|bromelain|papain\b/i)) {
    return Category.DIGESTIVE_ENZYME;
  }

  // Adaptogens
  if (text.match(/\bashwagandha|rhodiola|holy basil|reishi|cordyceps|schisandra|eleuthero|maca\b/i)) {
    return Category.ADAPTOGEN;
  }

  // Nootropics
  if (text.match(/\bnootropic|alpha gpc|citicoline|lion's mane|bacopa|ginkgo|l-theanine\b/i)) {
    return Category.NOOTROPIC;
  }

  // Amino Acids
  if (text.match(/\bamino acid|l-carnitine|l-arginine|l-glutamine|l-lysine|l-tryptophan|taurine|glycine|creatine\b/i)) {
    return Category.AMINO_ACID;
  }

  // Cardiovascular
  if (text.match(/\bcoq10|coenzyme q10|ubiquinol|hawthorn|nattokinase|heart health\b/i)) {
    return Category.CARDIOVASCULAR;
  }

  // Cognitive/Brain Health
  if (text.match(/\bbrain health|cognitive|memory|focus|phosphatidylserine|ps\b/i)) {
    return Category.COGNITIVE;
  }

  // Joint Support
  if (text.match(/\bjoint|glucosamine|chondroitin|msm|hyaluronic acid|collagen|turmeric|curcumin\b/i)) {
    return Category.JOINT_SUPPORT;
  }

  // Liver Support
  if (text.match(/\bliver|milk thistle|silymarin|nac|n-acetyl cysteine|glutathione\b/i)) {
    return Category.LIVER_SUPPORT;
  }

  // Sleep Aid
  if (text.match(/\bsleep|melatonin|valerian|passionflower|chamomile|5-htp\b/i)) {
    return Category.SLEEP_AID;
  }

  // Antioxidants
  if (text.match(/\bantioxidant|resveratrol|pterostilbene|quercetin|polyphenol|astaxanthin\b/i)) {
    return Category.ANTIOXIDANT;
  }

  // Mitochondrial Support
  if (text.match(/\bmitochondrial|pqq|alpha lipoic acid|ala|carnosine\b/i)) {
    return Category.MITOCHONDRIAL_SUPPORT;
  }

  // Longevity
  if (text.match(/\blongevity|nad|nmn|spermidine|rapamycin|metformin\b/i)) {
    return Category.LONGEVITY;
  }

  // Metabolic Health
  if (text.match(/\bmetabolic|berberine|chromium picolinate|cinnamon|blood sugar\b/i)) {
    return Category.METABOLIC;
  }

  // Botanicals (catch-all for herbal supplements)
  if (text.match(/\bherbal|botanical|extract|herb\b/i)) {
    return Category.BOTANICAL;
  }

  // Default fallback
  return Category.BOTANICAL;
}

/**
 * Calculate confidence score based on field completeness
 *
 * @param product - Product object to score
 * @returns Confidence score between 0 and 1
 *
 * @example
 * calculateConfidence({ brand: "...", product_name: "...", ... }) // 0.85
 */
export function calculateConfidence(product: {
  brand: string;
  product_name: string;
  dosage_form: DosageForm;
  category: Category;
  ingredients: any[];
  dose_per_unit?: string;
  recommended_dose_label?: string;
  key_ingredients_text?: string;
  certifications?: string[];
  allergen_info?: string;
  front_label_image_url?: string;
  back_label_image_url?: string;
}): number {
  let score = 0;
  let maxScore = 0;

  // Core required fields (50% of score)
  maxScore += 50;
  if (product.brand && product.brand !== 'Unknown Brand') score += 10;
  if (product.product_name && product.product_name !== 'Unknown Product') score += 10;
  if (product.dosage_form && product.dosage_form !== DosageForm.OTHER) score += 10;
  if (product.category && product.category !== Category.BOTANICAL) score += 10;
  if (product.ingredients && product.ingredients.length > 0) score += 10;

  // Optional but important fields (30% of score)
  maxScore += 30;
  if (product.dose_per_unit) score += 6;
  if (product.recommended_dose_label) score += 6;
  if (product.key_ingredients_text) score += 6;
  if (product.certifications && product.certifications.length > 0) score += 6;
  if (product.allergen_info) score += 6;

  // Nice-to-have fields (20% of score)
  maxScore += 20;
  if (product.front_label_image_url) score += 10;
  if (product.back_label_image_url) score += 10;

  return Math.min(score / maxScore, 1.0);
}

/**
 * Generate display name from brand and product name
 *
 * @param brand - Brand name
 * @param productName - Product name
 * @returns Formatted display name
 *
 * @example
 * generateDisplayName("Thorne", "Vitamin D3") // "Thorne - Vitamin D3"
 */
export function generateDisplayName(brand: string, productName: string): string {
  return `${brand} - ${productName}`;
}

/**
 * Generate canonical ID (slugified brand_product_name)
 *
 * @param brand - Brand name
 * @param productName - Product name
 * @returns Slugified canonical ID
 *
 * @example
 * generateCanonicalId("Thorne Research", "Vitamin D3 1000 IU")
 * // "thorne_research_vitamin_d3_1000_iu"
 */
export function generateCanonicalId(brand: string, productName: string): string {
  const combined = `${brand}_${productName}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .replace(/_+/g, '_'); // Collapse multiple underscores
}
