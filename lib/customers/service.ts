import { asc, eq, ilike, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { customers, quotations } from "@/db/schema";
import { normalizeSearch, toContainsPattern } from "@/lib/quotations/search";

import type { CustomerInput } from "./form";

/**
 * As in `lib/quotations/service.ts`, the database handle is passed in rather
 * than imported so these functions can also be driven from `scripts/` and from
 * tests — `@/db` pulls in `server-only`, which throws outside a server component.
 */
export type CustomerDb = NodePgDatabase<typeof schema>;

/**
 * How many quotations point at a customer.
 *
 * `quotations.customer_id` is `ON DELETE RESTRICT`, so this count is what
 * decides whether a customer can be removed — and it is worth showing in the
 * list either way.
 *
 * Built with `db.$count` rather than a hand-written `sql` fragment on purpose.
 * Drizzle renders interpolated columns *unqualified* inside a select-list
 * fragment, so the obvious correlated subquery comes out as
 * `WHERE "customer_id" = "id"` — and because `quotations` has an `id` of its
 * own, the inner scope captures it and the condition is never true. That counts
 * zero for everybody, which would offer to delete customers that are in use.
 * `$count` emits the table-qualified form.
 */
function quotationCountFor(db: CustomerDb) {
  return db.$count(quotations, eq(quotations.customerId, customers.id));
}

export type ListCustomersOptions = {
  /**
   * Free text matched case-insensitively against the name, city / province and
   * contact person. Blank or omitted lists everyone.
   */
  search?: string;
  limit?: number;
};

/** Alphabetical, for the index page. */
export async function listCustomers(
  db: CustomerDb,
  { search, limit = 100 }: ListCustomersOptions = {},
) {
  const term = normalizeSearch(search);
  const pattern = toContainsPattern(term);

  return db
    .select({
      id: customers.id,
      name: customers.name,
      addressLine: customers.addressLine,
      cityProvince: customers.cityProvince,
      contactPerson: customers.contactPerson,
      contactEmail: customers.contactEmail,
      contactPhone: customers.contactPhone,
      quotationCount: quotationCountFor(db),
    })
    .from(customers)
    // `undefined` rather than a tautology, so the unfiltered query is unchanged.
    .where(
      term
        ? or(
            ilike(customers.name, pattern),
            ilike(customers.cityProvince, pattern),
            ilike(customers.contactPerson, pattern),
          )
        : undefined,
    )
    .orderBy(asc(customers.name))
    .limit(limit);
}

export type CustomerListRow = Awaited<ReturnType<typeof listCustomers>>[number];

/** One customer plus its quotation count, for the edit page. */
export async function getCustomer(db: CustomerDb, id: string) {
  const [row] = await db
    .select({
      id: customers.id,
      name: customers.name,
      addressLine: customers.addressLine,
      cityProvince: customers.cityProvince,
      contactPerson: customers.contactPerson,
      contactEmail: customers.contactEmail,
      contactPhone: customers.contactPhone,
      notes: customers.notes,
      quotationCount: quotationCountFor(db),
    })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  return row ?? null;
}

export type CustomerRecord = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

export async function createCustomer(
  db: CustomerDb,
  input: CustomerInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(customers)
    .values(input)
    .returning({ id: customers.id });

  return row;
}

/**
 * Applies an edit. Returns false when the row is gone — deleted in another tab
 * between loading the form and submitting it — so the caller can say so rather
 * than reporting a silent success.
 */
export async function updateCustomer(
  db: CustomerDb,
  id: string,
  input: CustomerInput,
): Promise<boolean> {
  const updated = await db
    .update(customers)
    .set({ ...input, updatedAt: sql`now()` })
    .where(eq(customers.id, id))
    .returning({ id: customers.id });

  return updated.length > 0;
}

export type DeleteCustomerResult =
  | { ok: true; name: string }
  | { ok: false; reason: "not_found" }
  /** Blocked by quotations that would lose their customer. */
  | { ok: false; reason: "in_use"; quotationCount: number };

/**
 * Deletes a customer, refusing if any quotation still references it.
 *
 * A quotation prints its customer's name and address, so removing the row it
 * points at would gut documents that have already gone out. The check is
 * explicit — rather than left to the foreign key — so the UI can explain why.
 * The `ON DELETE RESTRICT` constraint is still the backstop if a quotation is
 * created for this customer between the count and the delete.
 */
export async function deleteCustomer(
  db: CustomerDb,
  id: string,
): Promise<DeleteCustomerResult> {
  const existing = await getCustomer(db, id);

  if (!existing) return { ok: false, reason: "not_found" };

  if (existing.quotationCount > 0) {
    return {
      ok: false,
      reason: "in_use",
      quotationCount: existing.quotationCount,
    };
  }

  const deleted = await db
    .delete(customers)
    .where(eq(customers.id, id))
    .returning({ name: customers.name });

  if (deleted.length === 0) return { ok: false, reason: "not_found" };

  return { ok: true, name: deleted[0].name };
}
