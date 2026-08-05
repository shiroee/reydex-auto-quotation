"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import type {
  CustomerOption,
  PresetOption,
  PriceVariant,
} from "@/lib/quotations/catalogue";
import {
  FIELD,
  encodeVariant,
  suggestSectionTitle,
  type QuotationFormState,
} from "@/lib/quotations/form";
import { formatPeso, multiplyAmount, sumAmounts } from "@/lib/quotations/money";

import { createQuotationAction } from "./actions";

type Line = {
  /** Stable React key; not submitted. */
  key: number;
  variant: string;
  quantity: string;
  section: string;
  /** While true, the section heading tracks the suggested one. */
  autoSection: boolean;
};

const SERVICE_LABEL: Record<string, string> = {
  new: "Brand new",
  refill: "Refill / service",
  maintenance: "Maintenance",
};

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  variant: "",
  quantity: "",
  section: "",
  autoSection: true,
});

export function QuotationForm({
  customers,
  presets,
  variants,
  today,
}: {
  customers: CustomerOption[];
  presets: PresetOption[];
  variants: PriceVariant[];
  today: string;
}) {
  const [state, formAction, isPending] = useActionState<
    QuotationFormState | null,
    FormData
  >(createQuotationAction, null);

  const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0];

  const [presetSlug, setPresetSlug] = useState(defaultPreset?.slug ?? "");
  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const variantIndex = useMemo(() => {
    const map = new Map<string, PriceVariant>();
    for (const v of variants) {
      map.set(encodeVariant(v.productId, v.serviceKind, v.capacityLabel), v);
    }
    return map;
  }, [variants]);

  const activePreset = presets.find((p) => p.slug === presetSlug);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  /* Live total, computed the same way Postgres will. */
  const lineTotals = lines.map((line) => {
    const variant = variantIndex.get(line.variant);
    if (!variant || line.quantity === "" || Number(line.quantity) <= 0) {
      return null;
    }
    try {
      return multiplyAmount(variant.unitPrice, line.quantity);
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
            ? suggestSectionTitle(
                variant.serviceKind,
                variant.category,
                variant.name,
              )
            : line.section;

        return { ...line, variant: value, section };
      }),
    );
  }

  /** Fills the subject from the chosen items, in the samples' style. */
  function suggestSubject() {
    const names = [
      ...new Set(
        lines
          .map((l) => variantIndex.get(l.variant)?.name)
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    if (names.length === 0) return;
    setSubject(names.join(" AND ").toUpperCase());
  }

  const lineErrors = state?.errors?.lines ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name={FIELD.presetSlug} value={presetSlug} />

      <div aria-live="polite" aria-atomic="true">
        {state?.formError ? (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200"
          >
            {state.formError}
          </p>
        ) : null}
      </div>

      {/* ---------------- Details ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Details
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Customer" error={state?.errors?.customerId} required>
            <select
              name={FIELD.customerId}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.cityProvince ? ` — ${c.cityProvince}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quotation type" error={state?.errors?.presetSlug}>
            <select
              value={presetSlug}
              onChange={(e) => setPresetSlug(e.target.value)}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            >
              {presets.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Subject" error={state?.errors?.subject} required>
              <div className="flex gap-2">
                <input
                  name={FIELD.subject}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="LION BRAND FIRE EXTINGUISHER AND SMOKE DETECTOR"
                  className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
                />
                <button
                  type="button"
                  onClick={suggestSubject}
                  className="shrink-0 rounded-lg border border-gold-500/25 px-3 text-xs font-medium text-gold-100/75 transition-colors hover:border-gold-400/45 hover:text-gold-100"
                >
                  From items
                </button>
              </div>
            </Field>
          </div>

          <Field label="Date" error={state?.errors?.quoteDate} required>
            <input
              type="date"
              name={FIELD.quoteDate}
              defaultValue={today}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>

          <Field
            label="Attention to"
            hint={
              selectedCustomer?.contactPerson
                ? `On file: ${selectedCustomer.contactPerson}`
                : "Optional"
            }
          >
            <input
              name={FIELD.attentionTo}
              defaultValue=""
              key={selectedCustomer?.id ?? "none"}
              placeholder={selectedCustomer?.contactPerson ?? "MR. / MS. …"}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>
        </div>
      </section>

      {/* ---------------- Items ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
            Items
          </h2>
          {state?.errors?.items ? (
            <p role="alert" className="text-sm text-red-300">
              {state.errors.items}
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
                            {SERVICE_LABEL[v.serviceKind]} ·{" "}
                            {formatPeso(v.unitPrice)}
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
                    ✕
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

                {variant ? (
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
            className="rounded-lg border border-gold-500/25 px-3.5 py-2 text-sm font-medium text-gold-100/80 transition-colors hover:border-gold-400/45 hover:text-gold-100"
          >
            + Add item
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

      {/* ---------------- Terms ---------------- */}
      <details className="reydex-card rounded-2xl p-5 sm:p-6">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Terms — override the {activePreset?.label ?? "preset"} defaults
        </summary>

        <p className="mt-3 text-xs text-gold-100/40">
          Leave blank to use the preset&apos;s wording.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Payment terms" hint={activePreset?.paymentTerms ?? "—"}>
            <input
              name={FIELD.paymentTerms}
              placeholder={activePreset?.paymentTerms ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/20"
            />
          </Field>

          <Field label="Delivery" hint={activePreset?.deliveryTerms ?? "—"}>
            <input
              name={FIELD.deliveryTerms}
              placeholder={activePreset?.deliveryTerms ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/20"
            />
          </Field>

          <Field label="Warranty" hint={activePreset?.warrantyTerms ?? "—"}>
            <input
              name={FIELD.warrantyTerms}
              placeholder={activePreset?.warrantyTerms ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/20"
            />
          </Field>

          <Field label="Mobilization" hint={activePreset?.mobilization ?? "—"}>
            <input
              name={FIELD.mobilization}
              placeholder={activePreset?.mobilization ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/20"
            />
          </Field>

          <Field label="Footnote" hint={activePreset?.notes ?? "—"}>
            <input
              name={FIELD.notes}
              placeholder={activePreset?.notes ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/20"
            />
          </Field>

          <Field
            label="Validity (days)"
            error={state?.errors?.validityDays}
            hint={`Preset: ${activePreset?.validityDays ?? 30}`}
          >
            <input
              name={FIELD.validityDays}
              inputMode="numeric"
              placeholder={String(activePreset?.validityDays ?? 30)}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/20"
            />
          </Field>
        </div>
      </details>

      <div className="flex items-center justify-end gap-4">
        <Link
          href="/quotations"
          className="text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="reydex-submit inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-semibold tracking-wide"
        >
          {isPending ? "Saving…" : "Save & open document"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gold-100/90">
        {label}
        {required ? <span className="ml-1 text-gold-500/70">*</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-red-300">
          {error}
        </span>
      ) : hint ? (
        <span className="truncate text-xs text-gold-100/30">{hint}</span>
      ) : null}
    </label>
  );
}
