/**
 * Parsing and validation for the new-quotation form.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared between the Server Action and any client-side pre-checks.
 */

import type { CreateQuotationInput, QuotationItemInput } from "./service";

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  customerId: "customerId",
  presetSlug: "presetSlug",
  subject: "subject",
  quoteDate: "quoteDate",
  attentionTo: "attentionTo",
  validityDays: "validityDays",
  paymentTerms: "paymentTerms",
  deliveryTerms: "deliveryTerms",
  warrantyTerms: "warrantyTerms",
  mobilization: "mobilization",
  notes: "notes",
  /** Repeated once per line, in document order. */
  itemVariant: "item.variant",
  itemQuantity: "item.quantity",
  itemSection: "item.section",
} as const;

export type QuotationFormErrors = {
  customerId?: string;
  presetSlug?: string;
  subject?: string;
  quoteDate?: string;
  validityDays?: string;
  items?: string;
  /** Per-line messages, keyed by the visible line number (1-based). */
  lines?: Record<number, string>;
};

export type QuotationFormState = {
  errors?: QuotationFormErrors;
  /** Set when the action failed for a reason unrelated to a single field. */
  formError?: string;
};

export type ParseResult =
  | { ok: true; input: CreateQuotationInput }
  | { ok: false; errors: QuotationFormErrors };

/** Separator for the composite price-variant option value. */
const VARIANT_SEPARATOR = "::";

const MAX_SUBJECT_LENGTH = 500;
const MAX_QUANTITY = 100_000;
const MAX_LINES = 60;

/**
 * A price is identified by (product, service kind, capacity) rather than by a
 * price row id, so a variant selected in the browser still resolves correctly
 * if the price list is edited between rendering the form and submitting it.
 */
export function encodeVariant(
  productId: string,
  serviceKind: string,
  capacityLabel: string,
): string {
  return [productId, serviceKind, capacityLabel].join(VARIANT_SEPARATOR);
}

export function decodeVariant(value: string): {
  productId: string;
  serviceKind: QuotationItemInput["serviceKind"];
  capacityLabel: string;
} | null {
  const parts = value.split(VARIANT_SEPARATOR);
  if (parts.length !== 3) return null;

  const [productId, serviceKind, capacityLabel] = parts;
  if (!UUID.test(productId)) return null;
  if (serviceKind !== "new" && serviceKind !== "refill" && serviceKind !== "maintenance") {
    return null;
  }

  return { productId, serviceKind, capacityLabel };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(form: FormData, name: string): string | undefined {
  const value = text(form, name);
  return value === "" ? undefined : value;
}

/**
 * Turns submitted form data into a `CreateQuotationInput`.
 *
 * Lines arrive as three parallel repeated fields, which `FormData.getAll`
 * returns in document order. Rows with no variant chosen are skipped rather
 * than rejected — the builder always keeps a blank row at the bottom.
 */
export function parseQuotationForm(form: FormData): ParseResult {
  const errors: QuotationFormErrors = {};
  const lineErrors: Record<number, string> = {};

  const customerId = text(form, FIELD.customerId);
  if (!customerId) {
    errors.customerId = "Choose a customer.";
  } else if (!UUID.test(customerId)) {
    errors.customerId = "That customer is not valid.";
  }

  const subject = text(form, FIELD.subject);
  if (!subject) {
    errors.subject = "Enter a subject for the quotation.";
  } else if (subject.length > MAX_SUBJECT_LENGTH) {
    errors.subject = `Keep the subject under ${MAX_SUBJECT_LENGTH} characters.`;
  }

  const quoteDate = text(form, FIELD.quoteDate);
  if (!quoteDate) {
    errors.quoteDate = "Choose a date.";
  } else if (!isRealDate(quoteDate)) {
    errors.quoteDate = "Enter a real date (YYYY-MM-DD).";
  }

  const validityRaw = text(form, FIELD.validityDays);
  let validityDays: number | undefined;
  if (validityRaw !== "") {
    const parsed = Number(validityRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      errors.validityDays = "Validity must be a whole number of days (1–365).";
    } else {
      validityDays = parsed;
    }
  }

  /* Line items */
  const variants = form.getAll(FIELD.itemVariant);
  const quantities = form.getAll(FIELD.itemQuantity);
  const sections = form.getAll(FIELD.itemSection);

  if (variants.length > MAX_LINES) {
    errors.items = `A quotation can hold at most ${MAX_LINES} lines.`;
  }

  const items: QuotationItemInput[] = [];

  for (let i = 0; i < variants.length; i += 1) {
    const rawVariant = typeof variants[i] === "string" ? (variants[i] as string) : "";
    const rawQuantity =
      typeof quantities[i] === "string" ? (quantities[i] as string).trim() : "";
    const rawSection =
      typeof sections[i] === "string" ? (sections[i] as string).trim() : "";

    // Blank row: nothing chosen and nothing typed.
    if (rawVariant === "" && rawQuantity === "") continue;

    const lineNo = i + 1;

    if (rawVariant === "") {
      lineErrors[lineNo] = "Choose an item, or clear the quantity.";
      continue;
    }

    const variant = decodeVariant(rawVariant);
    if (!variant) {
      lineErrors[lineNo] = "That item is no longer valid. Re-select it.";
      continue;
    }

    if (rawQuantity === "") {
      lineErrors[lineNo] = "Enter a quantity.";
      continue;
    }

    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      lineErrors[lineNo] = "Quantity must be greater than zero.";
      continue;
    }
    if (quantity > MAX_QUANTITY) {
      lineErrors[lineNo] = `Quantity must be ${MAX_QUANTITY} or less.`;
      continue;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(rawQuantity)) {
      lineErrors[lineNo] = "Quantity allows at most two decimal places.";
      continue;
    }

    items.push({
      productId: variant.productId,
      serviceKind: variant.serviceKind,
      capacityLabel: variant.capacityLabel,
      quantity: rawQuantity,
      sectionTitle: rawSection === "" ? null : rawSection,
    });
  }

  if (items.length === 0 && Object.keys(lineErrors).length === 0) {
    errors.items = "Add at least one item.";
  }

  if (Object.keys(lineErrors).length > 0) {
    errors.lines = lineErrors;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const overrides = {
    paymentTerms: optionalText(form, FIELD.paymentTerms),
    deliveryTerms: optionalText(form, FIELD.deliveryTerms),
    warrantyTerms: optionalText(form, FIELD.warrantyTerms),
    mobilization: optionalText(form, FIELD.mobilization),
    notes: optionalText(form, FIELD.notes),
    validityDays,
  };

  // Drop undefined keys so the preset's values are not overwritten with blanks.
  const cleanOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined),
  ) as CreateQuotationInput["overrides"];

  return {
    ok: true,
    input: {
      customerId,
      presetSlug: optionalText(form, FIELD.presetSlug),
      subject,
      quoteDate,
      attentionTo: optionalText(form, FIELD.attentionTo) ?? null,
      items,
      ...(cleanOverrides && Object.keys(cleanOverrides).length > 0
        ? { overrides: cleanOverrides }
        : {}),
    },
  };
}

/**
 * Suggests the grouping header the samples print above an item, e.g.
 * "REFILLING AND SERVICING OF FIRE EXTINGUISHER". Only a suggestion — the
 * builder lets it be edited or cleared.
 */
export function suggestSectionTitle(
  serviceKind: string,
  category: string,
  productName: string,
): string {
  if (serviceKind === "refill") {
    return category === "fire_extinguisher"
      ? "REFILLING AND SERVICING OF FIRE EXTINGUISHER"
      : `REFILLING AND SERVICING OF ${productName.toUpperCase()}`;
  }

  if (serviceKind === "maintenance") return "";

  return category === "fire_extinguisher"
    ? "BRANDNEW OF FIRE EXTINGUISHER"
    : `BRAND NEW ${productName.toUpperCase()}`;
}
