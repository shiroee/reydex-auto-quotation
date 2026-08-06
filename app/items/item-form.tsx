"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LuCircleAlert, LuPlus, LuX } from "react-icons/lu";

import {
  CATEGORIES,
  CATEGORY_LABEL,
  FIELD,
  SERVICE_KINDS,
  SERVICE_KIND_LABEL,
  type ItemFormState,
} from "@/lib/items/form";
import type { ItemRecord } from "@/lib/items/service";
import { formatPeso } from "@/lib/quotations/money";

import { createItemAction, updateItemAction } from "./actions";

type Row = {
  /** Stable React key; not submitted. */
  key: number;
  serviceKind: string;
  capacityLabel: string;
  capacityLbs: string;
  unitPrice: string;
};

let nextKey = 1;
const blankRow = (): Row => ({
  key: nextKey++,
  serviceKind: "new",
  capacityLabel: "",
  capacityLbs: "",
  unitPrice: "",
});

/**
 * Add / edit form for a catalogue item.
 *
 * The variant rows are controlled state rather than plain inputs: they are added
 * and removed dynamically, and a rejected submit has to put back exactly what was
 * typed in each one.
 */
export function ItemForm({ item }: { item?: ItemRecord }) {
  const isEdit = item !== undefined;

  const [state, formAction, isPending] = useActionState<
    ItemFormState | null,
    FormData
  >(isEdit ? updateItemAction : createItemAction, null);

  const [rows, setRows] = useState<Row[]>(() => {
    const stored = item?.variants.map((variant) => ({
      serviceKind: variant.serviceKind,
      capacityLabel: variant.capacityLabel,
      capacityLbs: variant.capacityLbs ?? "",
      unitPrice: variant.unitPrice,
    }));

    if (!stored || stored.length === 0) return [blankRow()];

    return stored.map((variant) => ({ key: nextKey++, ...variant }));
  });

  /*
   * Put back exactly the rows that were submitted when the action rejects them.
   * A `useState` initialiser runs once, so the echoed values have to be applied
   * when they arrive — adjusted during render rather than in an effect, so the
   * rows never paint in their pre-submit state.
   */
  const [appliedState, setAppliedState] = useState(state);
  if (state !== appliedState) {
    setAppliedState(state);

    const echoed = state?.values?.variants;
    if (echoed) {
      setRows(
        echoed.length === 0
          ? [blankRow()]
          : echoed.map((variant) => ({ key: nextKey++, ...variant })),
      );
    }
  }

  /**
   * A rejected submit wins over the stored row: React resets an uncontrolled
   * form once the action settles, so without the echoed values the fields would
   * snap back to what was loaded and quietly discard the edit.
   */
  function initial(
    field: "sku" | "name" | "brand" | "unitLabel" | "description",
  ): string {
    return state?.values?.[field] ?? item?.[field] ?? "";
  }

  const specsText = state?.values?.specs ?? (item?.specs ?? []).join("\n");
  const category = state?.values?.category ?? item?.category ?? "";
  const isActive = state?.values?.isActive ?? item?.isActive ?? true;

  const rowErrors = state?.errors?.variantRows ?? {};

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {isEdit ? <input type="hidden" name={FIELD.id} value={item.id} /> : null}

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

      {/* ---------------- Item ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Item
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="SKU"
            error={state?.errors?.sku}
            hint="Unique; upper-cased on save"
            required
          >
            <input
              name={FIELD.sku}
              defaultValue={initial("sku")}
              autoFocus={!isEdit}
              spellCheck={false}
              aria-invalid={state?.errors?.sku ? "true" : undefined}
              placeholder="FE-DC-10"
              className="reydex-field w-full rounded-lg px-3 py-2.5 font-mono text-sm text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field
            label="Name"
            error={state?.errors?.name}
            hint="As printed after “ITEM n:”"
            required
          >
            <input
              name={FIELD.name}
              defaultValue={initial("name")}
              aria-invalid={state?.errors?.name ? "true" : undefined}
              placeholder="DRY CHEMICAL TYPE"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field label="Category" error={state?.errors?.category} required>
            <select
              name={FIELD.category}
              defaultValue={category || "fire_extinguisher"}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Brand" error={state?.errors?.brand} hint="Optional">
            <input
              name={FIELD.brand}
              defaultValue={initial("brand")}
              placeholder="Lion Brand"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field
            label="Unit"
            error={state?.errors?.unitLabel}
            hint="Printed in the quantity column — UNIT, LOT, SET"
          >
            <input
              name={FIELD.unitLabel}
              defaultValue={initial("unitLabel")}
              placeholder="UNIT"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Checkbox
            name={FIELD.isActive}
            defaultChecked={isActive}
            label="Available to quote"
            hint="Clear this to retire an item without deleting it"
          />

          <div className="sm:col-span-2">
            <Field
              label="Description"
              error={state?.errors?.description}
              hint="Lead-in paragraph printed after “DESCRIPTION:”"
            >
              <textarea
                name={FIELD.description}
                defaultValue={initial("description")}
                rows={3}
                className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Specs"
              error={state?.errors?.specs}
              hint="One bullet per line. Independent of the description — the samples use both."
            >
              <textarea
                name={FIELD.specs}
                defaultValue={specsText}
                rows={4}
                className="reydex-field w-full resize-y rounded-lg px-3 py-2.5 text-sm text-gold-50"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* ---------------- Price variants ---------------- */}
      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
            Prices
          </h2>
          {state?.errors?.variants ? (
            <p role="alert" className="text-sm text-red-300">
              {state.errors.variants}
            </p>
          ) : null}
        </div>

        <p className="mb-5 text-xs leading-relaxed text-gold-100/40">
          One row per sellable variant: price depends on service kind and
          capacity, not on the item alone. Removing a row retires that price —
          it stops being offered, and stays on record as history.
        </p>

        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const error = rowErrors[index + 1];

            return (
              <div
                key={row.key}
                className="rounded-xl border border-gold-500/12 bg-ink-950/40 p-3.5"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-40 flex-1">
                    <select
                      name={FIELD.variantServiceKind}
                      value={row.serviceKind}
                      onChange={(event) =>
                        updateRow(row.key, { serviceKind: event.target.value })
                      }
                      aria-label={`Service kind for price ${index + 1}`}
                      aria-invalid={error ? "true" : undefined}
                      className="reydex-field w-full rounded-lg px-3 py-2 text-sm text-gold-50"
                    >
                      {SERVICE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {SERVICE_KIND_LABEL[kind]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-28">
                    <input
                      name={FIELD.variantCapacityLabel}
                      value={row.capacityLabel}
                      onChange={(event) =>
                        updateRow(row.key, { capacityLabel: event.target.value })
                      }
                      placeholder="10 lbs"
                      aria-label={`Capacity for price ${index + 1}`}
                      aria-invalid={error ? "true" : undefined}
                      className="reydex-field w-full rounded-lg px-3 py-2 text-sm text-gold-50 placeholder:text-gold-100/25"
                    />
                  </div>

                  <div className="w-20">
                    <input
                      name={FIELD.variantCapacityLbs}
                      value={row.capacityLbs}
                      onChange={(event) =>
                        updateRow(row.key, { capacityLbs: event.target.value })
                      }
                      inputMode="decimal"
                      placeholder="lbs"
                      aria-label={`Capacity in pounds for price ${index + 1}`}
                      aria-invalid={error ? "true" : undefined}
                      className="reydex-field w-full rounded-lg px-3 py-2 text-sm text-gold-50 placeholder:text-gold-100/25"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      name={FIELD.variantUnitPrice}
                      value={row.unitPrice}
                      onChange={(event) =>
                        updateRow(row.key, { unitPrice: event.target.value })
                      }
                      inputMode="decimal"
                      placeholder="1200.00"
                      aria-label={`Unit price for price ${index + 1}`}
                      aria-invalid={error ? "true" : undefined}
                      className="reydex-field w-full rounded-lg px-3 py-2 text-right text-sm tabular-nums text-gold-50 placeholder:text-gold-100/25"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) =>
                        current.length === 1
                          ? [blankRow()]
                          : current.filter((r) => r.key !== row.key),
                      )
                    }
                    aria-label={`Remove price ${index + 1}`}
                    className="mt-1 rounded-lg px-2 py-1.5 text-gold-100/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    <LuX aria-hidden className="size-4" />
                  </button>
                </div>

                {error ? (
                  <p role="alert" className="mt-2 text-xs text-red-300">
                    {error}
                  </p>
                ) : (
                  <PricePreview value={row.unitPrice} />
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setRows((current) => [...current, blankRow()])}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 px-3.5 py-2 text-sm font-medium text-gold-100/80 transition-colors hover:border-gold-400/45 hover:text-gold-100"
        >
          <LuPlus aria-hidden className="size-4" />
          Add price
        </button>
      </section>

      <div className="flex items-center justify-end gap-4">
        <Link
          href="/items"
          className="text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="reydex-submit inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-semibold tracking-wide"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add item"}
        </button>
      </div>
    </form>
  );
}

/** Echoes a typed price back formatted, so a misplaced decimal is obvious. */
function PricePreview({ value }: { value: string }) {
  if (value.trim() === "") return null;

  let formatted: string;
  try {
    formatted = formatPeso(value);
  } catch {
    return null;
  }

  return <p className="mt-2 text-xs text-gold-100/35">{formatted}</p>;
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
