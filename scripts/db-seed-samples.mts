#!/usr/bin/env tsx
/**
 * Rebuilds the three sample quotations from the seeded catalogue.
 *
 *   npm run db:seed-samples
 *
 * This doubles as an end-to-end check on the model: if the printed output
 * matches the original PDFs, then products, price variants, presets, snapshots
 * and totals all line up. The expected totals below are taken from the source
 * documents and asserted after each insert.
 *
 * Not idempotent by design — each run issues new reference numbers, the same as
 * raising a fresh quotation. Pass --reset to clear existing ones first.
 */

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireDirectUrl } from "../db/connection";
import * as schema from "../db/schema";
import { createQuotation } from "../lib/quotations/service";

const { customers, products, quotations } = schema;

const pool = new Pool({ connectionString: requireDirectUrl() });
const db = drizzle(pool, { schema });

async function customerId(name: string): Promise<string> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.name, name))
    .limit(1);

  if (!row) throw new Error(`Customer not seeded: ${name}. Run npm run db:seed.`);
  return row.id;
}

async function productId(sku: string): Promise<string> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);

  if (!row) throw new Error(`Product not seeded: ${sku}. Run npm run db:seed.`);
  return row.id;
}

try {
  if (process.argv.includes("--reset")) {
    // quotation_items / _exclusions cascade from quotations.
    await db.delete(quotations);
    await db.execute(sql`ALTER SEQUENCE quotation_no_seq RESTART WITH 1`);
    console.log("  reset existing quotations");
  }

  const results: { label: string; quoteNo: string; total: string; expected: string }[] = [];

  /* ---------------- 1. True North — brand new supply ---------------- */
  const trueNorth = await createQuotation(db, {
    customerId: await customerId("TRUE NORTH MANUFACTURING SERVICES INC."),
    presetSlug: "supply-new",
    subject: "LION BRAND FIRE EXTINGUISHER AND SMOKE DETECTOR / FIRE ALARM BELL",
    quoteDate: "2026-05-13",
    attentionTo: "MR. RENE R. ESGASANE",
    items: [
      {
        productId: await productId("FE-DRY-CHEM"),
        serviceKind: "new",
        capacityLabel: "10 lbs",
        quantity: 1,
        sectionTitle: "BRANDNEW OF FIRE EXTINGUISHER",
      },
      {
        productId: await productId("SD-PHOTO-9V"),
        serviceKind: "new",
        quantity: 1,
        sectionTitle: "BRAND NEW SMOKE DETECTOR",
      },
      {
        productId: await productId("FAB-8IN"),
        serviceKind: "new",
        quantity: 3,
        sectionTitle: "BRAND NEW FIRE ALARM BELL",
      },
    ],
  });
  results.push({
    label: "True North (supply)",
    quoteNo: trueNorth.quoteNo,
    total: trueNorth.totalAmount,
    expected: "18900.00",
  });

  /* ---------------- 2. Umicore — refilling & servicing ---------------- */
  const umicore = await createQuotation(db, {
    customerId: await customerId("UMICORE SPECIALTY CHEMICALS SUBIC INC."),
    presetSlug: "refill-service",
    subject: "FIRE EXTINGUISHER LION BRAND",
    quoteDate: "2026-05-13",
    attentionTo: "MR. JOFELSON N. RUIZ",
    items: [
      {
        productId: await productId("FE-DRY-CHEM"),
        serviceKind: "refill",
        capacityLabel: "10 lbs",
        quantity: 10,
        sectionTitle: "REFILLING AND SERVICING OF FIRE EXTINGUISHER",
      },
      {
        productId: await productId("FE-DRY-CHEM"),
        serviceKind: "refill",
        capacityLabel: "50 lbs",
        quantity: 1,
      },
      {
        productId: await productId("FE-HCFC-123"),
        serviceKind: "refill",
        capacityLabel: "10 lbs",
        quantity: 3,
      },
    ],
  });
  results.push({
    label: "Umicore (refill)",
    quoteNo: umicore.quoteNo,
    total: umicore.totalAmount,
    expected: "22500.00",
  });

  /* ---------------- 3. Puregold — PM proposal ---------------- */
  const puregold = await createQuotation(db, {
    customerId: await customerId("PUREGOLD CASTILLEJOS"),
    presetSlug: "pm-proposal",
    // The original subject named only FDAS even though item 2 is AFSS; the
    // generated subject covers both, which is the point of deriving it.
    subject:
      "Proposed Preventive Maintenance of Fire Detection and Alarm System (FDAS) and Automatic Fire Sprinkler System (AFSS) for Puregold Castillejos",
    quoteDate: "2026-05-19",
    items: [
      { productId: await productId("PM-FDAS"), serviceKind: "maintenance", quantity: 1 },
      { productId: await productId("PM-AFSS"), serviceKind: "maintenance", quantity: 1 },
    ],
  });
  results.push({
    label: "Puregold (proposal)",
    quoteNo: puregold.quoteNo,
    total: puregold.totalAmount,
    expected: "90000.00",
  });

  /* ---------------- Verify against the source documents ---------------- */
  console.log("\n  DOCUMENT                REF. NO.        TOTAL       EXPECTED    ");
  console.log("  " + "-".repeat(66));

  let failures = 0;
  for (const r of results) {
    const ok = r.total === r.expected;
    if (!ok) failures += 1;
    console.log(
      "  " +
        r.label.padEnd(24) +
        r.quoteNo.padEnd(16) +
        r.total.padStart(10) +
        r.expected.padStart(12) +
        (ok ? "   ✔" : "   ✖ MISMATCH"),
    );
  }

  if (failures > 0) {
    console.error(`\n✖ ${failures} total(s) do not match the source documents\n`);
    process.exitCode = 1;
  } else {
    console.log("\n✔ All three totals match the original PDFs\n");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✖ Failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
