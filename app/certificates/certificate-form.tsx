"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  FIELD,
  type CertificateFormState,
  type CertificateInput,
  type CertificateKind,
} from "@/lib/certificates/form";
import type { CertificateRecord } from "@/lib/certificates/service";

import {
  createCertificateAction,
  updateCertificateAction,
} from "./actions";

/**
 * Issue / edit form for either certificate.
 *
 * One component for both documents and for both modes. The two kinds share
 * their six required fields — client, system, location, the two dates, the place
 * of issue — and differ only in the block underneath, so splitting them would
 * mean keeping two copies of those six in step. The labels change with the kind
 * because the same column means something slightly different on each sheet: a
 * completion date on one, a test date on the other.
 *
 * The wording of the certificates is not editable here by design: it is fixed in
 * the layouts under `components/certificates/`, and this form supplies only the
 * blanks they drop into.
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

  /*
   * Which document this is. Chosen once, at issue: the reference is drawn from
   * the chosen kind's own series and printed on a sheet that may already be in a
   * client's file, so an edit shows the kind rather than offering it. The server
   * enforces the same thing — see `updateCertificate`.
   */
  const [kind, setKind] = useState<CertificateKind>(
    certificate?.kind ?? "completion",
  );
  const isSafety = kind === "safety_reliability";

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

      {/*
       * The kind is submitted either way: on an edit it is what tells the parser
       * which half of the form to keep, even though the row's own kind never
       * changes.
       */}
      {isEdit ? (
        <input type="hidden" name={FIELD.kind} value={kind} />
      ) : (
        <section className="reydex-card rounded-2xl p-5 sm:p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
            Document
          </h2>
          <p className="mb-5 text-sm leading-relaxed text-gold-100/45">
            Fixed once the certificate is issued — the reference number is drawn
            from this document&apos;s own series.
          </p>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Kind of certificate</legend>

            <KindChoice
              value="completion"
              checked={!isSafety}
              onSelect={setKind}
              title="Certificate of completion"
              detail="Reydex certifies that it completed the preventive maintenance, inspection and testing. Signed by the company, accepted by the client."
              reference="RDX-COC-…"
            />
            <KindChoice
              value="safety_reliability"
              checked={isSafety}
              onSelect={setKind}
              title="Safety & reliability"
              detail="A Registered Mechanical Engineer certifies that the system is functional and safe to operate. Signed by the engineer, with their PRC registration."
              reference="RDX-CSR-…"
            />
          </fieldset>
        </section>
      )}

      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          {isSafety ? "The inspection" : "The job"}
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label={isSafety ? "Establishment" : "Client"}
              error={state?.errors?.clientName}
              hint={
                isSafety
                  ? "Printed under the title and again in the body"
                  : undefined
              }
              required
            >
              <input
                name={FIELD.clientName}
                defaultValue={initial("clientName")}
                autoFocus={!isEdit}
                aria-invalid={state?.errors?.clientName ? "true" : undefined}
                placeholder={
                  isSafety ? "SHOPPERS SAVER GROCERY" : "SHOPPER SAVERS"
                }
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label={isSafety ? "System certified" : "Project"}
              error={state?.errors?.projectTitle}
              hint={
                isSafety
                  ? "Printed in the body, in title case as typed"
                  : "Printed after “PROJECT :” and again in the body"
              }
              required
            >
              <input
                name={FIELD.projectTitle}
                defaultValue={initial("projectTitle")}
                aria-invalid={state?.errors?.projectTitle ? "true" : undefined}
                placeholder={
                  isSafety
                    ? "Fire Detection and Alarm System"
                    : "FIRE DETECTION AND ALARM SYSTEM"
                }
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label={
                isSafety
                  ? "Location of the establishment"
                  : "Location of the works"
              }
              error={state?.errors?.location}
              required
            >
              <input
                name={FIELD.location}
                defaultValue={initial("location")}
                aria-invalid={state?.errors?.location ? "true" : undefined}
                placeholder={
                  isSafety
                    ? "Brgy. Baraca Camachile Subic, Zambales"
                    : "Subic, Zambales"
                }
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <Field
            label={isSafety ? "Tested & maintained on" : "Completed on"}
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
          {isSafety ? "Certifying engineer" : "Signatories"}
        </h2>
        <p className="mb-5 mt-2 text-sm leading-relaxed text-gold-100/45">
          {isSafety ? (
            <>
              Every field here is optional, but the registration lines are what
              the Bureau of Fire Protection reads off the sheet. Leave the name
              blank to print whoever the company profile names.
            </>
          ) : (
            <>
              All four are optional. Leave the parties blank to print the client
              name, and the signatory blank to print whoever the company profile
              names.
            </>
          )}
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {/*
           * The two parties belong to the completion certificate alone: nobody
           * countersigns a safety certification, so offering the fields would
           * invite data that no document prints.
           */}
          {isSafety ? null : (
            <>
              <div className="sm:col-span-2">
                <Field
                  label="Inspected by"
                  error={state?.errors?.inspectedBy}
                  hint="The party that inspected and accepted the works"
                >
                  <input
                    name={FIELD.inspectedBy}
                    defaultValue={initial("inspectedBy")}
                    aria-invalid={
                      state?.errors?.inspectedBy ? "true" : undefined
                    }
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
                    aria-invalid={
                      state?.errors?.acceptedBy ? "true" : undefined
                    }
                    placeholder="Same as the client"
                    className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
                  />
                </Field>
              </div>
            </>
          )}

          <Field label="Certified by" error={state?.errors?.signatoryName}>
            <input
              name={FIELD.signatoryName}
              defaultValue={initial("signatoryName")}
              aria-invalid={state?.errors?.signatoryName ? "true" : undefined}
              placeholder={isSafety ? "BRYAN A. LALAP" : "REYNALDO MANALO"}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Title" error={state?.errors?.signatoryTitle}>
            <input
              name={FIELD.signatoryTitle}
              defaultValue={initial("signatoryTitle")}
              aria-invalid={state?.errors?.signatoryTitle ? "true" : undefined}
              placeholder={
                isSafety
                  ? "Registered Mechanical Engineer (RME)"
                  : "General Manager"
              }
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          {isSafety ? (
            <>
              <Field
                label="PRC registration no."
                error={state?.errors?.engineerLicenseNo}
                hint="Printed as “PRC Registration # 90214”"
              >
                <input
                  name={FIELD.engineerLicenseNo}
                  defaultValue={initial("engineerLicenseNo")}
                  aria-invalid={
                    state?.errors?.engineerLicenseNo ? "true" : undefined
                  }
                  placeholder="90214"
                  className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
                />
              </Field>

              <Field
                label="Licence valid until"
                error={state?.errors?.engineerLicenseExpiry}
                hint="Optional — omitted from the sheet when blank"
              >
                <input
                  name={FIELD.engineerLicenseExpiry}
                  type="date"
                  defaultValue={initial("engineerLicenseExpiry")}
                  aria-invalid={
                    state?.errors?.engineerLicenseExpiry ? "true" : undefined
                  }
                  className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field
                  label="Findings"
                  hint="The closing clause of the third paragraph"
                >
                  <select
                    name={FIELD.findings}
                    defaultValue={initial("findings") || "none"}
                    className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
                  >
                    <option value="none">
                      Working normally — nothing to note
                    </option>
                    <option value="minor">
                      Working normally, but with minor findings to consider
                    </option>
                  </select>
                </Field>
              </div>
            </>
          ) : null}
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

/**
 * One of the two kinds, as a card-sized radio.
 *
 * A real `<input type="radio">` rather than a styled button: it gives arrow-key
 * navigation within the group, a single tab stop, and a form value, all for
 * free. It is visually hidden with `sr-only` rather than `display: none`, which
 * would take it out of the accessibility tree along with the focus ring the
 * card draws from `peer-focus-visible`.
 */
function KindChoice({
  value,
  checked,
  onSelect,
  title,
  detail,
  reference,
}: {
  value: CertificateKind;
  checked: boolean;
  onSelect: (kind: CertificateKind) => void;
  title: string;
  detail: string;
  reference: string;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition ${
        checked
          ? "border-gold-500/60 bg-gold-500/10"
          : "border-gold-500/15 hover:border-gold-500/35"
      }`}
    >
      <input
        type="radio"
        name={FIELD.kind}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span className="flex items-center justify-between gap-2 peer-focus-visible:underline">
        <span className="text-sm font-semibold text-gold-100">{title}</span>
        <span className="font-mono text-[0.7rem] text-gold-100/40">
          {reference}
        </span>
      </span>
      <span className="text-xs leading-relaxed text-gold-100/45">{detail}</span>
    </label>
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
