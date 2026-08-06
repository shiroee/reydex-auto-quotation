import { describe, expect, it } from "vitest";

import { FIELD, isCustomerId, parseCustomerForm } from "./form";

/** Builds a submission with the given fields; `name` is filled unless overridden. */
function build(fields: Record<string, string> = {}): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.name]: "PUREGOLD PRICE CLUB, INC.",
    ...fields,
  };

  for (const [key, value] of Object.entries(base)) {
    form.set(key, value);
  }

  return form;
}

describe("isCustomerId", () => {
  it("accepts a uuid in either case", () => {
    expect(isCustomerId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isCustomerId("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")).toBe(true);
  });

  it("rejects anything else, so it never reaches Postgres as a uuid", () => {
    expect(isCustomerId("")).toBe(false);
    expect(isCustomerId("not-a-uuid")).toBe(false);
    expect(isCustomerId("11111111-1111-4111-8111-11111111111")).toBe(false);
    expect(isCustomerId(null)).toBe(false);
    expect(isCustomerId(undefined)).toBe(false);
    expect(isCustomerId(42)).toBe(false);
  });
});

describe("parseCustomerForm", () => {
  it("accepts a name on its own — the samples include bare trading names", () => {
    const parsed = parseCustomerForm(build());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input).toEqual({
      name: "PUREGOLD PRICE CLUB, INC.",
      addressLine: null,
      cityProvince: null,
      contactPerson: null,
      contactEmail: null,
      contactPhone: null,
      notes: null,
    });
  });

  it("keeps every optional field it is given", () => {
    const parsed = parseCustomerForm(
      build({
        [FIELD.addressLine]: "National Highway, Brgy. San Roque",
        [FIELD.cityProvince]: "Castillejos, Zambales",
        [FIELD.contactPerson]: "MR. RENE R. ESGASANE",
        [FIELD.contactEmail]: "purchasing@example.com",
        [FIELD.contactPhone]: "0933-3347-702",
        [FIELD.notes]: "Invoices go to head office.",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input).toEqual({
      name: "PUREGOLD PRICE CLUB, INC.",
      addressLine: "National Highway, Brgy. San Roque",
      cityProvince: "Castillejos, Zambales",
      contactPerson: "MR. RENE R. ESGASANE",
      contactEmail: "purchasing@example.com",
      contactPhone: "0933-3347-702",
      notes: "Invoices go to head office.",
    });
  });

  it("trims fields and collapses blank ones to null", () => {
    const parsed = parseCustomerForm(
      build({
        [FIELD.name]: "  TRUE NORTH  ",
        [FIELD.cityProvince]: "   ",
        [FIELD.notes]: "",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.name).toBe("TRUE NORTH");
    expect(parsed.input.cityProvince).toBeNull();
    expect(parsed.input.notes).toBeNull();
  });

  it("lower-cases the email — it is an address, not a display name", () => {
    const parsed = parseCustomerForm(
      build({ [FIELD.contactEmail]: "  Purchasing@Example.COM  " }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.contactEmail).toBe("purchasing@example.com");
  });

  it("requires a name", () => {
    for (const name of ["", "   "]) {
      const parsed = parseCustomerForm(build({ [FIELD.name]: name }));

      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.name).toBeDefined();
    }
  });

  it("treats a missing field as blank rather than throwing", () => {
    // A hand-crafted POST need not include every input the form renders.
    const parsed = parseCustomerForm(new FormData());

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.name).toBeDefined();
  });

  it("rejects an email that cannot be one, and accepts one that can", () => {
    for (const email of ["nope", "a@b", "two@@example.com", "sp ace@x.com"]) {
      const parsed = parseCustomerForm(build({ [FIELD.contactEmail]: email }));

      expect(parsed.ok, email).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.contactEmail, email).toBeDefined();
    }

    expect(
      parseCustomerForm(build({ [FIELD.contactEmail]: "a.b@sub.example.ph" }))
        .ok,
    ).toBe(true);
  });

  it("caps each field so a pasted document cannot reach the database", () => {
    const long = (n: number) => "a".repeat(n);

    const cases: [string, string][] = [
      [FIELD.name, long(201)],
      [FIELD.addressLine, long(301)],
      [FIELD.cityProvince, long(161)],
      [FIELD.contactPerson, long(161)],
      [FIELD.contactPhone, long(81)],
      [FIELD.notes, long(2001)],
    ];

    for (const [field, value] of cases) {
      const parsed = parseCustomerForm(build({ [field]: value }));

      expect(parsed.ok, field).toBe(false);
      if (parsed.ok) return;

      expect(Object.keys(parsed.errors), field).toContain(field);
    }

    // An over-long email is caught before the shape check, so it reads clearly.
    const email = parseCustomerForm(
      build({ [FIELD.contactEmail]: `${long(250)}@example.com` }),
    );
    expect(email.ok).toBe(false);
    if (email.ok) return;
    expect(email.errors.contactEmail).toBe("That email address is too long.");
  });

  it("echoes the submitted values back so a rejected submit keeps them", () => {
    const parsed = parseCustomerForm(
      build({
        [FIELD.name]: "",
        [FIELD.contactPerson]: "MS. ANA REYES",
        [FIELD.contactEmail]: "broken",
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.values).toMatchObject({
      name: "",
      contactPerson: "MS. ANA REYES",
      contactEmail: "broken",
    });
  });
});
