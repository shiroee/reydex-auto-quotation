import { describe, expect, it } from "vitest";

import { FIELD, isItemId, parseItemForm, splitSpecs } from "./form";

type Variant = {
  serviceKind?: string;
  capacityLabel?: string;
  capacityLbs?: string;
  unitPrice?: string;
};

/** Builds a valid submission, then applies the given tweaks. */
function build(
  overrides: {
    fields?: Record<string, string>;
    remove?: string[];
    variants?: Variant[];
  } = {},
): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.sku]: "FE-DC-10",
    [FIELD.name]: "DRY CHEMICAL TYPE",
    [FIELD.category]: "fire_extinguisher",
    ...overrides.fields,
  };

  for (const [key, value] of Object.entries(base)) {
    if (overrides.remove?.includes(key)) continue;
    form.set(key, value);
  }

  const variants = overrides.variants ?? [
    { serviceKind: "new", capacityLabel: "10 lbs", unitPrice: "1200.00" },
  ];

  for (const variant of variants) {
    form.append(FIELD.variantServiceKind, variant.serviceKind ?? "");
    form.append(FIELD.variantCapacityLabel, variant.capacityLabel ?? "");
    form.append(FIELD.variantCapacityLbs, variant.capacityLbs ?? "");
    form.append(FIELD.variantUnitPrice, variant.unitPrice ?? "");
  }

  return form;
}

describe("splitSpecs", () => {
  it("drops blank lines, trims, and strips a leading bullet", () => {
    expect(splitSpecs("• One\n- Two\n* Three\n\n  Four  ")).toEqual([
      "One",
      "Two",
      "Three",
      "Four",
    ]);
  });

  it("leaves an internal hyphen alone", () => {
    expect(splitSpecs("2A2BC-rated")).toEqual(["2A2BC-rated"]);
  });
});

describe("isItemId", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(isItemId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isItemId("FE-DC-10")).toBe(false);
    expect(isItemId(null)).toBe(false);
  });
});

describe("parseItemForm", () => {
  it("accepts an item with one priced variant", () => {
    const parsed = parseItemForm(build());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input).toEqual({
      sku: "FE-DC-10",
      name: "DRY CHEMICAL TYPE",
      category: "fire_extinguisher",
      brand: null,
      unitLabel: "UNIT",
      description: null,
      isActive: false,
      specs: [],
      variants: [
        {
          serviceKind: "new",
          capacityLabel: "10 lbs",
          capacityLbs: null,
          unitPrice: "1200.00",
        },
      ],
    });
  });

  it("upper-cases the SKU and the unit label", () => {
    const parsed = parseItemForm(
      build({ fields: { [FIELD.sku]: "fe-dc-10", [FIELD.unitLabel]: "lot" } }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.sku).toBe("FE-DC-10");
    expect(parsed.input.unitLabel).toBe("LOT");
  });

  it("defaults the unit label to UNIT", () => {
    const parsed = parseItemForm(build({ fields: { [FIELD.unitLabel]: "  " } }));

    expect(parsed.ok && parsed.input.unitLabel).toBe("UNIT");
  });

  it("requires a SKU, a name and a known category", () => {
    const blank = parseItemForm(
      build({ fields: { [FIELD.sku]: "", [FIELD.name]: "" } }),
    );
    expect(blank.ok).toBe(false);
    if (blank.ok) return;
    expect(blank.errors.sku).toBeDefined();
    expect(blank.errors.name).toBeDefined();

    for (const category of ["", "extinguisher", "FIRE_EXTINGUISHER"]) {
      const parsed = parseItemForm(build({ fields: { [FIELD.category]: category } }));

      expect(parsed.ok, category).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.category, category).toBeDefined();
    }
  });

  it("rejects a SKU with characters the catalogue does not use", () => {
    for (const sku of ["FE DC 10", "-FE", "FE/DC"]) {
      const parsed = parseItemForm(build({ fields: { [FIELD.sku]: sku } }));

      expect(parsed.ok, sku).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.sku, sku).toBeDefined();
    }
  });

  it("reads the availability checkbox as present-or-absent", () => {
    const on = parseItemForm(build({ fields: { [FIELD.isActive]: "on" } }));
    expect(on.ok && on.input.isActive).toBe(true);

    const off = parseItemForm(build());
    expect(off.ok && off.input.isActive).toBe(false);
  });

  it("allows an item with no variants — catalogued before it is priced", () => {
    const parsed = parseItemForm(build({ variants: [{}] }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.variants).toEqual([]);
  });

  it("skips wholly blank rows but keeps the ones after them", () => {
    const parsed = parseItemForm(
      build({
        variants: [
          {},
          { serviceKind: "refill", capacityLabel: "50 lbs", unitPrice: "3000" },
        ],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.variants).toHaveLength(1);
    expect(parsed.input.variants[0].unitPrice).toBe("3000");
  });

  it("keeps the capacity in pounds when given, and null when not", () => {
    const parsed = parseItemForm(
      build({
        variants: [
          {
            serviceKind: "new",
            capacityLabel: "10 lbs",
            capacityLbs: "10",
            unitPrice: "1200",
          },
        ],
      }),
    );

    expect(parsed.ok && parsed.input.variants[0].capacityLbs).toBe("10");
    expect(
      parseItemForm(build()).ok &&
        parseItemForm(build()).ok === true &&
        (parseItemForm(build()) as { input: { variants: { capacityLbs: string | null }[] } })
          .input.variants[0].capacityLbs,
    ).toBeNull();
  });

  it("rejects a price that is missing, malformed, zero or negative", () => {
    const cases: [string, string][] = [
      ["", "missing"],
      ["abc", "not a number"],
      ["12.345", "three decimals"],
      ["0", "zero"],
      ["-5", "negative"],
      ["20000000", "beyond the typo guard"],
    ];

    for (const [unitPrice, why] of cases) {
      const parsed = parseItemForm(
        build({
          variants: [{ serviceKind: "new", capacityLabel: "10 lbs", unitPrice }],
        }),
      );

      expect(parsed.ok, why).toBe(false);
      if (parsed.ok) return;

      expect(parsed.errors.variantRows?.[1], why).toBeDefined();
    }
  });

  it("reports the row number of a bad row, 1-based and visible", () => {
    const parsed = parseItemForm(
      build({
        variants: [
          { serviceKind: "new", capacityLabel: "10 lbs", unitPrice: "1200" },
          { serviceKind: "new", capacityLabel: "20 lbs", unitPrice: "oops" },
        ],
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.variantRows).toEqual({
      2: expect.stringContaining("number"),
    });
  });

  it("rejects a row with no service kind chosen", () => {
    const parsed = parseItemForm(
      build({ variants: [{ serviceKind: "", unitPrice: "1200" }] }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.variantRows?.[1]).toContain("service kind");
  });

  it("catches a duplicate variant before the unique index does", () => {
    const parsed = parseItemForm(
      build({
        variants: [
          { serviceKind: "new", capacityLabel: "10 lbs", unitPrice: "1200" },
          { serviceKind: "new", capacityLabel: "10 LBS", unitPrice: "1300" },
        ],
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    // Points at the later row, naming the earlier one.
    expect(parsed.errors.variantRows?.[2]).toContain("row 1");
  });

  it("treats the same capacity under a different service kind as distinct", () => {
    const parsed = parseItemForm(
      build({
        variants: [
          { serviceKind: "new", capacityLabel: "10 lbs", unitPrice: "1200" },
          { serviceKind: "refill", capacityLabel: "10 lbs", unitPrice: "600" },
        ],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.variants).toHaveLength(2);
  });

  it("caps the variant count", () => {
    const parsed = parseItemForm(
      build({
        variants: Array.from({ length: 31 }, (_, i) => ({
          serviceKind: "new",
          capacityLabel: `${i} lbs`,
          unitPrice: "1200",
        })),
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.variants).toBeDefined();
  });

  it("splits specs and caps them", () => {
    const parsed = parseItemForm(
      build({ fields: { [FIELD.specs]: "• Stored pressure type\n• 2A2BC rated" } }),
    );

    expect(parsed.ok && parsed.input.specs).toEqual([
      "Stored pressure type",
      "2A2BC rated",
    ]);

    const many = parseItemForm(
      build({
        fields: {
          [FIELD.specs]: Array.from({ length: 41 }, (_, i) => `spec ${i}`).join("\n"),
        },
      }),
    );
    expect(many.ok).toBe(false);
    if (many.ok) return;
    expect(many.errors.specs).toBeDefined();
  });

  it("echoes every submitted row back so a rejected submit keeps them", () => {
    const parsed = parseItemForm(
      build({
        fields: { [FIELD.name]: "" },
        variants: [
          { serviceKind: "refill", capacityLabel: "50 lbs", unitPrice: "3000" },
          {},
        ],
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.values.variants).toEqual([
      {
        serviceKind: "refill",
        capacityLabel: "50 lbs",
        capacityLbs: "",
        unitPrice: "3000",
      },
      { serviceKind: "", capacityLabel: "", capacityLbs: "", unitPrice: "" },
    ]);
  });

  it("treats missing fields as blank rather than throwing", () => {
    const parsed = parseItemForm(new FormData());

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.sku).toBeDefined();
    expect(parsed.errors.name).toBeDefined();
  });
});
