import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  companyProfile,
  customers,
  prices,
  productSpecs,
  products,
  quotationExclusions,
  quotationItems,
  quotationPresets,
  quotations,
  type ScopeSection,
} from "@/db/schema";

import { normalizeSearch, toContainsPattern } from "./search";

/**
 * The database handle is passed in rather than imported so these functions can
 * also be driven from `scripts/` and from tests — `@/db` pulls in `server-only`,
 * which throws outside a server component.
 */
export type QuotationDb = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<QuotationDb["transaction"]>[0]>[0];

type ServiceKind = (typeof prices.serviceKind.enumValues)[number];
type Template = (typeof quotations.template.enumValues)[number];

export type QuotationItemInput = {
  productId: string;
  serviceKind: ServiceKind;
  /** Must match the catalogue variant; "" for products without a capacity. */
  capacityLabel?: string;
  quantity: number | string;
  /** Overrides the catalogue price for this line only. */
  unitPrice?: string;
  /** Grouping header, e.g. "BRAND NEW SMOKE DETECTOR". */
  sectionTitle?: string | null;
};

export type CreateQuotationInput = {
  customerId: string;
  /** Pulls letter body, terms, exclusions and scope from a stored preset. */
  presetSlug?: string;
  template?: Template;
  subject: string;
  /** ISO date; defaults to today. */
  quoteDate?: string;
  attentionTo?: string | null;
  items: QuotationItemInput[];
  preparedByUserId?: string | null;
  /** Wins over anything the preset supplies. */
  overrides?: {
    salutation?: string;
    introParagraph?: string | null;
    closingParagraph?: string | null;
    paymentTerms?: string | null;
    deliveryTerms?: string | null;
    warrantyTerms?: string | null;
    mobilization?: string | null;
    notes?: string | null;
    validityDays?: number;
    showBankDetails?: boolean;
    exclusions?: string[];
    scopeOfWorks?: ScopeSection[] | null;
  };
};

/**
 * Reference in the form RDX-2026-0001.
 *
 * Drawn from a Postgres sequence rather than `max(quote_no) + 1` so two people
 * saving at once cannot land on the same number. The sequence is global, not
 * per-year, which means numbers never repeat across years.
 */
async function nextQuoteNo(tx: Tx, year: number): Promise<string> {
  const result = await tx.execute<{ n: string }>(
    sql`SELECT nextval('quotation_no_seq')::text AS n`,
  );

  return `RDX-${year}-${String(result.rows[0].n).padStart(4, "0")}`;
}

/**
 * Creates a quotation, resolving each line's price from the catalogue and
 * freezing a snapshot of what was quoted.
 *
 * Runs in one transaction: a half-written quotation with no items, or a total
 * that disagrees with its lines, is worse than an outright failure.
 */
export async function createQuotation(
  db: QuotationDb,
  input: CreateQuotationInput,
): Promise<{ id: string; quoteNo: string; totalAmount: string }> {
  if (input.items.length === 0) {
    throw new Error("A quotation needs at least one line item.");
  }

  return db.transaction(async (tx) => {
    const preset = input.presetSlug
      ? (
          await tx
            .select()
            .from(quotationPresets)
            .where(eq(quotationPresets.slug, input.presetSlug))
            .limit(1)
        )[0]
      : undefined;

    if (input.presetSlug && !preset) {
      throw new Error(`Unknown quotation preset: ${input.presetSlug}`);
    }

    const [profile] = await tx
      .select()
      .from(companyProfile)
      .where(eq(companyProfile.slug, "reydex"))
      .limit(1);

    const quoteDate = input.quoteDate ?? new Date().toISOString().slice(0, 10);
    const template = input.template ?? preset?.template ?? "supply";
    const o = input.overrides ?? {};

    const quoteNo = await nextQuoteNo(tx, Number(quoteDate.slice(0, 4)));

    const [quotation] = await tx
      .insert(quotations)
      .values({
        quoteNo,
        customerId: input.customerId,
        template,
        subject: input.subject,
        quoteDate,
        attentionTo: input.attentionTo ?? null,
        salutation: o.salutation ?? preset?.salutation ?? "Dear Sir/Ma'am,",
        introParagraph: o.introParagraph ?? preset?.introParagraph ?? null,
        closingParagraph:
          o.closingParagraph ?? preset?.closingParagraph ?? null,
        paymentTerms: o.paymentTerms ?? preset?.paymentTerms ?? null,
        deliveryTerms: o.deliveryTerms ?? preset?.deliveryTerms ?? null,
        warrantyTerms: o.warrantyTerms ?? preset?.warrantyTerms ?? null,
        mobilization: o.mobilization ?? preset?.mobilization ?? null,
        notes: o.notes ?? preset?.notes ?? null,
        validityDays: o.validityDays ?? preset?.validityDays ?? 30,
        showBankDetails: o.showBankDetails ?? preset?.showBankDetails ?? false,
        scopeOfWorks: o.scopeOfWorks ?? preset?.scopeOfWorks ?? null,
        preparedByUserId: input.preparedByUserId ?? null,
        signatoryName: profile?.signatoryName ?? null,
        signatoryTitle: profile?.signatoryTitle ?? null,
      })
      .returning({ id: quotations.id });

    /* Line items, each snapshotted from the catalogue. */
    for (const [index, item] of input.items.entries()) {
      const capacityLabel = item.capacityLabel ?? "";

      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      if (!product) {
        throw new Error(`Unknown product: ${item.productId}`);
      }

      let unitPrice = item.unitPrice;

      if (unitPrice === undefined) {
        const [price] = await tx
          .select({ unitPrice: prices.unitPrice })
          .from(prices)
          .where(
            and(
              eq(prices.productId, item.productId),
              eq(prices.serviceKind, item.serviceKind),
              eq(prices.capacityLabel, capacityLabel),
              isNull(prices.effectiveTo),
            ),
          )
          .limit(1);

        if (!price) {
          throw new Error(
            `No live price for ${product.sku} (${item.serviceKind}` +
              `${capacityLabel ? `, ${capacityLabel}` : ""}). ` +
              `Add it to the price list or pass an explicit unitPrice.`,
          );
        }

        unitPrice = price.unitPrice;
      }

      const specs = await tx
        .select({ text: productSpecs.text })
        .from(productSpecs)
        .where(eq(productSpecs.productId, item.productId))
        .orderBy(asc(productSpecs.position));

      await tx.insert(quotationItems).values({
        quotationId: quotation.id,
        position: index + 1,
        sectionTitle: item.sectionTitle ?? null,
        productId: product.id,
        name: product.name,
        serviceKind: item.serviceKind,
        description: product.description,
        specs: specs.map((s) => s.text),
        capacityLabel,
        unitLabel: product.unitLabel,
        quantity: String(item.quantity),
        unitPrice,
      });
    }

    /* Exclusions */
    const exclusions = o.exclusions ?? preset?.exclusions ?? [];
    if (exclusions.length > 0) {
      await tx.insert(quotationExclusions).values(
        exclusions.map((text, i) => ({
          quotationId: quotation.id,
          position: i + 1,
          text,
        })),
      );
    }

    /* Total, summed by Postgres from the generated line totals. */
    const [updated] = await tx
      .update(quotations)
      .set({
        totalAmount: sql`(
          SELECT coalesce(sum(${quotationItems.lineTotal}), 0)
          FROM ${quotationItems}
          WHERE ${quotationItems.quotationId} = ${quotation.id}
        )`,
        updatedAt: sql`now()`,
      })
      .where(eq(quotations.id, quotation.id))
      .returning({ totalAmount: quotations.totalAmount });

    return { id: quotation.id, quoteNo, totalAmount: updated.totalAmount };
  });
}

/** Everything the printed document needs. */
export async function getQuotationForPrint(db: QuotationDb, id: string) {
  const [quotation] = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, id))
    .limit(1);

  if (!quotation) return null;

  const [[customer], [profile], items, exclusions] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(eq(customers.id, quotation.customerId))
      .limit(1),
    db
      .select()
      .from(companyProfile)
      .where(eq(companyProfile.slug, "reydex"))
      .limit(1),
    db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .orderBy(asc(quotationItems.position)),
    db
      .select({ text: quotationExclusions.text })
      .from(quotationExclusions)
      .where(eq(quotationExclusions.quotationId, id))
      .orderBy(asc(quotationExclusions.position)),
  ]);

  return {
    quotation,
    customer,
    profile,
    items,
    exclusions: exclusions.map((e) => e.text),
  };
}

export type PrintableQuotation = NonNullable<
  Awaited<ReturnType<typeof getQuotationForPrint>>
>;

export type ListQuotationsOptions = {
  /**
   * Free text matched case-insensitively against the reference number, the
   * customer name and the subject. Blank or omitted lists everything.
   */
  search?: string;
  limit?: number;
};

/** Newest first, for the index page. */
export async function listQuotations(
  db: QuotationDb,
  { search, limit = 50 }: ListQuotationsOptions = {},
) {
  const term = normalizeSearch(search);
  const pattern = toContainsPattern(term);

  return db
    .select({
      id: quotations.id,
      quoteNo: quotations.quoteNo,
      subject: quotations.subject,
      quoteDate: quotations.quoteDate,
      status: quotations.status,
      template: quotations.template,
      totalAmount: quotations.totalAmount,
      customerName: customers.name,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    // `undefined` rather than a tautology, so the unfiltered query is unchanged.
    .where(
      term
        ? or(
            ilike(quotations.quoteNo, pattern),
            ilike(customers.name, pattern),
            ilike(quotations.subject, pattern),
          )
        : undefined,
    )
    .orderBy(sql`${quotations.quoteDate} DESC, ${quotations.createdAt} DESC`)
    .limit(limit);
}
