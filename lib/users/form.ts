/**
 * Parsing and validation for the staff account add/edit form.
 *
 * Pure and free of Next.js / Neon imports so it can be unit tested and shared
 * between the Server Actions and any client-side pre-checks — the same split
 * `lib/customers/form.ts` uses.
 *
 * Accounts live in Neon Auth, not in our own tables, so this module validates
 * what we are about to *send* to the auth server rather than a row we own.
 */

import {
  isNetworkErrorCode,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "../auth/credentials";

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  id: "id",
  name: "name",
  email: "email",
  password: "password",
  role: "role",
} as const;

/**
 * The two roles Better Auth's admin plugin ships with. `admin` is what its
 * endpoints check for, so this is an authorisation level and not a job title:
 * an admin may add, edit, disable and delete accounts, including this one.
 */
export const ROLES = ["user", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  user: "Staff",
  admin: "Administrator",
};

/** What each role may do, for the hint under the picker. */
export const ROLE_HINT: Record<Role, string> = {
  user: "Raises quotations and maintains the catalogue",
  admin: "Also adds, disables and deletes accounts",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type UserFormErrors = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
};

/** What we send to the auth server. `password` is null when it is unchanged. */
export type UserInput = {
  name: string;
  email: string;
  role: Role;
  password: string | null;
};

/**
 * The trimmed fields exactly as submitted, for re-seeding a rejected form.
 *
 * Deliberately excludes the password: echoing it back would write a plaintext
 * credential into the HTML of the re-rendered page and into the Server Action's
 * response payload. A rejected submit asks for it again instead.
 */
export type UserFormValues = {
  name: string;
  email: string;
  role: string;
};

export type UserFormState = {
  errors?: UserFormErrors;
  /** Set when the action failed for a reason unrelated to a single field. */
  formError?: string;
  /**
   * Echoed back so a rejected submit does not wipe what was typed. React resets
   * an uncontrolled form once its action settles, so the fields are re-seeded
   * from here rather than from the account loaded by the page.
   */
  values?: Partial<UserFormValues>;
};

export type ParseResult =
  | { ok: true; input: UserInput; values: UserFormValues }
  | { ok: false; errors: UserFormErrors; values: UserFormValues };

/**
 * Adding an account sets its first password; editing leaves the field blank to
 * keep the current one, so the same parser serves both with different rules.
 */
export type UserFormMode = "create" | "edit";

const MAX_NAME_LENGTH = 160;
const MAX_EMAIL_LENGTH = 254;

/**
 * Better Auth's own minimum, which `scripts/create-user.mjs` also states.
 *
 * Worth enforcing here rather than leaning on the auth server: `sign-up/email`
 * rejects a short password with `PASSWORD_TOO_SHORT`, but `admin/create-user`
 * — the endpoint this form drives — accepts one. Without this check an
 * administrator could quietly issue a one-character password.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Matches the cap the sign-in form applies before calling Neon. */
const MAX_PASSWORD_LENGTH = 512;

/** Same permissive shape check the sign-in form uses; see lib/auth/credentials.ts. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards ids arriving from a form or a URL before they are sent upstream.
 * `neon_auth.user.id` is a uuid, so anything else cannot name an account and is
 * turned into a 404 rather than a request the auth server has to reject.
 */
export function isUserId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Turns submitted form data into a `UserInput`.
 *
 * A name is required, unlike on a customer: `admin/create-user` requires one,
 * and an account with no name shows up as a bare email address everywhere it is
 * listed.
 */
export function parseUserForm(form: FormData, mode: UserFormMode): ParseResult {
  const errors: UserFormErrors = {};

  const name = text(form, FIELD.name);
  const email = text(form, FIELD.email).toLowerCase();
  const role = text(form, FIELD.role);

  /*
   * Not trimmed, and not length-capped at the top: a password is a secret, not a
   * label. Trimming it would silently sign the account up with something other
   * than what was typed.
   */
  const rawPassword = form.get(FIELD.password);
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!name) {
    errors.name = "Enter the person's name.";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  }

  if (!email) {
    errors.email = "Enter their work email address.";
  } else if (email.length > MAX_EMAIL_LENGTH) {
    errors.email = "That email address is too long.";
  } else if (!EMAIL_SHAPE.test(email)) {
    errors.email = "That doesn't look like a valid email address.";
  }

  if (!isRole(role)) {
    // Only reachable by hand-crafting the POST — the form renders a select.
    errors.role = "Choose a role.";
  }

  if (mode === "create" && !password) {
    errors.password = "Set a first password.";
  } else if (password !== "") {
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (password.length > MAX_PASSWORD_LENGTH) {
      errors.password = "That password is too long.";
    }
  }

  const values: UserFormValues = { name, email, role };

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    input: {
      name,
      // Stored lower-cased: it is the identifier they sign in with.
      email,
      role: role as Role,
      // Blank on an edit means "leave the current password alone".
      password: password === "" ? null : password,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Error mapping                                                              */
/* -------------------------------------------------------------------------- */

export type AdminApiError = {
  code?: string | null;
  message?: string | null;
} | null;

/** Which field, if any, an upstream rejection belongs against. */
export type MappedAdminError = {
  field?: keyof UserFormErrors;
  message: string;
};

export const GENERIC_ADMIN_ERROR =
  "Could not save the account. Please try again.";

const NOT_ALLOWED_MESSAGE =
  "Your account is no longer allowed to manage users. Sign in again.";

/**
 * Maps a Neon Auth admin error onto a message worth showing an administrator.
 *
 * Unlike `describeSignInError`, this deliberately does *not* collapse everything
 * into one generic string: the audience is a colleague administering accounts
 * they already know exist, so "that address is already taken" is useful rather
 * than an enumeration leak.
 *
 * The codes matched here are the *SDK's* normalised set (`validation_failed`,
 * `weak_password`, …), not Better Auth's raw ones (`PASSWORD_TOO_SHORT`,
 * `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, …). `@neondatabase/auth` rewrites the
 * upstream code through its own `AuthErrorCode` table and, for anything not in
 * that table, falls back to one derived from the HTTP status — so matching the
 * raw codes silently never fires. Verified against the running service; see
 * `normalizeBetterAuthError` in the SDK if these ever stop matching.
 *
 * `validation_failed` is where a 400 with no recognised code lands, so it covers
 * several unrelated refusals at once and the message is the only thing that
 * separates them. Matching on prose is unpleasant but it is what distinguishes
 * "that address is taken" from "you cannot ban yourself", and an unrecognised
 * message still degrades to the generic string.
 */
export function describeAdminUserError(error: AdminApiError): MappedAdminError {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (isNetworkErrorCode(code)) {
    return { message: SERVICE_UNAVAILABLE_MESSAGE };
  }

  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return {
        field: "email",
        message: "That email address already has an account.",
      };

    case "email_address_invalid":
      return {
        field: "email",
        message: "That doesn't look like a valid email address.",
      };

    /*
     * The upstream text is "Password does not meet security requirements",
     * which does not say what to do about it. Ours states the rule.
     */
    case "weak_password":
      return {
        field: "password",
        message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      };

    case "user_not_found":
      return { message: "That account no longer exists." };

    /*
     * What a 403 becomes. Either the caller lost the `admin` role between
     * opening the page and submitting, or the request reached the auth server
     * without an Origin it trusts.
     */
    case "feature_not_supported":
      return /not allowed/i.test(message)
        ? { message: NOT_ALLOWED_MESSAGE }
        : { message: GENERIC_ADMIN_ERROR };

    case "validation_failed":
      if (/already exists/i.test(message)) {
        return {
          field: "email",
          message: "That email address already has an account.",
        };
      }

      if (/ban yourself/i.test(message)) {
        return { message: "You cannot disable your own account." };
      }

      if (/not allowed/i.test(message)) {
        return { message: NOT_ALLOWED_MESSAGE };
      }

      return { message: GENERIC_ADMIN_ERROR };

    default:
      return { message: GENERIC_ADMIN_ERROR };
  }
}
