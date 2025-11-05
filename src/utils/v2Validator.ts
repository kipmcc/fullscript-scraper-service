/**
 * V2 Schema Validator
 *
 * Zod schemas for validating aviado.stack.current.v2 data
 */

import { z } from 'zod';
import { DosageForm, Category, SourceType } from '../types/v2Schema';

/**
 * Zod enum schemas
 */
export const DosageFormSchema = z.nativeEnum(DosageForm);
export const CategorySchema = z.nativeEnum(Category);
export const SourceTypeSchema = z.nativeEnum(SourceType);

/**
 * Ingredient schema
 */
export const IngredientV2Schema = z.object({
  name: z.string().min(1),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  standardization: z.string().nullable(),
  equivalent: z.string().nullable(),
  parent_ingredient_id: z.string().nullable(),
});

/**
 * Source metadata schema
 */
export const SourceMetadataSchema = z.object({
  source_type: SourceTypeSchema,
  source_name: z.string().min(1),
  source_url: z.string().url().optional(),
  retrieved_at: z.string().datetime(), // ISO 8601
});

/**
 * Product v2 schema
 */
export const ProductV2Schema = z.object({
  // Required fields
  brand: z.string().min(1),
  product_name: z.string().min(1),
  display_name: z.string().min(1),
  canonical_id: z.string().min(1),
  dosage_form: DosageFormSchema,
  category: CategorySchema,
  ingredients: z.array(IngredientV2Schema),
  confidence: z.number().min(0).max(1),
  source_metadata: SourceMetadataSchema,

  // Optional fields
  dose_per_unit: z.string().optional(),
  recommended_dose_label: z.string().optional(),
  key_ingredients_text: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  allergen_info: z.string().optional(),
  notes: z.string().optional(),
  front_label_image_url: z.string().url().optional(),
  back_label_image_url: z.string().url().optional(),
});

/**
 * Import metadata schema
 */
export const ImportMetadataV2Schema = z.object({
  import_date: z.string().datetime(),
  import_source: z.literal('fullscript_scraper'),
  llm_model: z.null(),
  confidence_threshold: z.number().min(0).max(1),
  notes: z.string().optional(),
});

/**
 * Top-level import schema
 */
export const FullscriptImportV2Schema = z.object({
  schema_version: z.literal('aviado.stack.current.v2'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic version
  import_metadata: ImportMetadataV2Schema,
  products: z.array(ProductV2Schema),
});

/**
 * Validate a single product
 *
 * @param product - Product object to validate
 * @returns Validated product (throws on validation error)
 */
export function validateProduct(product: unknown) {
  return ProductV2Schema.parse(product);
}

/**
 * Validate entire import
 *
 * @param importData - Import object to validate
 * @returns Validated import (throws on validation error)
 */
export function validateImport(importData: unknown) {
  return FullscriptImportV2Schema.parse(importData);
}

/**
 * Safe validate (returns result with errors)
 *
 * @param product - Product object to validate
 * @returns Validation result with success/error
 */
export function safeValidateProduct(product: unknown) {
  return ProductV2Schema.safeParse(product);
}

/**
 * Safe validate import
 *
 * @param importData - Import object to validate
 * @returns Validation result with success/error
 */
export function safeValidateImport(importData: unknown) {
  return FullscriptImportV2Schema.safeParse(importData);
}
