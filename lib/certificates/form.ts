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

/**
 * The two documents the dashboard issues. Mirrors the `certificate_kind` enum;
 * duplicated rather than imported because this module stays free of database
 * imports so it can be unit tested.
 */
export const CERTIFICATE_KINDS = ["completion", "safety_reliability"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

/** Mirrors `certificate_findings`; see the note on the enum for why it is two. */
export const CERTIFICATE_FINDINGS = ["none", "minor"] as const;
export type CertificateFindings = (typeof CERTIFICATE_FINDINGS)[number];

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  id: "id",
  kind: "kind",
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
  findings: "findings",
  engineerLicenseNo: "engineerLicenseNo",
  engineerLicenseExpiry: "engineerLicenseExpiry",
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
  engineerLicenseNo?: string;
  engineerLicenseExpiry?: string;
};

/** The editable half of a `certificates` row — everything but the reference. */
export type CertificateInput = {
  kind: CertificateKind;
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
  findings: CertificateFindings;
  engineerLicenseNo: string | null;
  engineerLicenseExpiry: string | null;
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
const MAX_LICENSE_LENGTH = 40;

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

/**
 * Guards the kind arriving from a form before it reaches an enum column.
 *
 * Anything unrecognised is read as a completion certificate rather than
 * rejected: the field is a radio group with a default, so a value that is not
 * one of the two means the submission was hand-made, and the safe reading of a
 * hand-made submission is the document that carries no professional licence.
 */
export function toCertificateKind(value: unknown): CertificateKind {
  return CERTIFICATE_KINDS.includes(value as CertificateKind)
    ? (value as CertificateKind)
    : "completion";
}

/** Same reasoning as `toCertificateKind`: an unknown value claims nothing. */
function toFindings(value: unknown): CertificateFindings {
  return CERTIFICATE_FINDINGS.includes(value as CertificateFindings)
    ? (value as CertificateFindings)
    : "none";
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
 * Six fields are required for both kinds, because the printed sentence is
 * ungrammatical without them — "completed the {project} at {client}, located at
 * {location}, on {date}" cannot have a hole in it, and neither can "the
 * {project} in above-mentioned establishment is functional and safe to
 * operate". Everything else has a printed fallback (the client name, the
 * company signatory) or a printed default (no findings), so a blank is a choice
 * rather than a gap.
 *
 * Fields the chosen kind does not print are nulled rather than stored: a
 * completion certificate keeps no licence number, and a safety certificate
 * keeps no accepting party. Switching kind is not possible after issue (the
 * reference already names the document), so nothing is silently discarded by
 * an edit.
 *
 * The two dates are deliberately *not* checked against each other. The sample
 * certificate this was built from is dated the 6th and certifies work completed
 * on the 7th; whether that is a typo or a deliberate back-dating is the issuer's
 * business, and refusing to store it would refuse to reproduce their own file.
 */
export function parseCertificateForm(form: FormData): ParseResult {
  const errors: CertificateFormErrors = {};

  const kind = toCertificateKind(form.get(FIELD.kind));
  const isSafety = kind === "safety_reliability";

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
  const findings = toFindings(form.get(FIELD.findings));
  const engineerLicenseNo = text(form, FIELD.engineerLicenseNo);
  const engineerLicenseExpiry = text(form, FIELD.engineerLicenseExpiry);

  errors.clientName = checkRequired(clientName, "client name", MAX_CLIENT_LENGTH);
  errors.projectTitle = checkRequired(projectTitle, "project", MAX_PROJECT_LENGTH);
  errors.location = checkRequired(location, "location", MAX_LOCATION_LENGTH);
  errors.issuePlace = checkRequired(issuePlace, "place of issue", MAX_PLACE_LENGTH);

  errors.inspectedBy = checkOptional(inspectedBy, "inspecting party", MAX_PARTY_LENGTH);
  errors.acceptedBy = checkOptional(acceptedBy, "accepting party", MAX_PARTY_LENGTH);
  errors.signatoryName = checkOptional(signatoryName, "signatory", MAX_SIGNATORY_LENGTH);
  errors.signatoryTitle = checkOptional(signatoryTitle, "signatory title", MAX_SIGNATORY_LENGTH);

  if (isSafety) {
    errors.engineerLicenseNo = checkOptional(
      engineerLicenseNo,
      "PRC registration number",
      MAX_LICENSE_LENGTH,
    );
  }

  // Reused from quotations: same `YYYY-MM-DD` shape, same real-date check, and
  // the same 2000–2100 window that catches a mistyped year.
  const completion = parseQuoteDate(completionDate);
  if (!completion.ok) errors.completionDate = completion.error;

  const issue = parseQuoteDate(issueDate);
  if (!issue.ok) errors.issueDate = issue.error;

  /*
   * The licence expiry is the one optional date, so a blank is not an error —
   * but a *typed* one still has to be a real day, or the printed "Validity
   * Date" line would carry a date that does not exist.
   */
  const expiry =
    isSafety && engineerLicenseExpiry
      ? parseQuoteDate(engineerLicenseExpiry)
      : null;
  if (expiry && !expiry.ok) errors.engineerLicenseExpiry = expiry.error;

  const values: CertificateFormValues = {
    kind,
    findings,
    engineerLicenseNo,
    engineerLicenseExpiry,
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
      kind,
      clientName,
      projectTitle,
      location,
      // Safe: the guard above returns early unless both dates parsed.
      completionDate: completion.ok ? completion.date : completionDate,
      issueDate: issue.ok ? issue.date : issueDate,
      issuePlace,
      // The two parties are printed by the completion certificate only.
      inspectedBy: isSafety ? null : nullable(inspectedBy),
      acceptedBy: isSafety ? null : nullable(acceptedBy),
      signatoryName: nullable(signatoryName),
      signatoryTitle: nullable(signatoryTitle),
      // …and these three by the safety certificate only.
      findings: isSafety ? findings : "none",
      engineerLicenseNo: isSafety ? nullable(engineerLicenseNo) : null,
      engineerLicenseExpiry:
        expiry?.ok === true ? expiry.date : null,
    },
  };
}
