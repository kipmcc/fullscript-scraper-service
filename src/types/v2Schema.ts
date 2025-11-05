/**
 * Aviado Stack Schema v2 Types
 *
 * Full schema: aviado.stack.current.v2
 * Used by Fullscript scraper to export structured supplement data
 */

/**
 * Dosage form enum - REQUIRED field
 */
export enum DosageForm {
  CAPSULE = 'capsule',
  TABLET = 'tablet',
  SOFTGEL = 'softgel',
  LIQUID = 'liquid',
  POWDER = 'powder',
  GUMMY = 'gummy',
  SPRAY = 'spray',
  PATCH = 'patch',
  CREAM = 'cream',
  OIL = 'oil',
  OTHER = 'other',
}

/**
 * Category enum - REQUIRED field
 */
export enum Category {
  VITAMIN = 'vitamin',
  MINERAL = 'mineral',
  ADAPTOGEN = 'adaptogen',
  NOOTROPIC = 'nootropic',
  AMINO_ACID = 'amino_acid',
  PROBIOTIC = 'probiotic',
  LONGEVITY = 'longevity',
  METABOLIC = 'metabolic',
  CARDIOVASCULAR = 'cardiovascular',
  COGNITIVE = 'cognitive',
  JOINT_SUPPORT = 'joint_support',
  LIVER_SUPPORT = 'liver_support',
  SLEEP_AID = 'sleep_aid',
  DIGESTIVE_ENZYME = 'digestive_enzyme',
  OIL_FATTY_ACID = 'oil_fatty_acid',
  BOTANICAL = 'botanical',
  ANTIOXIDANT = 'antioxidant',
  MITOCHONDRIAL_SUPPORT = 'mitochondrial_support',
}

/**
 * Source type enum
 */
export enum SourceType {
  MARKETPLACE = 'marketplace',
  MANUAL_ENTRY = 'manual_entry',
  PDF_IMPORT = 'pdf_import',
  CSV_IMPORT = 'csv_import',
}

/**
 * Structured ingredient with amount and unit
 */
export interface IngredientV2 {
  name: string;
  amount: number | null;
  unit: string | null;
  standardization: string | null;
  equivalent: string | null;
  parent_ingredient_id: string | null;
}

/**
 * Source metadata for tracking where product data came from
 */
export interface SourceMetadata {
  source_type: SourceType;
  source_name: string;
  source_url?: string;
  retrieved_at: string; // ISO 8601 timestamp
}

/**
 * Full product data structure (v2 schema)
 */
export interface ProductV2 {
  // Required fields
  brand: string;
  product_name: string;
  display_name: string; // Generated: "Brand - Product Name"
  canonical_id: string; // Slugified: "brand_product_name"
  dosage_form: DosageForm; // REQUIRED ENUM
  category: Category; // REQUIRED ENUM
  ingredients: IngredientV2[]; // Structured ingredient list
  confidence: number; // 0-1 score based on field completeness
  source_metadata: SourceMetadata;

  // Optional but important fields
  dose_per_unit?: string;
  recommended_dose_label?: string;
  key_ingredients_text?: string;
  certifications?: string[];
  allergen_info?: string;
  notes?: string;
  front_label_image_url?: string;
  back_label_image_url?: string;
}

/**
 * Import metadata wrapper
 */
export interface ImportMetadataV2 {
  import_date: string; // ISO 8601 timestamp
  import_source: 'fullscript_scraper';
  llm_model: null; // Scraper doesn't use LLM
  confidence_threshold: number; // e.g., 0.8
  notes?: string;
}

/**
 * Top-level schema wrapper for entire import
 */
export interface FullscriptImportV2 {
  schema_version: 'aviado.stack.current.v2';
  version: string; // Semantic version (e.g., "2.1.0")
  import_metadata: ImportMetadataV2;
  products: ProductV2[];
}

/**
 * Product page data (scraped from detailed product pages)
 * Used to enhance card-level data with full details
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
