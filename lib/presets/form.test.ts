import { describe, expect, it } from "vitest";

import { FIELD, isPresetId, parsePresetForm, slugify, splitLines } from "./form";

/** Builds a valid submission, then applies the given tweaks. */
function build(
  fields: Record<string, string> = {},
  remove: string[] = [],
): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.label]: "Brand new supply (COD)",
    [FIELD.slug]: "supply-new",
    [FIELD.template]: "supply",
    ...fields,
  };

  for (const [key, value] of Object.entries(base)) {
    if (remove.includes(key)) continue;
    form.set(key, value);
  }

  return form;
}

describe("slugify", () => {
  it("matches the shape of the seeded slugs", () => {
    expect(slugify("Brand new supply (COD)")).toBe("brand-new-supply-cod");
    expect(slugify("Refilling & servicing (per contract)")).toBe(
      "refilling-servicing-per-contract",
    );
    expect(slugify("Preventive maintenance proposal")).toBe(
      "preventive-maintenance-proposal",
    );
  });

  it("collapses runs of punctuation and trims the hyphens", () => {
    expect(slugify("  --Foo // Bar--  ")).toBe("foo-bar");
    expect(slugify("!!!")).toBe("");
  });

  it("never ends on a hyphen, even when the cap lands mid-separator", () => {
    const slug = slugify(`${"a".repeat(59)} bcd`);
    expect(slug).toHaveLength(59);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("splitLines", () => {
  it("drops blank lines and trims the rest", () => {
    expect(splitLines("  one \n\n two \r\n\r\n")).toEqual(["one", "two"]);
    expect(splitLines("")).toEqual([]);
    expect(splitLines("   \n  ")).toEqual([]);
  });
});

describe("isPresetId", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(isPresetId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isPresetId("supply-new")).toBe(false);
    expect(isPresetId(undefined)).toBe(false);
  });
});

describe("parsePresetForm", () => {
  it("accepts the minimum: a name, a slug and a layout", () => {
    const parsed = parsePresetForm(build());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input).toMatchObject({
      slug: "supply-new",
      label: "Brand new supply (COD)",
      template: "supply",
      validityDays: 30,
      showBankDetails: false,
      isDefault: false,
      exclusions: [],
    });
    // Every optional text field collapses to null rather than "".
    expect(parsed.input.paymentTerms).toBeNull();
    // `scopeOfWorks` is deliberately not a field here, so an edit cannot flatten
    // it — enforced by the type, hence nothing to assert at runtime.
    expect(Object.keys(parsed.input)).not.toContain("scopeOfWorks");
  });

  it("derives the slug from the name when the field is blank", () => {
    const parsed = parsePresetForm(build({ [FIELD.slug]: "" }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.slug).toBe("brand-new-supply-cod");
  });

  it("lower-cases a hand-typed slug", () => {
    const parsed = parsePresetForm(build({ [FIELD.slug]: "Supply-NEW" }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.slug).toBe("supply-new");
  });

  it("rejects a slug that is not lower-kebab", () => {
    for (const slug of ["with space", "trailing-", "-leading", "under_score"]) {
      const parsed = parsePresetForm(build({ [FIELD.slug]: slug }));

      expect(parsed.ok, slug).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.slug, slug).toBeDefined();
    }
  });

  it("requires a name, without faulting a slug that was given", () => {
    const parsed = parsePresetForm(build({ [FIELD.label]: "  " }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.label).toBeDefined();
    expect(parsed.errors.slug).toBeUndefined();
  });

  it("reports both when the name is blank and the slug is left to it", () => {
    // Nothing to derive the slug from, so the second error is not noise.
    const parsed = parsePresetForm(
      build({ [FIELD.label]: "  ", [FIELD.slug]: "" }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.label).toBeDefined();
    expect(parsed.errors.slug).toBeDefined();
  });

  it("only accepts a known layout", () => {
    expect(parsePresetForm(build({ [FIELD.template]: "service_proposal" })).ok).toBe(
      true,
    );

    for (const template of ["", "supply_proposal", "SUPPLY"]) {
      const parsed = parsePresetForm(build({ [FIELD.template]: template }));

      expect(parsed.ok, template).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.template, template).toBeDefined();
    }
  });

  it("treats the checkboxes as present-or-absent", () => {
    const off = parsePresetForm(build());
    expect(off.ok && off.input.showBankDetails).toBe(false);
    expect(off.ok && off.input.isDefault).toBe(false);

    const on = parsePresetForm(
      build({ [FIELD.showBankDetails]: "on", [FIELD.isDefault]: "on" }),
    );
    expect(on.ok && on.input.showBankDetails).toBe(true);
    expect(on.ok && on.input.isDefault).toBe(true);
  });

  it("defaults validity to 30 and rejects values off the scale", () => {
    const blank = parsePresetForm(build({ [FIELD.validityDays]: "" }));
    expect(blank.ok && blank.input.validityDays).toBe(30);

    const given = parsePresetForm(build({ [FIELD.validityDays]: "45" }));
    expect(given.ok && given.input.validityDays).toBe(45);

    for (const value of ["0", "366", "-5", "12.5", "many"]) {
      const parsed = parsePresetForm(build({ [FIELD.validityDays]: value }));

      expect(parsed.ok, value).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.validityDays, value).toBeDefined();
    }
  });

  it("splits exclusions into lines", () => {
    const parsed = parsePresetForm(
      build({
        [FIELD.exclusions]: "Programming of FACP.\n\n  Any works not included.  ",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.exclusions).toEqual([
      "Programming of FACP.",
      "Any works not included.",
    ]);
  });

  it("caps the exclusion count and each line's length", () => {
    const many = parsePresetForm(
      build({ [FIELD.exclusions]: Array.from({ length: 31 }, (_, i) => `x${i}`).join("\n") }),
    );
    expect(many.ok).toBe(false);
    if (many.ok) return;
    expect(many.errors.exclusions).toBeDefined();

    const long = parsePresetForm(
      build({ [FIELD.exclusions]: "a".repeat(401) }),
    );
    expect(long.ok).toBe(false);
    if (long.ok) return;
    expect(long.errors.exclusions).toBeDefined();
  });

  it("caps the long free-text fields", () => {
    const parsed = parsePresetForm(
      build({ [FIELD.introParagraph]: "a".repeat(2001) }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.introParagraph).toBeDefined();
  });

  it("treats missing fields as blank rather than throwing", () => {
    const parsed = parsePresetForm(new FormData());

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.label).toBeDefined();
    expect(parsed.errors.template).toBeDefined();
  });

  it("echoes the submitted values back so a rejected submit keeps them", () => {
    const parsed = parsePresetForm(
      build({
        [FIELD.template]: "",
        [FIELD.paymentTerms]: "Cash On Delivery",
        [FIELD.isDefault]: "on",
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.values).toMatchObject({
      paymentTerms: "Cash On Delivery",
      template: "",
      isDefault: true,
    });
  });
});
