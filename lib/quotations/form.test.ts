import { describe, expect, it } from "vitest";

import {
  FIELD,
  decodeVariant,
  encodeVariant,
  parseQuotationForm,
  suggestSectionTitle,
} from "./form";

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";

/** Builds a valid submission, then applies the given tweaks. */
function build(
  overrides: {
    fields?: Record<string, string>;
    remove?: string[];
    lines?: { variant?: string; quantity?: string; section?: string }[];
  } = {},
): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.customerId]: CUSTOMER,
    [FIELD.presetSlug]: "supply-new",
    [FIELD.subject]: "LION BRAND FIRE EXTINGUISHER",
    [FIELD.quoteDate]: "2026-05-13",
    ...overrides.fields,
  };

  for (const [key, value] of Object.entries(base)) {
    if (overrides.remove?.includes(key)) continue;
    form.set(key, value);
  }

  const lines = overrides.lines ?? [
    { variant: encodeVariant(PRODUCT, "new", "10 lbs"), quantity: "1" },
  ];

  for (const line of lines) {
    form.append(FIELD.itemVariant, line.variant ?? "");
    form.append(FIELD.itemQuantity, line.quantity ?? "");
    form.append(FIELD.itemSection, line.section ?? "");
  }

  return form;
}

describe("encodeVariant / decodeVariant", () => {
  it("round-trips a variant with a capacity", () => {
    const encoded = encodeVariant(PRODUCT, "refill", "50 lbs");
    expect(decodeVariant(encoded)).toEqual({
      productId: PRODUCT,
      serviceKind: "refill",
      capacityLabel: "50 lbs",
    });
  });

  it("round-trips a variant with no capacity", () => {
    expect(decodeVariant(encodeVariant(PRODUCT, "new", ""))).toEqual({
      productId: PRODUCT,
      serviceKind: "new",
      capacityLabel: "",
    });
  });

  it.each([
    ["wrong shape", "just-one-part"],
    ["bad uuid", `not-a-uuid::new::10 lbs`],
    ["unknown service kind", `${PRODUCT}::rental::10 lbs`],
    ["too many parts", `${PRODUCT}::new::10 lbs::extra`],
  ])("rejects %s", (_label, value) => {
    expect(decodeVariant(value)).toBeNull();
  });
});

describe("parseQuotationForm", () => {
  it("accepts a minimal valid submission", () => {
    const result = parseQuotationForm(build());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.input).toMatchObject({
      customerId: CUSTOMER,
      presetSlug: "supply-new",
      subject: "LION BRAND FIRE EXTINGUISHER",
      quoteDate: "2026-05-13",
      attentionTo: null,
    });
    expect(result.input.items).toEqual([
      {
        productId: PRODUCT,
        serviceKind: "new",
        capacityLabel: "10 lbs",
        quantity: "1",
        sectionTitle: null,
      },
    ]);
  });

  it("keeps multiple lines in the order they were submitted", () => {
    const result = parseQuotationForm(
      build({
        lines: [
          { variant: encodeVariant(PRODUCT, "refill", "10 lbs"), quantity: "10" },
          { variant: encodeVariant(PRODUCT, "refill", "50 lbs"), quantity: "1" },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.items.map((i) => i.capacityLabel)).toEqual([
      "10 lbs",
      "50 lbs",
    ]);
    expect(result.input.items.map((i) => i.quantity)).toEqual(["10", "1"]);
  });

  it("skips entirely blank rows without complaining", () => {
    const result = parseQuotationForm(
      build({
        lines: [
          { variant: encodeVariant(PRODUCT, "new", ""), quantity: "2" },
          {}, // the trailing empty row the builder always renders
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.items).toHaveLength(1);
  });

  it("carries a section heading through and nulls a blank one", () => {
    const result = parseQuotationForm(
      build({
        lines: [
          {
            variant: encodeVariant(PRODUCT, "new", ""),
            quantity: "1",
            section: "BRAND NEW SMOKE DETECTOR",
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.items[0].sectionTitle).toBe("BRAND NEW SMOKE DETECTOR");
  });

  it.each([
    [FIELD.customerId, "customerId"],
    [FIELD.subject, "subject"],
    [FIELD.quoteDate, "quoteDate"],
  ])("requires %s", (field, key) => {
    const result = parseQuotationForm(build({ remove: [field] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[key as keyof typeof result.errors]).toBeDefined();
  });

  it("rejects a non-uuid customer", () => {
    const result = parseQuotationForm(
      build({ fields: { [FIELD.customerId]: "42" } }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.customerId).toMatch(/not valid/i);
  });

  it.each([
    ["impossible day", "2026-02-30"],
    ["month 13", "2026-13-01"],
    ["free text", "next tuesday"],
    ["wrong order", "13-05-2026"],
  ])("rejects an invalid date (%s)", (_label, value) => {
    const result = parseQuotationForm(
      build({ fields: { [FIELD.quoteDate]: value } }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.quoteDate).toBeDefined();
  });

  it("complains when no item is chosen at all", () => {
    const result = parseQuotationForm(build({ lines: [{}] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.items).toMatch(/at least one item/i);
  });

  it("reports the line number when a quantity is missing", () => {
    const result = parseQuotationForm(
      build({
        lines: [
          { variant: encodeVariant(PRODUCT, "new", ""), quantity: "1" },
          { variant: encodeVariant(PRODUCT, "refill", "10 lbs") },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.lines?.[2]).toMatch(/quantity/i);
    expect(result.errors.lines?.[1]).toBeUndefined();
  });

  it("flags a quantity typed with no item selected", () => {
    const result = parseQuotationForm(build({ lines: [{ quantity: "3" }] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.lines?.[1]).toMatch(/choose an item/i);
  });

  it.each([
    ["zero", "0"],
    ["negative", "-2"],
    ["not a number", "two"],
    ["three decimals", "1.005"],
  ])("rejects quantity %s", (_label, quantity) => {
    const result = parseQuotationForm(
      build({ lines: [{ variant: encodeVariant(PRODUCT, "new", ""), quantity }] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.lines?.[1]).toBeDefined();
  });

  it("allows a two-decimal quantity", () => {
    const result = parseQuotationForm(
      build({
        lines: [{ variant: encodeVariant(PRODUCT, "new", ""), quantity: "2.50" }],
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("validates the validity period", () => {
    expect(
      parseQuotationForm(build({ fields: { [FIELD.validityDays]: "0" } })).ok,
    ).toBe(false);
    expect(
      parseQuotationForm(build({ fields: { [FIELD.validityDays]: "45" } })).ok,
    ).toBe(true);
  });

  it("omits overrides that were left blank so preset values survive", () => {
    const result = parseQuotationForm(build());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // No overrides typed, so nothing should shadow the preset.
    expect(result.input.overrides).toBeUndefined();
  });

  it("passes through overrides that were filled in", () => {
    const result = parseQuotationForm(
      build({
        fields: {
          [FIELD.paymentTerms]: "50% down payment",
          [FIELD.validityDays]: "15",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.overrides).toEqual({
      paymentTerms: "50% down payment",
      validityDays: 15,
    });
  });

  it("trims surrounding whitespace on text fields", () => {
    const result = parseQuotationForm(
      build({ fields: { [FIELD.subject]: "   SPACED SUBJECT   " } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.subject).toBe("SPACED SUBJECT");
  });

  it("rejects an over-long subject", () => {
    const result = parseQuotationForm(
      build({ fields: { [FIELD.subject]: "x".repeat(501) } }),
    );

    expect(result.ok).toBe(false);
  });
});

describe("suggestSectionTitle", () => {
  it("matches the headings used in the samples", () => {
    expect(suggestSectionTitle("new", "fire_extinguisher", "DRY CHEMICAL TYPE")).toBe(
      "BRANDNEW OF FIRE EXTINGUISHER",
    );
    expect(suggestSectionTitle("new", "detection_alarm", "SMOKE DETECTOR")).toBe(
      "BRAND NEW SMOKE DETECTOR",
    );
    expect(
      suggestSectionTitle("refill", "fire_extinguisher", "DRY CHEMICAL TYPE"),
    ).toBe("REFILLING AND SERVICING OF FIRE EXTINGUISHER");
  });

  it("suggests nothing for maintenance lines, which carry no heading", () => {
    expect(suggestSectionTitle("maintenance", "service", "PM OF FDAS")).toBe("");
  });
});
