/**
 * Parsing and validation for the quotation-type (preset) form.
 *
 * A "quotation type" is a `quotation_presets` row: the fixed combination of
 * layout, letter body, terms and exclusions that the builder's *Quotation type*
 * picker offers. Presets are copied into a quotation when it is raised, so
 * editing one never restates a quotation that has already gone out.
 *
 * Pure and free of Next.js / database imports so it can be unit tested.
 */

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  id: "id",
  slug: "slug",
  label: "label",
  template: "template",
  subjectTemplate: "subjectTemplate",
  salutation: "salutation",
  introParagraph: "introParagraph",
  closingParagraph: "closingParagraph",
  paymentTerms: "paymentTerms",
  deliveryTerms: "deliveryTerms",
  warrantyTerms: "warrantyTerms",
  mobilization: "mobilization",
  notes: "notes",
  validityDays: "validityDays",
  showBankDetails: "showBankDetails",
  isDefault: "isDefault",
  /** One exclusion per line. */
  exclusions: "exclusions",
} as const;

export const TEMPLATES = ["supply", "service_proposal"] as const;
export type Template = (typeof TEMPLATES)[number];

export const TEMPLATE_LABEL: Record<Template, string> = {
  supply: "Supply",
  service_proposal: "Service proposal",
};

export type PresetFormErrors = {
  slug?: string;
  label?: string;
  template?: string;
  subjectTemplate?: string;
  salutation?: string;
  introParagraph?: string;
  closingParagraph?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  mobilization?: string;
  notes?: string;
  validityDays?: string;
  exclusions?: string;
};

/** The editable half of a `quotation_presets` row. */
export type PresetInput = {
  slug: string;
  label: string;
  template: Template;
  subjectTemplate: string | null;
  salutation: string | null;
  introParagraph: string | null;
  closingParagraph: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warrantyTerms: string | null;
  mobilization: string | null;
  notes: string | null;
  validityDays: number;
  showBankDetails: boolean;
  isDefault: boolean;
  exclusions: string[];
};

/** Text fields echoed back verbatim; the two checkboxes are handled separately. */
export type PresetFormValues = Record<
  | "slug"
  | "label"
  | "template"
  | "subjectTemplate"
  | "salutation"
  | "introParagraph"
  | "closingParagraph"
  | "paymentTerms"
  | "deliveryTerms"
  | "warrantyTerms"
  | "mobilization"
  | "notes"
  | "validityDays"
  | "exclusions",
  string
> & { showBankDetails: boolean; isDefault: boolean };

export type PresetFormState = {
  errors?: PresetFormErrors;
  formError?: string;
  /** Echoed back so a rejected submit does not wipe what was typed. */
  values?: Partial<PresetFormValues>;
};

export type ParseResult =
  | { ok: true; input: PresetInput; values: PresetFormValues }
  | { ok: false; errors: PresetFormErrors; values: PresetFormValues };

const MAX_SLUG_LENGTH = 60;
const MAX_LABEL_LENGTH = 120;
const MAX_LINE_LENGTH = 400;
const MAX_PARAGRAPH_LENGTH = 2000;
const MAX_EXCLUSIONS = 30;

/** Lower-case words joined by single hyphens — what the seeded slugs look like. */
const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards ids from a form or URL before they reach Postgres as a uuid. */
export function isPresetId(value: unknown): value is string {
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

/**
 * Derives a slug from a label: "Brand new supply (COD)" → "brand-new-supply-cod".
 *
 * Exported so the form can offer it as you type — the slug is a stable key that
 * should not have to be composed by hand.
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/** Splits a textarea into lines, dropping blank ones. */
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function parsePresetForm(form: FormData): ParseResult {
  const errors: PresetFormErrors = {};

  const label = text(form, FIELD.label);
  const rawSlug = text(form, FIELD.slug);
  // A blank slug is filled from the label rather than rejected.
  const slug = rawSlug === "" ? slugify(label) : rawSlug.toLowerCase();
  const rawTemplate = text(form, FIELD.template);
  const subjectTemplate = text(form, FIELD.subjectTemplate);
  const salutation = text(form, FIELD.salutation);
  const introParagraph = text(form, FIELD.introParagraph);
  const closingParagraph = text(form, FIELD.closingParagraph);
  const paymentTerms = text(form, FIELD.paymentTerms);
  const deliveryTerms = text(form, FIELD.deliveryTerms);
  const warrantyTerms = text(form, FIELD.warrantyTerms);
  const mobilization = text(form, FIELD.mobilization);
  const notes = text(form, FIELD.notes);
  const rawValidity = text(form, FIELD.validityDays);
  const rawExclusions = text(form, FIELD.exclusions);
  const showBankDetails = checkbox(form, FIELD.showBankDetails);
  const isDefault = checkbox(form, FIELD.isDefault);

  if (!label) {
    errors.label = "Enter a name for this quotation type.";
  } else if (label.length > MAX_LABEL_LENGTH) {
    errors.label = `Keep the name under ${MAX_LABEL_LENGTH} characters.`;
  }

  if (!slug) {
    errors.slug = "Enter a slug, or a name it can be derived from.";
  } else if (slug.length > MAX_SLUG_LENGTH) {
    errors.slug = `Keep the slug under ${MAX_SLUG_LENGTH} characters.`;
  } else if (!SLUG_SHAPE.test(slug)) {
    errors.slug = "Use lower-case letters, numbers and single hyphens.";
  }

  const template = TEMPLATES.find((t) => t === rawTemplate);
  if (!template) {
    errors.template = "Choose a layout.";
  }

  let validityDays = 30;
  if (rawValidity !== "") {
    const parsed = Number(rawValidity);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      errors.validityDays = "Validity must be a whole number of days (1–365).";
    } else {
      validityDays = parsed;
    }
  }

  const exclusions = splitLines(rawExclusions);
  if (exclusions.length > MAX_EXCLUSIONS) {
    errors.exclusions = `At most ${MAX_EXCLUSIONS} exclusions.`;
  } else if (exclusions.some((line) => line.length > MAX_LINE_LENGTH)) {
    errors.exclusions = `Keep each exclusion under ${MAX_LINE_LENGTH} characters.`;
  }

  /* The long free-text fields, checked with one rule each. */
  const paragraphs: [keyof PresetFormErrors, string][] = [
    ["subjectTemplate", subjectTemplate],
    ["salutation", salutation],
    ["introParagraph", introParagraph],
    ["closingParagraph", closingParagraph],
    ["paymentTerms", paymentTerms],
    ["deliveryTerms", deliveryTerms],
    ["warrantyTerms", warrantyTerms],
    ["mobilization", mobilization],
    ["notes", notes],
  ];

  for (const [field, value] of paragraphs) {
    if (value.length > MAX_PARAGRAPH_LENGTH) {
      errors[field] = `Keep this under ${MAX_PARAGRAPH_LENGTH} characters.`;
    }
  }

  const values: PresetFormValues = {
    slug,
    label,
    template: rawTemplate,
    subjectTemplate,
    salutation,
    introParagraph,
    closingParagraph,
    paymentTerms,
    deliveryTerms,
    warrantyTerms,
    mobilization,
    notes,
    validityDays: rawValidity,
    exclusions: rawExclusions,
    showBankDetails,
    isDefault,
  };

  if (Object.keys(errors).length > 0 || !template) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    input: {
      slug,
      label,
      template,
      subjectTemplate: nullable(subjectTemplate),
      salutation: nullable(salutation),
      introParagraph: nullable(introParagraph),
      closingParagraph: nullable(closingParagraph),
      paymentTerms: nullable(paymentTerms),
      deliveryTerms: nullable(deliveryTerms),
      warrantyTerms: nullable(warrantyTerms),
      mobilization: nullable(mobilization),
      notes: nullable(notes),
      validityDays,
      showBankDetails,
      isDefault,
      exclusions,
    },
  };
}
