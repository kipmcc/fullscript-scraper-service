# Fullscript Scraper v2 Schema - Code Review Report

**Review Date**: 2025-11-05
**Reviewer**: Code Review Agent
**Status**: ⚠️ PENDING IMPLEMENTATION

---

## 🔍 Executive Summary

**Finding**: The v2 schema implementation files specified in `V2_SCHEMA_IMPLEMENTATION_PLAN.md` have not been created yet. This review provides guidance for what should be validated once implementation is complete.

**Expected Files (NOT YET CREATED)**:
- ❌ `src/types/v2Schema.ts` - Type definitions
- ❌ `src/utils/enumDetection.ts` - Enum detection logic
- ❌ `src/utils/ingredientParser.ts` - Ingredient parsing
- ❌ `src/utils/v2Validator.ts` - Zod validation schemas
- ❌ `src/__tests__/v2Schema.test.ts` - Test suite
- ⚠️ `src/scraper.ts` - Exists but needs v2 upgrade

---

## 📋 Review Checklist for Future Implementation

### 1. Type Safety (`src/types/v2Schema.ts`)

**Requirements**:
- ✅ All interfaces should have strict typing
- ✅ No `any` types except in controlled error handling
- ✅ Enums should use const assertions or TypeScript enums
- ✅ Optional fields should be explicitly marked with `?`
- ✅ Arrays should specify element types

**Expected Interfaces**:
```typescript
// REQUIRED interfaces
interface ProductV2 {
  // Required fields
  brand: string;
  product_name: string;
  display_name: string;
  canonical_id: string;
  dosage_form: DosageForm; // ENUM - REQUIRED
  category: Category; // ENUM - REQUIRED
  ingredients: IngredientV2[];
  confidence: number; // 0-1
  source_metadata: SourceMetadata;

  // Optional fields
  dose_per_unit?: string;
  recommended_dose_label?: string;
  key_ingredients_text?: string;
  certifications?: string[];
  allergen_info?: string;
  notes?: string;
  front_label_image_url?: string;
  back_label_image_url?: string;
}

interface IngredientV2 {
  name: string;
  amount: number | null;
  unit: string | null;
  standardization: string | null;
  equivalent: string | null;
  parent_ingredient_id: string | null;
}

interface ImportMetadataV2 {
  import_date: string;
  import_source: "fullscript_scraper";
  llm_model: null;
  confidence_threshold: number;
  notes: string;
}

interface FullscriptImportV2 {
  schema_version: "aviado.stack.current.v2";
  version: "2.1.0";
  import_metadata: ImportMetadataV2;
  products: ProductV2[];
}

// Enums
type DosageForm =
  | 'capsule' | 'tablet' | 'softgel' | 'liquid' | 'powder'
  | 'gummy' | 'spray' | 'patch' | 'cream' | 'oil' | 'other';

type Category =
  | 'vitamin' | 'mineral' | 'adaptogen' | 'nootropic' | 'amino_acid'
  | 'probiotic' | 'longevity' | 'metabolic' | 'cardiovascular'
  | 'cognitive' | 'joint_support' | 'liver_support' | 'sleep_aid'
  | 'digestive_enzyme' | 'oil_fatty_acid' | 'botanical'
  | 'antioxidant' | 'mitochondrial_support' | 'other';
```

**Review Points**:
- [ ] Interfaces match v2 schema spec exactly
- [ ] No loose `any` types
- [ ] Enums are exhaustive (include all valid values)
- [ ] Required fields are not optional
- [ ] Confidence is constrained to 0-1 range

---

### 2. Enum Detection Logic (`src/utils/enumDetection.ts`)

**Requirements**:
- ✅ Robust keyword matching with case-insensitive search
- ✅ Fallback to 'other' when uncertain
- ✅ Clear confidence scoring logic
- ✅ Error handling for missing data

**Expected Functions**:
```typescript
export function detectDosageForm(
  productName: string,
  description?: string
): DosageForm;

export function detectCategory(
  productName: string,
  ingredients?: string
): Category;

export function calculateConfidence(product: ProductV2): number;
```

**Review Points**:
- [ ] Handles null/undefined inputs gracefully
- [ ] Uses lowercase normalization for keywords
- [ ] Covers all common supplement types
- [ ] Confidence calculation accounts for field completeness
- [ ] Logs uncertain classifications for debugging

**Critical Detection Patterns**:
```typescript
// Dosage Form Detection
'capsule' → capsule
'softgel' / 'soft gel' → softgel
'tablet' / 'pill' → tablet
'liquid' / 'drops' → liquid
'powder' / 'scoop' → powder
'gummy' / 'gummies' → gummy
'spray' → spray
'patch' → patch
'cream' / 'lotion' → cream
'oil' → oil

// Category Detection
'omega' / 'fish oil' / 'EPA' / 'DHA' → oil_fatty_acid
'vitamin D' / 'vitamin C' / 'B12' → vitamin
'magnesium' / 'zinc' / 'iron' / 'calcium' → mineral
'probiotic' / 'Lactobacillus' / 'Bifidobacterium' → probiotic
'melatonin' / 'sleep' → sleep_aid
'ashwagandha' / 'rhodiola' / 'adaptogen' → adaptogen
```

---

### 3. Ingredient Parsing (`src/utils/ingredientParser.ts`)

**Requirements**:
- ✅ Parse structured supplement facts when available
- ✅ Extract ingredient name, amount, unit
- ✅ Handle nested ingredients (parent-child)
- ✅ Graceful fallback when data missing

**Expected Function**:
```typescript
export function parseIngredients(
  factsText?: string,
  productName?: string
): IngredientV2[];
```

**Review Points**:
- [ ] Handles various table formats
- [ ] Extracts numeric amounts correctly
- [ ] Parses units (mg, mcg, IU, etc.)
- [ ] Creates fallback ingredient from product name
- [ ] Handles "per serving" vs "per capsule" correctly

**Parsing Strategy**:
1. Look for "Supplement Facts" table
2. Extract rows matching pattern: `Ingredient ... Amount ... Unit`
3. Parse numeric amounts with regex: `/(\d+(?:\.\d+)?)\s*(mg|mcg|g|IU)/`
4. Handle nested ingredients with indentation detection
5. Fallback: Create single ingredient from product name

---

### 4. Zod Validation (`src/utils/v2Validator.ts`)

**Requirements**:
- ✅ Strict schema validation with Zod
- ✅ Reject invalid enum values
- ✅ Validate confidence range (0-1)
- ✅ Clear error messages

**Expected Schema**:
```typescript
import { z } from 'zod';

export const DosageFormSchema = z.enum([
  'capsule', 'tablet', 'softgel', 'liquid', 'powder',
  'gummy', 'spray', 'patch', 'cream', 'oil', 'other'
]);

export const CategorySchema = z.enum([
  'vitamin', 'mineral', 'adaptogen', 'nootropic', 'amino_acid',
  'probiotic', 'longevity', 'metabolic', 'cardiovascular',
  'cognitive', 'joint_support', 'liver_support', 'sleep_aid',
  'digestive_enzyme', 'oil_fatty_acid', 'botanical',
  'antioxidant', 'mitochondrial_support', 'other'
]);

export const IngredientV2Schema = z.object({
  name: z.string().min(1),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  standardization: z.string().nullable(),
  equivalent: z.string().nullable(),
  parent_ingredient_id: z.string().nullable(),
});

export const ProductV2Schema = z.object({
  brand: z.string().min(1),
  product_name: z.string().min(1),
  display_name: z.string().min(1),
  canonical_id: z.string().min(1),
  dosage_form: DosageFormSchema,
  category: CategorySchema,
  ingredients: z.array(IngredientV2Schema),
  confidence: z.number().min(0).max(1),
  source_metadata: z.object({
    source_type: z.literal('fullscript'),
    fullscript_url: z.string().optional(),
    scrape_date: z.string(),
  }),
  // Optional fields
  dose_per_unit: z.string().optional(),
  recommended_dose_label: z.string().optional(),
  key_ingredients_text: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  allergen_info: z.string().optional(),
  notes: z.string().optional(),
  front_label_image_url: z.string().optional(),
  back_label_image_url: z.string().optional(),
});

export const FullscriptImportV2Schema = z.object({
  schema_version: z.literal("aviado.stack.current.v2"),
  version: z.literal("2.1.0"),
  import_metadata: z.object({
    import_date: z.string(),
    import_source: z.literal("fullscript_scraper"),
    llm_model: z.null(),
    confidence_threshold: z.number(),
    notes: z.string(),
  }),
  products: z.array(ProductV2Schema),
});
```

**Review Points**:
- [ ] All enums match TypeScript definitions
- [ ] Required fields are not optional
- [ ] Confidence constrained to 0-1
- [ ] Schema version is literal string
- [ ] Validation errors are descriptive

---

### 5. Scraper Integration (`src/scraper.ts`)

**Current Status**: Basic scraper exists, needs v2 upgrade

**Required Changes**:
```typescript
// BEFORE (current)
interface ScrapedProduct {
  brand: string;
  product_name: string;
  description?: string;
  ingredients?: string; // Raw text
  price?: number;
  image_url?: string;
}

// AFTER (v2 schema)
import { ProductV2, FullscriptImportV2 } from './types/v2Schema';
import { detectDosageForm, detectCategory, calculateConfidence } from './utils/enumDetection';
import { parseIngredients } from './utils/ingredientParser';
import { FullscriptImportV2Schema } from './utils/v2Validator';

// Update extractProductsFromPage() to return ProductV2[]
// Wrap final result in FullscriptImportV2 schema
```

**Review Points**:
- [ ] All products have required enums (dosage_form, category)
- [ ] display_name generated correctly (brand + product_name)
- [ ] canonical_id slugified properly
- [ ] Ingredients parsed into structured array
- [ ] Confidence calculated based on field completeness
- [ ] Source metadata includes scrape date and Fullscript URL
- [ ] Final JSON wrapped in import metadata
- [ ] Validation runs before database write
- [ ] Invalid products logged but don't crash scraper

---

## 🧪 Test Coverage Requirements

### Unit Tests (`src/__tests__/v2Schema.test.ts`)

**Minimum Test Cases**:
1. `detectDosageForm()`
   - Test common patterns: "capsule", "softgel", "tablet"
   - Test edge cases: "soft gel" (2 words), "gummies"
   - Test fallback: Unknown format → 'other'

2. `detectCategory()`
   - Test vitamin detection: "Vitamin D3 5000 IU"
   - Test mineral detection: "Magnesium Glycinate"
   - Test oil detection: "Omega-3 Fish Oil"
   - Test probiotic detection: "Lactobacillus acidophilus"
   - Test fallback: Unknown → 'other'

3. `parseIngredients()`
   - Test structured data: "Vitamin D3 ... 5000 IU"
   - Test nested ingredients
   - Test fallback: Missing data → product name

4. `validateProduct()`
   - Test valid product passes
   - Test missing required field fails
   - Test invalid enum value fails
   - Test confidence out of range fails

**Coverage Target**: 80%+ line coverage

---

## ⚠️ Common Issues to Watch For

### Type Safety
- ❌ Using `any` without justification
- ❌ Missing null checks before string operations
- ❌ Assuming fields exist without validation

### Error Handling
- ❌ Throwing errors instead of returning defaults
- ❌ Not logging failed enum detections
- ❌ Crashing on invalid data instead of graceful degradation

### Performance
- ❌ Complex regex in hot loops
- ❌ Repeated string operations without caching
- ❌ Synchronous operations blocking scraper

### Data Quality
- ❌ Confidence always 1.0 (should reflect completeness)
- ❌ Generic "other" category without investigation
- ❌ Empty ingredient arrays
- ❌ Missing source metadata

---

## ✅ Approval Criteria

Before merging v2 implementation:
- [ ] All TypeScript files compile without errors (`npx tsc --noEmit`)
- [ ] All tests pass (`npm test`)
- [ ] Test coverage ≥ 80%
- [ ] No `any` types except in error handlers
- [ ] All products have valid enums (dosage_form, category)
- [ ] Confidence scores reflect data completeness
- [ ] Validation runs before database write
- [ ] Documentation updated with v2 examples
- [ ] Manual test: Scrape 5 products → Download JSON → Validate structure
- [ ] Code review approved by 1+ reviewer

---

## 📊 Implementation Status Tracking

| Task | File | Status | Reviewer Notes |
|------|------|--------|----------------|
| v2 Schema Types | `src/types/v2Schema.ts` | ⏳ PENDING | Not created yet |
| Enum Detection | `src/utils/enumDetection.ts` | ⏳ PENDING | Not created yet |
| Ingredient Parser | `src/utils/ingredientParser.ts` | ⏳ PENDING | Not created yet |
| Zod Validation | `src/utils/v2Validator.ts` | ⏳ PENDING | Not created yet |
| Scraper Integration | `src/scraper.ts` | ⏳ PENDING | Needs v2 upgrade |
| Unit Tests | `src/__tests__/v2Schema.test.ts` | ⏳ PENDING | Template created |
| Database Migration | `supabase/migrations/*` | ⏳ PENDING | Rename products_data → products |
| Documentation | `README.md`, `DEPLOYMENT_GUIDE.md` | ⏳ PENDING | Add v2 examples |

---

## 🚀 Next Steps

1. **Implementation Agent**: Create the 4 missing files (types, enumDetection, ingredientParser, v2Validator)
2. **Scraper Agent**: Upgrade `src/scraper.ts` to use v2 schema
3. **Database Agent**: Create migration to rename column
4. **Testing Agent**: Run test suite and verify coverage
5. **Review Agent**: Re-run this checklist and approve

---

**Status**: Ready for implementation agents to proceed with v2 schema creation.
