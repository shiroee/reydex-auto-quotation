#!/usr/bin/env tsx
/**
 * Seeds the catalogue, customers and boilerplate transcribed from the three
 * sample quotations (Puregold Castillejos, True North, Umicore Subic).
 *
 *   npm run db:seed
 *
 * Idempotent: re-running updates existing rows rather than duplicating them,
 * so it is safe to run after editing the data below.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireDirectUrl } from "../db/connection";
import * as schema from "../db/schema";
import type { ScopeSection } from "../db/schema";

const {
  companyProfile,
  customers,
  prices,
  productSpecs,
  products,
  quotationPresets,
} = schema;

/* -------------------------------------------------------------------------- */
/* Letterhead                                                                 */
/* -------------------------------------------------------------------------- */

const COMPANY = {
  slug: "reydex",
  name: "REYDEX FIRE EXTINGUISHER TRADING",
  tagline: "Your Safety is our Priority…",
  tin: "209-376-059-000",
  vatRegistered: false,
  mainAddress: "#58-A Daang Pari St. P-4 San Pedro Hagonoy, Bulacan",
  branchAddress: "P-2 Pag-Asa St. Del Pilar Castillejos Zambales",
  // The samples disagreed on which numbers to print; these are the two
  // confirmed current ones. 0919-6638-522 and 0955-0424-993 appeared on the
  // True North and Umicore sheets but are retired — do not reinstate them.
  phones: ["0933-3347-702", "0906-841-5056"],
  email: "reydexservices@gmail.com",
  footerLine:
    "Distributor of Portable type, Wheeled Type Fire Extinguishers and all kinds of Fighting Accessories and Materials, FDAS, FSS",
  bankAccountName: "Reynaldo De Leon Manalo",
  bankAccountNo: "075-940-4521",
  bankBranch: "BPI, MALOLOS BRANCH",
  signatoryName: "REYNALDO MANALO",
  signatoryTitle: "General Manager",
};

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

type SeedProduct = {
  sku: string;
  name: string;
  category: (typeof schema.productCategory.enumValues)[number];
  brand?: string;
  unitLabel?: string;
  description?: string;
  specs?: string[];
  prices: {
    serviceKind: (typeof schema.serviceKind.enumValues)[number];
    capacityLabel?: string;
    capacityLbs?: string;
    unitPrice: string;
  }[];
};

const CATALOGUE: SeedProduct[] = [
  {
    sku: "FE-DRY-CHEM",
    name: "DRY CHEMICAL TYPE",
    category: "fire_extinguisher",
    brand: "Lion Brand",
    description:
      "to be refilled with Mono-ammonium Phosphate powder ideal for class A, B & C fires or multi-purpose, non-corrosive, and non-electrical conductor.",
    prices: [
      // True North quoted a new 10 lb unit at 1,200; Umicore refilled the same
      // capacity at 600 — this pair is why price is keyed on service kind.
      { serviceKind: "new", capacityLabel: "10 lbs", capacityLbs: "10", unitPrice: "1200.00" },
      { serviceKind: "refill", capacityLabel: "10 lbs", capacityLbs: "10", unitPrice: "600.00" },
      { serviceKind: "refill", capacityLabel: "50 lbs", capacityLbs: "50", unitPrice: "3000.00" },
    ],
  },
  {
    sku: "FE-HCFC-123",
    name: "HCFC – 123 CHEMICAL TYPE",
    category: "fire_extinguisher",
    brand: "Lion Brand",
    description:
      "2A2BCSt RATED. Stored pressure type, clean agent. Halon substitute fire extinguisher for A, B and C fires.",
    specs: [
      "Dependable on all classes of fire",
      "Non-corrosive, safe to use on electronic equipment.",
      "Non-conductor of electricity",
      "Not messy to use and leaves no residue.",
      "Zero Ozone Depleting Substance.",
      "Multi-shots can be used for several times, because of its own concentrated pressure.",
    ],
    prices: [
      { serviceKind: "refill", capacityLabel: "10 lbs", capacityLbs: "10", unitPrice: "4500.00" },
    ],
  },
  {
    sku: "SD-PHOTO-9V",
    name: "SMOKE DETECTOR",
    category: "detection_alarm",
    specs: [
      "Photoelectric Smoke Alarm",
      "DC9V battery powered",
      "Working Humidity <93%RH",
      "Working Temperature -5 deg C + 40 deg C",
      "Automatic Self-test",
      "Test button verifies battery and alarm operation",
      "Over 85 dB (3m) alarm signal",
      "Easy installation and maintenance",
    ],
    prices: [{ serviceKind: "new", unitPrice: "1500.00" }],
  },
  {
    sku: "FAB-8IN",
    name: "FIRE ALARM BELL",
    category: "detection_alarm",
    specs: [
      "8-inch Fire Alarm Bell",
      "Durable steel construction with red enamel finish",
      "Loud alarm signal for emergency warning",
      "Compatible with fire alarm control systems",
      "Available in 12V DC / 24V DC operation",
      "Low power consumption",
      "Easy wall-mount installation",
      "Suitable for indoor and outdoor use",
      "Reliable and long-lasting performance",
      "Ideal for residential, commercial, and industrial buildings",
    ],
    prices: [{ serviceKind: "new", unitPrice: "5400.00" }],
  },
  {
    sku: "PM-FDAS",
    name: "Proposed Preventive Maintenance of Fire Detection and Alarm System (FDAS)",
    category: "service",
    unitLabel: "LOT",
    prices: [{ serviceKind: "maintenance", unitPrice: "40000.00" }],
  },
  {
    sku: "PM-AFSS",
    name: "Proposed Preventive Maintenance of Automatic Fire Sprinkler System (AFSS)",
    category: "service",
    unitLabel: "LOT",
    prices: [{ serviceKind: "maintenance", unitPrice: "50000.00" }],
  },
];

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

const CUSTOMERS = [
  {
    name: "PUREGOLD CASTILLEJOS",
    cityProvince: "Castillejos, Zambales",
    contactPerson: null,
  },
  {
    name: "TRUE NORTH MANUFACTURING SERVICES INC.",
    cityProvince: null,
    contactPerson: "MR. RENE R. ESGASANE",
  },
  {
    name: "UMICORE SPECIALTY CHEMICALS SUBIC INC.",
    cityProvince: "SUBIC ZAMBALES",
    contactPerson: "MR. JOFELSON N. RUIZ",
  },
];

/* -------------------------------------------------------------------------- */
/* Scope of works (from the Puregold proposal)                                */
/* -------------------------------------------------------------------------- */

/*
 * Transcribed verbatim, including the run-on " - " joins that appear in the
 * source. Note the original's section I.A had a dangling empty item "7." — it
 * is omitted here rather than reproduced.
 */
const PM_SCOPE: ScopeSection[] = [
  {
    title: "FIRE DETECTION AND ALARM SYSTEM:",
    intro:
      "General check-up and testing of all indicating and initiating devices including its control panel as well as its accessories (indicator lamp, back up batteries, switches, contacts, etc.) included in the entire system.",
    nodes: [
      { label: "1.", text: "Cleaning of each Monitoring and Alarm Devices." },
      {
        label: "2.",
        text: "Tightening of termination and mounting screws of all field devices.",
      },
      {
        label: "3.",
        text: "Functional testing of all Manual Station, Audible and Visual Alarms",
      },
      {
        label: "4.",
        text: "Operational testing of all annunciator/fire locator panels.",
      },
    ],
  },
  {
    title: "AFSS AND FIRE HOSE CABINET SYSTEM:",
    nodes: [
      {
        label: "I.",
        text: "VISUAL INSPECTION, CHECK, INSPECT, SERVICE/REPAIR, CLEAN AND CONDUCT TEST",
        children: [
          {
            label: "A.",
            text: "Check, inspect, service/repair, clean and conduct test of the following:",
            children: [
              { label: "1.", text: "Checking and lubrication of all isolation/control valves." },
              {
                label: "2.",
                text: "Identification sign of each valve, to fix and adjust/repair any defects",
              },
              { label: "3.", text: "Checking and cleaning of all pressure gauges." },
              { label: "4.", text: "Flushing of each sprinkler zone." },
              {
                label: "5.",
                text: "Functional test of all water flow switches, supervisory switch and sprinkler alarm gong.",
              },
              {
                label: "6.",
                text: "Check for any sign of leaks on all check valves and fire department connections. - Check and re-install lock out/padlock safety equipment of each valve (if necessary).",
              },
            ],
          },
          {
            label: "B.",
            text: "Check and visually inspect piping system, supports and all sprinkler heads",
            children: [
              {
                label: "1.",
                text: "All piping and fittings shall be examined for any evidence of corrosion.",
              },
              {
                label: "2.",
                text: "Support mounting bolts of the piping system are tight and free from dirt and corrosion.",
              },
              {
                label: "3.",
                text: "De-rust and repaint any part of the system with mild corrosion except sprinkler heads.",
              },
              {
                label: "4.",
                text: "Replace any steel part of the system with heavy corrosion (cost to be charged to the customer)",
              },
              { label: "5.", text: "Cleaning of every sprinkler heads." },
              {
                label: "6.",
                text: "Fix and adjust any loose or misaligned/defective sprinkler escutcheon plate - Any sprinkler head found defective shall be replaced immediately (cost to be charged to the customer).",
              },
            ],
          },
        ],
      },
      {
        label: "II.",
        text: "ELECTRICAL SYSTEM: AUTO FIRE SPRINKLER SYSTEM AND FIRE PUMP/JOCKEY PUMP",
        children: [
          {
            label: "A.",
            text: "Conduct ocular inspection/functional test the Sprinkler and Fire Pump's electrical system - Dust removal of control panels with portable vacuum cleaner and non-conductive brush",
            children: [
              {
                label: "1.",
                text: "Cleaning of control panel cabinets inside and out with multi-purpose cleaner - Cleaning of panel's PC board slots, ports, terminals with approved contact cleaner - Electrical components/wirings of control panel checking for loose connections/contacts",
              },
              {
                label: "2.",
                text: "Functional operational test of the pressure switch on the jockey pump controller - Checking of Mounting bolts of the control panel boxes",
              },
              { label: "3.", text: "Preventive Maintenance of Fire Pump Assembly" },
            ],
          },
        ],
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Presets                                                                    */
/* -------------------------------------------------------------------------- */

const CLOSING_SUPPLY =
  "Should you have any additional information or clarification, please feel free to contact us. Thank you!";

const PRESETS = [
  {
    slug: "supply-new",
    label: "Brand new supply (COD)",
    template: "supply" as const,
    salutation: "Dear Sir/Ma'am,",
    introParagraph:
      "In connection with the above-captioned subject we are pleased to submit herewith our formal quotation, to wit:",
    closingParagraph: CLOSING_SUPPLY,
    deliveryTerms: "Three (3) to Five (5) working days.",
    paymentTerms: "Cash On Delivery",
    warrantyTerms:
      "One (1) year against inherent mechanical and factory defects provided that the seal is intact/unbroken",
    notes: "*Assistance to BFP for securing permits and clearance",
    mobilization: null,
    validityDays: 30,
    showBankDetails: false,
    exclusions: [] as string[],
    scopeOfWorks: null,
    isDefault: true,
  },
  {
    slug: "refill-service",
    label: "Refilling & servicing (per contract)",
    template: "supply" as const,
    salutation: "Dear Sir/Ma'am,",
    introParagraph:
      "In connection with the above-captioned subject we are pleased to submit herewith our formal quotation, to wit:",
    closingParagraph: CLOSING_SUPPLY,
    deliveryTerms: "Five (5) to Seven (7) working days.",
    paymentTerms: "As per arrangement",
    warrantyTerms:
      "DRY CHEMICAL/AFFF: One (1) year against inherent mechanical and factory defects provided that the seal is intact/unbroken",
    notes: "*As per contract",
    mobilization: null,
    validityDays: 30,
    showBankDetails: true,
    exclusions: [] as string[],
    scopeOfWorks: null,
    isDefault: false,
  },
  {
    slug: "pm-proposal",
    label: "Preventive maintenance proposal",
    template: "service_proposal" as const,
    salutation: "Dear Mam / Sir,",
    introParagraph:
      "Greetings from the management and staff of REYDEX! We hereby submit our proposal for the above-mentioned subject in accordance with your requirements, the guidelines contained in the manufacturer's literature and the NFPA Standards.",
    closingParagraph:
      "We trust that this proposal will satisfy you and we are eager to work with you in this particular project. Rest assured that we will do our best as far as fire protection workmanship is concerned.",
    deliveryTerms: null,
    paymentTerms: "Fifty (50%) down payment, balance upon completion",
    warrantyTerms: null,
    notes: null,
    mobilization:
      "Mobilization is within three to five days upon receipt of down payment.",
    validityDays: 30,
    showBankDetails: false,
    exclusions: [
      "Replacement of any damaged devices that were found defective during maintenance.",
      "Programming of FACP.",
      "Any works not included in the scope of works will be subjected for variation order.",
    ],
    scopeOfWorks: PM_SCOPE,
    isDefault: false,
  },
];

/* -------------------------------------------------------------------------- */
/* Seed                                                                       */
/* -------------------------------------------------------------------------- */

const pool = new Pool({ connectionString: requireDirectUrl() });
const db = drizzle(pool, { schema });

try {
  await db.transaction(async (tx) => {
    /* Company profile */
    await tx
      .insert(companyProfile)
      .values(COMPANY)
      .onConflictDoUpdate({
        target: companyProfile.slug,
        set: { ...COMPANY, updatedAt: sql`now()` },
      });

    /* Catalogue */
    for (const entry of CATALOGUE) {
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
      await tx.delete(productSpecs).where(eq(productSpecs.productId, product.id));
      if (entry.specs?.length) {
        await tx.insert(productSpecs).values(
          entry.specs.map((text, i) => ({
            productId: product.id,
            position: i + 1,
            text,
          })),
        );
      }

      for (const price of entry.prices) {
        const capacityLabel = price.capacityLabel ?? "";
        await tx
          .insert(prices)
          .values({
            productId: product.id,
            serviceKind: price.serviceKind,
            capacityLabel,
            capacityLbs: price.capacityLbs ?? null,
            unitPrice: price.unitPrice,
          })
          .onConflictDoUpdate({
            // Matches the partial unique index on live prices.
            target: [prices.productId, prices.serviceKind, prices.capacityLabel],
            targetWhere: isNull(prices.effectiveTo),
            set: {
              unitPrice: price.unitPrice,
              capacityLbs: price.capacityLbs ?? null,
            },
          });
      }
    }

    /* Customers — name is intentionally not unique, so match before inserting. */
    for (const customer of CUSTOMERS) {
      const existing = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.name, customer.name),
            customer.cityProvince
              ? eq(customers.cityProvince, customer.cityProvince)
              : isNull(customers.cityProvince),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await tx.insert(customers).values(customer);
      } else {
        await tx
          .update(customers)
          .set({ ...customer, updatedAt: sql`now()` })
          .where(eq(customers.id, existing[0].id));
      }
    }

    /* Presets */
    for (const preset of PRESETS) {
      await tx
        .insert(quotationPresets)
        .values(preset)
        .onConflictDoUpdate({
          target: quotationPresets.slug,
          set: { ...preset, updatedAt: sql`now()` },
        });
    }
  });

  /* Report */
  const counts = await db.execute<{ label: string; n: number }>(sql`
    SELECT 'products' AS label, count(*)::int AS n FROM products
    UNION ALL SELECT 'product_specs', count(*)::int FROM product_specs
    UNION ALL SELECT 'prices', count(*)::int FROM prices
    UNION ALL SELECT 'customers', count(*)::int FROM customers
    UNION ALL SELECT 'quotation_presets', count(*)::int FROM quotation_presets
    UNION ALL SELECT 'company_profile', count(*)::int FROM company_profile
    ORDER BY label
  `);

  console.log("\n✔ Seed complete\n");
  for (const row of counts.rows) {
    console.log(`  ${row.label.padEnd(18)} ${row.n}`);
  }
  console.log("");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✖ Seed failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
