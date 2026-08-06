#!/usr/bin/env tsx
/**
 * Seeds the catalogue items transcribed from the 2025 company profile brochure.
 *
 *   npm run db:seed-brochure
 *
 * `db:seed` covers only what the three sample quotations needed — two
 * extinguisher types, two detection devices and the two maintenance services.
 * The brochure lists the rest of the product line, so this fills the catalogue
 * out to what Reydex actually supplies.
 *
 * DELIBERATELY UNPRICED. The brochure quotes no prices, and price is a function
 * of (product, service kind, capacity) — inventing one would put a fabricated
 * figure on a real quotation. Each item lands with its brochure copy and its
 * available capacities recorded as spec bullets; add prices in the Items
 * dashboard (/items) and the item becomes quotable.
 *
 * Idempotent: keyed on SKU, so re-running updates rather than duplicates, and it
 * never touches prices that have been entered since.
 */

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireDirectUrl } from "../db/connection";
import * as schema from "../db/schema";

const { productSpecs, products } = schema;

type Category = (typeof schema.products.category.enumValues)[number];

type Entry = {
  sku: string;
  name: string;
  category: Category;
  brand?: string;
  unitLabel?: string;
  description?: string;
  specs?: string[];
};

/**
 * Descriptions are transcribed from the brochure, lightly repunctuated, because
 * they are the wording that has been going to clients.
 *
 * Capacities live in the spec bullets rather than on the product: the schema
 * carries capacity on the price row, so an unpriced item has nowhere else to
 * record what sizes exist. Once each size is priced in /items the bullets can be
 * trimmed — by then the variants say it.
 */
const BROCHURE: Entry[] = [
  /* ------------------------------ Extinguishers ----------------------------- */
  {
    sku: "FE-HFC-236FA",
    name: "HFC 236 FA CHEMICAL TYPE",
    category: "fire_extinguisher",
    brand: "Lion Brand",
    description:
      "Good for AB & C class of fire. Clean environment extinguishant. Chemical imported. It is a vaporizing liquid which chemically interrupts the chain reaction taking place in the flames, contained in a heavy duty imported cylinder but locally assembled. Highly recommended for vehicles, industrial factories, and computer and electronics companies.",
    specs: [
      "Available capacities: 10, 20 and 50 lbs.",
      "Clean extinguishing agent — halon substitute, stored pressure, for 2A2BC fires.",
    ],
  },
  {
    sku: "FE-CO2",
    name: "CO2 TYPE (CARBON DIOXIDE)",
    category: "fire_extinguisher",
    description:
      "Good for B & C class of fire. Effective for flammable liquids and electrical fire; helps lessen the fire by replacing the oxygen. Heavy duty imported cylinder containing odorless gas.",
    specs: ["Available capacities: 10, 15, 20, 50, 100, 150 and 200 lbs."],
  },
  {
    sku: "FE-AFFF",
    name: "AFFF CHEMICAL TYPE (AQUEOUS FILM FORMING FOAM)",
    category: "fire_extinguisher",
    brand: "Lion Brand",
    description:
      "Good for A & B class of fire. A synthetic film forming liquid designed for use with fresh water. Chemicals imported and locally manufactured, approved by the ISO and BPS.",
    specs: [
      "Available capacities: 10, 15, 20, 50, 100, 150 and 200 lbs.",
      "Aqueous film forming foam, stored pressure, for AB fires.",
    ],
  },

  /* --------------------------- Suppression systems -------------------------- */
  {
    sku: "SS-CEILING-TYPE",
    name: "CEILING TYPE FIRE EXTINGUISHER",
    category: "suppression_system",
    description:
      "Ceiling-mounted automatic extinguishing unit, for HCFC 123 and HFC 236 chemical.",
    specs: [
      "For HCFC 123 and HFC 236 chemical.",
      "Available capacities: 10 and 20 lbs.",
    ],
  },
  {
    sku: "SS-SPRINKLER-HEAD",
    name: "FIRE SPRINKLER HEAD",
    category: "suppression_system",
    description:
      "Automatic fire sprinkler head for wet automatic fire sprinkler systems.",
  },

  /* ------------------------- Fire fighting equipment ------------------------ */
  {
    sku: "ACC-FHC",
    name: "FIRE HOSE CABINET",
    category: "accessory",
    description:
      "Recessed or surface mounted type with aluminum frame, white enamel paint inside, complete with door handle, door lock and key, clear glass and hose rack.",
  },
  {
    sku: "ACC-FIRE-HOSE",
    name: "FIRE HOSE",
    category: "accessory",
    description: "Fire hose for fire hose cabinets and wet standpipe systems.",
    specs: ["Available brands: Yamato, Asahi, USA Brand and 5-Elem."],
  },
  {
    sku: "ACC-NOZ-STRAIGHT",
    name: "STRAIGHT NOZZLE",
    category: "accessory",
    description: "Brass straight-stream nozzle for fire hose.",
  },
  {
    sku: "ACC-NOZ-FOG",
    name: "FOG NOZZLE",
    category: "accessory",
    description: "Adjustable brass fog nozzle for fire hose.",
  },
  {
    sku: "ACC-NOZ-PISTOL",
    name: "PISTOL GRIP TYPE NOZZLE",
    category: "accessory",
    description: "Pistol grip type fire hose nozzle with adjustable spray.",
  },
  {
    sku: "ACC-EXIT-SIGN",
    name: "FIRE EXIT SIGN",
    category: "accessory",
    brand: "Rae Brand",
    description: "Illuminated fire exit sign.",
    specs: ["Available brand: Rae Brand.", "6 volts and 12 volts."],
  },
  {
    sku: "ACC-EMERGENCY-LIGHT",
    name: "EMERGENCY LIGHT",
    category: "accessory",
    brand: "Rae Brand",
    description: "Twin-lamp rechargeable emergency light.",
    specs: ["Available brand: Rae Brand.", "6 volts and 12 volts."],
  },

  /* --------------------------- Firemen accessories -------------------------- */
  {
    sku: "ACC-FM-HELMET",
    name: "FIREMAN HELMET",
    category: "accessory",
    description: "Fireman helmet with face shield and neck protector.",
  },
  {
    sku: "ACC-FM-SCBA",
    name: "SELF-CONTAINED BREATHING APPARATUS",
    category: "accessory",
    description:
      "Self-contained breathing apparatus with cylinder, harness, full face mask and pressure gauge.",
  },
  {
    sku: "ACC-FM-BOOTS",
    name: "FIREMAN BOOTS",
    category: "accessory",
    unitLabel: "PAIR",
    description: "Fireman safety boots.",
  },
  {
    sku: "ACC-FM-SUIT",
    name: "FIREMAN SUIT",
    category: "accessory",
    unitLabel: "SET",
    description: "Fireman protective suit with reflective banding, jacket and trousers.",
  },
];

/* -------------------------------------------------------------------------- */
/* Seed                                                                       */
/* -------------------------------------------------------------------------- */

const pool = new Pool({ connectionString: requireDirectUrl() });
const db = drizzle(pool, { schema });

try {
  await db.transaction(async (tx) => {
    for (const entry of BROCHURE) {
      const [product] = await tx
        .insert(products)
        .values({
          sku: entry.sku,
          name: entry.name,
          category: entry.category,
          brand: entry.brand ?? null,
          unitLabel: entry.unitLabel ?? "UNIT",
          description: entry.description ?? null,
        })
        .onConflictDoUpdate({
          target: products.sku,
          set: {
            name: entry.name,
            category: entry.category,
            brand: entry.brand ?? null,
            unitLabel: entry.unitLabel ?? "UNIT",
            description: entry.description ?? null,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: products.id });

      // Specs are positional; replace wholesale so edits and deletes both land.
      await tx
        .delete(productSpecs)
        .where(eq(productSpecs.productId, product.id));

      if (entry.specs?.length) {
        await tx.insert(productSpecs).values(
          entry.specs.map((text, i) => ({
            productId: product.id,
            position: i + 1,
            text,
          })),
        );
      }
    }
  });

  /* Report */
  const counts = await db.execute<{ label: string; n: number }>(sql`
    SELECT 'products' AS label, count(*)::int AS n FROM products
    UNION ALL SELECT 'unpriced products', count(*)::int FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM prices
        WHERE prices.product_id = p.id AND prices.effective_to IS NULL
      )
  `);

  for (const row of counts.rows) {
    console.log(`${row.label.padEnd(20)} ${row.n}`);
  }

  console.log(
    `\n${BROCHURE.length} brochure items seeded.\n` +
      "They carry no prices yet, so they are not offered in the quotation\n" +
      "builder. Add prices per capacity at /items to make them quotable.",
  );
} finally {
  await pool.end();
}
