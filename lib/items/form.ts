/**
 * Parsing and validation for the item (catalogue) form.
 *
 * An "item" here is a `products` row together with its spec bullets and its live
 * price variants. Price is a function of (product, service kind, capacity) — see
 * the note at the top of `db/schema.ts` — so a product carries a list of priced
 * variants rather than a single price column.
 *
 * Pure and free of Next.js / database imports so it can be unit tested.
 */

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  id: "id",
  sku: "sku",
  name: "name",
  category: "category",
  brand: "brand",
  unitLabel: "unitLabel",
  description: "description",
  isActive: "isActive",
  /** One spec bullet per line. */
  specs: "specs",
  /** Repeated once per variant row, in document order. */
  variantServiceKind: "variant.serviceKind",
  variantCapacityLabel: "variant.capacityLabel",
  variantCapacityLbs: "variant.capacityLbs",
  variantUnitPrice: "variant.unitPrice",
} as const;

export const CATEGORIES = [
  "fire_extinguisher",
  "detection_alarm",
  "suppression_system",
  "accessory",
  "service",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  fire_extinguisher: "Fire extinguisher",
  detection_alarm: "Detection & alarm",
  suppression_system: "Suppression system",
  accessory: "Accessory",
  service: "Service",
};

export const SERVICE_KINDS = ["new", "refill", "maintenance"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  new: "Brand new",
  refill: "Refill / service",
  maintenance: "Maintenance",
};

/** One priced variant of an item. */
export type VariantInput = {
  serviceKind: ServiceKind;
  /** Display form, e.g. "10 lbs"; "" for items without a capacity. */
  capacityLabel: string;
  /** Numeric form of the same capacity, for ordering. */
  capacityLbs: string | null;
  unitPrice: string;
};

export type ItemInput = {
  sku: string;
  name: string;
  category: Category;
  brand: string | null;
  unitLabel: string;
  description: string | null;
  isActive: boolean;
  specs: string[];
  variants: VariantInput[];
};

export type ItemFormErrors = {
  sku?: string;
  name?: string;
  category?: string;
  brand?: string;
  unitLabel?: string;
  description?: string;
  specs?: string;
  /** Applies to the variant list as a whole. */
  variants?: string;
  /** Per-row messages, keyed by the visible row number (1-based). */
  variantRows?: Record<number, string>;
};

export type ItemFormValues = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  unitLabel: string;
  description: string;
  specs: string;
  isActive: boolean;
  /** Echoed as submitted, so a rejected row keeps what was typed in it. */
  variants: {
    serviceKind: string;
    capacityLabel: string;
    capacityLbs: string;
    unitPrice: string;
  }[];
};

export type ItemFormState = {
  errors?: ItemFormErrors;
  formError?: string;
  values?: ItemFormValues;
};

export type ParseResult =
  | { ok: true; input: ItemInput; values: ItemFormValues }
  | { ok: false; errors: ItemFormErrors; values: ItemFormValues };

const MAX_SKU_LENGTH = 60;
const MAX_NAME_LENGTH = 200;
const MAX_BRAND_LENGTH = 120;
const MAX_UNIT_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_SPEC_LENGTH = 400;
const MAX_SPECS = 40;
const MAX_CAPACITY_LENGTH = 40;
const MAX_VARIANTS = 30;
/** `numeric(12, 2)` holds far more; this is a typo guard, not a column limit. */
const MAX_UNIT_PRICE = 10_000_000;

/** Up to 9 digits and at most two decimals — what `numeric(12, 2)` accepts. */
const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;
/** Capacity in pounds: `numeric(8, 2)`. */
const CAPACITY_LBS = /^\d{1,6}(\.\d{1,2})?$/;
/** Upper-case letters, digits and separators — matches the seeded SKUs. */
const SKU_SHAPE = /^[A-Z0-9][A-Z0-9._-]*$/;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards ids from a form or URL before they reach Postgres as a uuid. */
export function isItemId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** An unchecked box is absent from the submission entirely. */
function checkbox(form: FormData, name: string): boolean {
  return form.get(name) !== null;
}

function nullable(value: string): string | null {
  return value === "" ? null : value;
}

function nth(values: FormDataEntryValue[], index: number): string {
  const value = values[index];
  return typeof value === "string" ? value.trim() : "";
}

/** Splits a textarea into lines, dropping blank ones and any leading bullet. */
export function splitSpecs(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[•*-]\s*/, ""))
    .filter((line) => line !== "");
}

/** The key the live-price uniqueness constraint is built on. */
function variantKey(serviceKind: string, capacityLabel: string): string {
  return `${serviceKind}::${capacityLabel.toLowerCase()}`;
}

/**
 * Turns submitted form data into an `ItemInput`.
 *
 * Variants arrive as four parallel repeated fields, which `FormData.getAll`
 * returns in document order. A row with nothing chosen and nothing typed is
 * skipped rather than rejected — the editor always keeps a blank row at the
 * bottom. Zero variants is allowed: an item can be catalogued before it is
 * priced, it just cannot be quoted until it is.
 */
export function parseItemForm(form: FormData): ParseResult {
  const errors: ItemFormErrors = {};
  const rowErrors: Record<number, string> = {};

  const sku = text(form, FIELD.sku).toUpperCase();
  const name = text(form, FIELD.name);
  const rawCategory = text(form, FIELD.category);
  const brand = text(form, FIELD.brand);
  const rawUnitLabel = text(form, FIELD.unitLabel).toUpperCase();
  const description = text(form, FIELD.description);
  const rawSpecs = text(form, FIELD.specs);
  const isActive = checkbox(form, FIELD.isActive);

  if (!sku) {
    errors.sku = "Enter a SKU.";
  } else if (sku.length > MAX_SKU_LENGTH) {
    errors.sku = `Keep the SKU under ${MAX_SKU_LENGTH} characters.`;
  } else if (!SKU_SHAPE.test(sku)) {
    errors.sku = "Use letters, numbers, dots, dashes and underscores.";
  }

  if (!name) {
    errors.name = "Enter the item name.";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  }

  const category = CATEGORIES.find((c) => c === rawCategory);
  if (!category) {
    errors.category = "Choose a category.";
  }

  if (brand.length > MAX_BRAND_LENGTH) {
    errors.brand = `Keep the brand under ${MAX_BRAND_LENGTH} characters.`;
  }

  const unitLabel = rawUnitLabel === "" ? "UNIT" : rawUnitLabel;
  if (unitLabel.length > MAX_UNIT_LENGTH) {
    errors.unitLabel = `Keep the unit under ${MAX_UNIT_LENGTH} characters.`;
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;
  }

  const specs = splitSpecs(rawSpecs);
  if (specs.length > MAX_SPECS) {
    errors.specs = `At most ${MAX_SPECS} spec lines.`;
  } else if (specs.some((line) => line.length > MAX_SPEC_LENGTH)) {
    errors.specs = `Keep each spec line under ${MAX_SPEC_LENGTH} characters.`;
  }

  /* Variants */
  const kinds = form.getAll(FIELD.variantServiceKind);
  const labels = form.getAll(FIELD.variantCapacityLabel);
  const lbs = form.getAll(FIELD.variantCapacityLbs);
  const priceValues = form.getAll(FIELD.variantUnitPrice);

  const rowCount = Math.max(
    kinds.length,
    labels.length,
    lbs.length,
    priceValues.length,
  );

  if (rowCount > MAX_VARIANTS) {
    errors.variants = `An item can hold at most ${MAX_VARIANTS} variants.`;
  }

  const variants: VariantInput[] = [];
  const echoedVariants: ItemFormValues["variants"] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < rowCount; i += 1) {
    const rawKind = nth(kinds, i);
    const rawLabel = nth(labels, i);
    const rawLbs = nth(lbs, i);
    const rawPrice = nth(priceValues, i);

    echoedVariants.push({
      serviceKind: rawKind,
      capacityLabel: rawLabel,
      capacityLbs: rawLbs,
      unitPrice: rawPrice,
    });

    // Blank row: nothing typed anywhere in it.
    if (rawKind === "" && rawLabel === "" && rawLbs === "" && rawPrice === "") {
      continue;
    }

    const rowNo = i + 1;

    const serviceKind = SERVICE_KINDS.find((k) => k === rawKind);
    if (!serviceKind) {
      rowErrors[rowNo] = "Choose a service kind.";
      continue;
    }

    if (rawLabel.length > MAX_CAPACITY_LENGTH) {
      rowErrors[rowNo] =
        `Keep the capacity under ${MAX_CAPACITY_LENGTH} characters.`;
      continue;
    }

    if (rawPrice === "") {
      rowErrors[rowNo] = "Enter a unit price.";
      continue;
    }

    if (!AMOUNT.test(rawPrice)) {
      rowErrors[rowNo] = "Price must be a number with at most two decimals.";
      continue;
    }

    if (Number(rawPrice) <= 0) {
      rowErrors[rowNo] = "Price must be greater than zero.";
      continue;
    }

    if (Number(rawPrice) > MAX_UNIT_PRICE) {
      rowErrors[rowNo] = `Price must be ${MAX_UNIT_PRICE} or less.`;
      continue;
    }

    if (rawLbs !== "" && !CAPACITY_LBS.test(rawLbs)) {
      rowErrors[rowNo] = "Capacity in lbs must be a number.";
      continue;
    }

    /*
     * One live price per (service kind, capacity) — the partial unique index
     * would reject the second, so catch it here where it can be pointed at the
     * row that caused it.
     */
    const key = variantKey(serviceKind, rawLabel);
    const firstSeen = seen.get(key);
    if (firstSeen !== undefined) {
      rowErrors[rowNo] = `Same service kind and capacity as row ${firstSeen}.`;
      continue;
    }
    seen.set(key, rowNo);

    variants.push({
      serviceKind,
      capacityLabel: rawLabel,
      capacityLbs: nullable(rawLbs),
      unitPrice: rawPrice,
    });
  }

  if (Object.keys(rowErrors).length > 0) {
    errors.variantRows = rowErrors;
  }

  const values: ItemFormValues = {
    sku,
    name,
    category: rawCategory,
    brand,
    unitLabel: rawUnitLabel,
    description,
    specs: rawSpecs,
    isActive,
    variants: echoedVariants,
  };

  if (Object.keys(errors).length > 0 || !category) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    input: {
      sku,
      name,
      category,
      brand: nullable(brand),
      unitLabel,
      description: nullable(description),
      isActive,
      specs,
      variants,
    },
  };
}
