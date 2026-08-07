/**
 * Pure credential validation and error mapping for the sign-in form.
 *
 * Deliberately free of Next.js and Neon imports so it can be unit tested and
 * shared by both the server action and (if needed) client-side checks.
 */

export type SignInFieldErrors = {
  email?: string;
  password?: string;
};

export type SignInFormState = {
  /** Error shown above the form (bad credentials, service unreachable, …). */
  formError?: string;
  /** Per-field messages for shape problems we can detect before calling Neon. */
  fieldErrors?: SignInFieldErrors;
  /** Echoed back so a failed submit does not wipe what the user typed. */
  email?: string;
};

export type ValidatedCredentials = {
  email: string;
  password: string;
};

export type ValidationResult =
  | { ok: true; credentials: ValidatedCredentials }
  | { ok: false; fieldErrors: SignInFieldErrors };

/**
 * Permissive shape check: rejects obvious typos (missing `@`, no dot in the
 * domain, stray whitespace) without trying to out-guess RFC 5322.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** Guards against unbounded input being forwarded to the auth service. */
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 512;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Validates raw `FormData` values.
 *
 * Note we do NOT enforce password complexity here. On sign-in that would leak
 * the password policy and produce confusing errors for existing accounts —
 * complexity belongs to account creation. We only require a non-empty value.
 */
export function validateSignInInput(input: {
  email: unknown;
  password: unknown;
}): ValidationResult {
  const fieldErrors: SignInFieldErrors = {};

  const rawEmail = typeof input.email === "string" ? input.email : "";
  const rawPassword = typeof input.password === "string" ? input.password : "";

  const email = normalizeEmail(rawEmail);

  if (!email) {
    fieldErrors.email = "Enter your work email address.";
  } else if (email.length > MAX_EMAIL_LENGTH) {
    fieldErrors.email = "That email address is too long.";
  } else if (!EMAIL_SHAPE.test(email)) {
    fieldErrors.email = "That doesn't look like a valid email address.";
  }

  if (!rawPassword) {
    fieldErrors.password = "Enter your password.";
  } else if (rawPassword.length > MAX_PASSWORD_LENGTH) {
    fieldErrors.password = "That password is too long.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, credentials: { email, password: rawPassword } };
}

/** Transport failures reported by the Neon Auth SDK proxy. */
const NETWORK_ERROR_CODES = new Set([
  "NETWORK_DNS",
  "NETWORK_REFUSED",
  "NETWORK_TIMEOUT",
  "NETWORK_TLS",
  "NETWORK_RESET",
  "NETWORK_ABORT",
  "NETWORK_ERROR",
]);

/**
 * True when a code names a transport failure rather than a rejection.
 *
 * Exported so the other callers of the SDK — `lib/users/form.ts` maps the admin
 * endpoints' errors — can tell "we could not reach Neon" apart from "Neon said
 * no" without keeping a second copy of this list.
 */
export function isNetworkErrorCode(code: string | null | undefined): boolean {
  return NETWORK_ERROR_CODES.has(code ?? "");
}

export const INVALID_CREDENTIALS_MESSAGE =
  "Incorrect email or password. Please try again.";

export const SERVICE_UNAVAILABLE_MESSAGE =
  "We can't reach the sign-in service right now. Please try again in a moment.";

export const ACCOUNT_LOCKED_MESSAGE =
  "This account has been disabled. Contact your administrator.";

/**
 * Maps an SDK error onto a message that is safe to show a visitor.
 *
 * Credential problems always collapse to one generic string so the form never
 * reveals whether an email address is registered (account enumeration).
 */
export function describeSignInError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  const code = error?.code ?? "";

  if (isNetworkErrorCode(code)) {
    return SERVICE_UNAVAILABLE_MESSAGE;
  }

  if (code === "USER_BANNED" || code === "BANNED_USER") {
    return ACCOUNT_LOCKED_MESSAGE;
  }

  return INVALID_CREDENTIALS_MESSAGE;
}

/**
 * Restricts post-login redirects to same-origin absolute paths so a crafted
 * `?next=` cannot bounce a freshly authenticated user off to another host.
 */
export function safeRedirectPath(
  value: unknown,
  fallback = "/dashboard",
): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  // Must be a rooted path, and must not begin a scheme-relative URL (`//host`)
  // or a backslash variant that some browsers normalise to `//`.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  return value;
}
