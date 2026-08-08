/**
 * Parsing and validation for the certificate add/edit form.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared between the Server Actions and any client-side pre-checks — the same
 * split `lib/customers/form.ts` uses.
 */

// Relative, not `@/`: this module is unit tested, and the vitest config
// resolves no path alias — see the same import in `lib/activity/format.ts`.
import { parseQuoteDate } from "../quotations/dates";

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  id: "id",
  clientName: "clientName",
  projectTitle: "projectTitle",
  location: "location",
  completionDate: "completionDate",
  issueDate: "issueDate",
  issuePlace: "issuePlace",
  inspectedBy: "inspectedBy",
  acceptedBy: "acceptedBy",
  signatoryName: "signatoryName",
  signatoryTitle: "signatoryTitle",
} as const;

export type CertificateFormErrors = {
  clientName?: string;
  projectTitle?: string;
  location?: string;
  completionDate?: string;
  issueDate?: string;
  issuePlace?: string;
  inspectedBy?: string;
  acceptedBy?: string;
  signatoryName?: string;
  signatoryTitle?: string;
};

/** The editable half of a `certificates` row — everything but the reference. */
export type CertificateInput = {
  clientName: string;
  projectTitle: string;
  location: string;
  completionDate: string;
  issueDate: string;
  issuePlace: string;
  inspectedBy: string | null;
  acceptedBy: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
};

/** The trimmed fields exactly as submitted, for re-seeding a rejected form. */
export type CertificateFormValues = Record<keyof CertificateInput, string>;

export type CertificateFormState = {
  errors?: CertificateFormErrors;
  /** Set when the action failed for a reason unrelated to a single field. */
  formError?: string;
  /**
   * Echoed back so a rejected submit does not wipe what was typed. React resets
   * an uncontrolled form once its action settles, so the fields are re-seeded
   * from here rather than from the row loaded by the page.
   */
  values?: Partial<CertificateFormValues>;
};

export type ParseResult =
  | { ok: true; input: CertificateInput; values: CertificateFormValues }
  | { ok: false; errors: CertificateFormErrors; values: CertificateFormValues };

/*
 * Limits match the column types (all `text`, so this is about keeping a pasted
 * document out of the database rather than about fitting the column).
 */
const MAX_CLIENT_LENGTH = 200;
const MAX_PROJECT_LENGTH = 200;
const MAX_LOCATION_LENGTH = 200;
const MAX_PLACE_LENGTH = 160;
const MAX_PARTY_LENGTH = 200;
const MAX_SIGNATORY_LENGTH = 160;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards ids arriving from a form or a URL before they reach the database —
 * Postgres rejects a malformed uuid with an error rather than an empty result,
 * so checking here is what turns a bad id into a 404.
 */
export function isCertificateId(value: unknown): value is string {
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

/** `required` plus a length ceiling, the check five of these fields share. */
function checkRequired(
  value: string,
  label: string,
  max: number,
): string | undefined {
  if (!value) return `Enter the ${label}.`;
  if (value.length > max) return `Keep the ${label} under ${max} characters.`;
  return undefined;
}

function checkOptional(
  value: string,
  label: string,
  max: number,
): string | undefined {
  if (value.length > max) return `Keep the ${label} under ${max} characters.`;
  return undefined;
}

/**
 * Turns submitted form data into a `CertificateInput`.
 *
 * Six fields are required because the printed sentence is ungrammatical without
 * them — "completed the {project} at {client}, located at {location}, on
 * {date}" cannot have a hole in it. The four optional ones all have a printed
 * fallback (the client name, the company signatory), so a blank is a choice
 * rather than a gap.
 *
 * The two dates are deliberately *not* checked against each other. The sample
 * certificate this was built from is dated the 6th and certifies work completed
 * on the 7th; whether that is a typo or a deliberate back-dating is the issuer's
 * business, and refusing to store it would refuse to reproduce their own file.
 */
export function parseCertificateForm(form: FormData): ParseResult {
  const errors: CertificateFormErrors = {};

  const clientName = text(form, FIELD.clientName);
  const projectTitle = text(form, FIELD.projectTitle);
  const location = text(form, FIELD.location);
  const completionDate = text(form, FIELD.completionDate);
  const issueDate = text(form, FIELD.issueDate);
  const issuePlace = text(form, FIELD.issuePlace);
  const inspectedBy = text(form, FIELD.inspectedBy);
  const acceptedBy = text(form, FIELD.acceptedBy);
  const signatoryName = text(form, FIELD.signatoryName);
  const signatoryTitle = text(form, FIELD.signatoryTitle);

  errors.clientName = checkRequired(clientName, "client name", MAX_CLIENT_LENGTH);
  errors.projectTitle = checkRequired(projectTitle, "project", MAX_PROJECT_LENGTH);
  errors.location = checkRequired(location, "location", MAX_LOCATION_LENGTH);
  errors.issuePlace = checkRequired(issuePlace, "place of issue", MAX_PLACE_LENGTH);

  errors.inspectedBy = checkOptional(inspectedBy, "inspecting party", MAX_PARTY_LENGTH);
  errors.acceptedBy = checkOptional(acceptedBy, "accepting party", MAX_PARTY_LENGTH);
  errors.signatoryName = checkOptional(signatoryName, "signatory", MAX_SIGNATORY_LENGTH);
  errors.signatoryTitle = checkOptional(signatoryTitle, "signatory title", MAX_SIGNATORY_LENGTH);

  // Reused from quotations: same `YYYY-MM-DD` shape, same real-date check, and
  // the same 2000–2100 window that catches a mistyped year.
  const completion = parseQuoteDate(completionDate);
  if (!completion.ok) errors.completionDate = completion.error;

  const issue = parseQuoteDate(issueDate);
  if (!issue.ok) errors.issueDate = issue.error;

  const values: CertificateFormValues = {
    clientName,
    projectTitle,
    location,
    completionDate,
    issueDate,
    issuePlace,
    inspectedBy,
    acceptedBy,
    signatoryName,
    signatoryTitle,
  };

  // The helpers return `undefined` for "fine", so strip those before counting.
  for (const key of Object.keys(errors) as (keyof CertificateFormErrors)[]) {
    if (errors[key] === undefined) delete errors[key];
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    input: {
      clientName,
      projectTitle,
      location,
      // Safe: the guard above returns early unless both dates parsed.
      completionDate: completion.ok ? completion.date : completionDate,
      issueDate: issue.ok ? issue.date : issueDate,
      issuePlace,
      inspectedBy: nullable(inspectedBy),
      acceptedBy: nullable(acceptedBy),
      signatoryName: nullable(signatoryName),
      signatoryTitle: nullable(signatoryTitle),
    },
  };
}
