import { describe, expect, it } from "vitest";

import { EDIT_FIELD, parseQuotationEditForm } from "./edit-form";
import { FIELD, encodeVariant } from "./form";

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const LINE_A = "33333333-3333-4333-8333-333333333333";
const LINE_B = "44444444-4444-4444-8444-444444444444";

type Row = { id?: string; variant?: string; quantity?: string; section?: string };

/** Builds a valid submission, then applies the given tweaks. */
function build(
  overrides: {
    fields?: Record<string, string>;
    remove?: string[];
    rows?: Row[];
  } = {},
): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.customerId]: CUSTOMER,
    [EDIT_FIELD.template]: "supply",
    [FIELD.subject]: "LION BRAND FIRE EXTINGUISHER",
    [FIELD.quoteDate]: "2026-05-13",
    ...overrides.fields,
  };

  for (const [key, value] of Object.entries(base)) {
    if (overrides.remove?.includes(key)) continue;
    form.set(key, value);
  }

  const rows = overrides.rows ?? [{ id: LINE_A, quantity: "3" }];

  for (const row of rows) {
    form.append(FIELD.itemId, row.id ?? "");
    form.append(FIELD.itemVariant, row.variant ?? "");
    form.append(FIELD.itemQuantity, row.quantity ?? "");
    form.append(FIELD.itemSection, row.section ?? "");
  }

  return form;
}

describe("parseQuotationEditForm", () => {
  it("keeps a line submitted with its id, so its quoted price survives", () => {
    const parsed = parseQuotationEditForm(build());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.lines).toEqual([
      { kind: "kept", id: LINE_A, quantity: "3", sectionTitle: null },
    ]);
  });

  it("treats a line with no id as new, to be priced from the catalogue", () => {
    const parsed = parseQuotationEditForm(
      build({
        rows: [
          {
            variant: encodeVariant(PRODUCT, "refill", "50 lbs"),
            quantity: "2",
            section: "REFILLING AND SERVICING",
          },
        ],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.lines).toEqual([
      {
        kind: "added",
        productId: PRODUCT,
        serviceKind: "refill",
        capacityLabel: "50 lbs",
        quantity: "2",
        sectionTitle: "REFILLING AND SERVICING",
      },
    ]);
  });

  it("takes kept and added lines together, in submitted order", () => {
    const parsed = parseQuotationEditForm(
      build({
        rows: [
          { id: LINE_A, quantity: "1" },
          { variant: encodeVariant(PRODUCT, "new", "10 lbs"), quantity: "4" },
          { id: LINE_B, quantity: "2" },
        ],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Order matters: positions are assigned from it.
    expect(parsed.input.lines.map((l) => l.kind)).toEqual([
      "kept",
      "added",
      "kept",
    ]);
  });

  it("ignores the variant when an id is present — the id wins", () => {
    const parsed = parseQuotationEditForm(
      build({
        rows: [
          {
            id: LINE_A,
            // A stored line whose item has since been retired carries a
            // synthetic value here, which must not be decoded as a variant.
            variant: `stored::${LINE_A}`,
            quantity: "1",
          },
        ],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.lines[0]).toEqual({
      kind: "kept",
      id: LINE_A,
      quantity: "1",
      sectionTitle: null,
    });
  });

  it("skips a wholly blank row but keeps the ones after it", () => {
    const parsed = parseQuotationEditForm(
      build({ rows: [{}, { id: LINE_A, quantity: "1" }] }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.lines).toHaveLength(1);
  });

  it("refuses an edit that would leave no items", () => {
    const parsed = parseQuotationEditForm(build({ rows: [{}] }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.items).toBeDefined();
  });

  it("rejects the same stored line twice", () => {
    const parsed = parseQuotationEditForm(
      build({
        rows: [
          { id: LINE_A, quantity: "1" },
          { id: LINE_A, quantity: "2" },
        ],
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.lines?.[2]).toContain("already on");
  });

  it("rejects a malformed line id rather than passing it to Postgres", () => {
    const parsed = parseQuotationEditForm(
      build({ rows: [{ id: "not-a-uuid", quantity: "1" }] }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.lines?.[1]).toBeDefined();
  });

  it("checks quantity the same way for kept and added lines", () => {
    for (const quantity of ["", "0", "-1", "abc", "1.234", "100001"]) {
      const kept = parseQuotationEditForm(
        build({ rows: [{ id: LINE_A, quantity }] }),
      );
      const added = parseQuotationEditForm(
        build({
          rows: [{ variant: encodeVariant(PRODUCT, "new", ""), quantity }],
        }),
      );

      expect(kept.ok, `kept ${quantity}`).toBe(false);
      expect(added.ok, `added ${quantity}`).toBe(false);
      if (kept.ok || added.ok) return;

      expect(kept.errors.lines?.[1], `kept ${quantity}`).toBeDefined();
      expect(added.errors.lines?.[1], `added ${quantity}`).toBeDefined();
    }
  });

  it("asks for an item when a quantity was typed with nothing chosen", () => {
    const parsed = parseQuotationEditForm(build({ rows: [{ quantity: "2" }] }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.lines?.[1]).toContain("Choose an item");
  });

  it("requires a customer, a layout, a subject and a date", () => {
    const parsed = parseQuotationEditForm(
      build({
        fields: {
          [FIELD.customerId]: "",
          [EDIT_FIELD.template]: "",
          [FIELD.subject]: "",
          [FIELD.quoteDate]: "",
        },
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.customerId).toBeDefined();
    expect(parsed.errors.template).toBeDefined();
    expect(parsed.errors.subject).toBeDefined();
    expect(parsed.errors.quoteDate).toBeDefined();
  });

  it("rejects an impossible date", () => {
    const parsed = parseQuotationEditForm(
      build({ fields: { [FIELD.quoteDate]: "2026-02-30" } }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.quoteDate).toBeDefined();
  });

  it("writes concrete wording, with blanks as null rather than empty strings", () => {
    const parsed = parseQuotationEditForm(
      build({
        fields: {
          [FIELD.paymentTerms]: "Cash On Delivery",
          [FIELD.deliveryTerms]: "  ",
          [EDIT_FIELD.introParagraph]: "In connection with the above…",
          [EDIT_FIELD.closingParagraph]: "",
        },
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.paymentTerms).toBe("Cash On Delivery");
    expect(parsed.input.deliveryTerms).toBeNull();
    expect(parsed.input.introParagraph).toBe("In connection with the above…");
    expect(parsed.input.closingParagraph).toBeNull();
  });

  it("falls back to a default salutation rather than printing none", () => {
    const parsed = parseQuotationEditForm(
      build({ fields: { [EDIT_FIELD.salutation]: "   " } }),
    );

    expect(parsed.ok && parsed.input.salutation).toBe("Dear Sir/Ma'am,");
  });

  it("reads the bank-details checkbox as present-or-absent", () => {
    const off = parseQuotationEditForm(build());
    expect(off.ok && off.input.showBankDetails).toBe(false);

    const on = parseQuotationEditForm(
      build({ fields: { [EDIT_FIELD.showBankDetails]: "on" } }),
    );
    expect(on.ok && on.input.showBankDetails).toBe(true);
  });

  it("splits exclusions into lines and caps them", () => {
    const parsed = parseQuotationEditForm(
      build({
        fields: {
          [EDIT_FIELD.exclusions]: "Programming of FACP.\n\n  Any works not included.  ",
        },
      }),
    );

    expect(parsed.ok && parsed.input.exclusions).toEqual([
      "Programming of FACP.",
      "Any works not included.",
    ]);

    const many = parseQuotationEditForm(
      build({
        fields: {
          [EDIT_FIELD.exclusions]: Array.from({ length: 31 }, (_, i) => `x${i}`).join(
            "\n",
          ),
        },
      }),
    );
    expect(many.ok).toBe(false);
    if (many.ok) return;
    expect(many.errors.exclusions).toBeDefined();
  });

  it("defaults validity to 30 and rejects values off the scale", () => {
    const blank = parseQuotationEditForm(build());
    expect(blank.ok && blank.input.validityDays).toBe(30);

    const given = parseQuotationEditForm(
      build({ fields: { [FIELD.validityDays]: "45" } }),
    );
    expect(given.ok && given.input.validityDays).toBe(45);

    const bad = parseQuotationEditForm(
      build({ fields: { [FIELD.validityDays]: "400" } }),
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.validityDays).toBeDefined();
  });

  it("caps the number of lines", () => {
    const parsed = parseQuotationEditForm(
      build({
        rows: Array.from({ length: 61 }, () => ({
          variant: encodeVariant(PRODUCT, "new", "10 lbs"),
          quantity: "1",
        })),
      }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.items).toBeDefined();
  });

  it("treats missing fields as blank rather than throwing", () => {
    const parsed = parseQuotationEditForm(new FormData());

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.errors.customerId).toBeDefined();
    expect(parsed.errors.items).toBeDefined();
  });
});
