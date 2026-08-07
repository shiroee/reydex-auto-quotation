"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LuCircleAlert, LuWand } from "react-icons/lu";

import {
  FIELD,
  slugify,
  TEMPLATE_LABEL,
  TEMPLATES,
  type PresetFormState,
} from "@/lib/presets/form";
import type { PresetRecord } from "@/lib/presets/service";

import { createPresetAction, updatePresetAction } from "./actions";

/**
 * Add / edit form for a quotation type.
 *
 * One component for both: the fields are identical, and only the action, the
 * hidden id and the button wording differ.
 */
export function PresetForm({ preset }: { preset?: PresetRecord }) {
  const isEdit = preset !== undefined;

  const [state, formAction, isPending] = useActionState<
    PresetFormState | null,
    FormData
  >(isEdit ? updatePresetAction : createPresetAction, null);

  /*
   * The slug is controlled so it can track the label until it is edited by
   * hand — on an existing row it is left alone, since it is the stable key the
   * seed script and any bookmark refer to.
   */
  const [label, setLabel] = useState(state?.values?.label ?? preset?.label ?? "");
  const [slug, setSlug] = useState(state?.values?.slug ?? preset?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(isEdit);

  /**
   * A rejected submit wins over the stored row: React resets an uncontrolled
   * form once the action settles, so without the echoed values the fields would
   * snap back to what was loaded and quietly discard the edit.
   */
  function initial(field: keyof typeof FIELD, fallback = ""): string {
    const echoed = state?.values as Record<string, unknown> | undefined;
    const value = echoed?.[field];
    if (typeof value === "string") return value;

    const stored = preset as Record<string, unknown> | undefined;
    const storedValue = stored?.[field];
    return typeof storedValue === "string" ? storedValue : fallback;
  }

  function initialChecked(field: "showBankDetails" | "isDefault"): boolean {
    return state?.values?.[field] ?? preset?.[field] ?? false;
  }

  const exclusionsText =
    state?.values?.exclusions ?? (preset?.exclusions ?? []).join("\n");

  const scopeSections = preset?.scopeOfWorks?.length ?? 0;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {isEdit ? (
        <input type="hidden" name={FIELD.id} value={preset.id} />
      ) : null}

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

      {/* ---------------- Identity ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Type
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" error={state?.errors?.label} required>
            <input
              name={FIELD.label}
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
              autoFocus={!isEdit}
              aria-invalid={state?.errors?.label ? "true" : undefined}
              placeholder="Brand new supply (COD)"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field
            label="Slug"
            error={state?.errors?.slug}
            hint="Stable key used by the seed script — change with care"
            required
          >
            <div className="flex gap-2">
              <input
                name={FIELD.slug}
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugEdited(true);
                }}
                aria-invalid={state?.errors?.slug ? "true" : undefined}
                placeholder="supply-new"
                spellCheck={false}
                className="reydex-field w-full rounded-lg px-3 py-2.5 font-mono text-sm text-gold-50 placeholder:text-gold-100/25"
              />
              <button
                type="button"
                onClick={() => {
                  setSlug(slugify(label));
                  setSlugEdited(false);
                }}
                title="Derive the slug from the name"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gold-500/25 px-3 text-xs font-medium text-gold-100/75 transition-colors hover:border-gold-400/45 hover:text-gold-100"
              >
                <LuWand aria-hidden className="size-3.5" />
                From name
              </button>
            </div>
          </Field>

          <Field
            label="Layout"
            error={state?.errors?.template}
            hint="Which document shape this type prints as"
            required
          >
            <select
              name={FIELD.template}
              defaultValue={initial("template", preset?.template ?? "supply")}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            >
              {TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {TEMPLATE_LABEL[template]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Validity (days)"
            error={state?.errors?.validityDays}
            hint="Default 30"
          >
            <input
              name={FIELD.validityDays}
              defaultValue={initial(
                "validityDays",
                preset ? String(preset.validityDays) : "",
              )}
              inputMode="numeric"
              aria-invalid={state?.errors?.validityDays ? "true" : undefined}
              placeholder="30"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Subject template"
              error={state?.errors?.subjectTemplate}
              hint="Optional. {{customer}} is substituted when a quotation is raised."
            >
              <input
                name={FIELD.subjectTemplate}
                defaultValue={initial("subjectTemplate")}
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <Checkbox
            name={FIELD.showBankDetails}
            defaultChecked={initialChecked("showBankDetails")}
            label="Print bank details"
            hint="Shown on the Umicore-style sheet, not on True North's"
          />

          <Checkbox
            name={FIELD.isDefault}
            defaultChecked={initialChecked("isDefault")}
            label="Pre-select in the builder"
            hint="Only one type can be the default; setting this clears the others"
          />
        </div>
      </section>

      {/* ---------------- Letter body ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Letter
        </h2>

        <div className="grid gap-5">
          <Field label="Salutation" error={state?.errors?.salutation}>
            <input
              name={FIELD.salutation}
              defaultValue={initial("salutation")}
              placeholder="Dear Sir/Ma'am,"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Opening paragraph" error={state?.errors?.introParagraph}>
            <textarea
              name={FIELD.introParagraph}
              defaultValue={initial("introParagraph")}
              rows={3}
              className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>

          <Field
            label="Closing paragraph"
            error={state?.errors?.closingParagraph}
          >
            <textarea
              name={FIELD.closingParagraph}
              defaultValue={initial("closingParagraph")}
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
          <Field label="Payment" error={state?.errors?.paymentTerms}>
            <input
              name={FIELD.paymentTerms}
              defaultValue={initial("paymentTerms")}
              placeholder="Cash On Delivery"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Delivery" error={state?.errors?.deliveryTerms}>
            <input
              name={FIELD.deliveryTerms}
              defaultValue={initial("deliveryTerms")}
              placeholder="Three (3) to Five (5) working days."
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Warranty" error={state?.errors?.warrantyTerms}>
            <input
              name={FIELD.warrantyTerms}
              defaultValue={initial("warrantyTerms")}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Mobilization" error={state?.errors?.mobilization}>
            <input
              name={FIELD.mobilization}
              defaultValue={initial("mobilization")}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Footnote"
              error={state?.errors?.notes}
              hint="Printed under the terms, e.g. “*As per contract”"
            >
              <input
                name={FIELD.notes}
                defaultValue={initial("notes")}
                className="reydex-field w-full rounded-lg px-3 py-2.5 text-sm text-gold-50 placeholder:text-gold-100/25"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Exclusions"
              error={state?.errors?.exclusions}
              hint="One per line. Printed as the “Exclusions:” list."
            >
              <textarea
                name={FIELD.exclusions}
                defaultValue={exclusionsText}
                rows={4}
                className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-sm text-gold-50"
              />
            </Field>
          </div>
        </div>

        {/*
         * Scope of works is a nested outline this form does not edit; updates
         * leave it untouched rather than flattening it. Say what is there so its
         * absence from the form does not read as "this type has none".
         */}
        {scopeSections > 0 ? (
          <p className="mt-5 text-xs text-gold-100/40">
            Carries a scope of works of {scopeSections}{" "}
            {scopeSections === 1 ? "section" : "sections"}, kept as-is by this
            form — it is edited in the seed script.
          </p>
        ) : null}
      </section>

      {/* Stacked on a phone, submit full-width — see the item form. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <Link
          href="/quotation-types"
          className="order-2 text-center text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline sm:order-1"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="reydex-submit order-1 inline-flex h-11 w-full items-center justify-center rounded-lg px-6 text-sm font-semibold tracking-wide sm:order-2 sm:w-auto"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add type"}
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
        <span className="text-xs text-gold-100/30">{hint}</span>
      ) : null}
    </label>
  );
}

function Checkbox({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-gold-400"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gold-100/90">{label}</span>
        {hint ? <span className="text-xs text-gold-100/30">{hint}</span> : null}
      </span>
    </label>
  );
}
