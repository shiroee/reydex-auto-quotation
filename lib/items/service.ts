import { and, asc, count, eq, ilike, isNull, max, min, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  prices,
  productSpecs,
  products,
  quotationItems,
} from "@/db/schema";
import { normalizeSearch, toContainsPattern } from "@/lib/quotations/search";

import type { ItemInput, VariantInput } from "./form";

/** See the note in `lib/quotations/service.ts` on why the handle is a parameter. */
export type ItemDb = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<ItemDb["transaction"]>[0]>[0];

export type ListItemsOptions = {
  /**
   * Free text matched case-insensitively against the SKU, name and brand. Blank
   * or omitted lists everything.
   */
  search?: string;
  limit?: number;
};

/**
 * The catalogue, with each item's live price range.
 *
 * Two queries rather than one: aggregating prices in the select list would mean
 * a correlated subquery, and Drizzle renders interpolated columns *unqualified*
 * inside a select-list fragment (see the note in `lib/customers/service.ts`).
 * A grouped second query is both correct and easier to read.
 */
export async function listItems(
  db: ItemDb,
  { search, limit = 200 }: ListItemsOptions = {},
) {
  const term = normalizeSearch(search);
  const pattern = toContainsPattern(term);

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      brand: products.brand,
      unitLabel: products.unitLabel,
      isActive: products.isActive,
      // Correlated, so built with `$count`, which emits qualified column names.
      quotedLineCount: db.$count(
        quotationItems,
        eq(quotationItems.productId, products.id),
      ),
    })
    .from(products)
    // `undefined` rather than a tautology, so the unfiltered query is unchanged.
    .where(
      term
        ? or(
            ilike(products.sku, pattern),
            ilike(products.name, pattern),
            ilike(products.brand, pattern),
          )
        : undefined,
    )
    .orderBy(asc(products.category), asc(products.name))
    .limit(limit);

  if (rows.length === 0) return [];

  const summaries = await db
    .select({
      productId: prices.productId,
      variantCount: count(),
      minPrice: min(prices.unitPrice),
      maxPrice: max(prices.unitPrice),
    })
    .from(prices)
    .where(isNull(prices.effectiveTo))
    .groupBy(prices.productId);

  const byProduct = new Map(summaries.map((s) => [s.productId, s]));

  return rows.map((row) => {
    const summary = byProduct.get(row.id);

    return {
      ...row,
      variantCount: summary?.variantCount ?? 0,
      minPrice: summary?.minPrice ?? null,
      maxPrice: summary?.maxPrice ?? null,
    };
  });
}

export type ItemListRow = Awaited<ReturnType<typeof listItems>>[number];

/** One item with its spec bullets and live variants, for the edit page. */
export async function getItem(db: ItemDb, id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) return null;

  const [specs, variants, [usage]] = await Promise.all([
    db
      .select({ text: productSpecs.text })
      .from(productSpecs)
      .where(eq(productSpecs.productId, id))
      .orderBy(asc(productSpecs.position)),
    db
      .select({
        serviceKind: prices.serviceKind,
        capacityLabel: prices.capacityLabel,
        capacityLbs: prices.capacityLbs,
        unitPrice: prices.unitPrice,
      })
      .from(prices)
      .where(and(eq(prices.productId, id), isNull(prices.effectiveTo)))
      .orderBy(asc(prices.serviceKind), asc(prices.capacityLbs)),
    db
      .select({ n: count() })
      .from(quotationItems)
      .where(eq(quotationItems.productId, id)),
  ]);

  return {
    ...product,
    specs: specs.map((s) => s.text),
    variants,
    quotedLineCount: usage?.n ?? 0,
  };
}

export type ItemRecord = NonNullable<Awaited<ReturnType<typeof getItem>>>;

/** Rewrites the spec bullets, which are positional and so replaced wholesale. */
async function replaceSpecs(tx: Tx, productId: string, specs: string[]) {
  await tx.delete(productSpecs).where(eq(productSpecs.productId, productId));

  if (specs.length > 0) {
    await tx.insert(productSpecs).values(
      specs.map((text, i) => ({ productId, position: i + 1, text })),
    );
  }
}

async function insertVariants(
  tx: Tx,
  productId: string,
  variants: VariantInput[],
) {
  if (variants.length === 0) return;

  await tx.insert(prices).values(
    variants.map((variant) => ({
      productId,
      serviceKind: variant.serviceKind,
      capacityLabel: variant.capacityLabel,
      capacityLbs: variant.capacityLbs,
      unitPrice: variant.unitPrice,
    })),
  );
}

/** Retires a live price, keeping the row as history. */
async function retirePrice(tx: Tx, priceId: string) {
  await tx
    .update(prices)
    .set({ effectiveTo: sql`CURRENT_DATE` })
    .where(eq(prices.id, priceId));
}

export async function createItem(
  db: ItemDb,
  input: ItemInput,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        sku: input.sku,
        name: input.name,
        category: input.category,
        brand: input.brand,
        unitLabel: input.unitLabel,
        description: input.description,
        isActive: input.isActive,
      })
      .returning({ id: products.id });

    await replaceSpecs(tx, product.id, input.specs);
    await insertVariants(tx, product.id, input.variants);

    return product;
  });
}

/**
 * Applies an edit. Returns false when the row is gone.
 *
 * Prices are reconciled rather than replaced. `prices` keeps superseded rows for
 * history — `effectiveTo` is what makes one current — so a changed price retires
 * the old row and inserts a new one, a removed variant is retired, and an
 * unchanged one is left strictly alone. Deleting and re-inserting would throw
 * that history away and restamp `effective_from` on prices that never moved.
 */
export async function updateItem(
  db: ItemDb,
  id: string,
  input: ItemInput,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(products)
      .set({
        sku: input.sku,
        name: input.name,
        category: input.category,
        brand: input.brand,
        unitLabel: input.unitLabel,
        description: input.description,
        isActive: input.isActive,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (updated.length === 0) return false;

    await replaceSpecs(tx, id, input.specs);

    const live = await tx
      .select({
        id: prices.id,
        serviceKind: prices.serviceKind,
        capacityLabel: prices.capacityLabel,
        capacityLbs: prices.capacityLbs,
        unitPrice: prices.unitPrice,
      })
      .from(prices)
      .where(and(eq(prices.productId, id), isNull(prices.effectiveTo)));

    const key = (serviceKind: string, capacityLabel: string) =>
      `${serviceKind}::${capacityLabel}`;

    const existing = new Map(
      live.map((row) => [key(row.serviceKind, row.capacityLabel), row]),
    );

    const submitted = new Set(
      input.variants.map((v) => key(v.serviceKind, v.capacityLabel)),
    );

    /* Gone from the form: retire, so it stops being offered but stays on record. */
    for (const [variant, row] of existing) {
      if (!submitted.has(variant)) await retirePrice(tx, row.id);
    }

    const toInsert: VariantInput[] = [];

    for (const variant of input.variants) {
      const row = existing.get(key(variant.serviceKind, variant.capacityLabel));

      if (!row) {
        toInsert.push(variant);
        continue;
      }

      /*
       * `numeric` comes back canonicalised ("1200.00"), so compare numerically —
       * a string compare would treat "1200" as a change and retire a price that
       * did not move.
       */
      const samePrice = Number(row.unitPrice) === Number(variant.unitPrice);
      const sameCapacity =
        (row.capacityLbs === null ? null : Number(row.capacityLbs)) ===
        (variant.capacityLbs === null ? null : Number(variant.capacityLbs));

      if (samePrice && sameCapacity) continue;

      // Retire first: the partial unique index allows only one live row per key.
      await retirePrice(tx, row.id);
      toInsert.push(variant);
    }

    await insertVariants(tx, id, toInsert);

    return true;
  });
}

export type DeleteItemResult =
  | { ok: true; name: string; quotedLineCount: number }
  | { ok: false; reason: "not_found" };

/**
 * Deletes an item.
 *
 * Allowed even when quotations have quoted it: `quotation_items` holds a full
 * snapshot of what was quoted and keeps `product_id` only as a soft backlink,
 * which the foreign key nulls on delete. The documents stay intact; they just
 * stop pointing at a catalogue entry. The count of affected lines is returned so
 * the caller can say what happened. Specs and prices cascade.
 */
export async function deleteItem(
  db: ItemDb,
  id: string,
): Promise<DeleteItemResult> {
  return db.transaction(async (tx) => {
    const [{ n: quotedLineCount } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(quotationItems)
      .where(eq(quotationItems.productId, id));

    const deleted = await tx
      .delete(products)
      .where(eq(products.id, id))
      .returning({ name: products.name });

    if (deleted.length === 0) return { ok: false, reason: "not_found" };

    return { ok: true, name: deleted[0].name, quotedLineCount };
  });
}
