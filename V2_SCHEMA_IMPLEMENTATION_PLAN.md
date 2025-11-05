# Fullscript Scraper - v2 Schema Implementation Plan

## 🎯 Objective
Upgrade Railway scraper from basic schema to full `aviado.stack.current.v2` schema with complete field extraction, structured data, and validation.

---

## 📋 Requirements

### Schema Structure
```typescript
{
  schema_version: "aviado.stack.current.v2",
  version: "2.1.0",
  import_metadata: {
    import_date: string,
    import_source: "fullscript_scraper",
    llm_model: null,
    confidence_threshold: 0.8,
    notes: string
  },
  products: Array<ProductV2>
}
```

### ProductV2 Required Fields
- ✅ `brand` (string)
- ✅ `product_name` (string)
- ✅ `display_name` (string) - Generated from brand + product_name
- ✅ `canonical_id` (string) - Slugified brand_product_name
- ✅ `dosage_form` (ENUM - REQUIRED)
- ✅ `category` (ENUM - REQUIRED)
- ✅ `ingredients` (Array<Ingredient>) - Structured
- ✅ `confidence` (number 0-1)
- ✅ `source_metadata` (object)

### Optional But Important Fields
- `dose_per_unit` (string)
- `recommended_dose_label` (string)
- `key_ingredients_text` (string)
- `certifications` (string[])
- `allergen_info` (string)
- `notes` (string)
- `front_label_image_url` (string)
- `back_label_image_url` (string)

---

## 🔧 Implementation Tasks

### Task 1: Create v2 Schema Types
**Location**: `fullscript-scraper-service/src/types/v2Schema.ts`

Create TypeScript interfaces matching v2 schema:
- `ProductV2`
- `IngredientV2`
- `ImportMetadataV2`
- `FullscriptImportV2` (wrapper)
- Enums: `DosageForm`, `Category`, `SourceType`

### Task 2: Fix Database Column Name
**Location**: `supabase/migrations/`

Create new migration:
- Rename `products_data` → `products` in `fullscript_imports` table
- Update Aviado UI references (FullscriptScraperPanel.tsx)

### Task 3: Enhance Product Extraction
**Location**: `fullscript-scraper-service/src/scraper.ts`

Update `extractProductsFromPage()`:
```typescript
// Current (basic)
{
  brand: string;
  product_name: string;
  description?: string;
  ingredients?: string; // Raw text
}

// New (v2)
{
  brand: string;
  product_name: string;
  display_name: string;
  canonical_id: string;
  dosage_form: DosageForm; // REQUIRED ENUM
  category: Category; // REQUIRED ENUM
  dose_per_unit?: string;
  recommended_dose_label?: string;
  key_ingredients_text?: string;
  ingredients: IngredientV2[]; // Structured
  certifications?: string[];
  allergen_info?: string;
  notes?: string;
  front_label_image_url?: string;
  confidence: number;
  source_metadata: SourceMetadata;
}
```

**Extraction Strategy**:
1. Extract all visible text from product card
2. Parse dosage form from product name/description (e.g., "capsule", "softgel")
3. Detect category from keywords (e.g., "omega-3" → oil_fatty_acid)
4. Parse ingredients from supplement facts table (if visible)
5. Extract certifications (IFOS, USDA Organic, etc.)
6. Capture image URLs (front label)
7. Calculate confidence based on field completeness

### Task 4: Implement Enum Detection
**Location**: `fullscript-scraper-service/src/utils/enumDetection.ts`

Port from deleted Aviado utils (or recreate):
```typescript
function detectDosageForm(productName: string, description: string): DosageForm
function detectCategory(productName: string, ingredients: string): Category
function calculateConfidence(product: ProductV2): number // 0-1 based on field completeness
```

**Detection Logic**:
- `dosage_form`: Keyword matching ("capsule", "softgel", "tablet", "liquid", "powder", etc.)
- `category`: Analyze ingredients + product name
  - "omega" / "fish oil" / "EPA" / "DHA" → oil_fatty_acid
  - "vitamin D" / "vitamin C" → vitamin
  - "probiotic" / "Lactobacillus" → probiotic
  - "magnesium" / "zinc" / "iron" → mineral
  - Fallback: "other"

### Task 5: Implement Ingredient Parsing
**Location**: `fullscript-scraper-service/src/utils/ingredientParser.ts`

Parse visible supplement facts into structured array:
```typescript
interface IngredientV2 {
  name: string;
  amount: number | null;
  unit: string | null;
  standardization: string | null;
  equivalent: string | null;
  parent_ingredient_id: string | null;
}

function parseIngredients(factsText: string): IngredientV2[]
```

**Parsing Strategy**:
- Look for "Supplement Facts" table in product details
- Extract rows with pattern: "Ingredient Name ... Amount ... Unit"
- Handle nested ingredients (parent-child relationships)
- Fallback: If no structured data, create single ingredient from product name

### Task 6: Add Schema Wrapper
**Location**: `fullscript-scraper-service/src/scraper.ts`

Wrap scraped products in v2 schema:
```typescript
const importResult: FullscriptImportV2 = {
  schema_version: "aviado.stack.current.v2",
  version: "2.1.0",
  import_metadata: {
    import_date: new Date().toISOString(),
    import_source: "fullscript_scraper",
    llm_model: null,
    confidence_threshold: 0.8,
    notes: `Scraped ${finalProducts.length} products from Fullscript (mode: ${config.mode}, filter: ${config.filter})`
  },
  products: finalProducts // Array<ProductV2>
};
```

### Task 7: Add Validation
**Location**: `fullscript-scraper-service/src/utils/v2Validator.ts`

Create Zod schema for validation:
```typescript
import { z } from 'zod';

const DosageFormSchema = z.enum([
  'capsule', 'tablet', 'softgel', 'liquid', 'powder',
  'gummy', 'spray', 'patch', 'cream', 'oil', 'other'
]);

const CategorySchema = z.enum([
  'vitamin', 'mineral', 'adaptogen', 'nootropic', 'amino_acid',
  'probiotic', 'longevity', 'metabolic', 'cardiovascular',
  'cognitive', 'joint_support', 'liver_support', 'sleep_aid',
  'digestive_enzyme', 'oil_fatty_acid', 'botanical',
  'antioxidant', 'mitochondrial_support'
]);

const ProductV2Schema = z.object({
  brand: z.string().min(1),
  product_name: z.string().min(1),
  display_name: z.string().min(1),
  canonical_id: z.string().min(1),
  dosage_form: DosageFormSchema,
  category: CategorySchema,
  // ... all other fields
});

export function validateProduct(product: any): ProductV2
```

### Task 8: Update Database Write
**Location**: `fullscript-scraper-service/src/scraper.ts`

Update Supabase write to use `products` column (not `products_data`):
```typescript
await supabase
  .from('fullscript_imports')
  .update({
    status: 'completed',
    total_products: finalProducts.length,
    successful_products: validProducts.length,
    failed_products: invalidProducts.length,
    products: importResult, // Full v2 schema wrapper
    completed_at: new Date().toISOString(),
  })
  .eq('id', importId);
```

### Task 9: Update Documentation
**Files to Update**:
- `fullscript-scraper-service/README.md` - Add v2 schema example
- `fullscript-scraper-service/DEPLOYMENT_GUIDE.md` - Update expected output
- `App Docs/FS Scraper/SCHEMA_V2_MAPPING.md` - Document field extraction

---

## 🧪 Testing Strategy

### Unit Tests
1. Test `detectDosageForm()` with various product names
2. Test `detectCategory()` with common supplements
3. Test `parseIngredients()` with sample supplement facts
4. Test `validateProduct()` rejects invalid products

### Integration Tests
1. Scrape 1 product → Verify v2 schema compliance
2. Scrape 5 products → Verify all have required enums
3. Download JSON → Verify structure matches v2 spec
4. Test edge cases (missing data, unusual formats)

### Manual Verification
1. Scrape "Thorne Vitamin D3" → Check dosage_form=softgel, category=vitamin
2. Scrape "Nordic Naturals Omega-3" → Check category=oil_fatty_acid
3. Scrape "Garden of Life Probiotic" → Check category=probiotic
4. Download JSON → Validate against v2 schema spec

---

## 📊 Success Criteria

- ✅ All products have `dosage_form` (valid enum)
- ✅ All products have `category` (valid enum)
- ✅ All products have `display_name` and `canonical_id`
- ✅ Ingredients parsed into structured array (when available)
- ✅ Import metadata wrapper present
- ✅ Confidence scores calculated (0-1 range)
- ✅ Source metadata tracks Fullscript origin
- ✅ Database column renamed: `products_data` → `products`
- ✅ Zod validation passes for all products
- ✅ Documentation updated with v2 examples
- ✅ End-to-end test: Scrape → Store → Download → Validate

---

## 🚀 Deployment Plan

1. **Test locally** with Railway dev environment
2. **Push to GitHub** (triggers Railway auto-deploy)
3. **Verify Railway build** succeeds
4. **Test in Aviado** with small scrape (1-2 products)
5. **Validate JSON** download matches v2 schema
6. **Run production scrape** (10-50 products)
7. **Archive old data** (if any exists with old schema)

---

## ⚠️ Known Challenges

### Challenge 1: Limited Data on Product Cards
- **Problem**: Product cards may not show full supplement facts
- **Solution**: Extract what's visible, mark confidence low, add notes about missing data

### Challenge 2: Enum Detection Accuracy
- **Problem**: Some products may not fit cleanly into categories
- **Solution**: Use keyword matching + fallback to "other" category, log uncertain classifications

### Challenge 3: Ingredient Parsing Complexity
- **Problem**: Supplement facts tables have inconsistent formatting
- **Solution**: Implement multiple parsing strategies, fallback to text extraction

### Challenge 4: Performance Impact
- **Problem**: More extraction = slower scraping
- **Solution**: Already rate-limited (2-4s between pages), shouldn't impact much

---

**Created**: 2025-11-05
**Status**: Ready for Implementation
**Estimated Time**: 3-4 hours (with parallel agents)
