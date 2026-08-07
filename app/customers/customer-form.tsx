"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  FIELD,
  type CustomerFormState,
  type CustomerInput,
} from "@/lib/customers/form";
import type { CustomerRecord } from "@/lib/customers/service";

import { createCustomerAction, updateCustomerAction } from "./actions";

/**
 * Add / edit form for a customer.
 *
 * One component for both, because the fields are identical — only the action,
 * the hidden id and the button wording differ. Splitting them would mean
 * keeping two copies of the same seven fields in step.
 */
export function CustomerForm({ customer }: { customer?: CustomerRecord }) {
  const isEdit = customer !== undefined;

  const [state, formAction, isPending] = useActionState<
    CustomerFormState | null,
    FormData
  >(isEdit ? updateCustomerAction : createCustomerAction, null);

  /**
   * A rejected submit wins over the stored row: React resets an uncontrolled
   * form once the action settles, so without the echoed values the fields would
   * snap back to what was loaded and quietly discard the edit.
   */
  function initial(field: keyof CustomerInput): string {
    return state?.values?.[field] ?? customer?.[field] ?? "";
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {isEdit ? (
        <input type="hidden" name={FIELD.id} value={customer.id} />
      ) : null}

      {/* Always rendered so screen readers announce errors on submit. */}
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

      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Customer
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name" error={state?.errors?.name} required>
              <input
                name={FIELD.name}
                defaultValue={initial("name")}
                autoFocus={!isEdit}
                aria-invalid={state?.errors?.name ? "true" : undefined}
                placeholder="PUREGOLD PRICE CLUB, INC. — CASTILLEJOS"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Address"
              error={state?.errors?.addressLine}
              hint="Printed above the salutation"
            >
              <input
                name={FIELD.addressLine}
                defaultValue={initial("addressLine")}
                aria-invalid={state?.errors?.addressLine ? "true" : undefined}
                placeholder="National Highway, Brgy. San Roque"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <Field label="City / province" error={state?.errors?.cityProvince}>
            <input
              name={FIELD.cityProvince}
              defaultValue={initial("cityProvince")}
              aria-invalid={state?.errors?.cityProvince ? "true" : undefined}
              placeholder="Castillejos, Zambales"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field
            label="Contact person"
            error={state?.errors?.contactPerson}
            hint="Suggested as the “Attention to” line"
          >
            <input
              name={FIELD.contactPerson}
              defaultValue={initial("contactPerson")}
              aria-invalid={state?.errors?.contactPerson ? "true" : undefined}
              placeholder="MR. RENE R. ESGASANE"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Email" error={state?.errors?.contactEmail}>
            <input
              name={FIELD.contactEmail}
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              defaultValue={initial("contactEmail")}
              aria-invalid={state?.errors?.contactEmail ? "true" : undefined}
              placeholder="purchasing@example.com"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Phone" error={state?.errors?.contactPhone}>
            <input
              name={FIELD.contactPhone}
              type="tel"
              autoComplete="off"
              defaultValue={initial("contactPhone")}
              aria-invalid={state?.errors?.contactPhone ? "true" : undefined}
              placeholder="0933-3347-702"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Notes"
              error={state?.errors?.notes}
              hint="Internal only — never printed"
            >
              <textarea
                name={FIELD.notes}
                defaultValue={initial("notes")}
                rows={3}
                aria-invalid={state?.errors?.notes ? "true" : undefined}
                className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Stacked on a phone, submit full-width — see the item form. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <Link
          href="/customers"
          className="order-2 text-center text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline sm:order-1"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="reydex-submit order-1 inline-flex h-11 w-full items-center justify-center rounded-lg px-6 text-sm font-semibold tracking-wide sm:order-2 sm:w-auto"
        >
          {isPending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Add customer"}
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
