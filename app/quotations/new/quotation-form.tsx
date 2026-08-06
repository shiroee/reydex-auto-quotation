"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  blankLine,
  LineItemsField,
  subjectFromLines,
  variantIndexOf,
  type Line,
} from "@/components/quotations/line-items-field";
import type {
  CustomerOption,
  PresetOption,
  PriceVariant,
} from "@/lib/quotations/catalogue";
import { FIELD, type QuotationFormState } from "@/lib/quotations/form";

import { createQuotationAction } from "./actions";

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

  const variantIndex = useMemo(() => variantIndexOf(variants), [variants]);

  const activePreset = presets.find((p) => p.slug === presetSlug);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  function suggestSubject() {
    const suggested = subjectFromLines(lines, variantIndex);
    if (suggested !== "") setSubject(suggested);
  }

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

      <LineItemsField
        variants={variants}
        lines={lines}
        setLines={setLines}
        lineErrors={state?.errors?.lines}
        itemsError={state?.errors?.items}
      />

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
