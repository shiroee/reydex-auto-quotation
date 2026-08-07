import { describe, expect, it } from "vitest";

import { SERVICE_UNAVAILABLE_MESSAGE } from "../auth/credentials";

import {
  describeAdminUserError,
  FIELD,
  isRole,
  isUserId,
  MIN_PASSWORD_LENGTH,
  parseUserForm,
} from "./form";

/** Builds a valid submission; every field is overridable. */
function build(fields: Record<string, string> = {}): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.name]: "Juan Dela Cruz",
    [FIELD.email]: "juan@reydex.com",
    [FIELD.role]: "user",
    [FIELD.password]: "correct-horse-battery",
    ...fields,
  };

  for (const [key, value] of Object.entries(base)) {
    form.set(key, value);
  }

  return form;
}

describe("isUserId", () => {
  it("accepts a uuid in either case", () => {
    expect(isUserId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUserId("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")).toBe(true);
  });

  it("rejects anything else, so it never reaches the auth server", () => {
    expect(isUserId("")).toBe(false);
    expect(isUserId("not-a-uuid")).toBe(false);
    expect(isUserId("11111111-1111-4111-8111-11111111111")).toBe(false);
    expect(isUserId(null)).toBe(false);
    expect(isUserId(undefined)).toBe(false);
    expect(isUserId(42)).toBe(false);
  });
});

describe("isRole", () => {
  it("accepts the two roles the admin plugin ships with", () => {
    expect(isRole("user")).toBe(true);
    expect(isRole("admin")).toBe(true);
  });

  it("rejects invented roles", () => {
    expect(isRole("owner")).toBe(false);
    expect(isRole("Admin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe("parseUserForm", () => {
  it("accepts a complete new account", () => {
    const parsed = parseUserForm(build(), "create");

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input).toEqual({
      name: "Juan Dela Cruz",
      email: "juan@reydex.com",
      role: "user",
      password: "correct-horse-battery",
    });
  });

  it("lower-cases and trims the email — it is the sign-in identifier", () => {
    const parsed = parseUserForm(
      build({ [FIELD.email]: "  Juan@Reydex.COM  " }),
      "create",
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.email).toBe("juan@reydex.com");
  });

  it("trims the name but never the password", () => {
    const parsed = parseUserForm(
      build({ [FIELD.name]: "  Juan  ", [FIELD.password]: "  spaced  " }),
      "create",
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.name).toBe("Juan");
    // Trimming would sign the account up with something other than what was typed.
    expect(parsed.input.password).toBe("  spaced  ");
  });

  it("requires a name and an email", () => {
    for (const field of [FIELD.name, FIELD.email] as const) {
      const parsed = parseUserForm(build({ [field]: "   " }), "create");

      expect(parsed.ok, field).toBe(false);
      if (parsed.ok) return;

      expect(Object.keys(parsed.errors), field).toContain(field);
    }
  });

  it("rejects an email that cannot be one, and accepts one that can", () => {
    for (const email of ["nope", "a@b", "two@@example.com", "sp ace@x.com"]) {
      const parsed = parseUserForm(build({ [FIELD.email]: email }), "create");

      expect(parsed.ok, email).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.email, email).toBeDefined();
    }

    expect(
      parseUserForm(build({ [FIELD.email]: "a.b@sub.example.ph" }), "create").ok,
    ).toBe(true);
  });

  it("requires a first password when adding", () => {
    const parsed = parseUserForm(build({ [FIELD.password]: "" }), "create");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.password).toBeDefined();
  });

  it("treats a blank password on an edit as “leave it alone”", () => {
    const parsed = parseUserForm(build({ [FIELD.password]: "" }), "edit");

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.password).toBeNull();
  });

  /*
   * The reason this check exists at all: admin/create-user accepts a
   * one-character password where sign-up/email refuses it, so the floor is ours
   * to hold.
   */
  it("enforces the minimum length on both modes", () => {
    for (const mode of ["create", "edit"] as const) {
      const parsed = parseUserForm(
        build({ [FIELD.password]: "a".repeat(MIN_PASSWORD_LENGTH - 1) }),
        mode,
      );

      expect(parsed.ok, mode).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.password, mode).toBeDefined();
    }

    expect(
      parseUserForm(
        build({ [FIELD.password]: "a".repeat(MIN_PASSWORD_LENGTH) }),
        "create",
      ).ok,
    ).toBe(true);
  });

  it("rejects an over-long password rather than forwarding it", () => {
    const parsed = parseUserForm(
      build({ [FIELD.password]: "a".repeat(513) }),
      "create",
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.password).toBe("That password is too long.");
  });

  it("caps the name and the email", () => {
    const long = (n: number) => "a".repeat(n);

    const name = parseUserForm(build({ [FIELD.name]: long(161) }), "create");
    expect(name.ok).toBe(false);
    if (name.ok) return;
    expect(name.errors.name).toBeDefined();

    const email = parseUserForm(
      build({ [FIELD.email]: `${long(250)}@example.com` }),
      "create",
    );
    expect(email.ok).toBe(false);
    if (email.ok) return;
    expect(email.errors.email).toBe("That email address is too long.");
  });

  it("rejects a role it does not issue", () => {
    for (const role of ["", "owner", "ADMIN"]) {
      const parsed = parseUserForm(build({ [FIELD.role]: role }), "create");

      expect(parsed.ok, role).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.role, role).toBeDefined();
    }
  });

  it("treats a missing field as blank rather than throwing", () => {
    // A hand-crafted POST need not include every input the form renders.
    const parsed = parseUserForm(new FormData(), "create");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.name).toBeDefined();
    expect(parsed.errors.email).toBeDefined();
    expect(parsed.errors.role).toBeDefined();
    expect(parsed.errors.password).toBeDefined();
  });

  it("echoes the submitted values back, but never the password", () => {
    const parsed = parseUserForm(
      build({ [FIELD.email]: "broken", [FIELD.name]: "Ana Reyes" }),
      "create",
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.values).toEqual({
      name: "Ana Reyes",
      email: "broken",
      role: "user",
    });
    // A plaintext credential must not travel back into the re-rendered page.
    expect(Object.keys(parsed.values)).not.toContain("password");
  });
});

/*
 * The payloads below are what `@neondatabase/auth` actually hands back, captured
 * from the running service. The SDK rewrites Better Auth's codes through its own
 * table, so a test built on the upstream names (`PASSWORD_TOO_SHORT`, …) would
 * pass against a mapping that never fires in production.
 */
describe("describeAdminUserError", () => {
  it("puts a duplicate address against the email field", () => {
    // A 400 whose code the SDK does not recognise, so only the message says why.
    const mapped = describeAdminUserError({
      code: "validation_failed",
      message: "User already exists. Use another email.",
    });

    expect(mapped.field).toBe("email");
    expect(mapped.message).toMatch(/already has an account/i);
  });

  it("also handles a duplicate reported as its own code", () => {
    for (const code of ["user_already_exists", "email_exists"]) {
      expect(describeAdminUserError({ code }).field, code).toBe("email");
    }
  });

  it("states the password rule rather than the upstream platitude", () => {
    const mapped = describeAdminUserError({
      code: "weak_password",
      message: "Password does not meet security requirements",
    });

    expect(mapped.field).toBe("password");
    expect(mapped.message).toMatch(/at least 8 characters/i);
  });

  it("puts a malformed address against the email field", () => {
    const mapped = describeAdminUserError({
      code: "email_address_invalid",
      message: "Invalid email address format",
    });

    expect(mapped.field).toBe("email");
    expect(mapped.message).toMatch(/valid email address/i);
  });

  it("explains the self-ban refusal in the app's own words", () => {
    const mapped = describeAdminUserError({
      code: "validation_failed",
      message: "You cannot ban yourself",
    });

    expect(mapped.field).toBeUndefined();
    expect(mapped.message).toMatch(/your own account/i);
  });

  it("reports a deleted account as gone", () => {
    expect(
      describeAdminUserError({ code: "user_not_found", message: "User not found" })
        .message,
    ).toMatch(/no longer exists/i);
  });

  it("tells an administrator who lost the role to sign in again", () => {
    // Every `YOU_ARE_NOT_ALLOWED_TO_*` refusal arrives as a 403 like this one.
    expect(
      describeAdminUserError({
        code: "feature_not_supported",
        message: "You are not allowed to create users",
      }).message,
    ).toMatch(/no longer allowed/i);
  });

  it("reports a transport failure as the service being unreachable", () => {
    expect(describeAdminUserError({ code: "NETWORK_TIMEOUT" }).message).toBe(
      SERVICE_UNAVAILABLE_MESSAGE,
    );
  });

  it("does not mistake an unrelated 403 for a lost role", () => {
    // "Missing or null Origin" also arrives as feature_not_supported.
    expect(
      describeAdminUserError({
        code: "feature_not_supported",
        message: "Missing or null Origin",
      }).message,
    ).toMatch(/Please try again/i);
  });

  it("falls back to a generic message for anything unrecognised", () => {
    for (const error of [
      null,
      {},
      { code: "internal_error", message: "boom" },
      { code: "validation_failed", message: "something new upstream" },
      { code: "SOMETHING_NEW" },
    ]) {
      expect(describeAdminUserError(error).message).toMatch(/Please try again/i);
    }
  });
});
