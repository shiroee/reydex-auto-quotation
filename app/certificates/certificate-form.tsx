"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  FIELD,
  type CertificateFormState,
  type CertificateInput,
} from "@/lib/certificates/form";
import type { CertificateRecord } from "@/lib/certificates/service";

import {
  createCertificateAction,
  updateCertificateAction,
} from "./actions";

/**
 * Issue / edit form for a certificate of completion.
 *
 * One component for both, because the fields are identical — only the action,
 * the hidden id and the button wording differ. Splitting them would mean keeping
 * two copies of the same ten fields in step.
 *
 * The wording of the certificate is not editable here by design: it is fixed in
 * `components/certificates/certificate-layout.tsx`, and this form supplies only
 * the blanks it drops into.
 */
export function CertificateForm({
  certificate,
  today,
}: {
  certificate?: CertificateRecord;
  /** Today in Manila, for a new certificate's dates. See lib/quotations/dates. */
  today: string;
}) {
  const isEdit = certificate !== undefined;

  const [state, formAction, isPending] = useActionState<
    CertificateFormState | null,
    FormData
  >(isEdit ? updateCertificateAction : createCertificateAction, null);

  /**
   * A rejected submit wins over the stored row: React resets an uncontrolled
   * form once the action settles, so without the echoed values the fields would
   * snap back to what was loaded and quietly discard the edit.
   */
  function initial(field: keyof CertificateInput): string {
    return state?.values?.[field] ?? certificate?.[field] ?? "";
  }

  /** Both dates default to today on a new certificate, not on an edit. */
  function initialDate(field: "completionDate" | "issueDate"): string {
    return state?.values?.[field] ?? certificate?.[field] ?? today;
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {isEdit ? (
        <input type="hidden" name={FIELD.id} value={certificate.id} />
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
          The job
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Client" error={state?.errors?.clientName} required>
              <input
                name={FIELD.clientName}
                defaultValue={initial("clientName")}
                autoFocus={!isEdit}
                aria-invalid={state?.errors?.clientName ? "true" : undefined}
                placeholder="SHOPPER SAVERS"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Project"
              error={state?.errors?.projectTitle}
              hint="Printed after “PROJECT :” and again in the body"
              required
            >
              <input
                name={FIELD.projectTitle}
                defaultValue={initial("projectTitle")}
                aria-invalid={state?.errors?.projectTitle ? "true" : undefined}
                placeholder="FIRE DETECTION AND ALARM SYSTEM"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Location of the works"
              error={state?.errors?.location}
              required
            >
              <input
                name={FIELD.location}
                defaultValue={initial("location")}
                aria-invalid={state?.errors?.location ? "true" : undefined}
                placeholder="Subic, Zambales"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <Field
            label="Completed on"
            error={state?.errors?.completionDate}
            required
          >
            <input
              name={FIELD.completionDate}
              type="date"
              defaultValue={initialDate("completionDate")}
              aria-invalid={state?.errors?.completionDate ? "true" : undefined}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>

          <Field label="Issued on" error={state?.errors?.issueDate} required>
            <input
              name={FIELD.issueDate}
              type="date"
              defaultValue={initialDate("issueDate")}
              aria-invalid={state?.errors?.issueDate ? "true" : undefined}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Issued at"
              error={state?.errors?.issuePlace}
              hint="Where the certificate is signed — need not be the site"
              required
            >
              <input
                name={FIELD.issuePlace}
                defaultValue={initial("issuePlace")}
                aria-invalid={state?.errors?.issuePlace ? "true" : undefined}
                placeholder="Subic, Zambales"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Signatories
        </h2>
        <p className="mb-5 mt-2 text-sm leading-relaxed text-gold-100/45">
          All four are optional. Leave the parties blank to print the client
          name, and the signatory blank to print whoever the company profile
          names.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Inspected by"
              error={state?.errors?.inspectedBy}
              hint="The party that inspected and accepted the works"
            >
              <input
                name={FIELD.inspectedBy}
                defaultValue={initial("inspectedBy")}
                aria-invalid={state?.errors?.inspectedBy ? "true" : undefined}
                placeholder="Same as the client"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Approved & accepted by"
              error={state?.errors?.acceptedBy}
              hint="Printed under the second signature rule"
            >
              <input
                name={FIELD.acceptedBy}
                defaultValue={initial("acceptedBy")}
                aria-invalid={state?.errors?.acceptedBy ? "true" : undefined}
                placeholder="Same as the client"
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <Field label="Certified by" error={state?.errors?.signatoryName}>
            <input
              name={FIELD.signatoryName}
              defaultValue={initial("signatoryName")}
              aria-invalid={state?.errors?.signatoryName ? "true" : undefined}
              placeholder="REYNALDO MANALO"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Title" error={state?.errors?.signatoryTitle}>
            <input
              name={FIELD.signatoryTitle}
              defaultValue={initial("signatoryTitle")}
              aria-invalid={state?.errors?.signatoryTitle ? "true" : undefined}
              placeholder="General Manager"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>
        </div>
      </section>

      {/* Stacked on a phone, submit full-width — see the customer form. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <Link
          href="/certificates"
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
              : "Issue certificate"}
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
