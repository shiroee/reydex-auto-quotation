import { and, asc, eq, isNull } from "drizzle-orm";

import {
  customers,
  prices,
  products,
  quotationPresets,
} from "@/db/schema";

import type { QuotationDb } from "./service";

/** One sellable option in the builder's item picker. */
export type PriceVariant = {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unitLabel: string;
  serviceKind: "new" | "refill" | "maintenance";
  capacityLabel: string;
  unitPrice: string;
};

/**
 * Every live price, flattened into pickable variants.
 *
 * The picker offers variants rather than products because price depends on
 * service kind and capacity — "DRY CHEMICAL TYPE" alone is not enough to price
 * a line.
 */
export async function listPriceVariants(
  db: QuotationDb,
): Promise<PriceVariant[]> {
  return db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      unitLabel: products.unitLabel,
      serviceKind: prices.serviceKind,
      capacityLabel: prices.capacityLabel,
      unitPrice: prices.unitPrice,
    })
    .from(prices)
    .innerJoin(products, eq(products.id, prices.productId))
    .where(and(isNull(prices.effectiveTo), eq(products.isActive, true)))
    .orderBy(
      asc(products.category),
      asc(products.name),
      asc(prices.serviceKind),
      asc(prices.capacityLbs),
    );
}

export async function listCustomerOptions(db: QuotationDb) {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      cityProvince: customers.cityProvince,
      contactPerson: customers.contactPerson,
    })
    .from(customers)
    .orderBy(asc(customers.name));
}

export async function listPresetOptions(db: QuotationDb) {
  return db
    .select({
      slug: quotationPresets.slug,
      label: quotationPresets.label,
      template: quotationPresets.template,
      paymentTerms: quotationPresets.paymentTerms,
      deliveryTerms: quotationPresets.deliveryTerms,
      warrantyTerms: quotationPresets.warrantyTerms,
      mobilization: quotationPresets.mobilization,
      notes: quotationPresets.notes,
      validityDays: quotationPresets.validityDays,
      isDefault: quotationPresets.isDefault,
    })
    .from(quotationPresets)
    .orderBy(asc(quotationPresets.label));
}

export type CustomerOption = Awaited<
  ReturnType<typeof listCustomerOptions>
>[number];
export type PresetOption = Awaited<
  ReturnType<typeof listPresetOptions>
>[number];
