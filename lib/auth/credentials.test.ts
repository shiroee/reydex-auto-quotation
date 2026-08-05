import { describe, expect, it } from "vitest";

import {
  ACCOUNT_LOCKED_MESSAGE,
  describeSignInError,
  INVALID_CREDENTIALS_MESSAGE,
  normalizeEmail,
  safeRedirectPath,
  SERVICE_UNAVAILABLE_MESSAGE,
  validateSignInInput,
} from "./credentials";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeEmail("  Office@Reydex.COM \n")).toBe("office@reydex.com");
  });
});

describe("validateSignInInput", () => {
  it("accepts a well-formed pair and returns the normalised email", () => {
    const result = validateSignInInput({
      email: " Sales@Reydex.com ",
      password: "correct horse battery",
    });

    expect(result).toEqual({
      ok: true,
      credentials: {
        email: "sales@reydex.com",
        password: "correct horse battery",
      },
    });
  });

  it("does not trim or alter the password", () => {
    const result = validateSignInInput({
      email: "sales@reydex.com",
      password: "  spaces matter  ",
    });

    expect(result.ok && result.credentials.password).toBe("  spaces matter  ");
  });

  it("flags a missing email", () => {
    const result = validateSignInInput({ email: "   ", password: "secret123" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.email).toMatch(/enter your work email/i);
    expect(!result.ok && result.fieldErrors.password).toBeUndefined();
  });

  it("flags a missing password", () => {
    const result = validateSignInInput({
      email: "sales@reydex.com",
      password: "",
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.password).toMatch(/enter your password/i);
    expect(!result.ok && result.fieldErrors.email).toBeUndefined();
  });

  it("reports both fields when both are empty", () => {
    const result = validateSignInInput({ email: "", password: "" });

    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.fieldErrors).sort()).toEqual([
      "email",
      "password",
    ]);
  });

  it.each([
    ["no at sign", "salesreydex.com"],
    ["no domain dot", "sales@reydex"],
    ["trailing dot", "sales@reydex."],
    ["internal space", "sa les@reydex.com"],
    ["double at", "sales@@reydex.com"],
    ["empty local part", "@reydex.com"],
  ])("rejects a malformed email (%s)", (_label, email) => {
    const result = validateSignInInput({ email, password: "secret123" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.email).toMatch(/valid email/i);
  });

  it.each([
    ["subdomain", "sales@mail.reydex.com.ph"],
    ["plus tag", "sales+quotes@reydex.com"],
    ["hyphenated domain", "sales@reydex-trading.com"],
  ])("accepts a legitimate email (%s)", (_label, email) => {
    const result = validateSignInInput({ email, password: "secret123" });

    expect(result.ok).toBe(true);
  });

  it("rejects an over-long email rather than forwarding it upstream", () => {
    const email = `${"a".repeat(250)}@reydex.com`;
    const result = validateSignInInput({ email, password: "secret123" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.email).toMatch(/too long/i);
  });

  it("rejects an over-long password", () => {
    const result = validateSignInInput({
      email: "sales@reydex.com",
      password: "x".repeat(513),
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.password).toMatch(/too long/i);
  });

  it("treats non-string FormData values as missing", () => {
    const result = validateSignInInput({ email: null, password: undefined });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.email).toBeDefined();
    expect(!result.ok && result.fieldErrors.password).toBeDefined();
  });

  it("does not enforce a password policy on sign-in", () => {
    // Complexity rules belong to account creation; enforcing them here would
    // leak the policy and confuse holders of older credentials.
    const result = validateSignInInput({ email: "sales@reydex.com", password: "a" });

    expect(result.ok).toBe(true);
  });
});

describe("describeSignInError", () => {
  it.each([
    "NETWORK_DNS",
    "NETWORK_REFUSED",
    "NETWORK_TIMEOUT",
    "NETWORK_TLS",
    "NETWORK_RESET",
    "NETWORK_ABORT",
    "NETWORK_ERROR",
  ])("maps transport failure %s to the service-unavailable message", (code) => {
    expect(describeSignInError({ code })).toBe(SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("reports a disabled account distinctly", () => {
    expect(describeSignInError({ code: "USER_BANNED" })).toBe(
      ACCOUNT_LOCKED_MESSAGE,
    );
  });

  it("collapses credential failures to one generic message", () => {
    // Both branches must read identically, otherwise the form becomes an
    // account-enumeration oracle.
    const unknownEmail = describeSignInError({
      code: "USER_NOT_FOUND",
      message: "No user with that email",
    });
    const wrongPassword = describeSignInError({
      code: "INVALID_PASSWORD",
      message: "Password mismatch",
    });

    expect(unknownEmail).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(wrongPassword).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("never echoes the upstream message back to the visitor", () => {
    const message = describeSignInError({
      code: "SOMETHING_ODD",
      message: "user id 42 has no credential row",
    });

    expect(message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(message).not.toContain("42");
  });

  it.each([[null], [undefined], [{}]])(
    "falls back to the generic message for %p",
    (error) => {
      expect(describeSignInError(error)).toBe(INVALID_CREDENTIALS_MESSAGE);
    },
  );
});

describe("safeRedirectPath", () => {
  it("keeps a rooted in-app path", () => {
    expect(safeRedirectPath("/dashboard/quotations?draft=1")).toBe(
      "/dashboard/quotations?draft=1",
    );
  });

  it.each([
    ["absolute http url", "https://evil.example.com/steal"],
    ["protocol-relative url", "//evil.example.com"],
    ["backslash variant", "/\\evil.example.com"],
    ["relative path", "dashboard"],
    ["javascript url", "javascript:alert(1)"],
    ["empty string", ""],
  ])("rejects %s and uses the fallback", (_label, value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });

  it("rejects non-string values such as repeated query params", () => {
    expect(safeRedirectPath(["/a", "/b"])).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeRedirectPath(undefined, "/login")).toBe("/login");
  });
});
