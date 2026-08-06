/**
 * Parsing and validation for the customer add/edit form.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared between the Server Actions and any client-side pre-checks — the same
 * split `lib/quotations/form.ts` uses.
 */

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  id: "id",
  name: "name",
  addressLine: "addressLine",
  cityProvince: "cityProvince",
  contactPerson: "contactPerson",
  contactEmail: "contactEmail",
  contactPhone: "contactPhone",
  notes: "notes",
} as const;

export type CustomerFormErrors = {
  name?: string;
  addressLine?: string;
  cityProvince?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
};

/** The editable half of a `customers` row. */
export type CustomerInput = {
  name: string;
  addressLine: string | null;
  cityProvince: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
};

/** The trimmed fields exactly as submitted, for re-seeding a rejected form. */
export type CustomerFormValues = Record<keyof CustomerInput, string>;

export type CustomerFormState = {
  errors?: CustomerFormErrors;
  /** Set when the action failed for a reason unrelated to a single field. */
  formError?: string;
  /**
   * Echoed back so a rejected submit does not wipe what was typed. React resets
   * an uncontrolled form once its action settles, so the fields are re-seeded
   * from here rather than from the row loaded by the page.
   */
  values?: Partial<CustomerFormValues>;
};

/**
 * `values` is present on both branches: a submission can also be rejected after
 * parsing succeeds — the row was deleted, the insert failed — and those paths
 * need the same echo.
 */
export type ParseResult =
  | { ok: true; input: CustomerInput; values: CustomerFormValues }
  | { ok: false; errors: CustomerFormErrors; values: CustomerFormValues };

/*
 * Limits match the column types (all `text`, so this is about keeping a pasted
 * document out of the database rather than about fitting the column).
 */
const MAX_NAME_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 300;
const MAX_CITY_LENGTH = 160;
const MAX_PERSON_LENGTH = 160;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 80;
const MAX_NOTES_LENGTH = 2000;

/** Same permissive shape check the sign-in form uses; see lib/auth/credentials.ts. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards ids arriving from a form or a URL before they reach the database —
 * Postgres rejects a malformed uuid with an error rather than an empty result,
 * so checking here is what turns a bad id into a 404.
 */
export function isCustomerId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Collapses a blank optional field to `null` so it reads as "not recorded". */
function nullable(value: string): string | null {
  return value === "" ? null : value;
}

/**
 * Turns submitted form data into a `CustomerInput`.
 *
 * Only `name` is required — the samples include customers with nothing but a
 * trading name, and refusing to save one of those would be worse than storing
 * an incomplete record.
 */
export function parseCustomerForm(form: FormData): ParseResult {
  const errors: CustomerFormErrors = {};

  const name = text(form, FIELD.name);
  const addressLine = text(form, FIELD.addressLine);
  const cityProvince = text(form, FIELD.cityProvince);
  const contactPerson = text(form, FIELD.contactPerson);
  const contactEmail = text(form, FIELD.contactEmail);
  const contactPhone = text(form, FIELD.contactPhone);
  const notes = text(form, FIELD.notes);

  if (!name) {
    errors.name = "Enter the customer name.";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  }

  if (addressLine.length > MAX_ADDRESS_LENGTH) {
    errors.addressLine = `Keep the address under ${MAX_ADDRESS_LENGTH} characters.`;
  }

  if (cityProvince.length > MAX_CITY_LENGTH) {
    errors.cityProvince = `Keep the city / province under ${MAX_CITY_LENGTH} characters.`;
  }

  if (contactPerson.length > MAX_PERSON_LENGTH) {
    errors.contactPerson = `Keep the contact person under ${MAX_PERSON_LENGTH} characters.`;
  }

  if (contactEmail !== "") {
    if (contactEmail.length > MAX_EMAIL_LENGTH) {
      errors.contactEmail = "That email address is too long.";
    } else if (!EMAIL_SHAPE.test(contactEmail)) {
      errors.contactEmail = "That doesn't look like a valid email address.";
    }
  }

  if (contactPhone.length > MAX_PHONE_LENGTH) {
    errors.contactPhone = `Keep the phone number under ${MAX_PHONE_LENGTH} characters.`;
  }

  if (notes.length > MAX_NOTES_LENGTH) {
    errors.notes = `Keep the notes under ${MAX_NOTES_LENGTH} characters.`;
  }

  const values: CustomerFormValues = {
    name,
    addressLine,
    cityProvince,
    contactPerson,
    contactEmail,
    contactPhone,
    notes,
  };

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    input: {
      name,
      addressLine: nullable(addressLine),
      cityProvince: nullable(cityProvince),
      contactPerson: nullable(contactPerson),
      // Stored lower-cased: it is an address to send to, not a display name.
      contactEmail: nullable(contactEmail.toLowerCase()),
      contactPhone: nullable(contactPhone),
      notes: nullable(notes),
    },
  };
}
