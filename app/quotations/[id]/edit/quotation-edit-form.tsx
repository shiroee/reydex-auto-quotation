"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { LuCircleAlert, LuWand } from "react-icons/lu";

import {
  LineItemsField,
  storedLine,
  subjectFromLines,
  variantIndexOf,
  type Line,
} from "@/components/quotations/line-items-field";
import type { CustomerOption, PriceVariant } from "@/lib/quotations/catalogue";
import {
  EDIT_FIELD,
  TEMPLATES,
  type QuotationEditState,
} from "@/lib/quotations/edit-form";
import { FIELD } from "@/lib/quotations/form";
import type { PrintableQuotation } from "@/lib/quotations/service";

import { updateQuotationAction } from "@/app/quotations/actions";

const TEMPLATE_LABEL: Record<string, string> = {
  supply: "Supply",
  service_proposal: "Service proposal",
};

/**
 * Editor for a stored quotation.
 *
 * Separate from the builder rather than a mode of it, because the two work from
 * different material: the builder composes a preset plus overrides, while this
 * edits the concrete wording a quotation already carries. Sharing the form would
 * mean every field asking which of the two it was in.
 */
export function QuotationEditForm({
  quotation,
  items,
  exclusions,
  customers,
  variants,
}: {
  quotation: PrintableQuotation["quotation"];
  items: PrintableQuotation["items"];
  exclusions: string[];
  customers: CustomerOption[];
  variants: PriceVariant[];
}) {
  const [state, formAction, isPending] = useActionState<
    QuotationEditState | null,
    FormData
  >(updateQuotationAction, null);

  const [customerId, setCustomerId] = useState(quotation.customerId);
  const [subject, setSubject] = useState(quotation.subject);
  const [lines, setLines] = useState<Line[]>(() =>
    items.map((item) =>
      storedLine({
        id: item.id,
        productId: item.productId,
        serviceKind: item.serviceKind,
        capacityLabel: item.capacityLabel,
        sectionTitle: item.sectionTitle,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }),
    ),
  );

  const variantIndex = useMemo(() => variantIndexOf(variants), [variants]);

  function suggestSubject() {
    const suggested = subjectFromLines(lines, variantIndex);
    if (suggested !== "") setSubject(suggested);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name={EDIT_FIELD.id} value={quotation.id} />

      {/* Always rendered so screen readers announce errors on submit. */}
      <div aria-live="polite" aria-atomic="true">
        {state?.formError ? (
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200"
          >
            <LuCircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
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

          <Field
            label="Layout"
            error={state?.errors?.template}
            hint="Which document shape this prints as"
            required
          >
            <select
              name={EDIT_FIELD.template}
              defaultValue={quotation.template}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            >
              {TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {TEMPLATE_LABEL[template]}
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
                  className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
                />
                <button
                  type="button"
                  onClick={suggestSubject}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gold-500/25 px-3 text-xs font-medium text-gold-100/75 transition-colors hover:border-gold-400/45 hover:text-gold-100"
                >
                  <LuWand aria-hidden className="size-3.5" />
                  From items
                </button>
              </div>
            </Field>
          </div>

          <Field label="Date" error={state?.errors?.quoteDate} required>
            <input
              type="date"
              name={FIELD.quoteDate}
              defaultValue={quotation.quoteDate}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>

          <Field label="Attention to" hint="Optional">
            <input
              name={FIELD.attentionTo}
              defaultValue={quotation.attentionTo ?? ""}
              placeholder="MR. / MS. …"
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

      {/* ---------------- Letter ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Letter
        </h2>

        <div className="grid gap-5">
          <Field label="Salutation" error={state?.errors?.salutation}>
            <input
              name={EDIT_FIELD.salutation}
              defaultValue={quotation.salutation}
              placeholder="Dear Sir/Ma'am,"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Opening paragraph">
            <textarea
              name={EDIT_FIELD.introParagraph}
              defaultValue={quotation.introParagraph ?? ""}
              rows={3}
              className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>

          <Field label="Closing paragraph">
            <textarea
              name={EDIT_FIELD.closingParagraph}
              defaultValue={quotation.closingParagraph ?? ""}
              rows={3}
              className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>
        </div>
      </section>

      {/* ---------------- Terms ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Terms
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Payment terms">
            <input
              name={FIELD.paymentTerms}
              defaultValue={quotation.paymentTerms ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50"
            />
          </Field>

          <Field label="Delivery">
            <input
              name={FIELD.deliveryTerms}
              defaultValue={quotation.deliveryTerms ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50"
            />
          </Field>

          <Field label="Warranty">
            <input
              name={FIELD.warrantyTerms}
              defaultValue={quotation.warrantyTerms ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50"
            />
          </Field>

          <Field label="Mobilization">
            <input
              name={FIELD.mobilization}
              defaultValue={quotation.mobilization ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50"
            />
          </Field>

          <Field label="Footnote" hint="Printed under the terms">
            <input
              name={FIELD.notes}
              defaultValue={quotation.notes ?? ""}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50"
            />
          </Field>

          <Field
            label="Validity (days)"
            error={state?.errors?.validityDays}
            hint="Default 30"
          >
            <input
              name={FIELD.validityDays}
              defaultValue={String(quotation.validityDays)}
              inputMode="numeric"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50"
            />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name={EDIT_FIELD.showBankDetails}
                defaultChecked={quotation.showBankDetails}
                className="mt-0.5 size-4 shrink-0 accent-gold-400"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gold-100/90">
                  Print bank details
                </span>
                <span className="text-xs text-gold-100/30">
                  Shown on the Umicore-style sheet, not on True North&apos;s
                </span>
              </span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Exclusions"
              error={state?.errors?.exclusions}
              hint="One per line. Printed as the “Exclusions:” list."
            >
              <textarea
                name={EDIT_FIELD.exclusions}
                defaultValue={exclusions.join("\n")}
                rows={4}
                className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-sm text-gold-50"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Stacked on a phone, submit full-width — see the item form. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <Link
          href={`/quotations/${quotation.id}/print`}
          className="order-2 text-center text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline sm:order-1"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="reydex-submit order-1 inline-flex h-11 w-full items-center justify-center rounded-lg px-6 text-sm font-semibold tracking-wide sm:order-2 sm:w-auto"
        >
          {isPending ? "Saving…" : "Save changes"}
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
