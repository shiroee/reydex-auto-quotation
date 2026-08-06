"use client";

import { useMemo } from "react";
import { LuPlus, LuX } from "react-icons/lu";

import type { PriceVariant } from "@/lib/quotations/catalogue";
import { FIELD, encodeVariant, suggestSectionTitle } from "@/lib/quotations/form";
import { formatPeso, multiplyAmount, sumAmounts } from "@/lib/quotations/money";

/**
 * The line-items editor, shared by the new-quotation builder and the editor for
 * an existing one. Both need the same picker, the same per-line arithmetic and
 * the same running total; only what surrounds them differs.
 */

export type Line = {
  /** Stable React key; not submitted. */
  key: number;
  /**
   * Set for a line already stored on the quotation, and cleared the moment its
   * item is changed. Its presence is what tells the server to keep the line's
   * snapshot — the name, description and price it was quoted at — rather than
   * re-resolving it from today's catalogue.
   */
  id?: string;
  variant: string;
  quantity: string;
  section: string;
  /** While true, the section heading tracks the suggested one. */
  autoSection: boolean;
  /** For a stored line: how it was quoted, which is what it still costs. */
  quoted?: { label: string; unitPrice: string };
};

const SERVICE_LABEL: Record<string, string> = {
  new: "Brand new",
  refill: "Refill / service",
  maintenance: "Maintenance",
};

let nextKey = 1;

export function blankLine(): Line {
  return { key: nextKey++, variant: "", quantity: "", section: "", autoSection: true };
}

/**
 * A stored line, as a row.
 *
 * `variant` points at the matching catalogue option where there still is one, so
 * the select shows the right entry; otherwise it gets a synthetic value that only
 * has to be stable, since the server goes by `id` while one is set.
 */
export function storedLine(item: {
  id: string;
  productId: string | null;
  serviceKind: string;
  capacityLabel: string;
  sectionTitle: string | null;
  name: string;
  quantity: string;
  unitPrice: string;
}): Line {
  return {
    key: nextKey++,
    id: item.id,
    variant: item.productId
      ? encodeVariant(item.productId, item.serviceKind, item.capacityLabel)
      : `stored::${item.id}`,
    quantity: item.quantity,
    section: item.sectionTitle ?? "",
    autoSection: false,
    quoted: {
      label:
        `${item.name}${item.capacityLabel ? ` · ${item.capacityLabel}` : ""} · ` +
        `${SERVICE_LABEL[item.serviceKind] ?? item.serviceKind} · ` +
        `${formatPeso(item.unitPrice)} (as quoted)`,
      unitPrice: item.unitPrice,
    },
  };
}

export function variantIndexOf(variants: PriceVariant[]) {
  const map = new Map<string, PriceVariant>();
  for (const v of variants) {
    map.set(encodeVariant(v.productId, v.serviceKind, v.capacityLabel), v);
  }
  return map;
}

/** What a line costs per unit: as quoted for a stored line, else the catalogue. */
function unitPriceOf(line: Line, variants: Map<string, PriceVariant>) {
  if (line.id && line.quoted) return line.quoted.unitPrice;
  return variants.get(line.variant)?.unitPrice;
}

/** Fills the subject from the chosen items, in the samples' style. */
export function subjectFromLines(
  lines: Line[],
  variants: Map<string, PriceVariant>,
): string {
  const names = [
    ...new Set(
      lines
        .map((line) => variants.get(line.variant)?.name ?? line.quoted?.label)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  return names.join(" AND ").toUpperCase();
}

export function LineItemsField({
  variants,
  lines,
  setLines,
  lineErrors = {},
  itemsError,
}: {
  variants: PriceVariant[];
  lines: Line[];
  setLines: React.Dispatch<React.SetStateAction<Line[]>>;
  /** Per-line messages, keyed by the visible line number (1-based). */
  lineErrors?: Record<number, string>;
  itemsError?: string;
}) {
  const variantIndex = useMemo(() => variantIndexOf(variants), [variants]);

  /* Live total, computed the same way Postgres will. */
  const lineTotals = lines.map((line) => {
    const unitPrice = unitPriceOf(line, variantIndex);

    if (!unitPrice || line.quantity === "" || Number(line.quantity) <= 0) {
      return null;
    }

    try {
      return multiplyAmount(unitPrice, line.quantity);
    } catch {
      return null;
    }
  });

  const total = sumAmounts(lineTotals.filter((t): t is string => t !== null));

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function chooseVariant(key: number, value: string) {
    const variant = variantIndex.get(value);

    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;

        // Keep the heading in step with the item until it is edited by hand.
        const section =
          line.autoSection && variant
            ? suggestSectionTitle(variant.serviceKind, variant.category, variant.name)
            : line.section;

        /*
         * Picking a different item makes this a different line, so it stops being
         * the stored one: `id` and the quoted price go, and the server prices it
         * from the catalogue like any new line.
         */
        const stillStored = line.id !== undefined && value === line.variant;

        return {
          ...line,
          variant: value,
          section,
          id: stillStored ? line.id : undefined,
          quoted: stillStored ? line.quoted : undefined,
        };
      }),
    );
  }

  return (
    <section className="reydex-card rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Items
        </h2>
        {itemsError ? (
          <p role="alert" className="text-sm text-red-300">
            {itemsError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {lines.map((line, index) => {
          const variant = variantIndex.get(line.variant);
          const lineTotal = lineTotals[index];
          const error = lineErrors[index + 1];

          return (
            <div
              key={line.key}
              className="rounded-xl border border-gold-500/12 bg-ink-950/40 p-3.5"
            >
              {/*
               * Rendered for every row, blank ones included: the parser reads the
               * four line fields as parallel lists, so a row that skipped one
               * would shift every row after it.
               */}
              <input type="hidden" name={FIELD.itemId} value={line.id ?? ""} />

              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-60 flex-1">
                  <select
                    name={FIELD.itemVariant}
                    value={line.variant}
                    onChange={(e) => chooseVariant(line.key, e.target.value)}
                    aria-label={`Item ${index + 1}`}
                    aria-invalid={error ? "true" : undefined}
                    className="reydex-field w-full rounded-lg px-3 py-2 text-sm text-gold-50"
                  >
                    <option value="">Select an item…</option>

                    {/*
                     * A stored line keeps its own entry, so a quotation whose item
                     * has since been retired or repriced still opens with the
                     * right line selected instead of an empty picker.
                     */}
                    {line.id && line.quoted && !variant ? (
                      <option value={line.variant}>{line.quoted.label}</option>
                    ) : null}

                    {variants.map((v) => {
                      const value = encodeVariant(
                        v.productId,
                        v.serviceKind,
                        v.capacityLabel,
                      );
                      return (
                        <option key={value} value={value}>
                          {v.name}
                          {v.capacityLabel ? ` · ${v.capacityLabel}` : ""} ·{" "}
                          {SERVICE_LABEL[v.serviceKind]} · {formatPeso(v.unitPrice)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="w-24">
                  <input
                    name={FIELD.itemQuantity}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: e.target.value })
                    }
                    inputMode="decimal"
                    placeholder="Qty"
                    aria-label={`Quantity for item ${index + 1}`}
                    aria-invalid={error ? "true" : undefined}
                    className="reydex-field w-full rounded-lg px-3 py-2 text-sm text-gold-50 placeholder:text-gold-100/25"
                  />
                </div>

                <div className="w-28 pt-2 text-right text-sm tabular-nums text-gold-100/80">
                  {lineTotal ? formatPeso(lineTotal) : "—"}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1
                        ? [blankLine()]
                        : current.filter((l) => l.key !== line.key),
                    )
                  }
                  aria-label={`Remove item ${index + 1}`}
                  className="mt-1 rounded-lg px-2 py-1.5 text-gold-100/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <LuX aria-hidden className="size-4" />
                </button>
              </div>

              {/* Grouping header, prefilled from the item but editable. */}
              <input
                name={FIELD.itemSection}
                value={line.section}
                onChange={(e) =>
                  updateLine(line.key, {
                    section: e.target.value,
                    autoSection: false,
                  })
                }
                placeholder="Section heading (optional)"
                aria-label={`Section heading for item ${index + 1}`}
                className="reydex-field mt-2.5 w-full rounded-lg px-3 py-1.5 text-xs text-gold-100/70 placeholder:text-gold-100/20"
              />

              {line.id && line.quoted ? (
                <p className="mt-2 text-xs text-gold-100/35">
                  Priced as quoted, at {formatPeso(line.quoted.unitPrice)} per unit
                  {variant && variant.unitPrice !== line.quoted.unitPrice
                    ? ` — the catalogue now says ${formatPeso(variant.unitPrice)}`
                    : ""}
                  .
                </p>
              ) : variant ? (
                <p className="mt-2 text-xs text-gold-100/35">
                  {variant.sku} · unit {formatPeso(variant.unitPrice)} per{" "}
                  {variant.unitLabel}
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="mt-2 text-xs text-red-300">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setLines((current) => [...current, blankLine()])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 px-3.5 py-2 text-sm font-medium text-gold-100/80 transition-colors hover:border-gold-400/45 hover:text-gold-100"
        >
          <LuPlus aria-hidden className="size-4" />
          Add item
        </button>

        <p className="text-right">
          <span className="mr-3 text-xs uppercase tracking-wider text-gold-100/40">
            Total
          </span>
          <span className="text-lg font-semibold tabular-nums text-gold-200">
            {formatPeso(total)}
          </span>
        </p>
      </div>
    </section>
  );
}
