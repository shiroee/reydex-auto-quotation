import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { quotationPresets } from "@/db/schema";

import type { PresetInput } from "./form";

/** See the note in `lib/quotations/service.ts` on why the handle is a parameter. */
export type PresetDb = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<PresetDb["transaction"]>[0]>[0];

/**
 * Exactly one preset is the default.
 *
 * Called inside the same transaction as the write that set it, so the builder
 * never sees two defaults (it picks the first, arbitrarily) or none.
 */
async function clearOtherDefaults(tx: Tx, keepId: string) {
  await tx
    .update(quotationPresets)
    .set({ isDefault: false, updatedAt: sql`now()` })
    .where(
      and(eq(quotationPresets.isDefault, true), ne(quotationPresets.id, keepId)),
    );
}

/** Alphabetical by label, for the index page. */
export async function listPresets(db: PresetDb) {
  return db
    .select({
      id: quotationPresets.id,
      slug: quotationPresets.slug,
      label: quotationPresets.label,
      template: quotationPresets.template,
      paymentTerms: quotationPresets.paymentTerms,
      deliveryTerms: quotationPresets.deliveryTerms,
      validityDays: quotationPresets.validityDays,
      showBankDetails: quotationPresets.showBankDetails,
      isDefault: quotationPresets.isDefault,
      exclusions: quotationPresets.exclusions,
      scopeOfWorks: quotationPresets.scopeOfWorks,
    })
    .from(quotationPresets)
    .orderBy(asc(quotationPresets.label));
}

export type PresetListRow = Awaited<ReturnType<typeof listPresets>>[number];

export async function getPreset(db: PresetDb, id: string) {
  const [row] = await db
    .select()
    .from(quotationPresets)
    .where(eq(quotationPresets.id, id))
    .limit(1);

  return row ?? null;
}

export type PresetRecord = NonNullable<Awaited<ReturnType<typeof getPreset>>>;

export async function createPreset(
  db: PresetDb,
  input: PresetInput,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(quotationPresets)
      .values(input)
      .returning({ id: quotationPresets.id });

    if (input.isDefault) await clearOtherDefaults(tx, row.id);

    return row;
  });
}

/**
 * Applies an edit. Returns false when the row is gone.
 *
 * `scopeOfWorks` is deliberately absent from `PresetInput` and so is left
 * untouched: it is a nested outline the form does not edit, and writing the
 * form's idea of it would flatten what is there.
 */
export async function updatePreset(
  db: PresetDb,
  id: string,
  input: PresetInput,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(quotationPresets)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(quotationPresets.id, id))
      .returning({ id: quotationPresets.id });

    if (updated.length === 0) return false;

    if (input.isDefault) await clearOtherDefaults(tx, id);

    return true;
  });
}

export type DeletePresetResult =
  | { ok: true; label: string; promoted: string | null }
  | { ok: false; reason: "not_found" }
  /** The builder needs something to offer, so the last one stays. */
  | { ok: false; reason: "last_one" };

/**
 * Deletes a quotation type.
 *
 * Safe to do at any time: a quotation copies the preset's wording when it is
 * raised and keeps no reference back, so documents already issued are unaffected.
 * Two rules protect the builder instead — the last preset cannot be removed, and
 * deleting the default promotes another so one is always pre-selected.
 */
export async function deletePreset(
  db: PresetDb,
  id: string,
): Promise<DeletePresetResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        label: quotationPresets.label,
        isDefault: quotationPresets.isDefault,
      })
      .from(quotationPresets)
      .where(eq(quotationPresets.id, id))
      .limit(1);

    if (!existing) return { ok: false, reason: "not_found" };

    const remaining = await tx
      .select({ id: quotationPresets.id, label: quotationPresets.label })
      .from(quotationPresets)
      .where(ne(quotationPresets.id, id))
      .orderBy(asc(quotationPresets.label));

    if (remaining.length === 0) return { ok: false, reason: "last_one" };

    await tx.delete(quotationPresets).where(eq(quotationPresets.id, id));

    let promoted: string | null = null;

    if (existing.isDefault) {
      await tx
        .update(quotationPresets)
        .set({ isDefault: true, updatedAt: sql`now()` })
        .where(eq(quotationPresets.id, remaining[0].id));
      promoted = remaining[0].label;
    }

    return { ok: true, label: existing.label, promoted };
  });
}
