/**
 * Parsing and validation for the edit-quotation form.
 *
 * Editing is not creating with different defaults. A new quotation is assembled
 * from a preset plus overrides; a stored one already has concrete wording, so the
 * editor writes concrete values and there is no preset in the picture.
 *
 * The other difference is the line items. A stored line carries a snapshot of
 * what was quoted — name, description, specs, unit price — and that snapshot is
 * what the client agreed to, so an unchanged line is identified by its id and
 * kept as-is. Only genuinely new lines are priced from today's catalogue.
 *
 * Pure and free of Next.js / database imports so it can be unit tested.
 */

import { isRealDate } from "./dates";
import { decodeVariant, FIELD, isQuotationId } from "./form";
import type { QuotationItemInput } from "./service";

export const TEMPLATES = ["supply", "service_proposal"] as const;
export type Template = (typeof TEMPLATES)[number];

/** Fields the editor has and the builder does not. */
export const EDIT_FIELD = {
  id: "id",
  template: "template",
  salutation: "salutation",
  introParagraph: "introParagraph",
  closingParagraph: "closingParagraph",
  showBankDetails: "showBankDetails",
  /** One exclusion per line. */
  exclusions: "exclusions",
} as const;

/** A line the quotation already has, kept at the price it was quoted at. */
export type KeptLine = {
  kind: "kept";
  id: string;
  quantity: string;
  sectionTitle: string | null;
};

/** A line added during this edit, priced from the catalogue. */
export type AddedLine = { kind: "added" } & QuotationItemInput;

export type EditLine = KeptLine | AddedLine;

export type UpdateQuotationInput = {
  customerId: string;
  template: Template;
  subject: string;
  quoteDate: string;
  attentionTo: string | null;
  salutation: string;
  introParagraph: string | null;
  closingParagraph: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warrantyTerms: string | null;
  mobilization: string | null;
  notes: string | null;
  validityDays: number;
  showBankDetails: boolean;
  exclusions: string[];
  /** In document order; positions are assigned from this order. */
  lines: EditLine[];
};

export type QuotationEditErrors = {
  customerId?: string;
  template?: string;
  subject?: string;
  quoteDate?: string;
  salutation?: string;
  validityDays?: string;
  exclusions?: string;
  items?: string;
  /** Per-line messages, keyed by the visible line number (1-based). */
  lines?: Record<number, string>;
};

export type QuotationEditState = {
  errors?: QuotationEditErrors;
  formError?: string;
};

export type ParseResult =
  | { ok: true; input: UpdateQuotationInput }
  | { ok: false; errors: QuotationEditErrors };

const MAX_SUBJECT_LENGTH = 500;
const MAX_PARAGRAPH_LENGTH = 2000;
const MAX_QUANTITY = 100_000;
const MAX_LINES = 60;
const MAX_EXCLUSIONS = 30;
const MAX_EXCLUSION_LENGTH = 400;
const DEFAULT_SALUTATION = "Dear Sir/Ma'am,";

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string): string | null {
  return value === "" ? null : value;
}

/** An unchecked box is absent from the submission entirely. */
function checkbox(form: FormData, name: string): boolean {
  return form.get(name) !== null;
}

function nth(values: FormDataEntryValue[], index: number): string {
  const value = values[index];
  return typeof value === "string" ? value.trim() : "";
}

export function splitExclusions(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function parseQuotationEditForm(form: FormData): ParseResult {
  const errors: QuotationEditErrors = {};
  const lineErrors: Record<number, string> = {};

  const customerId = text(form, FIELD.customerId);
  if (!customerId) {
    errors.customerId = "Choose a customer.";
  } else if (!isQuotationId(customerId)) {
    errors.customerId = "That customer is not valid.";
  }

  const rawTemplate = text(form, EDIT_FIELD.template);
  const template = TEMPLATES.find((t) => t === rawTemplate);
  if (!template) errors.template = "Choose a layout.";

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

  const salutation = text(form, EDIT_FIELD.salutation);
  if (salutation.length > MAX_PARAGRAPH_LENGTH) {
    errors.salutation = `Keep this under ${MAX_PARAGRAPH_LENGTH} characters.`;
  }

  const validityRaw = text(form, FIELD.validityDays);
  let validityDays = 30;
  if (validityRaw !== "") {
    const parsed = Number(validityRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      errors.validityDays = "Validity must be a whole number of days (1–365).";
    } else {
      validityDays = parsed;
    }
  }

  const exclusions = splitExclusions(text(form, EDIT_FIELD.exclusions));
  if (exclusions.length > MAX_EXCLUSIONS) {
    errors.exclusions = `At most ${MAX_EXCLUSIONS} exclusions.`;
  } else if (exclusions.some((line) => line.length > MAX_EXCLUSION_LENGTH)) {
    errors.exclusions = `Keep each exclusion under ${MAX_EXCLUSION_LENGTH} characters.`;
  }

  /* Line items — four parallel repeated fields, in document order. */
  const ids = form.getAll(FIELD.itemId);
  const variants = form.getAll(FIELD.itemVariant);
  const quantities = form.getAll(FIELD.itemQuantity);
  const sections = form.getAll(FIELD.itemSection);

  const rowCount = Math.max(ids.length, variants.length, quantities.length);

  if (rowCount > MAX_LINES) {
    errors.items = `A quotation can hold at most ${MAX_LINES} lines.`;
  }

  const lines: EditLine[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rowCount; i += 1) {
    const rawId = nth(ids, i);
    const rawVariant = nth(variants, i);
    const rawQuantity = nth(quantities, i);
    const rawSection = nth(sections, i);

    // Blank row: nothing stored, nothing chosen, nothing typed.
    if (rawId === "" && rawVariant === "" && rawQuantity === "") continue;

    const lineNo = i + 1;
    const sectionTitle = rawSection === "" ? null : rawSection;

    const quantityError = checkQuantity(rawQuantity);
    if (quantityError) {
      lineErrors[lineNo] = quantityError;
      continue;
    }

    if (rawId !== "") {
      if (!isQuotationId(rawId)) {
        lineErrors[lineNo] = "That line is no longer valid. Re-select the item.";
        continue;
      }

      // A repeated id would make two rows fight over one stored line.
      if (seenIds.has(rawId)) {
        lineErrors[lineNo] = "This line is already on the quotation.";
        continue;
      }
      seenIds.add(rawId);

      lines.push({ kind: "kept", id: rawId, quantity: rawQuantity, sectionTitle });
      continue;
    }

    if (rawVariant === "") {
      lineErrors[lineNo] = "Choose an item, or clear the quantity.";
      continue;
    }

    const variant = decodeVariant(rawVariant);
    if (!variant) {
      lineErrors[lineNo] = "That item is no longer valid. Re-select it.";
      continue;
    }

    lines.push({
      kind: "added",
      productId: variant.productId,
      serviceKind: variant.serviceKind,
      capacityLabel: variant.capacityLabel,
      quantity: rawQuantity,
      sectionTitle,
    });
  }

  if (lines.length === 0 && Object.keys(lineErrors).length === 0) {
    errors.items = "A quotation needs at least one item.";
  }

  if (Object.keys(lineErrors).length > 0) errors.lines = lineErrors;

  if (Object.keys(errors).length > 0 || !template) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    input: {
      customerId,
      template,
      subject,
      quoteDate,
      attentionTo: nullable(text(form, FIELD.attentionTo)),
      // The letterhead reads oddly without one, so a blank falls back.
      salutation: salutation === "" ? DEFAULT_SALUTATION : salutation,
      introParagraph: nullable(text(form, EDIT_FIELD.introParagraph)),
      closingParagraph: nullable(text(form, EDIT_FIELD.closingParagraph)),
      paymentTerms: nullable(text(form, FIELD.paymentTerms)),
      deliveryTerms: nullable(text(form, FIELD.deliveryTerms)),
      warrantyTerms: nullable(text(form, FIELD.warrantyTerms)),
      mobilization: nullable(text(form, FIELD.mobilization)),
      notes: nullable(text(form, FIELD.notes)),
      validityDays,
      showBankDetails: checkbox(form, EDIT_FIELD.showBankDetails),
      exclusions,
      lines,
    },
  };
}

/** Shared by both kinds of line; returns a message, or "" when the quantity is fine. */
function checkQuantity(raw: string): string {
  if (raw === "") return "Enter a quantity.";

  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be greater than zero.";
  }
  if (quantity > MAX_QUANTITY) return `Quantity must be ${MAX_QUANTITY} or less.`;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return "Quantity allows at most two decimal places.";
  }

  return "";
}
